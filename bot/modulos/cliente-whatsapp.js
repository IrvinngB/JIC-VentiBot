const { Client } = require("whatsapp-web.js")
const qrcode = require("qrcode")
const { procesarMensaje } = require("./procesador-mensajes")
const { actualizarUltimoMensaje } = require("./utilidades")

/**
 * Inicializa el cliente de WhatsApp con las configuraciones optimizadas
 * @param {SocketIO.Server} io - Instancia de Socket.IO para emitir eventos
 * @returns {Client} Cliente de WhatsApp inicializado
 */
function inicializarCliente(io) {
  // Configurar el cliente de WhatsApp con opciones optimizadas
  const clienteWhatsapp = new Client({
    puppeteer: {
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
        "--disable-gpu",
        "--disable-extensions",
        "--disable-software-rasterizer",
        "--disable-features=site-per-process",
        '--js-flags="--max-old-space-size=512"',
      ],
      headless: "new",
      timeout: 0,
    },
    clientId: "electronics-js-bot",
    restartOnAuthFail: true,
  })

  // Manejadores de eventos de WhatsApp
  clienteWhatsapp.on("qr", (qr) => {
    qrcode
      .toDataURL(qr)
      .then((url) => io.emit("qr", url))
      .catch((err) => console.error("Error generando QR:", err))
  })

  clienteWhatsapp.on("ready", () => {
    console.log("Cliente WhatsApp Web listo")
    io.emit("ready", "Cliente WhatsApp Web listo")
  })

  clienteWhatsapp.on("loading_screen", (percent, message) => {
    console.log("Cargando:", percent, "%", message)
    io.emit("loading", { percent, message })
  })

  // Evento de mensaje con procesamiento
  clienteWhatsapp.on("message", async (mensaje) => {
    try {
      actualizarUltimoMensaje()
      await procesarMensaje(mensaje, clienteWhatsapp)
    } catch (error) {
      console.error("Error procesando mensaje:", error)
    }
  })

  return clienteWhatsapp
}

module.exports = { inicializarCliente }
