require('dotenv').config();

const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');
const StabilityManager = require('./stability');

// Manejo de memoria optimizado
let used = process.memoryUsage();
console.log('Uso de memoria inicial:', {
    rss: `${Math.round(used.rss / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)}MB`
});

// Control de estado global
let isProcessingMessage = false;
let messageQueue = [];
const MAX_QUEUE_SIZE = 100;
const MESSAGE_TIMEOUT = 30000; // 30 segundos

// Constantes y configuración
const PANAMA_TIMEZONE = "America/Panama";
const PORT = process.env.PORT || 3000;
const PAUSE_DURATION = 60 * 60 * 1000;
const MAX_RETRIES = 3;

// Estado global con gestión de memoria mejorada
const pausedUsers = new Map();
const contextStore = new Map();
const userRequestsHuman = new Map();

// Verificación de variables de entorno
if (!process.env.GEMINI_API_KEY) {
    throw new Error('La variable de entorno GEMINI_API_KEY no está configurada.');
}

// Inicializar Google Generative AI con manejo de errores
let genAI;
try {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
} catch (error) {
    console.error('Error inicializando Google Generative AI:', error);
    process.exit(1);
}

// Función mejorada para cargar archivos con caché
const fileCache = new Map();
function loadFile(filePath, defaultValue = '') {
    try {
        if (fileCache.has(filePath)) {
            return fileCache.get(filePath);
        }

        const fullPath = path.join(__dirname, filePath);
        if (!fs.existsSync(fullPath)) {
            console.warn(`Archivo no encontrado: ${filePath}`);
            return defaultValue;
        }

        const content = fs.readFileSync(fullPath, 'utf8');
        fileCache.set(filePath, content);
        return content;
    } catch (error) {
        console.error(`Error leyendo el archivo ${filePath}:`, error);
        return defaultValue;
    }
}

// Cargar información desde archivos con manejo de errores
let laptops, companyInfo, promptInstructions;
try {
    laptops = loadFile('Laptops1.txt');
    companyInfo = loadFile('info_empresa.txt');
    promptInstructions = loadFile('promt.txt');
} catch (error) {
    console.error('Error cargando archivos de configuración:', error);
    process.exit(1);
}

// Sistema de mensajes mejorado
const SYSTEM_MESSAGES = {
    WELCOME: `¡Hola! 👋 Soy el asistente virtual de ElectronicsJS. Estoy aquí para ayudarte con información sobre nuestros productos y servicios. 

Si en cualquier momento deseas hablar con un representante humano, puedes escribir "agente" o "hablar con persona real".

¿En qué puedo ayudarte hoy?`,
    
    HUMAN_REQUEST: `Entiendo que prefieres hablar con un representante humano. Voy a conectarte con uno de nuestros agentes.

⏳ Por favor, ten en cuenta que puede haber un tiempo de espera. Mientras tanto, ¿hay algo específico en lo que pueda ayudarte?

Para volver al asistente virtual en cualquier momento, escribe "volver al bot".`,
    
    STORE_CLOSED: `🕒 Nuestra tienda está cerrada en este momento.

Horario de atención:
- Lunes a Viernes: 9:00 AM - 8:00 PM
- Sábados y Domingos: 10:00 AM - 6:00 PM
(Hora de Panamá)

¿En qué puedo ayudarte mientras tanto?`,

    ERROR: `Lo siento, estamos experimentando dificultades técnicas. Por favor, intenta nuevamente en unos momentos.

Si el problema persiste, puedes escribir "agente" para hablar con una persona real.`,

    TIMEOUT: `Lo siento, tu mensaje está tomando más tiempo del esperado. Por favor, intenta nuevamente o escribe "agente" para hablar con una persona real.`
};

