const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

// Validar variables de entorno necesarias
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    throw new Error('Faltan las variables SUPABASE_URL o SUPABASE_ANON_KEY en el archivo .env');
}

// Crear el cliente de Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// Probar la conexión obteniendo una fila de una tabla existente (ajusta el nombre de la tabla si es necesario)
async function testConnection() {
    const { data, error } = await supabase.from('clientes').select('*').limit(1);
    if (error) {
        console.error('Error connecting to Supabase:', error);
    } else {
        console.log('Supabase connected successfully. Example data:', data);
    }
}
testConnection();

// Función para ejecutar consultas (ejemplo para la tabla "users")
async function query(table, method = 'select', params = {}) {
    let req = supabase.from(table);
    if (method === 'select') {
        req = req.select(params.columns || '*');
    }
    // Puedes agregar más métodos según lo necesites
    return req;
}

module.exports = {
    supabase,
    query
};