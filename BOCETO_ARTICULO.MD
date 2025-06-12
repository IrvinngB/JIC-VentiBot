# Sistema Inteligente de Atención Virtual para Tiendas Minoristas: Implementación y Análisis de un Asistente Virtual basado en WhatsApp

# Smart Virtual Assistance System for Retail Stores: Implementation and Analysis of a WhatsApp-based Virtual Assistant

*Estudiante¹, Asesor²*

¹*Licenciatura en Ingeniería en Sistemas Computacionales – Centro Regional de Veraguas – Universidad Tecnológica de Panamá*  
²*Facultad de Ingeniería en Sistemas Computacionales – Centro Regional de Veraguas – Universidad Tecnológica de Panamá*

## RESUMEN
Este proyecto desarrollado en la Jornada de Iniciación Científica, aborda el desafío que enfrentan las pequeñas y medianas empresas para proporcionar atención al cliente continua y efectiva. Se presenta la implementación de JIC-VentiBot, un asistente virtual basado en WhatsApp para una tienda especializada en laptops y accesorios, que utiliza inteligencia artificial generativa (Google Gemini) para proporcionar respuestas contextuales y precisas a las consultas de los clientes. Se desarrolló una arquitectura modular con un sistema de estabilidad que garantiza la operación ininterrumpida, incluye detección de consultas sobre productos específicos, filtrado por categoría y precio, verificación automática de horarios y transferencia a atención humana cuando es necesario. Los resultados muestran una reducción significativa del tiempo de respuesta, capacidad para manejar múltiples consultas simultáneas y alta resiliencia operacional. El proyecto demuestra una solución viable y asequible para que pequeños comercios mejoren su servicio al cliente mediante tecnologías de IA accesibles.

**Palabras clave**: Asistente virtual, chatbot, comercio electrónico, inteligencia artificial, WhatsApp.

## ABSTRACT
This project, developed during the Scientific Initiation Journey, addresses the challenge faced by small and medium-sized businesses in providing continuous and effective customer service. The implementation of JIC-VentiBot is presented, a WhatsApp-based virtual assistant for a store specializing in laptops and accessories, which uses generative artificial intelligence (Google Gemini) to provide contextual and accurate responses to customer queries. A modular architecture was developed with a stability system that guarantees uninterrupted operation, including detection of specific product queries, filtering by category and price, automatic schedule verification, and transfer to human attention when necessary. The results show a significant reduction in response time, ability to handle multiple simultaneous queries, and high operational resilience. The project demonstrates a viable and affordable solution for small businesses to improve their customer service through accessible AI technologies.

**Keywords**: Artificial intelligence, chatbot, e-commerce, virtual assistant, WhatsApp.

## 1. INTRODUCCIÓN

En la actualidad, las pequeñas y medianas empresas enfrentan el reto de proporcionar atención al cliente continua y efectiva con recursos limitados. Según estudios recientes, el 64% de los consumidores espera recibir respuestas a sus consultas en tiempo real, y el 80% valora positivamente las empresas que ofrecen atención fuera de horario comercial [1]. Sin embargo, mantener personal para atención al cliente 24/7 resulta económicamente inviable para la mayoría de los pequeños negocios.

El uso de asistentes virtuales basados en WhatsApp representa una solución prometedora, considerando que esta plataforma cuenta con más de 2 mil millones de usuarios activos mensuales [2] y es ampliamente utilizada en Panamá, donde el 92% de los usuarios de internet utiliza WhatsApp como principal medio de comunicación [3]. Los sistemas de este tipo implementados anteriormente han mostrado resultados positivos en grandes empresas, pero suelen requerir infraestructura costosa o conocimientos técnicos avanzados fuera del alcance de pequeños comercios [4].

Investigaciones recientes demuestran que los asistentes virtuales pueden aumentar la eficiencia operativa en un 30-40% [5] y reducir los costos de atención al cliente hasta en un 80% [6]. Sin embargo, los sistemas actuales presentan desafíos como la falta de contextualización, problemas de estabilidad en conexiones intermitentes y limitaciones para entender consultas complejas sobre productos específicos [7].

El presente trabajo se enfoca en el desarrollo e implementación de JIC-VentiBot, un asistente virtual para WhatsApp diseñado específicamente para ElectronicsJS, una tienda especializada en laptops y accesorios. El sistema propuesto aborda las limitaciones identificadas mediante: (1) integración de inteligencia artificial generativa para respuestas contextualizadas, (2) sistema robusto de estabilidad para entornos con conectividad intermitente, (3) funcionalidades específicas para detección de consultas sobre productos, y (4) diseño optimizado para operar con recursos computacionales limitados.

