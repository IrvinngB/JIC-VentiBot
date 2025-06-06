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



module.exports = {
    supabase
};