// Función mejorada para generar respuestas con retry y timeout
async function generateResponse(userMessage, contactId, retryCount = 0) {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    try {
        const userContext = contextStore.get(contactId) || '';
        
        const customPrompt = `
        Eres un asistente virtual amigable y profesional de ElectronicsJS. Tu objetivo es proporcionar la mejor atención posible siguiendo estas pautas:

        PERSONALIDAD:
        - Sé amable y empático, pero mantén un tono profesional
        - Usa emojis ocasionalmente para dar calidez a tus respuestas
        - Sé conciso pero informativo
        - Si no estás seguro de algo, ofrece conectar con un agente humano

        FUNCIONES PRINCIPALES:
        1. Información de Productos:
           - Proporciona detalles precisos sobre laptops y productos
           - Menciona especificaciones técnicas cuando sea relevante
           - Sugiere productos según las necesidades del cliente

        2. Información de la Empresa:
           - Comparte detalles sobre ElectronicsJS: ${companyInfo}
           - Informa sobre ubicación, horarios y políticas

        3. Servicio al Cliente:
           - Responde preguntas sobre garantías y soporte
           - Explica procesos de compra y políticas de devolución
           - Ofrece conectar con un agente humano cuando sea necesario

        4. Gestión de Consultas:
           - Si la pregunta está fuera de tu alcance, sugiere hablar con un agente
           - Para temas sensibles o complejos, recomienda atención personalizada

        RESTRICCIONES:
        - No compartas información confidencial
        - No hagas promesas sobre precios o disponibilidad
        - No proporciones información personal de clientes
        - No tomes decisiones sobre casos especiales

        CONTEXTO ACTUAL:
        - Historial del usuario: ${userContext}
        - Productos disponibles: ${laptops}

        RESPONDE A: "${userMessage}"
        
        FORMATO DE RESPUESTA:
        - Mantén las respuestas concisas (máximo 4-5 líneas)
        - Usa viñetas para listas largas
        - Incluye emojis relevantes ocasionalmente`;

        const result = await Promise.race([
            model.generateContent(customPrompt),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('TIMEOUT')), MESSAGE_TIMEOUT)
            )
        ]);

        const text = result.response.text();

        // Actualizar contexto con límite de memoria
        const newContext = `${userContext.slice(-1000)}\nUsuario: ${userMessage}\nBot: ${text}`.trim();
        contextStore.set(contactId, newContext);

        return text;
    } catch (error) {
        console.error('Error generando la respuesta:', error);
        
        if (error.message === 'TIMEOUT') {
            return SYSTEM_MESSAGES.TIMEOUT;
        }

        if (retryCount < MAX_RETRIES) {
            console.log(`Reintentando generación de respuesta (${retryCount + 1}/${MAX_RETRIES})...`);
            return generateResponse(userMessage, contactId, retryCount + 1);
        }

        return SYSTEM_MESSAGES.ERROR;
    }
}

// Función mejorada para verificar horario
function isStoreOpen() {
    const panamaTime = moment().tz(PANAMA_TIMEZONE);
    const day = panamaTime.day();
    const hour = panamaTime.hour();

    const schedule = {
        weekday: { start: 9, end: 20 },
        weekend: { start: 10, end: 18 }
    };

    const isWeekday = day >= 1 && day <= 5;
    const { start, end } = isWeekday ? schedule.weekday : schedule.weekend;

    return hour >= start && hour < end;
}

// Configurar el cliente de WhatsApp con opciones optimizadas
const whatsappClient = new Client({
    puppeteer: {
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
            '--disable-extensions',
            '--disable-software-rasterizer',
            '--disable-features=site-per-process',
            '--js-flags="--max-old-space-size=512"'
        ],
        headless: "new",
        timeout: 0
    },
    clientId: 'electronics-js-bot',
    restartOnAuthFail: true
});

// Configurar Express y Socket.IO con manejo de errores
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    pingTimeout: 60000,
    pingInterval: 25000
});

// Inicializar StabilityManager
const stabilityManager = new StabilityManager(whatsappClient);

// Sistema de cola de mensajes
async function processMessageQueue() {
    if (isProcessingMessage || messageQueue.length === 0) return;

    isProcessingMessage = true;
    const { message, resolve, reject } = messageQueue.shift();

    try {
        await handleMessage(message);
        resolve();
    } catch (error) {
        console.error('Error procesando mensaje en cola:', error);
        reject(error);
    } finally {
        isProcessingMessage = false;
        if (messageQueue.length > 0) {
            processMessageQueue();
        }
    }
}

