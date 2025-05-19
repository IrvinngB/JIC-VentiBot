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

// Manejo de errores no capturados
process.on("unhandledRejection", (error) => {
  console.error("Error no manejado:", error)
})

process.on("uncaughtException", (error) => {
  console.error("Excepción no capturada:", error)
})

// Limpieza al cerrar
process.on("SIGINT", async () => {
  console.log("Cerrando aplicación...")
  await clienteWhatsapp.destroy()
  process.exit()
})
