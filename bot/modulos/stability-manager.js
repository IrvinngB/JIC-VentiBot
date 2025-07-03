const axios = require("axios")
const URL = require("url").URL
const fs = require("fs").promises
const path = require("path")

/**
 * Clase para gestionar la estabilidad del bot de WhatsApp
 */
class StabilityManager {
  /**
   * Constructor de la clase StabilityManager
   * @param {Object} clienteWhatsapp - Cliente de WhatsApp
   */
  constructor(clienteWhatsapp) {
    this.clienteWhatsapp = clienteWhatsapp
    this.intervaloKeepAlive = null
    this.intentosReconexion = 0
    this.reconectando = false
    this.inicializado = false
    this.fallosPing = 0
    this.enDespliegue = false
    this.timeoutDespliegue = null

    // Constantes optimizadas
    this.MAX_INTENTOS_RECONEXION = 15 // Aumentado para más intentos de reconexión
    this.RETRASO_RECONEXION = 10000 // 10 segundos entre intentos
    this.INTERVALO_PING = 10 * 60 * 1000 // 10 minutos entre pings
    this.INTERVALO_VERIFICACION_SALUD = 5 * 60 * 1000 // 5 minutos entre verificaciones de salud
    this.MAX_SILENCIO = 60 * 60 * 1000 // 1 hora de inactividad antes de reiniciar
    this.MAX_FALLOS_PING = 5 // Aumentado para más tolerancia a fallos
    this.TIMEOUT_DESPLIEGUE = 15 * 60 * 1000 // 15 minutos para despliegues
    this.TIMEOUT_PING = 15000 // 15 segundos de timeout para pings

    this.URL_PING = process.env.APP_URL || "https://jic-ventibot.onrender.com/"

    // Contadores específicos para errores de serialización
    this.erroresSerializacion = 0
    this.ultimoErrorSerializacion = null
    this.MAX_ERRORES_SERIALIZACION = 3 // Máximo de errores antes de reiniciar

    this.verificacionSalud = {
      ultimoPing: Date.now(),
      ultimoMensaje: Date.now(),
      saludable: true,
      estadoConexion: "desconectado",
      estadoDespliegue: "estable",
      metricas: {
        totalReconexiones: 0,
        ultimoReinicio: null,
        tiempoActividad: Date.now(),
        errores: [],
        ultimaConexionExitosa: null,
        intentosDespliegue: 0,
        ultimoTiempoDespliegue: null,
      },
    }

    this.configurarMonitoreoMemoria()
    this.configurarManejadoresEventos()
  }

  /**
   * Maneja el estado de despliegue
   * @param {number} estado - Código de estado HTTP
   * @returns {boolean} - True si es un estado relacionado con despliegue, false en caso contrario
   */
  manejarEstadoDespliegue(estado) {
    if (estado === 502) {
      if (!this.enDespliegue) {
        console.log("Detectado posible despliegue en curso")
        this.enDespliegue = true
        this.verificacionSalud.estadoDespliegue = "en_progreso"
        this.verificacionSalud.metricas.ultimoTiempoDespliegue = Date.now()
        this.verificacionSalud.metricas.intentosDespliegue++

        // Limpiar timeout anterior si existe
        if (this.timeoutDespliegue) {
          clearTimeout(this.timeoutDespliegue)
        }

        // Establecer nuevo timeout para el despliegue
        this.timeoutDespliegue = setTimeout(() => {
          if (this.enDespliegue) {
            console.log("Timeout de despliegue alcanzado, reiniciando servicios")
            this.enDespliegue = false
            this.verificacionSalud.estadoDespliegue = "fallido"
            this.reiniciarServicios()
          }
        }, this.TIMEOUT_DESPLIEGUE)
      }
      return true
    }

    if (this.enDespliegue && estado === 200) {
      console.log("Despliegue completado exitosamente")
      this.enDespliegue = false
      this.verificacionSalud.estadoDespliegue = "estable"
      if (this.timeoutDespliegue) {
        clearTimeout(this.timeoutDespliegue)
        this.timeoutDespliegue = null
      }
      return true
    }

    return false
  }

  /**
   * Configura el monitoreo de memoria
   */
  configurarMonitoreoMemoria() {
    setInterval(
      () => {
        const usado = process.memoryUsage()
        const metricas = {
          rss: `${Math.round(usado.rss / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(usado.heapTotal / 1024 / 1024)}MB`,
          heapUsed: `${Math.round(usado.heapUsed / 1024 / 1024)}MB`,
        }

        if (usado.heapUsed > 500 * 1024 * 1024) {
          // 500MB
          try {
            if (global.gc) {
              global.gc()
              console.log("Garbage collection ejecutado")
            }
          } catch (e) {
            console.log("GC no disponible")
          }
        }

        console.log("Métricas de memoria:", metricas)
      },
      5 * 60 * 1000,
    ) // Cada 5 minutos
  }

