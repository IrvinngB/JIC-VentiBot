-- Tablas normalizadas para tienda de productos electrónicos en PostgreSQL

-- Tabla de clientes
CREATE TABLE clientes (
    id_cliente SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    cedula VARCHAR(20) UNIQUE NOT NULL,
    correo VARCHAR(100),
    telefono VARCHAR(20),
    direccion TEXT,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activo BOOLEAN DEFAULT TRUE
);

-- Tabla de marcas de electrónicos
CREATE TABLE marcas (
    id_marca SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    pais_origen VARCHAR(50),
    sitio_web VARCHAR(100),
    activo BOOLEAN DEFAULT TRUE
);

-- Tabla de categorías específicas para electrónicos
CREATE TABLE categorias_electronicas (
    id_categoria SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE
);

-- Tabla de productos electrónicos
CREATE TABLE productos (
    id_producto SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    precio DECIMAL(10,2) NOT NULL CHECK (precio >= 0),
    id_categoria INTEGER NOT NULL,
    id_marca INTEGER,
    modelo VARCHAR(100),
    numero_serie VARCHAR(100) UNIQUE,
    codigo_barras VARCHAR(50) UNIQUE,
    stock INTEGER DEFAULT 0 CHECK (stock >= 0),
    voltaje VARCHAR(20),
    potencia VARCHAR(20),
    dimensiones VARCHAR(50),
    peso DECIMAL(8,2),
    color VARCHAR(30),
    garantia_meses INTEGER DEFAULT 12,
    fecha_fabricacion DATE,
    temperatura_operacion VARCHAR(30),
    certificaciones TEXT,
    incluye_accesorios TEXT,
    requiere_instalacion BOOLEAN DEFAULT FALSE,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_categoria) REFERENCES categorias_electronicas(id_categoria),
    FOREIGN KEY (id_marca) REFERENCES marcas(id_marca)
);

-- Tabla de especificaciones técnicas
CREATE TABLE especificaciones_tecnicas (
    id_especificacion SERIAL PRIMARY KEY,
    id_producto INTEGER NOT NULL,
    nombre_especificacion VARCHAR(100) NOT NULL,
    valor VARCHAR(200) NOT NULL,
    unidad VARCHAR(20),
    FOREIGN KEY (id_producto) REFERENCES productos(id_producto) ON DELETE CASCADE,
    UNIQUE(id_producto, nombre_especificacion)
);

-- Tabla de estados de pedidos
CREATE TABLE estados_pedido (
    id_estado SERIAL PRIMARY KEY,
    nombre VARCHAR(30) NOT NULL UNIQUE,
    descripcion TEXT
);

-- Tabla de pedidos
CREATE TABLE pedidos (
    id_pedido SERIAL PRIMARY KEY,
    id_cliente INTEGER NOT NULL,
    fecha_pedido TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    id_estado INTEGER DEFAULT 1,
    total DECIMAL(12,2) DEFAULT 0.00 CHECK (total >= 0),
    subtotal DECIMAL(12,2) DEFAULT 0.00 CHECK (subtotal >= 0),
    impuestos DECIMAL(12,2) DEFAULT 0.00 CHECK (impuestos >= 0),
    descuentos DECIMAL(12,2) DEFAULT 0.00 CHECK (descuentos >= 0),
    costo_envio DECIMAL(10,2) DEFAULT 0.00 CHECK (costo_envio >= 0),
    observaciones TEXT,
    direccion_entrega TEXT,
    requiere_instalacion BOOLEAN DEFAULT FALSE,
    fecha_entrega_estimada DATE,
    FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente),
    FOREIGN KEY (id_estado) REFERENCES estados_pedido(id_estado)
);

-- Tabla de detalle de pedidos
CREATE TABLE detalle_pedido (
    id_detalle SERIAL PRIMARY KEY,
    id_pedido INTEGER NOT NULL,
    id_producto INTEGER NOT NULL,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario DECIMAL(10,2) NOT NULL CHECK (precio_unitario >= 0),
    descuento_unitario DECIMAL(10,2) DEFAULT 0.00 CHECK (descuento_unitario >= 0),
    subtotal DECIMAL(12,2),
    garantia_extendida_meses INTEGER DEFAULT 0,
    instalacion_requerida BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (id_pedido) REFERENCES pedidos(id_pedido) ON DELETE CASCADE,
    FOREIGN KEY (id_producto) REFERENCES productos(id_producto),
    UNIQUE(id_pedido, id_producto)
);

