# Documentación del Proyecto: Electra - Bot de WhatsApp con Inteligencia Artificial

## Introducción
Electra es un bot de WhatsApp impulsado por inteligencia artificial, diseñado para ofrecer atención al cliente eficiente, personalizada e interactiva. Este proyecto tiene como objetivo optimizar la comunicación entre una tienda y sus clientes, proporcionando respuestas rápidas y precisas a través de la API de Google Generative AI (Gemini).

Electra no solo responde preguntas frecuentes, sino que también ofrece recomendaciones personalizadas, gestiona consultas complejas y permite el intercambio de archivos multimedia para una experiencia de usuario completa.

---

## Características Principales
- **Atención 24/7**: Responde preguntas y brinda soporte incluso fuera del horario laboral.
- **Recomendaciones Personalizadas**: Sugiere productos basados en las necesidades del usuario.
- **Gestión de Consultas Frecuentes**: Proporciona información sobre horarios, políticas, garantías y más.
- **Soporte Multimedia**: Permite el intercambio de imágenes, documentos y otros archivos para una asistencia más detallada.
- **Detección de Spam**: Filtra mensajes no deseados para mantener conversaciones relevantes.
- **Sistema de Gestión de Contexto**: Mantiene conversaciones coherentes al recordar detalles previos.

---

## Tecnologías Utilizadas
- **Node.js**: Lenguaje principal para el desarrollo del bot.
- **whatsapp-web.js**: Librería para integrar el bot con WhatsApp.
- **Google Generative AI (Gemini)**: API para generar respuestas inteligentes y contextuales.
- **Express.js**: Framework para manejar el servidor y las rutas.
- **Moment.js**: Librería para manejo de fechas y horarios.
- **Socket.IO**: Para comunicación en tiempo real entre el servidor y el cliente.
- **PM2**: Administrador de procesos para mantener el bot en ejecución.

---

## Estructura del Proyecto
```
Main/
├── Dockerfile
├── ecosystem.config.js
├── package.json
├── README.md
├── render.yaml
├── start.sh
├── bot/
│   ├── bot.js
│   ├── info_empresa.txt
│   ├── Laptops1.txt
│   ├── promt.txt
│   ├── stability.js
│   └── web/
│       └── index.html
└── WhatsApp-bot/
    ├── LICENSE
    └── .gitattributes
```

---

## Configuración del Entorno
### Requisitos Previos
1. **Node.js**: Asegúrate de tener Node.js instalado (versión 16 o superior).
2. **npm**: Viene incluido con Node.js.
3. **Docker** (opcional): Para despliegue en contenedores.
4. **PM2**: Administrador de procesos para Node.js.

### Variables de Entorno
Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:
- `PORT`: Puerto en el que se ejecutará el servidor (por defecto: 3000).
- `GEMINI_API_KEY`: Clave de API para Google Generative AI.

### Instalación
1. Clona el repositorio:
   ```bash
   git clone https://github.com/IrvinngB/JIC-VentiBot.git
   cd Main
   ```
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Instala PM2 globalmente:
   ```bash
   npm install pm2 -g
   ```

---

## Uso
### Iniciar el Bot
- **Modo Producción**:
  ```bash
  npm start
  ```
- **Modo Desarrollo**:
  ```bash
  npm run dev
  ```

### Generar Código QR
El bot generará un código QR que debe ser escaneado con la aplicación de WhatsApp para iniciar sesión. Este código se mostrará en la consola o en la interfaz web.

---

## Despliegue
### Usando Docker
1. Construye la imagen de Docker:
   ```bash
   docker build -t whatsapp-bot .
   ```
2. Ejecuta el contenedor:
   ```bash
   docker run -p 3000:3000 whatsapp-bot
   ```

### Usando Render
El archivo `render.yaml` contiene la configuración necesaria para desplegar el bot en la plataforma Render. Sigue estos pasos:
1. Crea un nuevo servicio en Render.
2. Sube el archivo `render.yaml`.
3. Configura las variables de entorno requeridas.

---

## Solución de Problemas Comunes
1. **Error de Autenticación**:
   - Asegúrate de que la clave `GEMINI_API_KEY` esté configurada correctamente en el archivo `.env`.
2. **Problemas con el Código QR**:
   - Verifica que el cliente de WhatsApp esté actualizado.
3. **El Bot no Responde**:
   - Revisa los logs generados por PM2 o Docker para identificar el problema.

---

## Contribución

### Realizar un Fork del Repositorio
1. Ve al repositorio en GitHub y haz clic en el botón **Fork** en la esquina superior derecha.
2. Esto creará una copia del repositorio en tu cuenta de GitHub.

### Clonar el Repositorio
1. Clona el repositorio forkeado en tu máquina local:
   ```bash
   git clone <URL_DEL_REPOSITORIO_FORK>
   cd <NOMBRE_DEL_REPOSITORIO>
   ```

### Crear una Nueva Rama
1. Crea una nueva rama para tu funcionalidad o corrección:
   ```bash
   git checkout -b feature/nueva-funcionalidad
   ```

### Realizar Cambios
1. Realiza los cambios necesarios en el código.
2. Guarda los archivos modificados.

### Confirmar los Cambios
1. Añade los archivos modificados al área de preparación:
   ```bash
   git add .
   ```
2. Realiza un commit con un mensaje descriptivo:
   ```bash
   git commit -m "Agrega nueva funcionalidad"
   ```

### Subir los Cambios
1. Sube los cambios a tu repositorio forkeado:
   ```bash
   git push origin feature/nueva-funcionalidad
   ```

### Abrir un Pull Request
1. Ve a la página del repositorio original en GitHub.
2. Haz clic en el botón **Pull Requests** y luego en **New Pull Request**.
3. Selecciona tu rama y describe los cambios realizados.
4. Envía el Pull Request para revisión.

### Mantener tu Fork Actualizado
1. Agrega el repositorio original como remoto:
   ```bash
   git remote add upstream <URL_DEL_REPOSITORIO_ORIGINAL>
   ```
2. Obtén los últimos cambios del repositorio original:
   ```bash
   git fetch upstream
   ```
3. Fusiona los cambios en tu rama principal:
   ```bash
   git checkout main
   git merge upstream/main
   ```
4. Sube los cambios actualizados a tu fork:
   ```bash
   git push origin main
   ```

---

## Licencia
Este proyecto está bajo la Licencia MIT. Consulta el archivo `LICENSE` para más detalles.