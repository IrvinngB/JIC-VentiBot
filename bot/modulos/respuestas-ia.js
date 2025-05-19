const { GoogleGenerativeAI } = require("@google/generative-ai")
const { cargarArchivo } = require("./utilidades")
const { MENSAJES_SISTEMA } = require("./mensajes-sistema")

// Verificación de variables de entorno
if (!process.env.GEMINI_API_KEY) {
  throw new Error("La variable de entorno GEMINI_API_KEY no está configurada.")
}

// Inicializar Google Generative AI con manejo de errores
let genAI
try {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
} catch (error) {
  console.error("Error inicializando Google Generative AI:", error)
  process.exit(1)
}

// Constantes
const MAX_REINTENTOS = 3
const TIEMPO_ESPERA_MENSAJE = 60000 // 60 segundos

/**
 * Selecciona el dataset relevante para la consulta del usuario usando IA
 * @param {string} mensajeUsuario - Mensaje del usuario
 * @returns {string} - Nombre del archivo de dataset seleccionado
 */
async function seleccionarDatasetRelevante(mensajeUsuario) {
  const modelo = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
  // Descripciones breves de cada dataset
  const datasets = [
    {
      name: "Laptops1.txt",
      description: "Listado de laptops, componentes, accesorios y servicios disponibles en ElectronicsJS.",
    },
    {
      name: "info_empresa.txt",
      description: "Información sobre la empresa, misión, visión, políticas, horarios y contacto.",
    },
  ]
  const listaDatasets = datasets.map((ds) => `- ${ds.name}: ${ds.description}`).join("\n")
  const promptSeleccion = `Tengo los siguientes datasets de información para responder preguntas de clientes.\n${listaDatasets}\n\n¿Según la siguiente consulta de usuario, cuál dataset es el más relevante para responder?\nConsulta: \"${mensajeUsuario}\"\n\nResponde solo el nombre del archivo más relevante, sin explicación extra.`
  try {
    const resultado = await modelo.generateContent(promptSeleccion)
    const texto = resultado.response.text().toLowerCase()
    if (texto.includes("laptops1")) return "Laptops1.txt"
    if (texto.includes("info_empresa")) return "info_empresa.txt"
    // fallback
    return "info_empresa.txt"
  } catch (e) {
    console.error("Error seleccionando dataset relevante con IA:", e)
    return "info_empresa.txt"
  }
}

/**
 * Genera una respuesta usando IA
 * @param {string} mensajeUsuario - Mensaje del usuario
 * @param {string} idContacto - ID del contacto
 * @param {Map} almacenContexto - Almacén de contexto de conversaciones
 * @param {number} intentos - Número de intentos realizados
 * @returns {string} - Respuesta generada
 */
async function generarRespuestaIA(mensajeUsuario, idContacto, almacenContexto, intentos = 0) {
  const modelo = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

  try {
    const contextoUsuario = almacenContexto.get(idContacto) || ""

    // Selección dinámica del dataset relevante
    const archivoDatasetRelevante = await seleccionarDatasetRelevante(mensajeUsuario)
    const contextoDataset = cargarArchivo(archivoDatasetRelevante)

    const promptPersonalizado = `
        Eres un asistente virtual llamado Electra amigable y profesional de ElectronicsJS. Tu objetivo es proporcionar la mejor atención posible siguiendo estas pautas:
        \nCONTEXTO RELEVANTE:\n${contextoDataset}
        \nHistorial del usuario: ${contextoUsuario}
        \nRESPONDE A: \"${mensajeUsuario}\"\n
        FORMATO DE RESPUESTA:
        - Mantén las respuestas concisas (máximo 4-5 líneas)
        - Usa viñetas para listas largas
        - Incluye emojis relevantes ocasionalmente`

    const resultado = await Promise.race([
      modelo.generateContent(promptPersonalizado),
      new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), TIEMPO_ESPERA_MENSAJE)),
    ])

    let texto = resultado.response.text()

    // Verificar si el cliente ha expresado interés en comprar o cotizar
    const palabrasClaveCompra = ["comprar", "cotizar", "llevar", "adquirir", "quiero comprar", "precio", "costo"]
    const esIntencionCompra = palabrasClaveCompra.some((palabra) => mensajeUsuario.toLowerCase().includes(palabra))

    // Solo agregar el mensaje de compra si el cliente ha expresado interés en comprar
    if (esIntencionCompra) {
      texto += `\n\n¿Te gustaría comprar esta laptop? Aquí tienes las opciones disponibles:
            - 🗣️ Hablar con un agente real: Escribe "agente" para conectarte con un representante.
            - 🌐 Comprar en línea: Visita nuestra página web: https://irvin-benitez.software
            - 🏬 Visitar la tienda: Estamos ubicados en La chorrera. ¡Te esperamos!`
    }

    // Actualizar contexto con límite de memoria
    const nuevoContexto = `${contextoUsuario.slice(-1000)}\nUsuario: ${mensajeUsuario}\nBot: ${texto}`.trim()
    almacenContexto.set(idContacto, nuevoContexto)

    return texto
  } catch (error) {
    console.error("Error generando la respuesta:", error)

    if (error.message === "TIMEOUT" && intentos < MAX_REINTENTOS) {
      console.log(`Reintentando generación de respuesta (${intentos + 1}/${MAX_REINTENTOS})...`)
      return generarRespuestaIA(mensajeUsuario, idContacto, almacenContexto, intentos + 1)
    }

    return MENSAJES_SISTEMA.ERROR
  }
}

module.exports = { generarRespuestaIA }
