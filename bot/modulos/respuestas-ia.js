const { GoogleGenerativeAI } = require("@google/generative-ai")
const { MENSAJES_SISTEMA } = require("./mensajes-sistema")
const { query } = require("./conexion")

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
  // Ahora solo detecta el tipo de consulta
  const texto = mensajeUsuario.toLowerCase()
  if (texto.includes("laptop") || texto.includes("producto") || texto.includes("stock") || texto.includes("precio")) {
    return "productos"
  }
  if (texto.includes("empresa") || texto.includes("mision") || texto.includes("vision") || texto.includes("horario") || texto.includes("politica")) {
    return "empresa"
  }
  // Por defecto, info empresa
  return "empresa"
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
    const tipoConsulta = await seleccionarDatasetRelevante(mensajeUsuario)
    let contextoDataset = ""
    if (tipoConsulta === "productos") {
      contextoDataset = await obtenerResumenProductos()
    } else {
      contextoDataset = await obtenerInfoEmpresa()
    }

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

/**
 * Obtiene información de productos desde la base de datos
 * @returns {Promise<string>} - Resumen de productos
 */
async function obtenerResumenProductos() {
  try {
    const res = await query('vista_productos_detalle');
    if (!res.data || !Array.isArray(res.data) || !res.data.length) return "No hay productos disponibles actualmente.";
    return res.data.map(p => `• ${p.nombre_producto} (${p.categoria}, ${p.marca})\n  ${p.descripcion}\n  Precio: $${p.precio} | Stock: ${p.stock}`).join("\n\n");
  } catch (e) {
    console.error("Error consultando productos:", e);
    return "No se pudo obtener información de productos.";
  }
}

/**
 * Obtiene información de la empresa desde la base de datos (puedes crear una vista o tabla para esto)
 * @returns {Promise<string>} - Resumen de la empresa
 */
async function obtenerInfoEmpresa() {
  try {
    const res = await query('info_empresa');
    if (!res.data || !Array.isArray(res.data) || !res.data.length) return "No hay información de la empresa disponible.";
    return res.data[0].resumen;
  } catch (e) {
    console.error("Error consultando info empresa:", e);
    return "No se pudo obtener información de la empresa.";
  }
}

module.exports = { generarRespuestaIA, obtenerResumenProductos, obtenerInfoEmpresa }
