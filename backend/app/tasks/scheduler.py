from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.services.ingestion import run_ingestion_cycle
from app.websocket.manager import ws_manager

settings = get_settings()
scheduler = AsyncIOScheduler()


async def run_ingestion_job(source: str | None = None) -> None:
    async with SessionLocal() as db:
        await run_ingestion_cycle(db, broadcaster=ws_manager.broadcast, sources=[source] if source else None)


def start_scheduler() -> None:
    if scheduler.running:
        return
    scheduler.add_job(
        run_ingestion_job,
        IntervalTrigger(minutes=max(settings.scheduler_interval_minutes, 1)),
        max_instances=1,
        coalesce=True,
        id="trend-ingestion-controller",
        replace_existing=True,
    )
    scheduler.start()


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown()
