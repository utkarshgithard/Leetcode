import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

console.log('🔌 [DB_INIT] DATABASE_URL presence:', process.env.DATABASE_URL ? 'YES' : 'NO');
if (!process.env.DATABASE_URL) {
    console.error('❌ [DB_INIT] FATAL: DATABASE_URL is not defined in process.env');
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },
});

pool.on('error', (err) => {
    console.error('Unexpected PostgreSQL pool error:', err);
});

export default pool;
