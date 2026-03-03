const express = require('express');
const router = express.Router();
const pool = require('../db');

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/learning-paths
// Returns all published topics with their lesson counts, ordered by sort_order.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/learning-paths', async (_req, res, next) => {
    try {
        const result = await pool.query(`
      SELECT
        t.id,
        t.slug,
        t.title,
        t.description,
        t.icon,
        t.sort_order,
        COUNT(l.id) FILTER (WHERE l.is_published = true) AS lesson_count
      FROM topics t
      LEFT JOIN lessons l ON l.topic_id = t.id
      GROUP BY t.id
      ORDER BY t.sort_order ASC, t.title ASC
    `);
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/learning-paths/:topicSlug
// Returns a topic + its ordered list of published lessons (without content blocks).
// ─────────────────────────────────────────────────────────────────────────────
router.get('/learning-paths/:topicSlug', async (req, res, next) => {
    const { topicSlug } = req.params;
    try {
        // Fetch the topic
        const topicResult = await pool.query(
            `SELECT id, slug, title, description, icon FROM topics WHERE slug = $1`,
            [topicSlug]
        );
        if (topicResult.rows.length === 0) {
            return res.status(404).json({ error: `Topic '${topicSlug}' not found` });
        }
        const topic = topicResult.rows[0];

        // Fetch ordered lessons for that topic
        const lessonsResult = await pool.query(
            `SELECT
         id, slug, title, summary, difficulty,
         estimated_mins, prerequisites, sort_order, is_published
       FROM lessons
       WHERE topic_id = $1 AND is_published = true
       ORDER BY sort_order ASC, title ASC`,
            [topic.id]
        );

        res.json({ ...topic, lessons: lessonsResult.rows });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/lessons/:lessonSlug
// Returns a full lesson with all its content blocks, ordered by sort_order.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/lessons/:lessonSlug', async (req, res, next) => {
    const { lessonSlug } = req.params;
    try {
        // Fetch the lesson + its parent topic slug
        const lessonResult = await pool.query(
            `SELECT
         l.id, l.slug, l.title, l.summary, l.difficulty,
         l.estimated_mins, l.prerequisites, l.sort_order, l.is_published,
         t.slug AS topic_slug, t.title AS topic_title
       FROM lessons l
       JOIN topics t ON t.id = l.topic_id
       WHERE l.slug = $1`,
            [lessonSlug]
        );
        if (lessonResult.rows.length === 0) {
            return res.status(404).json({ error: `Lesson '${lessonSlug}' not found` });
        }
        const lesson = lessonResult.rows[0];

        // Fetch content blocks ordered correctly
        const blocksResult = await pool.query(
            `SELECT id, type, sort_order, content, metadata
       FROM content_blocks
       WHERE lesson_id = $1
       ORDER BY sort_order ASC`,
            [lesson.id]
        );

        res.json({ ...lesson, content_blocks: blocksResult.rows });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/search?q=...
// Returns a list of lessons (concepts) matching the search query.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/search', async (req, res, next) => {
    const { q } = req.query;
    if (!q || q.trim().length === 0) {
        return res.json([]);
    }

    try {
        const result = await pool.query(
            `SELECT
         l.id, l.slug, l.title, l.summary, l.difficulty,
         l.estimated_mins, l.prerequisites, l.sort_order,
         t.slug AS topic_slug, t.title AS topic_title
       FROM lessons l
       JOIN topics t ON t.id = l.topic_id
       WHERE
         l.is_published = true AND (
           l.title ILIKE $1 OR
           l.summary ILIKE $1 OR
           t.title ILIKE $1
         )
       ORDER BY
         CASE
           WHEN l.title ILIKE $1 THEN 1
           WHEN t.title ILIKE $1 THEN 2
           ELSE 3
         END,
         l.sort_order ASC
       LIMIT 10`,
            [`%${q}%`]
        );
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
