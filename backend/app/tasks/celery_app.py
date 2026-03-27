import asyncio

from celery import Celery

from app.core.config import get_settings
from app.db.session import SessionLocal, engine
from app.services.cache import close_redis_clients
from app.services.ingestion import run_ingestion_cycle

settings = get_settings()
celery_app = Celery(
    "trendprompt",
    broker=settings.celery_broker_url,
    backend=settings.celery_backend_url,
)
celery_app.conf.timezone = "UTC"
celery_app.conf.beat_schedule = {
    "run-ingestion-controller": {
        "task": "tasks.run_ingestion",
        "schedule": max(settings.scheduler_interval_minutes, 1) * 60,
    },
}


@celery_app.task(name="tasks.run_ingestion")
def run_ingestion_task(source: str | None = None) -> dict:
    async def _job() -> dict:
        await engine.dispose()
        await close_redis_clients()
        async with SessionLocal() as db:
            result = await run_ingestion_cycle(db, sources=[source] if source else None)
        await engine.dispose()
        await close_redis_clients()
        return result

    return asyncio.run(_job())
