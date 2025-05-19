/**
 * Tipos de medios que pueden ser enviados por WhatsApp
 */
const TIPOS_MEDIOS = {
  IMAGEN: "image",
  VIDEO: "video",
  AUDIO: "audio",
  DOCUMENTO: "document",
  STICKER: "sticker",
}

/**
 * Patrones para detectar spam en mensajes
 */
const PATRONES_SPAM = [
  "spam",
  "publicidad",
  "promo",
  "gana dinero",
  "investment",
  "casino",
  "lottery",
  "premio",
  "ganaste",
  "bitcoin",
  "crypto",
  "prestamo",
  "loan",
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/, // Patrón de email
  /(?:https?:\/\/)?(?:[\w-]+\.)+[a-zA-Z]{2,}(?:\/[^\s]*)?/, // Patrón de URL
]

/**
 * Configuración de límite de mensajes
 */
const LIMITE_MENSAJES = {
  VENTANA_MS: 60000, // 1 minuto
  MAX_MENSAJES: 10, // máximo 10 mensajes por minuto
}

/**
 * Zona horaria de Panamá
 */
const ZONA_HORARIA_PANAMA = "America/Panama"

/**
 * Duración de pausa para usuarios
 */
const DURACION_PAUSA = 60 * 60 * 1000 // 1 hora

module.exports = {
  TIPOS_MEDIOS,
  PATRONES_SPAM,
  LIMITE_MENSAJES,
  ZONA_HORARIA_PANAMA,
  DURACION_PAUSA,
}
