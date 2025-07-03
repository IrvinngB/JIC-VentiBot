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

// Variable para el stability manager (se inicializará externamente)
let stabilityManager = null

/**
 * Configura el stability manager
 * @param {Object} manager - Instancia del StabilityManager
 */
function configurarStabilityManager(manager) {
  stabilityManager = manager
}

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
 * Verifica si el cliente de WhatsApp está en un estado válido
 * @param {Object} clienteWhatsapp - Cliente de WhatsApp
 * @returns {boolean} True si el cliente está listo
 */
function verificarEstadoCliente(clienteWhatsapp) {
  try {
    // Verificaciones básicas
    if (!clienteWhatsapp) {
      console.log("❌ Cliente es null o undefined")
      return false
    }

    // Verificar que el cliente esté inicializado
    if (!clienteWhatsapp.pupPage) {
      console.log("❌ Página de Puppeteer no disponible")
      return false
    }

    // Verificar que la página no esté cerrada
    if (clienteWhatsapp.pupPage.isClosed()) {
      console.log("❌ Página de Puppeteer está cerrada")
      return false
    }

    // Verificar información del cliente
    if (!clienteWhatsapp.info || !clienteWhatsapp.info.wid) {
      console.log("❌ Información del cliente no disponible")
      return false
    }

    // Si llegamos aquí, el cliente parece estar en buen estado
    return true
  } catch (error) {
    console.error("❌ Error verificando estado del cliente:", error.message)
    return false
  }
}

/**
 * Envía un mensaje de forma segura con reintentos
 * @param {Object} mensaje - Mensaje de WhatsApp
 * @param {string} textoRespuesta - Texto a enviar
 * @param {Object} clienteWhatsapp - Cliente de WhatsApp
 * @param {number} intentos - Número de intentos (máximo 3)
 */
