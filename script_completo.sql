-- Script simplificado para tienda de productos electrónicos (PostgreSQL)

-- Limpiar tablas existentes
DROP TABLE IF EXISTS servicios_tecnicos CASCADE;
DROP TABLE IF EXISTS detalle_pedido CASCADE;
DROP TABLE IF EXISTS pedidos CASCADE;
DROP TABLE IF EXISTS productos CASCADE;
DROP TABLE IF EXISTS categorias_electronicas CASCADE;
DROP TABLE IF EXISTS marcas CASCADE;
DROP TABLE IF EXISTS clientes CASCADE;
DROP TABLE IF EXISTS estados_pedido CASCADE;

-- Eliminar vistas existentes
DROP VIEW IF EXISTS vista_productos_detalle CASCADE;
DROP VIEW IF EXISTS vista_pedidos_resumen CASCADE;
DROP VIEW IF EXISTS vista_detalle_pedidos CASCADE;
DROP VIEW IF EXISTS vista_servicios_tecnicos CASCADE;
DROP VIEW IF EXISTS vista_stock_productos CASCADE;
DROP VIEW IF EXISTS vista_catalogo_completo CASCADE;
DROP VIEW IF EXISTS vista_categorias_conteo CASCADE;
DROP VIEW IF EXISTS vista_marcas_unicas CASCADE;
DROP VIEW IF EXISTS vista_categorias_unicas CASCADE;
DROP VIEW IF EXISTS vista_modelos_unicos CASCADE;
DROP VIEW IF EXISTS vista_productos_unicos CASCADE;
DROP VIEW IF EXISTS vista_esquema_bd CASCADE;

-- Eliminar funciones existentes
DROP FUNCTION IF EXISTS buscar_productos_avanzado CASCADE;
DROP FUNCTION IF EXISTS obtener_valores_unicos CASCADE;
DROP FUNCTION IF EXISTS consultar_por_campo CASCADE;

-- Tabla de categorías simplificada
CREATE TABLE IF NOT EXISTS categorias (
    id_categoria SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE
);

-- Tabla de productos simplificada
CREATE TABLE IF NOT EXISTS productos (
    id_producto SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    id_categoria INTEGER NOT NULL,
    stock INTEGER DEFAULT 0 CHECK (stock >= 0),
    precio DECIMAL(10,2) NOT NULL CHECK (precio >= 0),
    detalle TEXT,
    FOREIGN KEY (id_categoria) REFERENCES categorias(id_categoria)
);

-- Vista de productos con categorías
CREATE OR REPLACE VIEW vista_productos AS
SELECT
    p.id_producto,
    p.nombre,
    c.nombre AS categoria,
    p.stock,
    p.precio,
    p.detalle
FROM productos p
JOIN categorias c ON p.id_categoria = c.id_categoria;

