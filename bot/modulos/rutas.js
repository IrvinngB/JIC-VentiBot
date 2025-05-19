/**
 * Configura las rutas de Express para la aplicación
 * @param {Object} app - Aplicación Express
 * @param {Object} path - Módulo path de Node.js
 */
function configurarRutas(app, path) {
  // Ruta principal
  app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "web", "index.html"))
  })

  // Ruta de ping para mantener vivo el servicio
  app.get("/ping", (req, res) => {
    res.status(200).send("pong")
  })

  // Ruta para verificar el estado del bot
  app.get("/status", (req, res) => {
    const { ultimoMensaje } = require("./utilidades")
    const ahora = Date.now()
    const tiempoDesdeUltimoMensaje = ahora - ultimoMensaje

    res.json({
      estado: "activo",
      ultimoMensaje: new Date(ultimoMensaje).toISOString(),
      tiempoInactivo: `${Math.floor(tiempoDesdeUltimoMensaje / 1000 / 60)} minutos`,
      memoria: process.memoryUsage(),
    })
  })
}

module.exports = { configurarRutas }