async function enviarMensajeSeguro(mensaje, textoRespuesta, clienteWhatsapp, intentos = 0) {
  const MAX_INTENTOS = 3

  try {
    // Verificar estado del cliente antes de enviar
    if (!verificarEstadoCliente(clienteWhatsapp)) {
      throw new Error("Cliente de WhatsApp no está en estado válido")
    }

    await mensaje.reply(textoRespuesta)
    console.log("✅ Mensaje enviado correctamente")
  } catch (error) {
    console.error(`❌ Error enviando mensaje (intento ${intentos + 1}/${MAX_INTENTOS}):`, error.message)

    // Si es un error de serialización, notificar al stability manager
    if (error.message.includes("serialize") || error.message.includes("getMessageModel")) {
      if (stabilityManager) {
        stabilityManager.manejarErrorSerializacion(error)
      }
    }

    // Si es un error de serialización o conexión y tenemos intentos restantes
    if (
      intentos < MAX_INTENTOS - 1 &&
      (error.message.includes("serialize") ||
        error.message.includes("getMessageModel") ||
        error.message.includes("Protocol error") ||
        error.message.includes("Target closed"))
    ) {
      console.log(`🔄 Reintentando envío en 2 segundos...`)
      await new Promise((resolve) => setTimeout(resolve, 2000))
      return await enviarMensajeSeguro(mensaje, textoRespuesta, clienteWhatsapp, intentos + 1)
    }

    // Si agotamos los intentos o es otro tipo de error
    throw error
  }
}

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
    
    // Resetear contadores de errores si el mensaje se procesó exitosamente
    if (stabilityManager) {
      stabilityManager.resetearContadoresSerializacion()
    }
    
    resolve()
  } catch (error) {
    console.error("Error procesando mensaje en cola:", error)

    // Si es un error de serialización, usar el stability manager
    if (error.message.includes("serialize") || error.message.includes("getMessageModel")) {
      console.log("⚠️ Error de serialización detectado, puede que la sesión esté desconectada")
      
      if (stabilityManager) {
        const debeReiniciar = stabilityManager.manejarErrorSerializacion(error)
        if (debeReiniciar) {
          console.log("🔄 Iniciando proceso de reinicio del cliente...")
          // El stability manager manejará el reinicio
        }
      }
    }

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
    await enviarMensajeSeguro(mensaje, MENSAJES_SISTEMA.ADVERTENCIA_SPAM, clienteWhatsapp)
    tiempoEsperaSpam.set(idContacto, Date.now() + 180000) // 3 minutos de espera
    return
  }

  // Verificar si el usuario está solicitando atención humana
  if (solicitaAtencionHumana(textoMensaje)) {
    const estadoTienda = verificarHorario()
    if (!estadoTienda.abierto) {
      await enviarMensajeSeguro(
        mensaje,
        "Lo siento, fuera del horario de atención no podemos conectarte con un agente. Por favor, intenta durante nuestro horario de atención.",
        clienteWhatsapp
      )
      return
    }

    await enviarMensajeSeguro(mensaje, MENSAJES_SISTEMA.SOLICITUD_HUMANO, clienteWhatsapp)
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
    await enviarMensajeSeguro(mensaje, "¡Bienvenido de vuelta! ¿En qué puedo ayudarte?", clienteWhatsapp)
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
    const estadoTienda = verificarHorario()
    let textoRespuesta

    if (textoMensaje === "hola") {
      textoRespuesta = MENSAJES_SISTEMA.BIENVENIDA
    } else if (textoMensaje === "horario") {
      textoRespuesta = MENSAJES_SISTEMA.HORARIO
    } else if (/web|página web|pagina web/i.test(textoMensaje)) {
      textoRespuesta = MENSAJES_SISTEMA.PAGINA_WEB
    } else if (estadoTienda.abierto) {
      textoRespuesta = await generarRespuestaIA(mensaje.body, idContacto, almacenContexto)
    } else {
      textoRespuesta = `🕒 Nuestra tienda está cerrada en este momento. El horario de atención es de Lunes a Viernes de 6:00 AM a 10:00 PM y Sábados y Domingos de 7:00 AM a 8:00 PM (Hora de Panamá).\n\n🌐 Visita nuestra web: https://irvin-benitez.software`
    }

    await enviarMensajeSeguro(mensaje, textoRespuesta, clienteWhatsapp)
  } catch (error) {
    console.error("Error procesando mensaje:", error)
    
    // Manejo específico para errores de serialización
    if (error.message.includes('serialize') || error.message.includes('getMessageModel')) {
      console.log("⚠️ Error de conexión con WhatsApp Web detectado")
      // Intentar enviar mensaje de error de forma segura
      try {
        await enviarMensajeSeguro(mensaje, MENSAJES_SISTEMA.ERROR, clienteWhatsapp)
      } catch (errorSecundario) {
        console.error("No se pudo enviar mensaje de error:", errorSecundario.message)
      }
    } else {
      await enviarMensajeSeguro(mensaje, MENSAJES_SISTEMA.ERROR, clienteWhatsapp)
    }
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
    await enviarMensajeSeguro(mensaje, textoRespuesta, clienteWhatsapp)
    usuariosPausados.set(idContacto, true)
    usuariosSolicitanHumano.set(idContacto, true)

    // Programar la limpieza después del período de pausa
    setTimeout(
      () => {
        if (usuariosPausados.get(idContacto)) {
          usuariosPausados.delete(idContacto)
          usuariosSolicitanHumano.delete(idContacto)
          // Usar envío seguro para el mensaje automático también
          enviarMensajeSeguro(
            { from: idContacto, reply: (texto) => clienteWhatsapp.sendMessage(idContacto, texto) },
            "El asistente virtual está nuevamente disponible. ¿En qué puedo ayudarte?",
            clienteWhatsapp
          ).catch(err => console.error("Error enviando mensaje de reactivación:", err))
        }
      },
      60 * 60 * 1000,
    ) // 1 hora
  } catch (error) {
    console.error("Error manejando mensaje con medios:", error)
    await enviarMensajeSeguro(mensaje, MENSAJES_SISTEMA.ERROR, clienteWhatsapp)
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
  configurarStabilityManager,
}
