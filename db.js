const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Recommended defaults for production use:
    max: 10,                // max connections in pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
    console.error('Unexpected PostgreSQL pool error:', err);
});

module.exports = pool;
