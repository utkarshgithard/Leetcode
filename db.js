import 'dotenv/config';
import { Pool } from 'pg';

console.log('🔌 DATABASE_URL presence:', process.env.DATABASE_URL ? 'YES' : 'NO');

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
