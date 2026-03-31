# trend-detector

Trend ingestion and prompt engine using FastAPI + PostgreSQL + Redis + Celery + Next.js.

## Features

- Multi-source ingestion services:
  - `youtube_scraper.py` (YouTube Data API v3)
  - `google_trends.py` (pytrends + Google RSS backup)
  - `reddit_scraper.py` (PRAW)
  - `tiktok_scraper.py` (Apify primary + Playwright fallback)
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

# Recommended for TikTok regional live ingestion
APIFY_API_TOKEN=your_apify_api_token
APIFY_TIKTOK_ACTOR_ID=novi/fast-tiktok-scraper

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

## Railway Deploy Checklist

Deploy as multiple Railway services (recommended):

- `backend-api` (Dockerfile: `backend/Dockerfile`)
- `backend-worker` (Dockerfile: `backend/Dockerfile`, start command override for Celery)
- `frontend-web` (Dockerfile: `frontend/Dockerfile`)
- Railway PostgreSQL plugin
- Railway Redis plugin

### 1) Backend API service

- Root directory: `backend`
- Dockerfile: `Dockerfile`
- Healthcheck path: `/health`
- Required environment variables:
  - `APP_ENV=production`
  - `DEBUG=false`
  - `API_PREFIX=/api`
  - `DATABASE_URL=${{Postgres.DATABASE_URL}}`
  - `REDIS_URL=${{Redis.REDIS_URL}}`
  - `USE_REDIS_CACHE=true`
  - `USE_CELERY=true`
  - `CORS_ORIGINS=https://<your-frontend-domain>`
  - `YOUTUBE_API_KEY=<your_youtube_key>`
  - `APIFY_API_TOKEN=<your_apify_token>`
  - `APIFY_TIKTOK_ACTOR_ID=novi/fast-tiktok-scraper`
  - `TIKTOK_HEADLESS=true`
  - Optional:
    - `REDDIT_CLIENT_ID`
    - `REDDIT_CLIENT_SECRET`
    - `REDDIT_USER_AGENT=trendprompt-engine/1.0`

### 2) Worker service

- Root directory: `backend`
- Dockerfile: `Dockerfile`
- Start command:
  - `celery -A app.tasks.celery_app.celery_app worker -B -l info`
- Environment variables: same as backend API service.

### 3) Frontend service

- Root directory: `frontend`
- Dockerfile: `Dockerfile`
- Required environment variables:
  - `NEXT_PUBLIC_API_URL=https://<your-backend-domain>/api`
  - `NEXT_PUBLIC_WS_URL=wss://<your-backend-domain>/ws/live-trends`

### 4) Notes

- The backend supports Railway Postgres URL formats (`postgres://...` and `postgresql://...`) and normalizes to `postgresql+asyncpg://...` automatically.
- If TikTok or Google providers are blocked/rate-limited, source status is exposed at:
  - `GET /api/sources/status`
- For first validation after deploy, verify:
  - `GET /health`
  - `GET /api/trends?include_source_status=true`
  - `GET /api/google_trends_results?refresh=true`
  - `GET /api/youtube_results?refresh=true`
  - `GET /api/tiktok_results?refresh=true`

## Notes

- Source health is available at `GET /api/sources/status`.
- Trends + source status are available at `GET /api/trends?include_source_status=true`.
- If a source fails, frontend shows a toast with the exact source and message.
