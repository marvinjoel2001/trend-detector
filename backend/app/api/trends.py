from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.trend import Trend
from app.models.trend_forecast import TrendForecast
from app.models.trend_snapshot import TrendSnapshot
from app.schemas.trend import ForecastExplainIn, ForecastExplanationOut, ForecastOut, TrendDetailOut, TrendOut
from app.services.ingestion_controller import get_source_results, get_sources_status
from app.services.cache import cache_get_json, cache_set_json
from app.core.config import get_settings
from app.services.forecast import generate_forecast
from app.services.forecast_explainer import explain_forecast
from app.services.geo_targets import normalize_geo_code, resolve_geo_target
from app.services.ingestion import run_ingestion_cycle

router = APIRouter()
settings = get_settings()


def _is_strict_geo_match(trend: Trend, geo_code: str | None) -> bool:
    if not geo_code:
        return True
    metadata = trend.metadata_json or {}
    if str(metadata.get("geo_code") or "US").upper() != geo_code:
        return False
    if geo_code != "US" and not bool(metadata.get("geo_precise")):
        return False
    return True


@router.get("/trends")
async def list_trends(
    category: str | None = Query(default=None),
    platform: str | None = Query(default=None),
    geo: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    include_source_status: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]] | dict[str, Any]:
    geo_code = normalize_geo_code(geo)
    cache_key = f"trends:v4:list:{geo_code}:{category or 'all'}:{platform or 'all'}:{limit}"
    cached = await cache_get_json(cache_key)
    if isinstance(cached, list) and cached:
        if include_source_status:
            return {"items": cached, "source_status": await get_sources_status(geo_code=geo_code)}
        return cached

    stmt = select(Trend).order_by(Trend.rank_score.desc())
    trends = list((await db.execute(stmt)).scalars().all())

    def _filter(items: list[Trend]) -> list[Trend]:
        filtered = items
        if geo_code:
            filtered = [item for item in filtered if _is_strict_geo_match(item, geo_code)]
        if category:
            filtered = [item for item in filtered if item.category == category]
        if platform:
            filtered = [item for item in filtered if item.platform == platform]
        return filtered[:limit]

    filtered_trends = _filter(trends)
    if geo_code and not filtered_trends:
        geo_target = resolve_geo_target(geo_code)
        refresh_sources: list[str] | None
        if platform:
            if platform == "tiktok" and not geo_target.tiktok_supported:
                refresh_sources = []
            else:
                refresh_sources = [platform]
        else:
            if geo_code == "US":
                refresh_sources = None
            else:
                refresh_sources = ["google", "youtube"]
                if geo_target.tiktok_supported:
                    refresh_sources.append("tiktok")

        if refresh_sources is None or refresh_sources:
            await run_ingestion_cycle(
                db,
                sources=refresh_sources,
                force=True,
                geo_code=geo_code,
                emit_events=False,
            )
            trends = list((await db.execute(stmt)).scalars().all())
            filtered_trends = _filter(trends)

    payload = [TrendOut.model_validate(t).model_dump(mode="json") for t in filtered_trends]
    if payload:
        await cache_set_json(cache_key, payload, ttl=max(settings.cache_ttl_trends, 1800))
    if include_source_status:
        return {"items": payload, "source_status": await get_sources_status(geo_code=geo_code)}
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


@router.post("/trends/forecast/explain", response_model=ForecastExplanationOut)
async def explain_trend_forecast(payload: ForecastExplainIn, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    cache_key = (
        f"forecast:explain:{payload.trend_id}:{payload.language or 'en'}:"
        f"{settings.gemini_model}:{bool(payload.generator_config)}"
    )
    cached = await cache_get_json(cache_key)
    if cached and not payload.generator_config:
        return cached

    trend = await db.get(Trend, payload.trend_id)
    if not trend:
        raise HTTPException(status_code=404, detail="Trend not found")

    snapshots = (
        await db.execute(
            select(TrendSnapshot)
            .where(TrendSnapshot.trend_id == payload.trend_id)
            .order_by(TrendSnapshot.snapshot_ts.asc())
            .limit(48)
        )
    ).scalars().all()
    serialized_snapshots = [
        {"snapshot_ts": item.snapshot_ts.isoformat(), "metric_views": item.metric_views, "velocity_score": item.velocity_score}
        for item in snapshots
    ]
    series = [(item.snapshot_ts, float(item.metric_views)) for item in snapshots]
    points, confidence = generate_forecast(series, horizon_hours=6)
    serialized_points = [
        {"ts": point["ts"].isoformat() if hasattr(point["ts"], "isoformat") else str(point["ts"]), "momentum": float(point["momentum"])}
        for point in points
    ]

    explanation = explain_forecast(
        trend,
        serialized_snapshots,
        serialized_points,
        confidence,
        language=payload.language or "en",
        generator_config=payload.generator_config,
    )
    if not payload.generator_config:
        await cache_set_json(cache_key, explanation, ttl=max(settings.cache_ttl_forecast, 1800))
    return explanation


@router.get("/google_trends_results")
async def get_google_trends_results(refresh: bool = Query(default=False), geo: str | None = Query(default=None)) -> list[dict[str, Any]]:
    geo_code = normalize_geo_code(geo)
    cache_key = f"google_trends_results:{geo_code.lower()}"
    cached = None if refresh else await cache_get_json(cache_key)
    if cached:
        return cached
    payload = await get_source_results("google", geo_code=geo_code)
    await cache_set_json(cache_key, payload, ttl=max(settings.source_cache_ttl_seconds, 1800))
    return payload


@router.get("/reddit_results")
async def get_reddit_results(refresh: bool = Query(default=False), geo: str | None = Query(default=None)) -> list[dict[str, Any]]:
    geo_code = normalize_geo_code(geo)
    cache_key = f"reddit_results:{geo_code.lower()}"
    cached = None if refresh else await cache_get_json(cache_key)
    if cached:
        return cached
    payload = await get_source_results("reddit", geo_code=geo_code)
    await cache_set_json(cache_key, payload, ttl=max(settings.source_cache_ttl_seconds, 1800))
    return payload


@router.get("/youtube_results")
async def get_youtube_results(refresh: bool = Query(default=False), geo: str | None = Query(default=None)) -> list[dict[str, Any]]:
    geo_code = normalize_geo_code(geo)
    cache_key = f"youtube_results:{geo_code.lower()}"
    cached = None if refresh else await cache_get_json(cache_key)
    if cached:
        return cached
    payload = await get_source_results("youtube", geo_code=geo_code)
    await cache_set_json(cache_key, payload, ttl=max(settings.source_cache_ttl_seconds, 1800))
    return payload


@router.get("/tiktok_results")
async def get_tiktok_results(refresh: bool = Query(default=False), geo: str | None = Query(default=None)) -> list[dict[str, Any]]:
    geo_code = normalize_geo_code(geo)
    cache_key = f"tiktok_results:{geo_code.lower()}"
    cached = None if refresh else await cache_get_json(cache_key)
    if cached and not any((item.get("title") or "").strip() in {"", "trend"} for item in cached):
        return cached
    payload = await get_source_results("tiktok", geo_code=geo_code)
    await cache_set_json(cache_key, payload, ttl=max(settings.source_cache_ttl_seconds, 1800))
    return payload


@router.get("/sources/status")
async def get_ingestion_sources_status(geo: str | None = Query(default=None)) -> dict[str, dict[str, Any]]:
    return await get_sources_status(geo_code=normalize_geo_code(geo))
