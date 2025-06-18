const { MENSAJES_SISTEMA } = require("./mensajes-sistema")
const {
  verificarHorario,
  esSpam,
  esMensajeRepetido,
  verificarLimiteMensajes,
  solicitaAtencionHumana,
  quiereVolverAlBot,
  actualizarContexto,
} = require("./utilidades")
const { generarRespuestaIA } = require("./respuestas-ia")
const { TIPOS_MEDIOS, PATRONES_SPAM } = require("./constantes")

// Estado global con gestión de memoria mejorada
const usuariosPausados = new Map()
const almacenContexto = new Map()
const usuariosSolicitanHumano = new Map()
const ultimosMensajesUsuario = new Map()
const tiempoEsperaSpam = new Map()
const contadorMensajesUsuario = new Map()

// Cola de mensajes
let procesandoMensaje = false
const colaMensajes = []
const TAMANO_MAXIMO_COLA = 100
const TIEMPO_ESPERA_MENSAJE = 60000 // 60 segundos

/**
 * Procesa un mensaje de WhatsApp
 * @param {Object} mensaje - Mensaje de WhatsApp
 * @param {Object} clienteWhatsapp - Cliente de WhatsApp
 */
async function procesarMensaje(mensaje, clienteWhatsapp) {
  return new Promise((resolve, reject) => {
    if (colaMensajes.length >= TAMANO_MAXIMO_COLA) {
      colaMensajes.shift() // Eliminar el mensaje más antiguo
    }
    colaMensajes.push({ mensaje, clienteWhatsapp, resolve, reject })
    procesarColaMensajes()
  })
}

/**
 * Procesa la cola de mensajes
 */
async function procesarColaMensajes() {
  if (procesandoMensaje || colaMensajes.length === 0) return

  procesandoMensaje = true
  const { mensaje, clienteWhatsapp, resolve, reject } = colaMensajes.shift()

  try {
    await manejarMensaje(mensaje, clienteWhatsapp)
    resolve()
  } catch (error) {
    console.error("Error procesando mensaje en cola:", error)
    reject(error)
  } finally {
    procesandoMensaje = false
    if (colaMensajes.length > 0) {
      procesarColaMensajes()
    }
  }
}

/**
 * Maneja un mensaje individual
 * @param {Object} mensaje - Mensaje de WhatsApp
 * @param {Object} clienteWhatsapp - Cliente de WhatsApp
 */
async function manejarMensaje(mensaje, clienteWhatsapp) {
  const idContacto = mensaje.from
  const textoMensaje = mensaje.body.toLowerCase()

  // Verificar límite de mensajes
  if (verificarLimiteMensajes(idContacto, contadorMensajesUsuario)) {
    await mensaje.reply(MENSAJES_SISTEMA.LIMITE_MENSAJES)
    return
  }

  // Verificar mensajes repetidos
  if (esMensajeRepetido(idContacto, textoMensaje, ultimosMensajesUsuario)) {
    if (ultimosMensajesUsuario.get(idContacto).count === 0) {
      // Si es el cuarto mensaje repetido
      await mensaje.reply(MENSAJES_SISTEMA.ADVERTENCIA_SPAM)
      tiempoEsperaSpam.set(idContacto, Date.now() + 120000) // 2 minutos de espera
      return
    } else {
      await mensaje.reply(MENSAJES_SISTEMA.MENSAJE_REPETIDO)
      return
    }
  }

  // Verificar si el usuario está en tiempo de espera por spam
  if (tiempoEsperaSpam.has(idContacto)) {
    const finEspera = tiempoEsperaSpam.get(idContacto)
    if (Date.now() < finEspera) {
      return // No responder durante el tiempo de espera
    } else {
      tiempoEsperaSpam.delete(idContacto) // Eliminar el tiempo de espera si ha expirado
    }
  }

  // Verificar si el mensaje es spam
  if (esSpam(mensaje, PATRONES_SPAM)) {
    await mensaje.reply(MENSAJES_SISTEMA.ADVERTENCIA_SPAM)
    tiempoEsperaSpam.set(idContacto, Date.now() + 180000) // 3 minutos de espera
    return
  }

  // Verificar si el usuario está solicitando atención humana
  if (solicitaAtencionHumana(textoMensaje)) {
    // Eliminar restricción de horario: siempre permite atención humana
    await mensaje.reply(MENSAJES_SISTEMA.SOLICITUD_HUMANO)
    usuariosPausados.set(idContacto, true)
    usuariosSolicitanHumano.set(idContacto, true)

    setTimeout(
      () => {
        if (usuariosPausados.get(idContacto)) {
          usuariosPausados.delete(idContacto)
          usuariosSolicitanHumano.delete(idContacto)
          clienteWhatsapp.sendMessage(
            idContacto,
            "El asistente virtual está nuevamente disponible. ¿En qué puedo ayudarte?",
          )
        }
      },
      60 * 60 * 1000,
    ) // 1 hora

    return
  }

  // Verificar si el usuario quiere volver al bot
  if (quiereVolverAlBot(textoMensaje) && usuariosSolicitanHumano.get(idContacto)) {
    usuariosPausados.delete(idContacto)
    usuariosSolicitanHumano.delete(idContacto)
    await mensaje.reply("¡Bienvenido de vuelta! ¿En qué puedo ayudarte?")
    return
  }

  if (usuariosPausados.get(idContacto)) {
    return
  }

  // Verificar si el mensaje contiene medios
  if (mensaje.hasMedia) {
    await manejarMensajeConMedios(mensaje, idContacto, clienteWhatsapp)
    return
  }

  // Mensajes de bienvenida y horario
  try {
    let textoRespuesta

    if (textoMensaje === "hola") {
      textoRespuesta = MENSAJES_SISTEMA.BIENVENIDA
    } else if (textoMensaje === "horario") {
      textoRespuesta = MENSAJES_SISTEMA.HORARIO
    } else if (/web|página web|pagina web/i.test(textoMensaje)) {
      textoRespuesta = MENSAJES_SISTEMA.PAGINA_WEB
    } else {
      textoRespuesta = await generarRespuestaIA(mensaje.body, idContacto, almacenContexto)
    }

    await mensaje.reply(textoRespuesta)
  } catch (error) {
    console.error("Error procesando mensaje:", error)
    await mensaje.reply(MENSAJES_SISTEMA.ERROR)
  }
}