-- Función para búsqueda de productos simplificada
CREATE OR REPLACE FUNCTION buscar_productos(
    p_termino TEXT DEFAULT NULL,
    p_categoria TEXT DEFAULT NULL,
    p_min_precio NUMERIC DEFAULT NULL,
    p_max_precio NUMERIC DEFAULT NULL
)
RETURNS TABLE (
    id_producto INT,
    nombre TEXT,
    categoria TEXT,
    stock INT,
    precio NUMERIC,
    detalle TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id_producto,
        p.nombre,
        c.nombre AS categoria,
        p.stock,
        p.precio,
        p.detalle
    FROM productos p
    JOIN categorias c ON p.id_categoria = c.id_categoria
    WHERE
        (p_termino IS NULL OR LOWER(p.nombre) LIKE '%' || LOWER(p_termino) || '%' OR LOWER(p.detalle) LIKE '%' || LOWER(p_termino) || '%')
        AND (p_categoria IS NULL OR LOWER(c.nombre) = LOWER(p_categoria))
        AND (p_min_precio IS NULL OR p.precio >= p_min_precio)
        AND (p_max_precio IS NULL OR p.precio <= p_max_precio);
END;
$$ LANGUAGE plpgsql;

-- Insertar categorías simplificadas
INSERT INTO categorias (nombre) VALUES
('Gama Baja'),
('Gama Media'),
('Gama Alta'),
('Gamer'),
('Empresarial'),
('Accesorios'),
('Repuestos');

-- Insertar productos con las categorías simplificadas
INSERT INTO productos (nombre, id_categoria, stock, precio, detalle) VALUES
-- Gama Baja
('Acer Aspire 3', 1, 10, 420.00, '15.6" FHD, Intel Core i3-1115G4, 8GB RAM, 256GB SSD, Windows 11 Home'),
('HP 245 G8', 1, 8, 390.00, '14" HD, AMD Ryzen 3 3250U, 8GB RAM, 256GB SSD, Windows 11 Home'),

-- Gama Media
('Lenovo IdeaPad 3', 2, 12, 650.00, '15.6" FHD, Intel Core i5-1135G7, 8GB RAM, 512GB SSD, Windows 11 Home'),
('Dell Inspiron 15', 2, 9, 780.00, '15.6" FHD, Intel Core i5-1135G7, 8GB RAM, 512GB SSD, Windows 11 Home'),

-- Gama Alta
('Apple MacBook Air M2', 3, 5, 1200.00, '13.6" Liquid Retina, Apple M2, 8GB RAM, 256GB SSD, macOS'),
('ASUS ZenBook 14', 3, 6, 1350.00, '14" FHD, Intel Core i7-1165G7, 16GB RAM, 512GB SSD, Windows 11 Pro'),
('HP Spectre x360 14', 3, 7, 1399.99, '13.5" 3K2K OLED Touch: Intel Core i7-1355U, Intel Iris Xe, 16GB LPDDR5, 1TB PCIe Gen4, WiFi 6E, Win11 Home: Azul Nocturno'),

-- Gamer
('MSI Gaming Stealth 15M', 4, 15, 1299.99, '15.6" 144Hz FHD: Intel Core i7 de 13ª generación, RTX 4070, 16GB DDR5, 1TB NVMe SSD, USB-Type C, Cooler Boost 5, Win11 Home: Negro'),
('MSI GF63 Thin', 4, 7, 950.00, '15.6" FHD 144Hz, Intel Core i5-10500H, GTX 1650, 8GB RAM, 512GB SSD, Windows 11 Home'),

-- Empresarial
('Dell Latitude 5420', 5, 4, 1050.00, '14" FHD, Intel Core i7-1165G7, 16GB RAM, 512GB SSD, Windows 11 Pro'),

-- Accesorios
('Samsonite Classic Sleeve 14"', 6, 15, 25.00, 'Funda acolchada, resistente, para laptops de 14"'),
('Logitech MX Master 3', 6, 10, 99.00, 'Mouse inalámbrico, recargable, Bluetooth, 4000DPI, USB-C'),
('Anker 65W GaN Charger', 6, 8, 45.00, 'Cargador USB-C, 65W, GaN, compatible con la mayoría de laptops'),
('KLIM Wind Laptop Cooling Pad', 6, 9, 25.00, 'Base refrigerante, 4 ventiladores, compatible con laptops hasta 17"'),
('Targus CitySmart 15.6" Professional Backpack', 6, 10, 45.00, 'Mochila acolchada, resistente al agua, múltiples compartimentos, para laptops hasta 15.6"'),
('Cooler Master NotePal X3', 6, 12, 35.00, 'Ventilador LED azul, 2 puertos USB, compatible con la mayoría de laptops'),

-- Repuestos
('Batería HP Original 45Wh', 7, 6, 89.00, 'Batería 45Wh, compatible con HP Pavilion'),
('Crucial MX500 1TB SATA SSD', 7, 10, 100.00, 'SSD 1TB SATA, 560MB/s lectura, compatible con la mayoría de laptops'),
('Teclado para Lenovo ThinkPad', 7, 5, 45.00, 'Teclado QWERTY, compatible con Lenovo ThinkPad serie T'),
('Crucial 8GB DDR4-3200 SODIMM', 7, 20, 35.00, '8GB DDR4-3200 SODIMM, bajo voltaje, compatible con la mayoría de laptops'),
('Samsung 970 EVO Plus 500GB NVMe M.2', 7, 15, 80.00, '500GB NVMe M.2, hasta 3500MB/s lectura, compatible con laptops');

-- Índices para mejorar consultas
CREATE INDEX idx_productos_categoria ON productos(id_categoria);
CREATE INDEX idx_productos_nombre ON productos(nombre);
CREATE INDEX idx_productos_precio ON productos(precio);