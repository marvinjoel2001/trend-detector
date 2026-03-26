# trend-detector

Trend ingestion and prompt engine using FastAPI + PostgreSQL + Redis + Celery + Next.js.

## Features

- Multi-source ingestion services:
  - `youtube_scraper.py` (YouTube Data API v3)
  - `google_trends.py` (pytrends + Google RSS backup)
  - `reddit_scraper.py` (PRAW)
  - `tiktok_scraper.py` (Playwright scraping)
- Velocity engine with snapshot persistence in `trend_snapshots`
- Trend categorization using spaCy (with keyword fallback)
- Prompt Generator Engine (`/api/prompt/generate`)
- Forecast engine with Prophet (linear fallback when needed)
- Scheduler every 30 minutes:
  - Celery worker+beat enabled when `USE_CELERY=true`
  - APScheduler fallback enabled when `USE_CELERY=false`
- Redis caching for trends, forecasts, and generated prompts
- WebSocket live events at `/ws/live-trends` (worker/backend event bridge via Redis pub/sub)
- Stitch-style frontend pages connected to backend:
  - Dashboard (`/`)
  - Trend detail (`/trends/[id]`)
  - Prompt generator (`/prompt-generator`)
  - Prompt history (`/history`)
  - Forecast (`/forecast`)
  - Live trends (`/live-trends`)

## API Endpoints

- `GET /api/trends?category=&platform=&limit=`
- `GET /api/trends/{id}`
- `GET /api/trends/forecast/{id}`
- `POST /api/prompt/generate`
- `GET /api/prompt/history`
- `POST /api/prompt/feedback`
- `WS /ws/live-trends`

## Environment Variables

Create a `.env` file in project root.

```env
# Required for YouTube real ingestion
YOUTUBE_API_KEY=your_youtube_api_key

# Required for Reddit real ingestion
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret
REDDIT_USER_AGENT=trend-detector/1.0

# Optional scraping/network settings
TIKTOK_HEADLESS=true
HTTP_PROXY=
HTTPS_PROXY=
```

## Run Locally

1. Start all services:

```bash
docker compose up --build
```

2. Open:
   - Frontend: `http://localhost:3000`
   - Backend docs: `http://localhost:8000/docs`

## Notes

- Source health is available at `GET /api/sources/status`.
- Trends + source status are available at `GET /api/trends?include_source_status=true`.
- If a source fails, frontend shows a toast with the exact source and message.