// Función para agregar mensaje a la cola
function queueMessage(message) {
    return new Promise((resolve, reject) => {
        if (messageQueue.length >= MAX_QUEUE_SIZE) {
            messageQueue.shift(); // Eliminar el mensaje más antiguo
        }
        messageQueue.push({ message, resolve, reject });
        processMessageQueue();
    });
}

// Manejadores de eventos de WhatsApp mejorados
whatsappClient.on('qr', (qr) => {
    qrcode.toDataURL(qr)
        .then(url => io.emit('qr', url))
        .catch(err => console.error('Error generando QR:', err));
});

whatsappClient.on('ready', () => {
    console.log('Cliente WhatsApp Web listo');
    io.emit('ready', 'Cliente WhatsApp Web listo');
});

whatsappClient.on('loading_screen', (percent, message) => {
    console.log('Cargando:', percent, '%', message);
    io.emit('loading', { percent, message });
});

// Funciones mejoradas para verificar mensajes
function isRequestingHuman(message) {
    const humanKeywords = ['agente', 'persona real', 'humano', 'representante', 'asesor', 'hablar con alguien'];
    return humanKeywords.some(keyword => message.toLowerCase().includes(keyword));
}

function isReturningToBot(message) {
    const botKeywords = ['volver al bot', 'bot', 'asistente virtual', 'chatbot'];
    return botKeywords.some(keyword => message.toLowerCase().includes(keyword));
}

// Manejador de mensajes principal mejorado
async function handleMessage(message) {
    stabilityManager.updateLastMessage();
    
    const contactId = message.from;
    const messageText = message.body.toLowerCase();

    // Verificar si el usuario está solicitando atención humana
    if (isRequestingHuman(messageText)) {
        await message.reply(SYSTEM_MESSAGES.HUMAN_REQUEST);
        pausedUsers.set(contactId, true);
        userRequestsHuman.set(contactId, true);
        
        setTimeout(() => {
            if (pausedUsers.get(contactId)) {
                pausedUsers.delete(contactId);
                userRequestsHuman.delete(contactId);
                whatsappClient.sendMessage(contactId, 'El asistente virtual está nuevamente disponible. ¿En qué puedo ayudarte?');
            }
        }, PAUSE_DURATION);
        
        return;
    }

    // Verificar si el usuario quiere volver al bot
    if (isReturningToBot(messageText) && userRequestsHuman.get(contactId)) {
        pausedUsers.delete(contactId);
        userRequestsHuman.delete(contactId);
        await message.reply('¡Bienvenido de vuelta! ¿En qué puedo ayudarte?');
        return;
    }

    if (pausedUsers.get(contactId)) {
        return;
    }

    if (message.hasMedia) {
        if (message.type === 'audio') {
            await message.reply(SYSTEM_MESSAGES.HUMAN_REQUEST);
            pausedUsers.set(contactId, true);
        }
        return;
    }

    if (['spam', 'publicidad', 'promo'].some(word => messageText.includes(word))) {
        return;
    }

    try {
        const responseText = messageText === 'hola' 
            ? SYSTEM_MESSAGES.WELCOME
            : isStoreOpen()
                ? await generateResponse(message.body, contactId)
                : SYSTEM_MESSAGES.STORE_CLOSED;

        await message.reply(responseText);
    } catch (error) {
        console.error('Error procesando mensaje:', error);
        await message.reply(SYSTEM_MESSAGES.ERROR);
    }
}

// Evento de mensaje mejorado con cola
whatsappClient.on('message', async (message) => {
    try {
        await queueMessage(message);
    } catch (error) {
        console.error('Error en cola de mensajes:', error);
    }
});

// Configuración de rutas Express mejorada
app.use(express.static(path.join(__dirname, 'web')));
app.use(express.json());

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'index.html'));
});

// Iniciar el sistema de estabilidad
stabilityManager.startStabilitySystem(app);

// Iniciar servidor con manejo de errores
server.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});

// Manejo de errores no capturados
process.on('unhandledRejection', (error) => {
    console.error('Error no manejado:', error);
});

process.on('uncaughtException', (error) => {
    console.error('Excepción no capturada:', error);
});