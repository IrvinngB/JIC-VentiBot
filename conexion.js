const { Pool } = require('pg');

require('dotenv').config();

// Create a PostgreSQL connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // If your application is deployed, you might want to set this to true
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test the connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Error connecting to the database:', err);
    } else {
        console.log('Database connected successfully at:', res.rows[0].now);
    }
});

// Function to execute database queries
const query = (text, params) => pool.query(text, params);

module.exports = {
    query,
    pool
};