  /**
   * Configura los manejadores de eventos para el cliente de WhatsApp
   */
  configurarManejadoresEventos() {
    this.clienteWhatsapp.on("disconnected", async (razon) => {
      console.log("Cliente desconectado:", razon)
      this.verificacionSalud.estadoConexion = "desconectado"
      this.registrarError("desconexion", razon)

      const esDesconexionIntencional = razon === "NAVIGATION" || razon === "LOGOUT"

      if (esDesconexionIntencional) {
        await this.limpiarSesion()
      }

      if (!this.reconectando && !esDesconexionIntencional) {
        this.reconectando = true
        await this.manejarReconexion(razon)
        this.reconectando = false
      }
    })

    this.clienteWhatsapp.on("auth_failure", async (error) => {
      console.log("Error de autenticación:", error)
      this.verificacionSalud.estadoConexion = "fallo_autenticacion"
      this.registrarError("fallo_autenticacion", error)
      await this.limpiarSesion()
      await this.manejarReconexion("FALLO_AUTENTICACION")
    })

    this.clienteWhatsapp.on("ready", () => {
      console.log("Cliente WhatsApp Web listo")
      this.verificacionSalud.estadoConexion = "conectado"
      this.verificacionSalud.metricas.ultimaConexionExitosa = Date.now()
      this.intentosReconexion = 0
      this.fallosPing = 0
      this.inicializado = true
      this.verificacionSalud.saludable = true
      console.log("Bot listo para recibir mensajes") // Verificación adicional
    })

    this.clienteWhatsapp.on("loading_screen", (porcentaje, mensaje) => {
      console.log(`Cargando: ${porcentaje}% - ${mensaje}`)
      this.verificacionSalud.estadoConexion = "cargando"
    })

    this.clienteWhatsapp.on("qr", () => {
      this.verificacionSalud.estadoConexion = "esperando_qr"
    })
  }

  /**
   * Realiza un ping al servidor con reintentos
   */
  async keepAliveConReintento() {
    try {
      const respuesta = await axios.get(this.URL_PING, {
        timeout: this.TIMEOUT_PING,
        validateStatus: (estado) => estado >= 200 && estado < 500,
        headers: {
          "User-Agent": "WhatsAppBot/1.0 HealthCheck",
        },
      })

      console.log("Respuesta del ping:", respuesta.status)

      const esRelacionadoConDespliegue = this.manejarEstadoDespliegue(respuesta.status)

      if (!esRelacionadoConDespliegue) {
        this.verificacionSalud.ultimoPing = Date.now()
        console.log(`Ping exitoso: ${respuesta.status}`)
        this.fallosPing = 0
        this.intentosReconexion = 0
      }
    } catch (error) {
      console.error("Error en ping:", {
        mensaje: error.message,
        url: this.URL_PING,
        codigo: error.code,
        respuesta: error.response?.status,
      })

      if (error.response?.status === 502) {
        this.manejarEstadoDespliegue(502)
        return
      }

      this.fallosPing++

      if (this.fallosPing >= this.MAX_FALLOS_PING) {
        console.log(`Máximo de fallos de ping (${this.MAX_FALLOS_PING}) alcanzado, reiniciando servicios`)
        await this.reiniciarServicios()
        return
      }

      const retrasoBackoff = Math.min(15000 * Math.pow(1.5, this.fallosPing), 180000)

      console.log(`Reintentando ping en ${retrasoBackoff / 1000}s...`)
      setTimeout(() => this.keepAliveConReintento(), retrasoBackoff)
    }
  }

