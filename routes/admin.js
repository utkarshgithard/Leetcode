const express = require('express');
const router = express.Router();
const pool = require('../db');
const { ingestData } = require('../scripts/ingestLogic');

// ─────────────────────────────────────────────────────────────────────────────
// Middleware: simple API-key auth for all admin routes
// Send the key as: x-admin-key: <your-secret>
// ─────────────────────────────────────────────────────────────────────────────
router.use((req, res, next) => {
    const key = req.headers['x-admin-key'];
    if (!key || key !== process.env.ADMIN_KEY) {
        return res.status(401).json({ error: 'Unauthorized: invalid or missing x-admin-key header' });
    }
    next();
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/ingest
// Bulk-upsert topics, lessons, and content blocks from a JSON body.
//
// Expected body shape: same as seed.example.json
// {
//   "topics": [
//     {
//       "slug": "arrays",
//       "title": "Arrays",
//       ...
//       "lessons": [
//         {
//           "slug": "two-sum-pattern",
//           "title": "The Two-Sum Pattern",
//           ...
//           "content_blocks": [ ... ]
//         }
//       ]
//     }
//   ]
// }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/ingest', async (req, res, next) => {
    const payload = req.body;

    if (!payload || !Array.isArray(payload.topics)) {
        return res.status(400).json({
            error: 'Invalid payload. Expected: { "topics": [ ... ] }',
        });
    }

    try {
        const stats = await ingestData(payload, pool);
        res.json({
            message: `Ingested ${stats.topics} topics, ${stats.lessons} lessons, ${stats.blocks} blocks`,
            stats,
        });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/admin/lessons/:lessonSlug
// Update metadata fields on a single lesson (title, summary, difficulty, etc.)
// Does NOT touch content_blocks — use POST /ingest for block updates.
// ─────────────────────────────────────────────────────────────────────────────
router.put('/lessons/:lessonSlug', async (req, res, next) => {
    const { lessonSlug } = req.params;
    const { title, summary, difficulty, estimated_mins, prerequisites, is_published, sort_order } = req.body;

    try {
        const result = await pool.query(
            `UPDATE lessons
       SET
         title           = COALESCE($2, title),
         summary         = COALESCE($3, summary),
         difficulty      = COALESCE($4, difficulty),
         estimated_mins  = COALESCE($5, estimated_mins),
         prerequisites   = COALESCE($6, prerequisites),
         is_published    = COALESCE($7, is_published),
         sort_order      = COALESCE($8, sort_order)
       WHERE slug = $1
       RETURNING *`,
            [lessonSlug, title, summary, difficulty, estimated_mins, prerequisites, is_published, sort_order]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: `Lesson '${lessonSlug}' not found` });
        }
        res.json({ message: 'Lesson updated', lesson: result.rows[0] });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/lessons  (list all, including unpublished — for review)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/lessons', async (_req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT
         l.id, l.slug, l.title, l.difficulty, l.is_published,
         l.sort_order, t.slug AS topic_slug, t.title AS topic_title,
         COUNT(cb.id) AS block_count
       FROM lessons l
       JOIN topics t ON t.id = l.topic_id
       LEFT JOIN content_blocks cb ON cb.lesson_id = l.id
       GROUP BY l.id, t.slug, t.title
       ORDER BY t.sort_order ASC, l.sort_order ASC`
        );
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
