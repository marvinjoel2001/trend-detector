from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.trend import Trend
from app.models.trend_forecast import TrendForecast
from app.models.trend_snapshot import TrendSnapshot
from app.schemas.trend import ForecastOut, TrendDetailOut, TrendOut
from app.services.ingestion_controller import get_source_results, get_sources_status
from app.services.cache import cache_get_json, cache_set_json
from app.core.config import get_settings
from app.services.forecast import generate_forecast

router = APIRouter()
settings = get_settings()


@router.get("/trends")
async def list_trends(
    category: str | None = Query(default=None),
    platform: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    include_source_status: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]] | dict[str, Any]:
    cache_key = f"trends:list:{category or 'all'}:{platform or 'all'}:{limit}"
    cached = await cache_get_json(cache_key)
    if cached:
        if include_source_status:
            return {"items": cached, "source_status": await get_sources_status()}
        return cached

    stmt = select(Trend).order_by(Trend.rank_score.desc())
    if category:
        stmt = stmt.where(Trend.category == category)
    if platform:
        stmt = stmt.where(Trend.platform == platform)
    stmt = stmt.limit(limit)
    trends = list((await db.execute(stmt)).scalars().all())
    payload = [TrendOut.model_validate(t).model_dump(mode="json") for t in trends]
    await cache_set_json(cache_key, payload, ttl=max(settings.cache_ttl_trends, 1800))
    if include_source_status:
        return {"items": payload, "source_status": await get_sources_status()}
    return payload


@router.get("/trends/{trend_id}")
async def get_trend(trend_id: str, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    trend = await db.get(Trend, trend_id)
    if not trend:
        raise HTTPException(status_code=404, detail="Trend not found")

    snapshots = (
        await db.execute(
            select(TrendSnapshot)
            .where(TrendSnapshot.trend_id == trend_id)
            .order_by(TrendSnapshot.snapshot_ts.desc())
            .limit(24)
        )
    ).scalars().all()
    return {
        "trend": TrendDetailOut.model_validate(trend).model_dump(mode="json"),
        "snapshots": [
            {"snapshot_ts": s.snapshot_ts, "metric_views": s.metric_views, "velocity_score": s.velocity_score} for s in snapshots
        ],
    }


@router.get("/trends/forecast/{trend_id}", response_model=ForecastOut)
async def get_forecast(trend_id: str, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    cache_key = f"forecast:{trend_id}"
    cached = await cache_get_json(cache_key)
    if cached:
        return cached

    trend = await db.get(Trend, trend_id)
    if not trend:
        raise HTTPException(status_code=404, detail="Trend not found")

    snapshots = (
        await db.execute(
            select(TrendSnapshot)
            .where(TrendSnapshot.trend_id == trend_id)
            .order_by(TrendSnapshot.snapshot_ts.asc())
            .limit(48)
        )
    ).scalars().all()
    series = [(item.snapshot_ts, float(item.metric_views)) for item in snapshots]
    points, confidence = generate_forecast(series, horizon_hours=6)
    serialized_points = [
        {"ts": p["ts"].isoformat() if hasattr(p["ts"], "isoformat") else str(p["ts"]), "momentum": float(p["momentum"])}
        for p in points
    ]

    forecast = TrendForecast(trend_id=trend_id, horizon_hours=6, points_json=serialized_points, confidence=confidence)
    db.add(forecast)
    await db.commit()
    await db.refresh(forecast)

    payload = {
        "trend_id": trend_id,
        "generated_at": forecast.generated_at or datetime.utcnow(),
        "horizon_hours": 6,
        "confidence": confidence,
        "points": serialized_points,
    }
    await cache_set_json(cache_key, payload, ttl=max(settings.cache_ttl_forecast, 1800))
    return payload


@router.get("/google_trends_results")
async def get_google_trends_results(refresh: bool = Query(default=False)) -> list[dict[str, Any]]:
    cache_key = "google_trends_results"
    cached = None if refresh else await cache_get_json(cache_key)
    if cached:
        return cached
    payload = await get_source_results("google")
    await cache_set_json(cache_key, payload, ttl=max(settings.source_cache_ttl_seconds, 1800))
    return payload


@router.get("/reddit_results")
async def get_reddit_results(refresh: bool = Query(default=False)) -> list[dict[str, Any]]:
    cache_key = "reddit_results"
    cached = None if refresh else await cache_get_json(cache_key)
    if cached:
        return cached
    payload = await get_source_results("reddit")
    await cache_set_json(cache_key, payload, ttl=max(settings.source_cache_ttl_seconds, 1800))
    return payload


@router.get("/youtube_results")
async def get_youtube_results(refresh: bool = Query(default=False)) -> list[dict[str, Any]]:
    cache_key = "youtube_results"
    cached = None if refresh else await cache_get_json(cache_key)
    if cached:
        return cached
    payload = await get_source_results("youtube")
    await cache_set_json(cache_key, payload, ttl=max(settings.source_cache_ttl_seconds, 1800))
    return payload


@router.get("/tiktok_results")
async def get_tiktok_results(refresh: bool = Query(default=False)) -> list[dict[str, Any]]:
    cache_key = "tiktok_results"
    cached = None if refresh else await cache_get_json(cache_key)
    if cached and not any((item.get("title") or "").strip() in {"", "trend"} for item in cached):
        return cached
    payload = await get_source_results("tiktok")
    await cache_set_json(cache_key, payload, ttl=max(settings.source_cache_ttl_seconds, 1800))
    return payload


@router.get("/sources/status")
async def get_ingestion_sources_status() -> dict[str, dict[str, Any]]:
    return await get_sources_status()
