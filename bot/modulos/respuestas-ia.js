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
 * Selecciona el dataset relevante para la consulta del usuario usando análisis de palabras clave
 * @param {string} mensajeUsuario - Mensaje del usuario
 * @returns {string} - Tipo de consulta identificada ("productos" o "empresa")
 */
async function seleccionarDatasetRelevante(mensajeUsuario) {
  // Detectamos el tipo de consulta mediante palabras clave
  const texto = mensajeUsuario.toLowerCase();
  
  // Palabras clave relacionadas con productos
  const keywordsProductos = [
    "laptop", "ordenador", "computadora", "computador", "portátil", "notebook",
    "producto", "productos", "catálogo", "catalogo", "inventario", "venta", "compra",
    "stock", "disponible", "disponibilidad", "precio", "costo", "cuánto cuesta",
    "cuanto vale", "gama alta", "gama media", "gama baja", "gamer", "gaming",
    "empresarial", "accesorio", "repuesto", "batería", "teclado", "ram", "memoria",
    "procesador", "oferta", "descuento", "promoción"
  ];
  
  // Palabras clave relacionadas con la empresa
  const keywordsEmpresa = [
    "empresa", "negocio", "tienda", "local", "ubicación", "dirección", "horario",
    "abierto", "cerrado", "atención", "misión", "visión", "historia", "quiénes son",
    "política", "garantía", "devolución", "contacto", "teléfono", "email", "correo",
    "fundación", "página web", "sitio web", "redes sociales", "envío", "entrega",
    "seguridad", "privacidad"
  ];
  
  // Contar coincidencias de cada tipo
  const matchesProductos = keywordsProductos.filter(keyword => texto.includes(keyword)).length;
  const matchesEmpresa = keywordsEmpresa.filter(keyword => texto.includes(keyword)).length;
  
  // Decidir el tipo de consulta basado en coincidencias
  if (matchesProductos > matchesEmpresa) {
    return "productos";
  } else if (matchesEmpresa > matchesProductos) {
    return "empresa";
  } else {
    // Si hay empate o no hay coincidencias, analizar la intención de forma general
    if (
      texto.includes("comprar") || 
      texto.includes("quiero") || 
      texto.includes("busco") ||
      texto.includes("necesito") ||
      texto.includes("tienen") ||
      texto.includes("cuál") ||
      texto.includes("recomiendas")
    ) {
      return "productos";
    } else {
      return "empresa";
    }
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
    const contextoUsuario = almacenContexto.get(idContacto) || ""    // Selección dinámica del dataset relevante
    const tipoConsulta = await seleccionarDatasetRelevante(mensajeUsuario)
    let contextoDataset = ""
    
    // Verificar si parece una búsqueda específica de productos
    const esBusquedaEspecifica = /gama (baja|media|alta)|precio|menos de|más de|cuestan|cuesta|entre \d+ y \d+|barato|económico|gamer|empresarial|repuesto|accesorio/i.test(mensajeUsuario);
    
    if (tipoConsulta === "productos") {
      if (esBusquedaEspecifica) {
        // Intentar obtener productos específicos según la consulta
        const resultadosBusqueda = await buscarProductosEspecificos(mensajeUsuario);
        if (resultadosBusqueda) {
          contextoDataset = resultadosBusqueda;
        } else {
          // Si la búsqueda específica falla, usar el catálogo general
          contextoDataset = await obtenerResumenProductos();
        }
      } else {
        // Para consultas generales sobre productos
        contextoDataset = await obtenerResumenProductos();
      }
    } else {
      contextoDataset = await obtenerInfoEmpresa();
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
    const palabrasClaveCompra = ["comprar", "cotizar", "llevar", "adquirir", "quiero", "precio", "costo", "cuánto cuesta", "disponible", "tienen", "hay", "busco", "necesito"]
    const esIntencionCompra = palabrasClaveCompra.some((palabra) => mensajeUsuario.toLowerCase().includes(palabra))

    // Solo agregar el mensaje de compra si el cliente ha expresado interés en comprar
    if (esIntencionCompra && tipoConsulta === "productos") {
      texto += `\n\n¿Te gustaría comprar este producto? Aquí tienes las opciones disponibles:
            - 🗣️ Hablar con un agente real: Escribe "agente" para conectarte con un representante.
            - 🌐 Comprar en línea: Visita nuestra página web: https://irvin-benitez.software
            - 🏬 Visitar la tienda: Estamos ubicados en La Chorrera. ¡Te esperamos!`
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
    const { supabase } = require('./conexion');
    const { data, error } = await supabase.from('vista_productos').select('*');
    
    if (error) {
      console.error('Error al obtener productos:', error);
      return "No se pudieron obtener los productos en este momento.";
    }
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      return "No hay productos disponibles en este momento.";
    }
    
    // Formatear los datos de productos para el contexto
    let resumenProductos = "CATÁLOGO DE PRODUCTOS:\n\n";
    
    // Agrupar productos por categoría
    const productosPorCategoria = {};
    data.forEach(producto => {
      if (!productosPorCategoria[producto.categoria]) {
        productosPorCategoria[producto.categoria] = [];
      }
      productosPorCategoria[producto.categoria].push(producto);
    });
    
    // Construir el resumen por categorías
    for (const categoria in productosPorCategoria) {
      resumenProductos += `CATEGORÍA: ${categoria}\n`;
      productosPorCategoria[categoria].forEach(producto => {
        resumenProductos += `• ${producto.nombre}: $${producto.precio} (${producto.stock} disponibles) - ${producto.detalle}\n`;
      });
      resumenProductos += "\n";
    }
    
    return resumenProductos;
  } catch (e) {
    console.error("Error consultando productos:", e);
    return "No se pudo obtener información de productos.";
  }
}

/**
 * Obtiene información de la empresa desde un archivo local
 * @returns {Promise<string>} - Resumen de la empresa
 */
async function obtenerInfoEmpresa() {
  try {
    // Leer información desde el archivo info_empresa.txt
    const fs = require("fs");
    const path = require("path");
    const infoEmpresaPath = path.join(__dirname, "..", "info_empresa.txt");
    
    if (fs.existsSync(infoEmpresaPath)) {
      const contenido = fs.readFileSync(infoEmpresaPath, "utf8");
      return contenido;
    } else {
      console.error("Archivo info_empresa.txt no encontrado");
      return "JSElectronics, fundada en 2020 en La Chorrera, Panamá Oeste, se ha destacado en la venta de laptops de diversas marcas y modelos. Horario: Lunes a Viernes: 9:00 AM - 8:00 PM, Sábados y Domingos: 10:00 AM - 6:00 PM.";
    }
  } catch (e) {
    console.error("Error obteniendo información de la empresa:", e);
    return "No se pudo obtener información de la empresa.";
  }
}

/**
 * Busca productos específicos en la base de datos según los criterios del usuario
 * @param {string} mensajeUsuario - Mensaje del usuario con la consulta
 * @returns {Promise<string>} - Resultados de la búsqueda
 */
async function buscarProductosEspecificos(mensajeUsuario) {
  try {
    const texto = mensajeUsuario.toLowerCase();
    
    // Detectar categoría mencionada
    let categoriaFiltro = null;
    const categoriasDisponibles = ['gama baja', 'gama media', 'gama alta', 'gamer', 'empresarial', 'accesorios', 'repuestos'];
    
    for (const cat of categoriasDisponibles) {
      if (texto.includes(cat)) {
        categoriaFiltro = cat;
        break;
      }
    }
    
    // Detectar rango de precios mencionado
    let precioMin = null;
    let precioMax = null;
    
    // Patrones para detectar rangos de precios
    const patronPrecioMax = /menos de (\d+)|máximo (\d+)|maximo (\d+)|no más de (\d+)|no mas de (\d+)|hasta (\d+)/i;
    const patronPrecioMin = /más de (\d+)|mas de (\d+)|mínimo (\d+)|minimo (\d+)|desde (\d+)/i;
    const patronPrecioRango = /entre (\d+) y (\d+)|de (\d+) a (\d+)/i;
    
    const matchPrecioMax = texto.match(patronPrecioMax);
    const matchPrecioMin = texto.match(patronPrecioMin);
    const matchPrecioRango = texto.match(patronPrecioRango);
    
    if (matchPrecioRango) {
      // Extraer del patrón "entre X y Y" o "de X a Y"
      const nums = matchPrecioRango.slice(1).filter(Boolean).map(Number);
      if (nums.length >= 2) {
        precioMin = Math.min(nums[0], nums[1]);
        precioMax = Math.max(nums[0], nums[1]);
      }
    } else {
      // Extraer precio máximo si está presente
      if (matchPrecioMax) {
        precioMax = Number(matchPrecioMax.slice(1).filter(Boolean)[0]);
      }
      // Extraer precio mínimo si está presente
      if (matchPrecioMin) {
        precioMin = Number(matchPrecioMin.slice(1).filter(Boolean)[0]);
      }
    }
      // Buscar productos usando la función buscar_productos de la base de datos
    // Utilizar la función importada del módulo de conexión
    const { supabase } = require("./conexion");
    
    // Llamar a la función en la base de datos
    const { data, error } = await supabase.rpc('buscar_productos', {
      p_termino: null,  // No usamos filtro de término específico
      p_categoria: categoriaFiltro, 
      p_min_precio: precioMin,
      p_max_precio: precioMax
    });
    
    if (error) {
      console.error('Error al buscar productos específicos:', error);
      return null;
    }
    
    if (!data || data.length === 0) {
      return "No encontré productos que coincidan exactamente con esos criterios.";
    }
    
    // Formatear resultados
    let resultado = `Encontré ${data.length} productos que podrían interesarte:\n\n`;
    
    data.forEach(producto => {
      resultado += `• ${producto.nombre}: $${producto.precio} (${producto.stock} disponibles)\n  ${producto.detalle}\n\n`;
    });
    
    return resultado;
  } catch (e) {
    console.error("Error en la búsqueda específica de productos:", e);
    return null;
  }
}

// Agregamos a los exports
module.exports = { generarRespuestaIA, obtenerResumenProductos, obtenerInfoEmpresa, buscarProductosEspecificos }
