// Script de prueba para verificar la reorganización de categorías
const { query } = require('./modulos/conexion');

async function verificarReorganizacionCategorias() {
  console.log('🔍 Verificando reorganización de categorías...\n');

  try {
    // 1. Verificar productos con categoría ID=1 (Laptops genérica)
    console.log('📊 PASO 1: Verificando productos con categoría ID=1');
    const productosCategoria1 = await query('productos', 'select', {
      filters: { id_categoria: 1 },
      columns: 'id_producto, nombre, precio, especificaciones_texto'
    });
    
    if (productosCategoria1.data && productosCategoria1.data.length > 0) {
      console.log(`   ⚠️  Se encontraron ${productosCategoria1.data.length} productos con categoría ID=1:`);
      productosCategoria1.data.forEach(p => {
        console.log(`   - ${p.nombre} ($${p.precio})`);
      });
    } else {
      console.log('   ✅ No hay productos con categoría ID=1');
    }
    console.log('');

    // 2. Verificar categorías existentes
    console.log('📋 PASO 2: Verificando categorías existentes');
    const categorias = await query('categorias_electronicas', 'select', {
      columns: 'id_categoria, nombre, descripcion'
    });
    
    if (categorias.data && categorias.data.length > 0) {
      console.log('   Categorías disponibles:');
      categorias.data.forEach(cat => {
        console.log(`   - ID ${cat.id_categoria}: ${cat.nombre}`);
      });
    }
    console.log('');

    // 3. Verificar distribución de productos por categoría
    console.log('📈 PASO 3: Distribución actual de productos por categoría');
    const distribucion = await query('vista_productos_detalle', 'select', {
      columns: 'categoria, COUNT(*) as cantidad'
    });
    
    if (distribucion.data && distribucion.data.length > 0) {
      console.log('   Distribución de productos:');
      distribucion.data.forEach(dist => {
        console.log(`   - ${dist.categoria}: ${dist.cantidad || 0} productos`);
      });
    }
    console.log('');

    // 4. Verificar productos gaming
    console.log('🎮 PASO 4: Verificando productos gaming');
    const productosGaming = await query('productos', 'select', {
      like: { especificaciones_texto: 'gaming' },
      columns: 'nombre, precio, especificaciones_texto'
    });
    
    if (productosGaming.data && productosGaming.data.length > 0) {
      console.log(`   Se encontraron ${productosGaming.data.length} productos gaming:`);
      productosGaming.data.forEach(p => {
        console.log(`   - ${p.nombre} ($${p.precio})`);
      });
    } else {
      console.log('   No se encontraron productos gaming específicos');
    }
    console.log('');

    console.log('✅ Verificación completada!');
    
  } catch (error) {
    console.error('❌ Error durante la verificación:', error);
  }
}

// Función para ejecutar la reorganización
async function ejecutarReorganizacion() {
  console.log('🔄 Iniciando reorganización de categorías...\n');
  
  try {
    // Aquí podrías ejecutar el script SQL de reorganización
    // Por ahora solo mostraremos las consultas recomendadas
    
    console.log('📝 Consultas SQL recomendadas para ejecutar:');
    console.log('');
    console.log('1. Verificar productos actuales con ID=1:');
    console.log('   SELECT * FROM productos WHERE id_categoria = 1;');
    console.log('');
    console.log('2. Reasignar productos gaming:');
    console.log(`   UPDATE productos SET id_categoria = (SELECT id_categoria FROM categorias_electronicas WHERE nombre = 'Laptops Gamer')
   WHERE id_categoria = 1 AND (LOWER(especificaciones_texto) LIKE '%gaming%' OR LOWER(especificaciones_texto) LIKE '%rtx%');`);
    console.log('');
    console.log('3. Ver script completo en: script_reorganizar_categorias.sql');
    
  } catch (error) {
    console.error('❌ Error durante la reorganización:', error);
  }
}

// Función principal
async function main() {
  console.log('🚀 Herramienta de Reorganización de Categorías ElectronicsJS\n');
  
  // Verificar primero
  await verificarReorganizacionCategorias();
  
  console.log('\n' + '='.repeat(60) + '\n');
  
  // Mostrar plan de reorganización
  await ejecutarReorganizacion();
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  verificarReorganizacionCategorias,
  ejecutarReorganizacion
};