-- Tabla de servicios técnicos
CREATE TABLE servicios_tecnicos (
    id_servicio SERIAL PRIMARY KEY,
    id_pedido INTEGER,
    id_producto INTEGER,
    tipo_servicio VARCHAR(50) NOT NULL,
    descripcion TEXT,
    fecha_programada TIMESTAMP,
    fecha_completada TIMESTAMP,
    tecnico_asignado VARCHAR(100),
    costo DECIMAL(10,2) DEFAULT 0.00,
    estado VARCHAR(30) DEFAULT 'Programado',
    observaciones TEXT,
    FOREIGN KEY (id_pedido) REFERENCES pedidos(id_pedido),
    FOREIGN KEY (id_producto) REFERENCES productos(id_producto)
);

-- Índices para optimización
CREATE INDEX idx_clientes_cedula ON clientes(cedula);
CREATE INDEX idx_clientes_correo ON clientes(correo);
CREATE INDEX idx_productos_marca ON productos(id_marca);
CREATE INDEX idx_productos_categoria ON productos(id_categoria);
CREATE INDEX idx_productos_modelo ON productos(modelo);
CREATE INDEX idx_productos_numero_serie ON productos(numero_serie);
CREATE INDEX idx_productos_codigo_barras ON productos(codigo_barras);
CREATE INDEX idx_especificaciones_producto ON especificaciones_tecnicas(id_producto);
CREATE INDEX idx_pedidos_cliente ON pedidos(id_cliente);
CREATE INDEX idx_pedidos_fecha ON pedidos(fecha_pedido);
CREATE INDEX idx_pedidos_estado ON pedidos(id_estado);
CREATE INDEX idx_detalle_pedido ON detalle_pedido(id_pedido);
CREATE INDEX idx_detalle_producto ON detalle_pedido(id_producto);
CREATE INDEX idx_servicios_fecha ON servicios_tecnicos(fecha_programada);

-- Datos de ejemplo para clientes
INSERT INTO clientes (nombre, cedula, correo, telefono, direccion) VALUES
('Juan Pérez', '0801234567', 'juan.perez@example.com', '123456789', 'Avenida Siempre Viva'),
('Ana García', '0807654321', 'ana.garcia@example.com', '987654321', 'Calle Falsa 123');

-- Datos de ejemplo para marcas
INSERT INTO marcas (nombre, pais_origen, sitio_web) VALUES
('Samsung', 'Corea del Sur', 'https://www.samsung.com'),
('Sony', 'Japón', 'https://www.sony.com');

-- Datos de ejemplo para categorías
INSERT INTO categorias_electronicas (nombre, descripcion) VALUES
('Televisores', 'Dispositivos de visualización para entretenimiento'),
('Celulares', 'Teléfonos móviles inteligentes');

-- Datos de ejemplo para productos
INSERT INTO productos (nombre, descripcion, precio, id_categoria, id_marca, modelo, numero_serie, codigo_barras, stock, color, peso) VALUES
('Televisor Samsung QLED', 'Televisor QLED de última generación', 1200.00, 1, 1, 'Q60T', 'SN1234567890', '123456789012', 50, 'Negro', 15.00),
('Sony Xperia 5', 'Teléfono móvil inteligente con tecnología 5G', 900.00, 2, 2, 'Xperia 5 II', 'SN9876543210', '987654321098', 30, 'Azul', 0.15);

-- Datos de ejemplo para estados de pedido
INSERT INTO estados_pedido (nombre, descripcion) VALUES
('Pendiente', 'El pedido está pendiente de confirmación'),
('Completado', 'El pedido ha sido entregado satisfactoriamente');

-- Datos de ejemplo para pedidos
INSERT INTO pedidos (id_cliente, total, subtotal, impuestos, direccion_entrega) VALUES
(1, 1200.00, 1000.00, 200.00, 'Avenida Siempre Viva'),
(2, 900.00, 850.00, 50.00, 'Calle Falsa 123');

-- Datos de ejemplo para detalle de pedidos
INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad, precio_unitario, subtotal) VALUES
(1, 1, 1, 1000.00, 1000.00),
(2, 2, 1, 850.00, 850.00);

-- Datos de ejemplo para servicios técnicos
INSERT INTO servicios_tecnicos (id_pedido, id_producto, tipo_servicio, descripcion, fecha_programada, tecnico_asignado) VALUES
(1, 1, 'Instalación', 'Instalación de televisor QLED', '2025-06-03 10:00:00', 'Técnico Juan'),
(2, 2, 'Reparación', 'Reparación de pantalla del celular', '2025-06-04 15:00:00', 'Técnico Ana');