  /**
   * Maneja la reconexión del cliente de WhatsApp
   * @param {string} razon - Razón de la desconexión
   */
  async manejarReconexion(razon) {
    if (this.intentosReconexion >= this.MAX_INTENTOS_RECONEXION) {
      console.error("Máximo número de intentos de reconexión alcanzado")
      this.verificacionSalud.metricas.ultimoReinicio = Date.now()
      this.verificacionSalud.saludable = false

      await this.limpiarAntesDeTerminar()
      process.exit(1)
      return
    }

    this.intentosReconexion++
    this.verificacionSalud.metricas.totalReconexiones++

    const retrasoBase = this.RETRASO_RECONEXION * Math.pow(1.5, this.intentosReconexion - 1)
    const jitter = Math.random() * 1000
    const retraso = Math.min(retrasoBase + jitter, 300000)

    console.log(
      `Intento de reconexión ${this.intentosReconexion}/${this.MAX_INTENTOS_RECONEXION} en ${retraso / 1000}s...`,
    )

    await new Promise((resolve) => setTimeout(resolve, retraso))

    try {
      if (razon === "FALLO_AUTENTICACION" || this.intentosReconexion > 3) {
        await this.limpiarSesion()
      }

      if (this.inicializado) {
        await this.clienteWhatsapp.destroy()
        await new Promise((resolve) => setTimeout(resolve, 5000))
      }

      await this.clienteWhatsapp.initialize()

      // Verificar que el bot esté listo para recibir mensajes
      if (this.clienteWhatsapp.getState() === "CONNECTED") {
        console.log("Bot conectado y listo para recibir mensajes")
      } else {
        console.error("El bot no se conectó correctamente después del reinicio")
        await this.manejarReconexion("FALLO_REINICIO")
      }
    } catch (error) {
      console.error("Error en la reconexión:", error)
      this.registrarError("reconexion", error)

      if (error.message.includes("ERR_FAILED") || error.message.includes("timeout")) {
        await this.limpiarSesion()
      }

      await this.manejarReconexion(razon)
    }
  }

  /**
   * Limpia la sesión de WhatsApp
   */
  async limpiarSesion() {
    const rutaSesion = path.join(process.cwd(), ".wwebjs_auth/session-client")

    try {
      await fs.rm(rutaSesion, { recursive: true, force: true })
      console.log("Sesión eliminada correctamente")
      await new Promise((resolve) => setTimeout(resolve, 2000))
    } catch (error) {
      console.error("Error eliminando sesión:", error)
      this.registrarError("limpieza_sesion", error)
    }
  }

  /**
   * Registra un error en las métricas
   * @param {string} tipo - Tipo de error
   * @param {Error|string} error - Error ocurrido
   */
  registrarError(tipo, error) {
    const registroError = {
      tipo,
      timestamp: new Date().toISOString(),
      mensaje: error.toString(),
      stack: error.stack,
      estadoDespliegue: this.verificacionSalud.estadoDespliegue,
    }

    this.verificacionSalud.metricas.errores.push(registroError)

    if (this.verificacionSalud.metricas.errores.length > 50) {
      this.verificacionSalud.metricas.errores.shift()
    }
  }

  /**
   * Actualiza el estado de salud del sistema
   */
  actualizarSalud() {
    const ahora = Date.now()

    const ultimaActividadDelta = Math.min(
      ahora - this.verificacionSalud.ultimoPing,
      ahora - this.verificacionSalud.ultimoMensaje,
    )

    this.verificacionSalud.saludable =
      ultimaActividadDelta < this.MAX_SILENCIO &&
      this.verificacionSalud.estadoConexion === "conectado" &&
      this.verificacionSalud.estadoDespliegue === "estable"

    this.verificacionSalud.metricas.tiempoActividad = ahora - this.verificacionSalud.metricas.tiempoActividad

    if (!this.verificacionSalud.saludable && !this.reconectando && !this.enDespliegue) {
      console.warn("Sistema posiblemente inactivo, reiniciando servicios...")
      this.reiniciarServicios()
    }
  }

  /**
   * Reinicia los servicios del sistema
   */
  async reiniciarServicios() {
    if (this.reconectando || this.enDespliegue) {
      console.log("Ya hay una reconexión o despliegue en progreso, saltando reinicio de servicios")
      return
    }

    try {
      this.reconectando = true
      this.verificacionSalud.metricas.ultimoReinicio = Date.now()

      await this.limpiarAntesDeTerminar()

      await new Promise((resolve) => setTimeout(resolve, 10000)) // Aumenta el retraso a 10 segundos

      this.iniciarKeepAlive()
      await this.clienteWhatsapp.initialize()

      // Verificar que el bot esté listo para recibir mensajes
      if (this.clienteWhatsapp.getState() === "CONNECTED") {
        console.log("Bot conectado y listo para recibir mensajes")
      } else {
        console.error("El bot no se conectó correctamente después del reinicio")
        await this.manejarReconexion("FALLO_REINICIO")
      }

      this.reconectando = false
      console.log("Servicios reiniciados exitosamente")
    } catch (error) {
      console.error("Error reiniciando servicios:", error)
      this.registrarError("reinicio_servicios", error)
      process.exit(1)
    }
  }

  /**
   * Limpia recursos antes de terminar la aplicación
   */
  async limpiarAntesDeTerminar() {
    try {
      if (this.intervaloKeepAlive) clearInterval(this.intervaloKeepAlive)
      if (this.timeoutDespliegue) clearTimeout(this.timeoutDespliegue)

      await this.clienteWhatsapp.destroy()
      await this.limpiarSesion()

      console.log("Limpieza completada antes de salir")
    } catch (error) {
      console.error("Error en limpieza:", error)
    }
  }

