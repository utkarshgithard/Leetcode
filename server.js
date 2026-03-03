import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import learningPathRouter from './routes/learningPath.js';
import adminRouter from './routes/admin.js';
import pool from './db.js';

const app = express();
const PORT = process.env.PORT || 4000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));  // large limit for bulk ingest payloads

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api', learningPathRouter);
app.use('/api/admin', adminRouter);
app.use('/check', (req, res) => {
  res.json({ message: "I am hosted" });
});

app.get('/', (_req, res) => res.json({ message: "I am hosted" }))

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message, err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
async function start() {
  // Test DB connection before accepting traffic
  try {
    const client = await pool.connect();
    const res = await client.query('SELECT current_database(), version()');
    const { current_database, version } = res.rows[0];
    client.release();
    console.log(`🗄️  Database connected  →  ${current_database}`);
    console.log(`    ${version.split(',')[0]}`);
  } catch (err) {
    console.error('❌  Database connection FAILED:', err.message);
    console.error('    Check DATABASE_URL in your .env file');
    // Don't crash — let the server start so you can still see the error
  }


}
start();
export default app;