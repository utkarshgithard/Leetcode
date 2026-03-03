-- =============================================================================
-- codrapp Content Backend — PostgreSQL Schema
-- =============================================================================
-- Run once to create the database tables.
-- Usage: psql -U <user> -d <dbname> -f schema.sql
-- =============================================================================

-- ─── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- for gen_random_uuid()

-- ─── Content Block Types ──────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE block_type AS ENUM ('markdown', 'code', 'quiz');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- TABLE: topics
-- Top-level concept groupings (e.g. "Arrays", "Dynamic Programming")
-- =============================================================================
CREATE TABLE IF NOT EXISTS topics (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT        NOT NULL UNIQUE,          -- URL-safe identifier, e.g. "dynamic-programming"
  title        TEXT        NOT NULL,                 -- Display name, e.g. "Dynamic Programming"
  description  TEXT,                                 -- Short summary shown in the learning path list
  icon         TEXT,                                 -- Emoji or icon identifier, e.g. "🧩"
  sort_order   INTEGER     NOT NULL DEFAULT 0,       -- Controls display order in the learning path
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TABLE: lessons
-- Individual lessons that belong to a topic.
-- Each lesson is a self-contained unit with an ordered set of content blocks.
-- =============================================================================
CREATE TABLE IF NOT EXISTS lessons (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id        UUID        NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  slug            TEXT        NOT NULL UNIQUE,        -- e.g. "two-sum-pattern"
  title           TEXT        NOT NULL,               -- e.g. "The Two-Sum Pattern"
  summary         TEXT,                               -- 1-2 sentence teaser for the lesson list
  difficulty      TEXT        CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  estimated_mins  INTEGER,                            -- Estimated read/practice time
  prerequisites   TEXT[]      DEFAULT '{}',           -- Array of lesson slugs this depends on
  sort_order      INTEGER     NOT NULL DEFAULT 0,     -- Order within the topic
  is_published    BOOLEAN     NOT NULL DEFAULT false, -- Draft/published toggle
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lessons_topic_id ON lessons(topic_id);
CREATE INDEX IF NOT EXISTS idx_lessons_slug     ON lessons(slug);

-- =============================================================================
-- TABLE: content_blocks
-- Ordered blocks of content within a lesson.
--
-- The `content` JSONB column stores the actual payload:
--   - type='markdown': { "text": "## Heading\n\nYour markdown here..." }
--   - type='code':     { "language": "python", "code": "def two_sum(...)", "caption": "Optional caption" }
--   - type='quiz':     { "question": "What is...", "options": ["A","B","C","D"], "answer_index": 2, "explanation": "..." }
--
-- The `metadata` JSONB column is for optional extras (tags, hints, etc.)
-- =============================================================================
CREATE TABLE IF NOT EXISTS content_blocks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id   UUID        NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  type        block_type  NOT NULL,
  sort_order  INTEGER     NOT NULL DEFAULT 0,         -- Controls display order within the lesson
  content     JSONB       NOT NULL,                   -- The actual content payload (see above)
  metadata    JSONB       NOT NULL DEFAULT '{}',      -- Optional: hints, tags, difficulty signals
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_blocks_lesson_id ON content_blocks(lesson_id);

-- =============================================================================
-- TRIGGER: auto-update updated_at on row changes
-- =============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_topics_updated_at
    BEFORE UPDATE ON topics
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_lessons_updated_at
    BEFORE UPDATE ON lessons
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_blocks_updated_at
    BEFORE UPDATE ON content_blocks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
