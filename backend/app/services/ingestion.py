import logging
from collections.abc import Awaitable, Callable
from datetime import datetime
from typing import Any

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.trend import Trend
from app.models.trend_snapshot import TrendSnapshot
from app.services.cache import cache_delete_prefix
from app.services.categorizer import categorize_text
from app.services.ingestion_controller import IngestionController
from app.services.live_events import publish_live_event
from app.services.velocity import compute_velocity

logger = logging.getLogger(__name__)


async def _get_latest_snapshot(db: AsyncSession, trend_id: str) -> TrendSnapshot | None:
    stmt: Select[tuple[TrendSnapshot]] = (
        select(TrendSnapshot)
        .where(TrendSnapshot.trend_id == trend_id)
        .order_by(TrendSnapshot.snapshot_ts.desc())
        .limit(1)
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def _upsert_trend(db: AsyncSession, normalized: dict[str, Any]) -> tuple[Trend, bool, float]:
    stmt = select(Trend).where(
        Trend.external_id == normalized["external_id"],
        Trend.platform == normalized["platform"],
    )
    trend = (await db.execute(stmt)).scalar_one_or_none()
    is_new = trend is None

    if trend is None:
        trend = Trend(
            external_id=normalized["external_id"],
            title=normalized["title"],
            platform=normalized["platform"],
            category=normalized["category"],
            description=normalized.get("description"),
            metadata_json=normalized["metadata"],
        )
        db.add(trend)
        await db.flush()

    previous_snapshot = await _get_latest_snapshot(db, trend.id)
    velocity = compute_velocity(
        current_views=normalized["metadata"].get("views", 0),
        previous_views=(previous_snapshot.metric_views if previous_snapshot else None),
        previous_ts=(previous_snapshot.snapshot_ts if previous_snapshot else None),
    )
    rank_score = max(velocity, 0.0) + (normalized["metadata"].get("likes", 0) / 1000.0)

    trend.title = normalized["title"]
    trend.category = normalized["category"]
    trend.description = normalized.get("description")
    trend.metadata_json = normalized["metadata"]
    trend.velocity_score = velocity
    trend.rank_score = rank_score

    snapshot = TrendSnapshot(
        trend_id=trend.id,
        platform=trend.platform,
        metric_views=int(normalized["metadata"].get("views", 0)),
        metric_likes=int(normalized["metadata"].get("likes", 0)),
        velocity_score=velocity,
        metadata_json=normalized["metadata"],
    )
    db.add(snapshot)
    return trend, is_new, velocity


def _normalize(item: dict[str, Any]) -> dict[str, Any]:
    metadata = item.get("metadata", {})
    category = categorize_text(item["title"], metadata)
    geo_code = str(metadata.get("geo_code") or "US").strip().upper()
    external_id = str(item.get("id") or "").strip() or item.get("title", "untitled")
    return {
        "external_id": f"{geo_code}:{external_id}",
        "title": item.get("title", "Untitled Trend"),
        "platform": item.get("platform", "unknown"),
        "category": category,
        "metadata": metadata,
        "description": item.get("description"),
        "timestamp": item.get("timestamp"),
    }


async def run_ingestion_cycle(
    db: AsyncSession,
    broadcaster: Callable[[dict[str, Any]], Awaitable[None]] | None = None,
    sources: list[str] | None = None,
    force: bool = False,
    geo_code: str | None = None,
    emit_events: bool = True,
) -> dict[str, int]:
    logger.info("Starting ingestion cycle", extra={"context": "ingestion_cycle", "status": "started"})
    all_items: list[dict[str, Any]] = []

    controller = IngestionController(geo_code=geo_code)
    collected = await controller.collect_sources(sources=sources, force=force)
    for source_name, items in collected.items():
        logger.info(
            "ingestion_source_collected",
            extra={"source": source_name, "items_count": len(items), "response_status": "ok"},
        )
        all_items.extend(items)

    created = 0
    updated = 0
    new_events: list[dict[str, Any]] = []
    velocity_events: list[dict[str, Any]] = []

    for item in all_items:
        if item.get("metadata", {}).get("fallback"):
            logger.warning(
                "ingestion_skipping_fallback_item",
                extra={"source": item.get("platform", "unknown"), "response_status": "skipped_fallback"},
            )
            continue
        if item.get("platform") == "tiktok":
            metadata = item.get("metadata", {})
            hashtag = str(metadata.get("hashtag", "")).strip()
            title = str(item.get("title", "")).strip().lower()
            has_media_signal = bool(metadata.get("thumbnail_url") or metadata.get("video_url") or metadata.get("source_url"))
            if (not hashtag and not has_media_signal) or title in {"", "trend"}:
                logger.warning(
                    "ingestion_skipping_invalid_tiktok_item",
                    extra={"source": "tiktok", "response_status": "skipped_invalid", "items_count": 0},
                )
                continue
        normalized = _normalize(item)
        trend, is_new, velocity = await _upsert_trend(db, normalized)
        if is_new:
            created += 1
            new_events.append({"trend_id": trend.id, "title": trend.title, "platform": trend.platform})
        else:
            updated += 1
        if velocity > 0:
            velocity_events.append({"trend_id": trend.id, "velocity_score": velocity, "title": trend.title})

    await db.commit()
    await cache_delete_prefix("trends:")
    await cache_delete_prefix("forecast:")

    async def emit(payload: dict[str, Any]) -> None:
        if broadcaster:
            await broadcaster(payload)
        else:
            await publish_live_event(payload)

    if emit_events:
        if new_events:
            await emit({"event": "new_trend_detected", "timestamp": datetime.utcnow().isoformat(), "items": new_events})
        if velocity_events:
            await emit(
                {"event": "velocity_score_changed", "timestamp": datetime.utcnow().isoformat(), "items": velocity_events[:20]}
            )
        rankings = (await db.execute(select(Trend.id, Trend.title, Trend.rank_score).order_by(Trend.rank_score.desc()).limit(10))).all()
        await emit(
            {
                "event": "trend_ranking_changed",
                "timestamp": datetime.utcnow().isoformat(),
                "items": [{"trend_id": r.id, "title": r.title, "rank_score": r.rank_score} for r in rankings],
            }
        )

    result = {"total": len(all_items), "created": created, "updated": updated}
    logger.info("Ingestion cycle done result=%s", result)
    return result
