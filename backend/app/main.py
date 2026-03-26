import asyncio
import logging
from contextlib import asynccontextmanager
from contextlib import suppress

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api import api_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.services.ingestion import run_ingestion_cycle
from app.services.live_events import listen_live_events
from app.tasks.celery_app import run_ingestion_task
from app.tasks.scheduler import start_scheduler, stop_scheduler
from app.websocket.manager import ws_manager
import app.models  # noqa: F401

settings = get_settings()
configure_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    redis_listener_task = None
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with SessionLocal() as db:
        await db.execute(text("SELECT 1"))
        await run_ingestion_cycle(db, broadcaster=ws_manager.broadcast)

    if settings.use_celery:
        redis_listener_task = asyncio.create_task(listen_live_events(ws_manager.broadcast))
        logger.info("Celery mode enabled; trigger async ingestion seed task")
        run_ingestion_task.delay()
    else:
        logger.info("APScheduler fallback mode enabled")
        start_scheduler()

    yield

    if not settings.use_celery:
        stop_scheduler()
    if redis_listener_task:
        redis_listener_task.cancel()
        with suppress(asyncio.CancelledError):
            await redis_listener_task
    await engine.dispose()


app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[item.strip() for item in settings.cors_origins.split(",") if item.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/ingest/now")
async def ingest_now() -> dict[str, int]:
    async with SessionLocal() as db:
        return await run_ingestion_cycle(db, broadcaster=ws_manager.broadcast)


@app.websocket("/ws/live-trends")
async def websocket_live_trends(ws: WebSocket) -> None:
    await ws_manager.connect(ws)
    try:
        while True:
            await asyncio.sleep(10)
            await ws.send_json({"event": "heartbeat", "message": "live", "ts": asyncio.get_running_loop().time()})
    except WebSocketDisconnect:
        ws_manager.disconnect(ws)
    except Exception:  # noqa: BLE001
        ws_manager.disconnect(ws)