  /**
   * Inicia el sistema de keep-alive
   */
  iniciarKeepAlive() {
    if (this.intervaloKeepAlive) {
      clearInterval(this.intervaloKeepAlive)
    }

    this.keepAliveConReintento()
    this.intervaloKeepAlive = setInterval(() => this.keepAliveConReintento(), this.INTERVALO_PING)
    console.log("Sistema keepAlive iniciado")
  }

  /**
   * Configura el endpoint de salud para la aplicación Express
   * @param {Object} app - Aplicación Express
   */
  configurarEndpointSalud(app) {
    app.get("/health", (req, res) => {
      const salud = {
        estado: this.verificacionSalud.saludable ? "saludable" : "no_saludable",
        ultimoPing: new Date(this.verificacionSalud.ultimoPing).toISOString(),
        ultimoMensaje: new Date(this.verificacionSalud.ultimoMensaje).toISOString(),
        estadoConexion: this.verificacionSalud.estadoConexion,
        estadoDespliegue: this.verificacionSalud.estadoDespliegue,
        metricas: {
          ...this.verificacionSalud.metricas,
          tiempoActividad: `${Math.floor(this.verificacionSalud.metricas.tiempoActividad / 1000 / 60)} minutos`,
          intentosReconexion: this.intentosReconexion,
          fallosPing: this.fallosPing,
          memoria: process.memoryUsage(),
        },
      }

      res.json(salud)
    })

    app.post("/gc", (req, res) => {
      try {
        if (global.gc) {
          global.gc()
          res.json({ exito: true, mensaje: "Garbage collection ejecutado" })
        } else {
          res.status(400).json({
            exito: false,
            mensaje: "GC no disponible. Ejecute Node.js con --expose-gc",
          })
        }
      } catch (error) {
        res.status(500).json({ exito: false, error: error.message })
      }
    })
  }

  /**
   * Actualiza la marca de tiempo del último mensaje
   */
  updateLastMessage() {
    this.verificacionSalud.ultimoMensaje = Date.now()
  }

  /**
   * Inicia el sistema de estabilidad
   * @param {Object} app - Aplicación Express
   */
  async startStabilitySystem(app) {
    this.configurarEndpointSalud(app)
    this.iniciarKeepAlive()

    try {
      await this.clienteWhatsapp.initialize()
    } catch (error) {
      console.error("Error en la inicialización inicial:", error)
      this.registrarError("inicio_inicial", error)
      await this.manejarReconexion("FALLO_INICIAL")
    }

    setInterval(() => this.actualizarSalud(), this.INTERVALO_VERIFICACION_SALUD)

    // Manejo de señales de terminación
    process.on("SIGTERM", async () => {
      console.log("Recibida señal SIGTERM")
      await this.limpiarAntesDeTerminar()
      process.exit(0)
    })

    process.on("SIGINT", async () => {
      console.log("Recibida señal SIGINT")
      await this.limpiarAntesDeTerminar()
      process.exit(0)
    })

    // Manejo de errores no capturados
    process.on("unhandledRejection", (error) => {
      console.error("Promesa rechazada no manejada:", error)
      this.registrarError("rechazo_no_manejado", error)
      if (!this.reconectando && !this.enDespliegue) {
        this.reiniciarServicios()
      }
    })

    process.on("uncaughtException", (error) => {
      console.error("Excepción no capturada:", error)
      this.registrarError("excepcion_no_capturada", error)
      if (!this.reconectando && !this.enDespliegue) {
        this.reiniciarServicios()
      }
    })
  }

  /**
   * Maneja errores específicos de serialización
   * @param {Error} error - El error de serialización
   * @returns {boolean} True si se debe reiniciar el cliente
   */
  manejarErrorSerializacion(error) {
    this.erroresSerializacion++
    this.ultimoErrorSerializacion = Date.now()
    
    console.log(`⚠️ Error de serialización detectado (${this.erroresSerializacion}/${this.MAX_ERRORES_SERIALIZACION}):`, error.message)
    
    this.registrarError("serializacion", {
      mensaje: error.message,
      timestamp: Date.now(),
      contador: this.erroresSerializacion
    })

    // Si hemos tenido demasiados errores de serialización, reiniciar
    if (this.erroresSerializacion >= this.MAX_ERRORES_SERIALIZACION) {
      console.log("🔄 Demasiados errores de serialización, reiniciando cliente...")
      this.erroresSerializacion = 0
      return true
    }

    return false
  }

  /**
   * Resetea los contadores de errores de serialización
   */
  resetearContadoresSerializacion() {
    this.erroresSerializacion = 0
    this.ultimoErrorSerializacion = null
    console.log("✅ Contadores de serialización reseteados")
  }
}

module.exports = StabilityManager
