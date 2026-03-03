/**
 * ingestLogic.js
 *
 * Shared upsert logic used by both:
 *   - POST /api/admin/ingest (HTTP API)
 *   - node scripts/ingest.js <file.json> (CLI)
 *
 * Expects a `data` object with this shape:
 * {
 *   "topics": [
 *     {
 *       "slug": "arrays",
 *       "title": "Arrays",
 *       "description": "...",
 *       "icon": "📦",
 *       "sort_order": 1,
 *       "lessons": [
 *         {
 *           "slug": "two-sum-pattern",
 *           "title": "The Two-Sum Pattern",
 *           "summary": "...",
 *           "difficulty": "beginner",
 *           "estimated_mins": 15,
 *           "prerequisites": [],
 *           "sort_order": 1,
 *           "is_published": true,
 *           "content_blocks": [
 *             { "type": "markdown", "sort_order": 1, "content": { "text": "## Intro\n..." } },
 *             { "type": "code",     "sort_order": 2, "content": { "language": "python", "code": "def...", "caption": "..." } },
 *             { "type": "quiz",     "sort_order": 3, "content": { "question": "...", "options": [...], "answer_index": 0, "explanation": "..." } }
 *           ]
 *         }
 *       ]
 *     }
 *   ]
 * }
 */

export async function ingestData(data, pool) {
    const client = await pool.connect();
    const stats = { topics: 0, lessons: 0, blocks: 0 };

    try {
        await client.query('BEGIN');

        for (const topic of data.topics) {
            // ── Upsert topic (by slug) ────────────────────────────────────────────
            const topicResult = await client.query(
                `INSERT INTO topics (slug, title, description, icon, sort_order)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (slug) DO UPDATE SET
           title       = EXCLUDED.title,
           description = EXCLUDED.description,
           icon        = EXCLUDED.icon,
           sort_order  = EXCLUDED.sort_order
         RETURNING id`,
                [
                    topic.slug,
                    topic.title,
                    topic.description || null,
                    topic.icon || null,
                    topic.sort_order != null ? topic.sort_order : 0,
                ]
            );
            const topicId = topicResult.rows[0].id;
            stats.topics++;

            for (const lesson of (topic.lessons || [])) {
                // ── Upsert lesson (by slug) ─────────────────────────────────────────
                const lessonResult = await client.query(
                    `INSERT INTO lessons
             (topic_id, slug, title, summary, difficulty, estimated_mins, prerequisites, sort_order, is_published)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (slug) DO UPDATE SET
             topic_id       = EXCLUDED.topic_id,
             title          = EXCLUDED.title,
             summary        = EXCLUDED.summary,
             difficulty     = EXCLUDED.difficulty,
             estimated_mins = EXCLUDED.estimated_mins,
             prerequisites  = EXCLUDED.prerequisites,
             sort_order     = EXCLUDED.sort_order,
             is_published   = EXCLUDED.is_published
           RETURNING id`,
                    [
                        topicId,
                        lesson.slug,
                        lesson.title,
                        lesson.summary || null,
                        lesson.difficulty || null,
                        lesson.estimated_mins || null,
                        lesson.prerequisites || [],
                        lesson.sort_order != null ? lesson.sort_order : 0,
                        lesson.is_published != null ? lesson.is_published : false,
                    ]
                );
                const lessonId = lessonResult.rows[0].id;
                stats.lessons++;

                // ── Replace content blocks (delete old, insert new) ─────────────────
                // Using delete+insert rather than upsert because block ordering
                // changes are common, and blocks have no stable natural key.
                if (Array.isArray(lesson.content_blocks) && lesson.content_blocks.length > 0) {
                    await client.query(`DELETE FROM content_blocks WHERE lesson_id = $1`, [lessonId]);

                    for (const block of lesson.content_blocks) {
                        await client.query(
                            `INSERT INTO content_blocks (lesson_id, type, sort_order, content, metadata)
               VALUES ($1, $2, $3, $4, $5)`,
                            [
                                lessonId,
                                block.type,
                                block.sort_order != null ? block.sort_order : 0,
                                JSON.stringify(block.content),
                                JSON.stringify(block.metadata || {}),
                            ]
                        );
                        stats.blocks++;
                    }
                }
            }
        }

        await client.query('COMMIT');
        return stats;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}


