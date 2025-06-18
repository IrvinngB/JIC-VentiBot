require("dotenv").config()
const express = require("express")
const http = require("http")
const socketIo = require("socket.io")
const path = require("path")
const { inicializarCliente } = require("./modulos/cliente-whatsapp")
const { configurarRutas } = require("./modulos/rutas")
const StabilityManager = require("./modulos/stability-manager")

// Puerto de la aplicación
const PUERTO = process.env.PORT || 3000

// Inicializar Express y Socket.IO
const app = express()
const servidor = http.createServer(app)
const io = socketIo(servidor, {
  pingTimeout: 60000,
  pingInterval: 25000,
})

// Configuración de Express
app.use(express.static(path.join(__dirname, "web")))
app.use(express.json())

// Inicializar el cliente de WhatsApp
const clienteWhatsapp = inicializarCliente(io)

// Inicializar el administrador de estabilidad
const administradorEstabilidad = new StabilityManager(clienteWhatsapp)

// Configurar rutas de la aplicación
configurarRutas(app, path)

// Iniciar el sistema de estabilidad
administradorEstabilidad.startStabilitySystem(app)

// Iniciar servidor con manejo de errores
servidor.listen(PUERTO, () => {
  console.log(`Servidor ejecutándose en http://localhost:${PUERTO}`)
})

// --- Panel de administración: métricas y logs en tiempo real ---
const os = require('os')
let actividadReciente = '-'

function getMetrics() {
  const mem = process.memoryUsage()
  return {
    status: clienteWhatsapp && clienteWhatsapp.info ? clienteWhatsapp.info.connection : '-',
    memory: `${(mem.rss / 1024 / 1024).toFixed(1)} MB`,
    activity: actividadReciente,
  }
}

// Emitir métricas periódicamente
setInterval(() => {
  io.emit('metrics', getMetrics())
}, 5000)

// Función para emitir logs
function emitirLog(msg) {
  io.emit('log', `[${new Date().toLocaleTimeString()}] ${msg}`)
  actividadReciente = msg
}

// Ejemplo: log de inicio
emitirLog('Bot iniciado')

// Escuchar logs importantes del sistema
process.on('unhandledRejection', (error) => {
  console.error('Error no manejado:', error)
  emitirLog('Error no manejado: ' + error.message)
})

process.on('uncaughtException', (error) => {
  console.error('Excepción no capturada:', error)
  emitirLog('Excepción no capturada: ' + error.message)
})

// Limpieza al cerrar
process.on("SIGINT", async () => {
  console.log("Cerrando aplicación...")
  await clienteWhatsapp.destroy()
  process.exit()
})
