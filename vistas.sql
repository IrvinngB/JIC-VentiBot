-- Vista: productos con detalles de marca y categoría
CREATE OR REPLACE VIEW vista_productos_detalle AS
SELECT
    p.id_producto,
    p.nombre AS nombre_producto,
    p.descripcion,
    p.precio,
    p.stock,
    p.modelo,
    p.numero_serie,
    p.codigo_barras,
    p.color,
    p.peso,
    p.garantia_meses,
    p.fecha_fabricacion,
    p.activo,
    m.nombre AS marca,
    m.pais_origen,
    c.nombre AS categoria
FROM productos p
LEFT JOIN marcas m ON p.id_marca = m.id_marca
LEFT JOIN categorias_electronicas c ON p.id_categoria = c.id_categoria;

-- Vista: pedidos con información del cliente y estado
CREATE OR REPLACE VIEW vista_pedidos_resumen AS
SELECT
    pe.id_pedido,
    pe.fecha_pedido,
    pe.total,
    pe.subtotal,
    pe.impuestos,
    pe.descuentos,
    pe.costo_envio,
    pe.direccion_entrega,
    pe.fecha_entrega_estimada,
    cl.nombre AS cliente,
    cl.cedula,
    cl.correo,
    cl.telefono,
    ep.nombre AS estado_pedido
FROM pedidos pe
JOIN clientes cl ON pe.id_cliente = cl.id_cliente
JOIN estados_pedido ep ON pe.id_estado = ep.id_estado;

-- Vista: detalle de pedidos con información de producto y cliente
CREATE OR REPLACE VIEW vista_detalle_pedidos AS
SELECT
    dp.id_detalle,
    dp.id_pedido,
    pe.fecha_pedido,
    cl.nombre AS cliente,
    pr.nombre AS producto,
    dp.cantidad,
    dp.precio_unitario,
    dp.descuento_unitario,
    dp.subtotal,
    dp.garantia_extendida_meses,
    dp.instalacion_requerida
FROM detalle_pedido dp
JOIN pedidos pe ON dp.id_pedido = pe.id_pedido
JOIN clientes cl ON pe.id_cliente = cl.id_cliente
JOIN productos pr ON dp.id_producto = pr.id_producto;

-- Vista: servicios técnicos con información de pedido, producto y cliente
CREATE OR REPLACE VIEW vista_servicios_tecnicos AS
SELECT
    st.id_servicio,
    st.tipo_servicio,
    st.descripcion,
    st.fecha_programada,
    st.fecha_completada,
    st.tecnico_asignado,
    st.costo,
    st.estado,
    st.observaciones,
    pe.id_pedido,
    cl.nombre AS cliente,
    pr.nombre AS producto
FROM servicios_tecnicos st
LEFT JOIN pedidos pe ON st.id_pedido = pe.id_pedido
LEFT JOIN clientes cl ON pe.id_cliente = cl.id_cliente
LEFT JOIN productos pr ON st.id_producto = pr.id_producto;

-- Vista: stock de productos activos
CREATE OR REPLACE VIEW vista_stock_productos AS
SELECT
    id_producto,
    nombre,
    stock,
    precio,
    activo
FROM productos
WHERE activo = TRUE;