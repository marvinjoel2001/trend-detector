# TrendPrompt Engine - Explicacion completa del funcionamiento

Este documento explica como funciona el proyecto completo de forma exacta: backend, scraping, pipeline de tendencias, generacion de prompts, forecast, frontend, websocket, cache, scheduler y despliegue.

## 1) Objetivo del sistema

TrendPrompt Engine descubre tendencias virales desde multiples fuentes, calcula su velocidad de crecimiento, las clasifica por categoria, predice momentum a 6 horas y genera prompts optimizados para creadores (video, imagen, audio).

Fuentes actuales:

- YouTube (API oficial)
- Google Trends (pytrends + RSS + fallback)
- Reddit (PRAW)
- TikTok (Playwright scraping + fallback)

## 2) Arquitectura general

Stack principal:

- Backend: FastAPI + SQLAlchemy async + PostgreSQL
- Cache/Event bus: Redis
- Scheduler: Celery Beat + Worker (o APScheduler fallback)
- Forecast: Prophet (con fallback lineal)
- Categorizacion: spaCy (con fallback por keywords)
- Frontend: Next.js (Stitch UI conectada a API real)

Servicios de runtime:

- `backend`: API HTTP + WebSocket
- `worker`: tareas periodicas de ingestion
- `postgres`: persistencia
- `redis`: cache, locks y pub/sub de eventos live
- `frontend`: dashboard UI

## 3) Flujo principal end-to-end

1. El scheduler dispara una corrida de ingestion.
2. El controlador consulta cada fuente (google/youtube/reddit/tiktok) con retries, cache, lock y rate limiting.
3. Cada resultado se normaliza al formato comun `trend`.
4. El sistema hace upsert en `trends` y guarda snapshot en `trend_snapshots`.
5. Se calcula `velocity_score` comparando vistas actuales vs snapshot anterior.
6. Se calcula `rank_score` para ordenar tendencias.
7. Se limpia cache de listados/forecast para exponer datos frescos.
8. Se publican eventos live por Redis y WebSocket:
   - `new_trend_detected`
   - `velocity_score_changed`
   - `trend_ranking_changed`
9. El frontend consulta la API y renderiza tarjetas, detalle, forecast y prompts.

## 4) Ingestion y scraping por fuente

### 4.1 YouTube

Archivo: `backend/app/services/youtube_scraper.py`

- Usa `YouTube Data API v3` (`videos?chart=mostPopular&regionCode=US`).
- Requiere `YOUTUBE_API_KEY`.
- Convierte cada item a formato normalizado (`id`, `title`, `platform`, `timestamp`, `metadata`).
- Si no hay API key, falla con `youtube_api_key_missing`.

### 4.2 Google Trends

Archivo: `backend/app/services/google_trends.py`

Estrategia en 3 capas:

1. Primario: `pytrends.trending_searches(pn="united_states")`
2. Backup: RSS oficial `https://trends.google.com/trending/rss?geo=US`
3. Fallback controlado: lista interna marcada con `metadata.fallback = true`

Adicional:

- Cooldown cuando hay bloqueo/rate limit.
- User-Agent rotativo y soporte de proxy por variables de entorno.

### 4.3 Reddit

Archivo: `backend/app/services/reddit_scraper.py`

- Usa `PRAW` con credenciales (`REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT`).
- Consulta subreddits clave (`technology`, `gaming`, `memes`, `music`, `worldnews`) y toma posts `hot`.
- Mapea score/comments a metrica de vistas/likes.
- Si faltan credenciales, marca error `reddit_credentials_missing`.

### 4.4 TikTok

Archivo: `backend/app/services/tiktok_scraper.py`

- Usa `Playwright` (Chromium) contra `https://www.tiktok.com/discover`.
- Extrae hashtags desde enlaces `a[href*='/tag/']`.
- Limpia tags y construye trends.
- Si scraping falla o no hay tags, activa fallback controlado (`metadata.fallback = true`) para no romper el pipeline.

## 5) Controlador de ingestion (core de resiliencia)

Archivo: `backend/app/services/ingestion_controller.py`

Responsabilidades clave:

- Lock global de ingestion para evitar corridas superpuestas.
- Rate limit por fuente (`source_interval_*_minutes`).
- Retry exponencial por fuente.
- Jitter aleatorio para distribuir carga.
- Cache de resultados por fuente en Redis.
- Estado operativo por fuente (`real`, `fallback`, `cached`, `unavailable`, `locked`, `locked_cached`).

Resultado:

- El sistema evita caidas totales cuando una fuente falla.
- Se puede inspeccionar salud por `GET /api/sources/status`.

## 6) Normalizacion, scoring y persistencia

Archivo: `backend/app/services/ingestion.py`

### 6.1 Normalizacion

Cada item entrante se transforma a:

- `external_id`
- `title`
- `platform`
- `category`
- `metadata`
- `description`
- `timestamp`

### 6.2 Categorizacion

Archivo: `backend/app/services/categorizer.py`

- Intenta spaCy (`en_core_web_sm`).
- Si spaCy no esta disponible, usa keyword matching.
- Categorias: `gaming`, `music`, `lifestyle`, `memes`, `news`, `technology`, `finance`, `education`.

### 6.3 Velocity score

Archivo: `backend/app/services/velocity.py`

Formula implementada:

`velocity_score = (current_views - previous_views) / elapsed_hours`

Notas:

- Si no existe snapshot previo, velocity = 0.
- Se usa `elapsed_hours` con piso minimo para evitar division por cero.

