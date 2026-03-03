#!/usr/bin/env node
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { ingestData } from './ingestLogic.js';

// ─── Parse args ───────────────────────────────────────────────────────────────
const [, , filePath] = process.argv;

if (!filePath) {
    console.error('❌  Usage: node scripts/ingest.js <path-to-json-file>');
    process.exit(1);
}

const absolutePath = path.resolve(filePath);

if (!fs.existsSync(absolutePath)) {
    console.error(`❌  File not found: ${absolutePath}`);
    process.exit(1);
}

// ─── Parse JSON ───────────────────────────────────────────────────────────────
let data;
try {
    const raw = fs.readFileSync(absolutePath, 'utf-8');
    data = JSON.parse(raw);
} catch (err) {
    console.error(`❌  Failed to parse JSON: ${err.message}`);
    process.exit(1);
}

if (!data || !Array.isArray(data.topics)) {
    console.error('❌  Invalid format. Expected: { "topics": [ ... ] }');
    process.exit(1);
}

// ─── Connect & Ingest ─────────────────────────────────────────────────────────
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    console.log(`📂  Reading: ${absolutePath}`);
    console.log(`🔗  Connecting to: ${process.env.DATABASE_URL?.replace(/:\/\/.*@/, '://<credentials>@')}`);
    console.log('⏳  Ingesting...\n');

    try {
        const stats = await ingestData(data, pool);
        console.log('✅  Ingestion complete!');
        console.log(`   📁  Topics:  ${stats.topics}`);
        console.log(`   📖  Lessons: ${stats.lessons}`);
        console.log(`   📝  Blocks:  ${stats.blocks}`);
    } catch (err) {
        console.error('❌  Ingestion failed:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
})();