/**
 * Maneja mensajes que contienen medios (imágenes, audio, etc.)
 * @param {Object} mensaje - Mensaje de WhatsApp
 * @param {string} idContacto - ID del contacto
 * @param {Object} clienteWhatsapp - Cliente de WhatsApp
 */
async function manejarMensajeConMedios(mensaje, idContacto, clienteWhatsapp) {
  const tipoMedio = mensaje.type
  let textoRespuesta = MENSAJES_SISTEMA.MEDIO_RECIBIDO

  // Personalizar mensaje según el tipo de medio
  switch (tipoMedio) {
    case TIPOS_MEDIOS.IMAGEN:
      textoRespuesta = `${textoRespuesta}\n\n📸 He notado que has compartido una imagen.`
      break
    case TIPOS_MEDIOS.AUDIO:
      textoRespuesta = `${textoRespuesta}\n\n🎵 He notado que has compartido un mensaje de voz.`
      break
    case TIPOS_MEDIOS.VIDEO:
      textoRespuesta = `${textoRespuesta}\n\n🎥 He notado que has compartido un video.`
      break
    case TIPOS_MEDIOS.DOCUMENTO:
      textoRespuesta = `${textoRespuesta}\n\n📄 He notado que has compartido un documento.`
      break
  }

  try {
    await mensaje.reply(textoRespuesta)
    usuariosPausados.set(idContacto, true)
    usuariosSolicitanHumano.set(idContacto, true)

    // Programar la limpieza después del período de pausa
    setTimeout(
      () => {
        if (usuariosPausados.get(idContacto)) {
          usuariosPausados.delete(idContacto)
          usuariosSolicitanHumano.delete(idContacto)
          clienteWhatsapp.sendMessage(
            idContacto,
            "El asistente virtual está nuevamente disponible. ¿En qué puedo ayudarte?",
          )
        }
      },
      60 * 60 * 1000,
    ) // 1 hora
  } catch (error) {
    console.error("Error manejando mensaje con medios:", error)
    await mensaje.reply(MENSAJES_SISTEMA.ERROR)
  }
}

// Limpieza periódica de datos
setInterval(() => {
  const ahora = Date.now()

  // Limpiar contadores de mensajes antiguos
  for (const [idUsuario, datos] of contadorMensajesUsuario.entries()) {
    if (ahora - datos.timestamp > 60000 * 2) {
      // 2 minutos
      contadorMensajesUsuario.delete(idUsuario)
    }
  }

  // Limpiar mensajes repetidos antiguos
  for (const [idUsuario, datos] of ultimosMensajesUsuario.entries()) {
    if (ahora - datos.timestamp > 60000) {
      // 1 minuto
      ultimosMensajesUsuario.delete(idUsuario)
    }
  }

  // Limpiar tiempos de espera expirados
  for (const [idUsuario, finEspera] of tiempoEsperaSpam.entries()) {
    if (ahora > finEspera) {
      tiempoEsperaSpam.delete(idUsuario)
    }
  }
}, 60000) // Cada minuto

module.exports = {
  procesarMensaje,
  usuariosPausados,
  almacenContexto,
  usuariosSolicitanHumano,
  ultimosMensajesUsuario,
  tiempoEsperaSpam,
  contadorMensajesUsuario,
}
