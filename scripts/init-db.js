import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import pool from '../db.js';

const __dirname = path.resolve();
const schemaPath = path.join(__dirname, 'schema.sql');

async function initDb() {
    console.log('⏳ Initializing database schema...');
    try {
        const schema = fs.readFileSync(schemaPath, 'utf8');
        // Split schema into individual queries if needed, or just run as-is if the driver supports it
        // The 'pg' driver can execute multiple statements in one query call
        const client = await pool.connect();
        try {
            await client.query(schema);
            console.log('✅ Database schema initialized successfully!');
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('❌ Failed to initialize database schema:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

initDb();
