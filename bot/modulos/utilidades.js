const fs = require("fs")
const path = require("path")
const moment = require("moment-timezone")
const { LIMITE_MENSAJES, ZONA_HORARIA_PANAMA } = require("./constantes")

// Variables globales
let ultimoMensaje = Date.now()
const cacheArchivos = new Map()

/**
 * Actualiza la marca de tiempo del último mensaje recibido
 */
function actualizarUltimoMensaje() {
  ultimoMensaje = Date.now()
}

/**
 * Carga un archivo con sistema de caché
 * @param {string} rutaArchivo - Ruta del archivo a cargar
 * @param {string} valorPredeterminado - Valor a devolver si el archivo no existe
 * @returns {string} - Contenido del archivo
 */
function cargarArchivo(rutaArchivo, valorPredeterminado = "") {
  try {
    if (cacheArchivos.has(rutaArchivo)) {
      return cacheArchivos.get(rutaArchivo)
    }

    const rutaCompleta = path.join(__dirname, "..", rutaArchivo)
    if (!fs.existsSync(rutaCompleta)) {
      console.warn(`Archivo no encontrado: ${rutaArchivo}`)
      return valorPredeterminado
    }

    const contenido = fs.readFileSync(rutaCompleta, "utf8")
    cacheArchivos.set(rutaArchivo, contenido)
    return contenido
  } catch (error) {
    console.error(`Error leyendo el archivo ${rutaArchivo}:`, error)
    return valorPredeterminado
  }
}

/**
 * Verifica si la tienda está abierta según el horario
 * @returns {Object} - Estado de la tienda y próxima apertura
 */
function verificarHorario() {
  const horaPanama = moment().tz(ZONA_HORARIA_PANAMA)
  const dia = horaPanama.day()
  const hora = horaPanama.hour()

  const horario = {
    diasLaborables: { inicio: 6, fin: 22 },
    finDeSemana: { inicio: 7, fin: 20 },
  }

  const esDiaLaborable = dia >= 1 && dia <= 5
  const { inicio, fin } = esDiaLaborable ? horario.diasLaborables : horario.finDeSemana

  const abierto = hora >= inicio && hora < fin
  const proximaApertura = abierto
    ? null
    : horaPanama
        .clone()
        .startOf("day")
        .add(esDiaLaborable ? inicio : dia === 6 ? 10 : 9, "hours")

  return {
    abierto,
    proximaApertura,
  }
}

/**
 * Verifica si un mensaje es spam
 * @param {Object} mensaje - Mensaje de WhatsApp
 * @param {Array} patronesSpam - Patrones para detectar spam
 * @returns {boolean} - True si es spam, false en caso contrario
 */
function esSpam(mensaje, patronesSpam) {
  const textoMensaje = mensaje.body.toLowerCase()

  // Verificar patrones de spam
  const contienePatronSpam = patronesSpam.some((patron) => {
    if (patron instanceof RegExp) {
      return patron.test(textoMensaje)
    }
    return textoMensaje.includes(patron)
  })

  // Verificar características sospechosas
  const tieneMultiplesUrls = (textoMensaje.match(/https?:\/\//g) || []).length > 1
  const tieneMultiplesNumerosTelefono = (textoMensaje.match(/\b\d{8,}\b/g) || []).length > 1
  const tieneExcesivaPuntuacion = (textoMensaje.match(/[!?]/g) || []).length > 5

  return contienePatronSpam || tieneMultiplesUrls || tieneMultiplesNumerosTelefono || tieneExcesivaPuntuacion
}

/**
 * Verifica si un mensaje es repetido
 * @param {string} idUsuario - ID del usuario
 * @param {string} mensaje - Texto del mensaje
 * @param {Map} ultimosMensajes - Mapa de últimos mensajes
 * @returns {boolean} - True si es repetido, false en caso contrario
 */
function esMensajeRepetido(idUsuario, mensaje, ultimosMensajes) {
  const ultimoMensaje = ultimosMensajes.get(idUsuario)
  const mensajeActual = mensaje.toLowerCase().trim()

  if (ultimoMensaje && ultimoMensaje.texto === mensajeActual) {
    ultimoMensaje.count++
    if (ultimoMensaje.count >= 4) {
      // Si el usuario envía 4 mensajes iguales
      ultimoMensaje.count = 0 // Reiniciar el contador
      return true // Indicar que se debe aplicar el tiempo de espera
    }
  } else {
    ultimosMensajes.set(idUsuario, {
      texto: mensajeActual,
      count: 1,
      timestamp: Date.now(),
    })
  }

  return false
}

/**
 * Verifica si se ha excedido el límite de mensajes
 * @param {string} idUsuario - ID del usuario
 * @param {Map} contadorMensajes - Mapa de contadores de mensajes
 * @returns {boolean} - True si se excedió el límite, false en caso contrario
 */
function verificarLimiteMensajes(idUsuario, contadorMensajes) {
  const ahora = Date.now()
  const contadorUsuario = contadorMensajes.get(idUsuario) || { count: 0, timestamp: ahora }

  // Limpiar contadores antiguos
  if (ahora - contadorUsuario.timestamp > LIMITE_MENSAJES.VENTANA_MS) {
    contadorUsuario.count = 1
    contadorUsuario.timestamp = ahora
  } else {
    contadorUsuario.count++
  }

  contadorMensajes.set(idUsuario, contadorUsuario)
  return contadorUsuario.count > LIMITE_MENSAJES.MAX_MENSAJES
}

/**
 * Verifica si el usuario está solicitando atención humana
 * @param {string} mensaje - Texto del mensaje
 * @returns {boolean} - True si solicita atención humana, false en caso contrario
 */
function solicitaAtencionHumana(mensaje) {
  const palabrasClaveHumano = ["agente", "persona real", "humano", "representante", "asesor", "hablar con alguien"]
  return palabrasClaveHumano.some((palabra) => mensaje.toLowerCase().includes(palabra))
}

/**
 * Verifica si el usuario quiere volver al bot
 * @param {string} mensaje - Texto del mensaje
 * @returns {boolean} - True si quiere volver al bot, false en caso contrario
 */
function quiereVolverAlBot(mensaje) {
  const palabrasClaveBot = ["volver al bot", "bot", "asistente virtual", "chatbot"]
  return palabrasClaveBot.some((palabra) => mensaje.toLowerCase().includes(palabra))
}

/**
 * Actualiza el contexto de la conversación
 * @param {string} idContacto - ID del contacto
 * @param {string} mensajeUsuario - Mensaje del usuario
 * @param {string} respuestaBot - Respuesta del bot
 * @param {Map} almacenContexto - Almacén de contexto
 */
function actualizarContexto(idContacto, mensajeUsuario, respuestaBot, almacenContexto) {
  const contextoActual = almacenContexto.get(idContacto) || ""
  const nuevoContexto = `${contextoActual.slice(-1000)}\nUsuario: ${mensajeUsuario}\nBot: ${respuestaBot}`.trim()
  almacenContexto.set(idContacto, nuevoContexto)
}

module.exports = {
  actualizarUltimoMensaje,
  cargarArchivo,
  verificarHorario,
  esSpam,
  esMensajeRepetido,
  verificarLimiteMensajes,
  solicitaAtencionHumana,
  quiereVolverAlBot,
  actualizarContexto,
  ultimoMensaje,
}
