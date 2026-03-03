# codrapp Content API

A PostgreSQL + Express.js backend that serves AI-generated lesson content for the codrapp Flutter app. Keeps lesson content separate from user data (which lives in Firebase/Firestore).

---

## Project Structure

```
backend/
├── server.js               # Express entrypoint
├── db.js                   # Shared PostgreSQL connection pool
├── schema.sql              # Database DDL — run once to create tables
├── seed.example.json       # Example content payload (2 topics, 3 lessons)
├── package.json
├── .env.example            # Copy to .env and fill in your values
├── routes/
│   ├── learningPath.js     # Public GET endpoints
│   └── admin.js            # Admin endpoints (ingest, update)
└── scripts/
    ├── ingest.js           # CLI ingestion script
    └── ingestLogic.js      # Shared upsert logic (used by CLI + API)
```

---

## 1. Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [PostgreSQL](https://www.postgresql.org/) v14+

---

## 2. Setup

### Create the database

```bash
# In psql, as your postgres superuser:
CREATE DATABASE codrapp_content;
```

### Apply the schema

```bash
psql -U postgres -d codrapp_content -f schema.sql
```

### Configure environment

```bash
cp .env.example .env
```

Then edit `.env`:

```
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/codrapp_content
ADMIN_KEY=some-long-random-secret
PORT=4000
```

### Install dependencies

```bash
npm install
```

---

## 3. Running the Server

```bash
# Development (auto-restart on file changes)
npm run dev

# Production
npm start
```

Server runs on `http://localhost:4000` by default.

---

## 4. Ingesting Content

This is your **main workflow** as a content maintainer. You edit a JSON file (or produce one with AI) and run one command.

### Option A — CLI Script (recommended for local content work)

```bash
node scripts/ingest.js seed.example.json
```

Re-running is safe — it upserts by `slug`, so existing content is updated, not duplicated.

### Option B — HTTP API (for remote/CI workflows)

```bash
curl -X POST http://localhost:4000/api/admin/ingest \
  -H "Content-Type: application/json" \
  -H "x-admin-key: your-secret-key" \
  -d @seed.example.json
```

---

## 5. API Reference

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api/learning-paths` | List all topics with lesson count |
| `GET` | `/api/learning-paths/:topicSlug` | Topic detail + ordered published lessons |
| `GET` | `/api/lessons/:lessonSlug` | Full lesson with all content blocks |

#### Example — Fetch a lesson

```bash
curl http://localhost:4000/api/lessons/two-sum-pattern
```

```json
{
  "slug": "two-sum-pattern",
  "title": "The Two-Sum Pattern",
  "difficulty": "beginner",
  "estimated_mins": 12,
  "topic_slug": "arrays",
  "content_blocks": [
    { "type": "markdown", "sort_order": 1, "content": { "text": "## The Core Idea\n\n..." } },
    { "type": "code",     "sort_order": 2, "content": { "language": "python", "code": "..." } },
    { "type": "quiz",     "sort_order": 4, "content": { "question": "...", "answer_index": 2 } }
  ]
}
```

### Admin Endpoints (require `x-admin-key` header)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/admin/ingest` | Bulk-upsert from JSON body |
| `GET` | `/api/admin/lessons` | List all lessons (including drafts) |
| `PUT` | `/api/admin/lessons/:lessonSlug` | Update lesson metadata |

---

## 6. Content JSON Format

Use `seed.example.json` as a template. The full shape:

```json
{
  "topics": [
    {
      "slug": "arrays",
      "title": "Arrays & Hashing",
      "description": "Short description shown in the learning path list.",
      "icon": "📦",
      "sort_order": 1,
      "lessons": [
        {
          "slug": "two-sum-pattern",
          "title": "The Two-Sum Pattern",
          "summary": "One-sentence teaser.",
          "difficulty": "beginner",
          "estimated_mins": 12,
          "prerequisites": [],
          "sort_order": 1,
          "is_published": true,
          "content_blocks": [
            {
              "type": "markdown",
              "sort_order": 1,
              "content": { "text": "## Heading\n\nYour **Markdown** here..." }
            },
            {
              "type": "code",
              "sort_order": 2,
              "content": {
                "language": "python",
                "code": "def solution(): ...",
                "caption": "Optional caption shown below the code block"
              }
            },
            {
              "type": "quiz",
              "sort_order": 3,
              "content": {
                "question": "What is the time complexity?",
                "options": ["O(n²)", "O(n log n)", "O(n)", "O(1)"],
                "answer_index": 2,
                "explanation": "Because we do a single pass..."
              }
            }
          ]
        }
      ]
    }
  ]
}
```

### `difficulty` values: `beginner` | `intermediate` | `advanced`
### `type` values: `markdown` | `code` | `quiz`
### `is_published: false` = draft (hidden from public API, visible in admin)

---

## 7. Typical Content Workflow

```
1. Generate lesson content with AI (ChatGPT, Gemini, etc.)
2. Paste it into your JSON file (following the format above)
3. Review and edit the content
4. Run: node scripts/ingest.js my-content.json
5. Set is_published: true when ready for users
```