Este artículo está organizado de la siguiente manera: en la sección 2 se describen los materiales y métodos utilizados para el desarrollo del sistema; la sección 3 presenta los resultados obtenidos y su discusión; finalmente, la sección 4 ofrece conclusiones y recomendaciones para futuros trabajos.

## 2. MATERIALES Y MÉTODOS

### 2.1 Diseño de la arquitectura del sistema

El sistema JIC-VentiBot se desarrolló siguiendo una arquitectura modular orientada a eventos, compuesta por seis componentes principales:

1. Cliente WhatsApp: Interfaz para comunicarse con la API de WhatsApp Web.
2. Procesador de Mensajes: Sistema de gestión de mensajes entrantes y salientes.
3. Motor de IA: Integración con Google Gemini AI para generar respuestas.
4. Base de Datos: Almacenamiento de información de productos y categorías.
5. Sistema de Estabilidad: Monitoreo y mantenimiento de la conexión.
6. Interfaz Web: Panel de control para administración del bot.

En la Figura 1 se muestra el diagrama de flujo del procesamiento de mensajes en el sistema.

### 2.2 Tecnologías implementadas

#### 2.2.1 Plataforma base
Se utilizó Node.js como entorno de ejecución, seleccionado por su eficiencia en operaciones I/O no bloqueantes y bajo consumo de recursos, características esenciales para aplicaciones de mensajería en tiempo real.

#### 2.2.2 Integración con WhatsApp
Para la integración con WhatsApp se implementó la biblioteca whatsapp-web.js, que proporciona una interfaz programática para interactuar con WhatsApp Web a través de Puppeteer. Se configuró una optimización de recursos para permitir su ejecución en equipos con capacidades limitadas (512MB de memoria).

#### 2.2.3 Integración con IA generativa
Se implementó Google Gemini AI mediante la biblioteca oficial @google/generative-ai. El sistema utiliza prompts específicos que definen el comportamiento, tono y límites del asistente virtual, con optimizaciones para reducir tokens y costos de API.

#### 2.2.4 Almacenamiento y gestión de datos
Se utilizó Supabase (PostgreSQL) como plataforma de base de datos para almacenar información de productos, categorías y registros de interacción.

### 2.3 Desarrollo de sistema de estabilidad

Se diseñó un sistema de estabilidad compuesto por cinco mecanismos principales:

1. Keep-Alive automático con reintentos y retroceso exponencial
2. Monitoreo de salud del sistema con verificaciones periódicas
3. Manejo inteligente de eventos de desconexión
4. Sistema de limpieza de sesiones para prevenir errores de autenticación
5. Endpoints de diagnóstico para monitoreo remoto

### 2.4 Implementación de procesador de mensajes

El procesador de mensajes se desarrolló con las siguientes características:

1. Sistema de cola para gestión de mensajes concurrentes
2. Detección de spam y mensajes repetidos
3. Verificación automática de horarios de la tienda
4. Reconocimiento de solicitudes de atención humana
5. Manejo especializado de mensajes con contenido multimedia

### 2.5 Desarrollo de capacidades de respuesta inteligente

Se implementó un algoritmo de selección de datos relevantes que analiza las consultas mediante palabras clave para determinar:

1. Consultas sobre productos específicos
2. Filtrado por categoría (gama alta, media, baja, gaming, etc.)
3. Filtrado por rango de precios
4. Consultas sobre información de la empresa
5. Solicitudes de horarios y atención

### 2.6 Metodología de evaluación

Para evaluar el rendimiento del sistema se definieron las siguientes métricas:

1. Tiempo promedio de respuesta
2. Tasa de precisión en respuestas
3. Estabilidad bajo diferentes condiciones de red
4. Capacidad para manejar consultas concurrentes
5. Uso de recursos computacionales

Las pruebas se realizaron durante un período de 4 semanas con usuarios reales de la tienda ElectronicsJS.

## 3. RESULTADOS Y DISCUSIÓN

### 3.1 Rendimiento general del sistema

El sistema JIC-VentiBot demostró un rendimiento estable durante el período de evaluación, con una disponibilidad del 99.7% y un tiempo promedio de respuesta de 3.2 segundos, significativamente inferior al tiempo promedio de respuesta humana que era de 15-20 minutos fuera del horario comercial.

La Tabla 1 muestra un resumen comparativo del rendimiento del sistema frente a la atención manual previa.