### 6.4 Rank score

En ingestion se calcula:

`rank_score = max(velocity, 0) + (likes / 1000)`

Esto permite ordenar tendencias combinando aceleracion y engagement.

### 6.5 Base de datos

Tablas principales:

- `trends`
- `trend_snapshots`
- `trend_forecasts`
- `prompts`
- `prompt_feedback`
- `users`

En startup, FastAPI ejecuta `Base.metadata.create_all` para asegurar esquema basico.

## 7) Forecast engine

Archivo: `backend/app/services/forecast.py`

- Endpoint: `GET /api/trends/forecast/{id}`
- Usa serie historica de snapshots (views).
- Si hay datos suficientes: Prophet.
- Si falla Prophet o hay pocos datos: forecast lineal.
- Horizonte: 6 horas.
- Persiste resultado en `trend_forecasts` y cachea en Redis.

## 8) Prompt Generator Engine

Archivos:

- `backend/app/services/prompt_generator.py`
- `backend/app/api/prompts.py`

Entrada:

- `trend_id`
- `platform_target`
- `output_type` (`video`, `image`, `audio`)
- `user_niche`

Salida estructurada:

- `description`
- `visual_style`
- `tone`
- `format`
- `hashtags`
- `recommended_duration`
- `publish_time`

El endpoint `POST /api/prompt/generate` guarda ademas:

- `prompt_text` final
- `payload_json` con estructura completa

Tambien existen:

- `GET /api/prompt/history`
- `POST /api/prompt/feedback`

## 9) API y WebSocket

### 9.1 API REST principal

Rutas:

- `GET /api/trends`
- `GET /api/trends/{id}`
- `GET /api/trends/forecast/{id}`
- `POST /api/prompt/generate`
- `GET /api/prompt/history`
- `POST /api/prompt/feedback`
- `GET /api/sources/status`
- Endpoints por fuente:
  - `GET /api/google_trends_results`
  - `GET /api/youtube_results`
  - `GET /api/reddit_results`
  - `GET /api/tiktok_results`

### 9.2 WebSocket live

Ruta:

- `WS /ws/live-trends`

Flujo:

1. Ingestion publica eventos en Redis (`live_trends_events`).
2. API escucha canal Redis.
3. API retransmite a conexiones activas WebSocket.
4. Frontend live page consume y renderiza eventos en tiempo real.

## 10) Frontend (Stitch integrado)

La UI no se rediseno; se conecto a backend real.

Mapeo de pantallas:

- Dashboard `/`:
  - Trends + source status + quick prompt generator
- Trend Detail `/trends/[id]`:
  - detalle + snapshots + forecast
- Prompt Generator `/prompt-generator`:
  - formulario completo + resultado estructurado
- Forecast `/forecast`:
  - selector de trend + grafico de momentum
- History `/history`:
  - historial de prompts
- Live Trends `/live-trends`:
  - stream WebSocket

Cliente API:

- `frontend/lib/api.ts`

Internacionalizacion:

- `frontend/lib/i18n.tsx`
- Idiomas activos: ingles (`en`) y espanol (`es`)

## 11) Cache, lock y rendimiento

Cache Redis aplicada a:

- listados de trends
- forecast por trend
- prompts generados
- payload por fuente
- estados de fuente

Lock global:

- evita ejecuciones concurrentes peligrosas de ingestion.

Beneficio:

- menos costo de API externa
- mayor estabilidad frente a bloqueos temporales
- menor latencia de frontend

## 12) Scheduler y ejecucion periodica

### Modo Celery (recomendado)

- `worker` ejecuta `celery worker -B`.
- Beat dispara tarea `tasks.run_ingestion`.
- Intervalo configurable por `SCHEDULER_INTERVAL_MINUTES`.

### Modo fallback APScheduler

- Si `USE_CELERY=false`, el backend activa APScheduler interno.
- Mismo objetivo: disparar ingestion periodica.

## 13) Configuracion por entorno

Variables importantes:

- `DATABASE_URL`
- `REDIS_URL`
- `YOUTUBE_API_KEY`
- `REDDIT_CLIENT_ID`
- `REDDIT_CLIENT_SECRET`
- `REDDIT_USER_AGENT`
- `TIKTOK_HEADLESS`
- `CORS_ORIGINS`
- `USE_CELERY`
- `USE_REDIS_CACHE`
- `SCHEDULER_INTERVAL_MINUTES`

Referencia:

- `.env.example`
- `README.md` (incluye checklist Railway)

## 14) Como levantarlo local

Comando:

```bash
docker compose up --build
```

Accesos:

- Frontend: `http://localhost:3000`
- Backend docs: `http://localhost:8000/docs`
- Health: `http://localhost:8000/health`

## 15) Limitaciones y comportamiento esperado

- YouTube requiere API key valida.
- Reddit requiere credenciales validas para data real.
- Google y TikTok pueden activar fallback por bloqueos externos.
- Fallback esta disenado para mantener servicio estable, no para reemplazar data real indefinidamente.

## 16) Resumen corto del valor tecnico

Este proyecto ya funciona como MVP productivo:

- ingestion multi-fuente
- persistencia historica
- scoring de velocidad
- forecast
- prompt generation estructurada
- dashboard conectado
- live events por websocket
- tolerancia a fallos y cache

En pocas palabras: detecta tendencias, estima momentum y te devuelve prompts accionables listos para producir contenido.