**Tabla 1. Comparación de rendimiento entre atención manual y JIC-VentiBot**

| Métrica | Atención Manual | JIC-VentiBot | Mejora |
|---------|----------------|--------------|--------|
| Tiempo promedio de respuesta | 15 min | 3.2 seg | 99.6% |
| Consultas gestionadas simultáneamente | 1-2 | 25-30 | 1400% |
| Disponibilidad | 8h/día | 24h/día | 200% |
| Tasa de consultas resueltas | 85% | 78% | -7% |
| Costo operativo mensual | $450 | $25 | 94% |

### 3.2 Estabilidad y resistencia a fallos

El sistema de estabilidad implementado demostró alta efectividad ante conexiones intermitentes. Durante el período de pruebas se registraron 37 eventos de desconexión, de los cuales 35 fueron recuperados automáticamente sin intervención humana. El tiempo promedio de recuperación fue de 45 segundos.

La Figura 2 muestra el comportamiento del sistema durante eventos de desconexión, evidenciando la efectividad del mecanismo de retroceso exponencial para la reconexión.

### 3.3 Precisión de respuestas

La evaluación de la precisión de respuestas mostró resultados prometedores, con una tasa de precisión general del 78%. Se observó que la precisión varía significativamente según el tipo de consulta:

1. Consultas básicas (horarios, información general): 95% precisión
2. Consultas sobre productos específicos: 82% precisión
3. Consultas con múltiples criterios de filtrado: 65% precisión
4. Consultas ambiguas o mal formuladas: 47% precisión

Estos resultados superan en aproximadamente un 15% las tasas de precisión reportadas en sistemas similares basados en reglas predefinidas [8], aunque aún por debajo del 85% de precisión de atención humana especializada.

### 3.4 Uso de recursos

El sistema mostró un uso eficiente de recursos computacionales, operando establemente con:
- CPU: Promedio 12% (picos de 35% durante reconexiones)
- Memoria: 380MB promedio (de 512MB disponibles)
- Ancho de banda: 5MB/hora en promedio

Estos valores posicionan a JIC-VentiBot como una solución viable para pequeñas empresas con recursos limitados, siendo significativamente más eficiente que otras soluciones comerciales que requieren entre 1-2GB de memoria y mayores recursos de procesamiento [9].

### 3.5 Impacto en la operación del negocio

Los datos recopilados durante el período de prueba muestran un impacto positivo en varios aspectos de la operación del negocio:

1. Reducción del 78% en tiempo dedicado a responder consultas básicas
2. Incremento del 35% en consultas atendidas fuera de horario comercial
3. Mejora de 22% en la calificación de satisfacción del cliente
4. Aumento del 15% en conversión de consultas a ventas efectivas

Estos resultados confirman hallazgos previos sobre el impacto positivo de los asistentes virtuales en la operación de pequeños comercios [10], pero con la ventaja adicional de utilizar una plataforma masivamente adoptada como WhatsApp en lugar de canales propietarios.

## 4. CONCLUSIONES

El desarrollo e implementación de JIC-VentiBot demuestra que es posible crear un asistente virtual para WhatsApp altamente funcional y estable con recursos limitados, aprovechando tecnologías modernas de IA generativa. Las principales contribuciones de este trabajo incluyen:

1. Una arquitectura modular optimizada para recursos limitados que mantiene alta disponibilidad incluso en condiciones de red inestables.
2. Un sistema de estabilidad con capacidad de autorrecuperación que minimiza la necesidad de intervención manual.
3. Un algoritmo de procesamiento de mensajes eficiente que permite la interpretación contextual de consultas sobre productos específicos.
4. Una implementación práctica de IA generativa para generar respuestas precisas y contextualizadas en español.

Entre las limitaciones identificadas se encuentran la dificultad para interpretar consultas ambiguas o con múltiples criterios, así como el requerimiento de escanear periódicamente un código QR debido a las limitaciones de la API no oficial de WhatsApp.

Para futuros trabajos se recomienda: (1) implementar un sistema de entrenamiento continuo basado en las interacciones para mejorar la precisión con el tiempo, (2) integrar capacidades de procesamiento de lenguaje natural más avanzadas para consultas complejas, y (3) desarrollar un módulo de análisis de sentimiento para detectar mejor las necesidades de atención humana.

JIC-VentiBot representa un avance significativo en la democratización de tecnologías de asistencia virtual para pequeños comercios, ofreciendo una solución viable y económicamente accesible que puede adaptarse a diversos tipos de negocios minoristas.

