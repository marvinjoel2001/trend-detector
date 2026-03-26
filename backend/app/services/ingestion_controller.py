import asyncio
import logging
import random
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from app.core.config import get_settings
from app.services.cache import cache_get_json, cache_set_json, redis_client
from app.services.google_trends import fetch_google_trends
from app.services.reddit_scraper import fetch_reddit_trends
from app.services.retry import with_retry
from app.services.tiktok_scraper import fetch_tiktok_trends
from app.services.youtube_scraper import fetch_youtube_trends

logger = logging.getLogger(__name__)
settings = get_settings()
_controller_lock = asyncio.Lock()


@dataclass(frozen=True)
class SourceSpec:
    name: str
    fetcher: Callable[[], Awaitable[list[dict[str, Any]]]]
    cache_key: str
    interval_minutes: int


SOURCE_SPECS: dict[str, SourceSpec] = {
    "google": SourceSpec(
        name="google",
        fetcher=fetch_google_trends,
        cache_key="google_trends_results",
        interval_minutes=settings.source_interval_google_minutes,
    ),
    "youtube": SourceSpec(
        name="youtube",
        fetcher=fetch_youtube_trends,
        cache_key="youtube_results",
        interval_minutes=settings.source_interval_youtube_minutes,
    ),
    "reddit": SourceSpec(
        name="reddit",
        fetcher=fetch_reddit_trends,
        cache_key="reddit_results",
        interval_minutes=settings.source_interval_reddit_minutes,
    ),
    "tiktok": SourceSpec(
        name="tiktok",
        fetcher=fetch_tiktok_trends,
        cache_key="tiktok_results",
        interval_minutes=settings.source_interval_tiktok_minutes,
    ),
}


class IngestionController:
    def __init__(self) -> None:
        self._lock_key = "ingestion:global:lock"

    def _status_key(self, source: str) -> str:
        return f"ingestion:source:status:{source}"

    async def _set_source_status(
        self,
        source: str,
        status: str,
        message: str,
        items_count: int,
        used_cache: bool,
        used_fallback: bool,
    ) -> None:
        ttl = max(settings.source_cache_ttl_seconds, 1800)
        payload = {
            "source": source,
            "status": status,
            "message": message,
            "items_count": items_count,
            "used_cache": used_cache,
            "used_fallback": used_fallback,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        await cache_set_json(self._status_key(source), payload, ttl=ttl)

    async def _acquire_global_lock(self) -> bool:
        if not settings.use_redis_cache:
            if _controller_lock.locked():
                return False
            await _controller_lock.acquire()
            return True

        acquired = await redis_client().set(self._lock_key, str(time.time()), ex=settings.ingestion_lock_ttl_seconds, nx=True)
        return bool(acquired)

    async def _release_global_lock(self) -> None:
        if settings.use_redis_cache:
            await redis_client().delete(self._lock_key)
            return
        if _controller_lock.locked():
            _controller_lock.release()

    def _rate_key(self, source: str) -> str:
        return f"ingestion:source:last_run:{source}"

    async def _is_due(self, spec: SourceSpec, force: bool) -> bool:
        if force:
            return True
        if not settings.use_redis_cache:
            return True
        last_run_raw = await redis_client().get(self._rate_key(spec.name))
        if not last_run_raw:
            return True
        last_run = float(last_run_raw)
        interval_seconds = max(spec.interval_minutes * 60, 60)
        return (time.time() - last_run) >= interval_seconds

    async def _mark_run(self, spec: SourceSpec) -> None:
        if settings.use_redis_cache:
            await redis_client().set(self._rate_key(spec.name), str(time.time()))

    async def _fetch_source(self, spec: SourceSpec) -> list[dict[str, Any]]:
        request_ts = datetime.now(timezone.utc).isoformat()
        jitter = random.randint(settings.ingestion_jitter_min_seconds, settings.ingestion_jitter_max_seconds)
        await asyncio.sleep(jitter)

        started = time.perf_counter()
        try:
            items = await with_retry(
                spec.fetcher,
                retries=settings.source_retry_attempts,
                base_delay_seconds=settings.source_retry_base_delay_seconds,
                context=f"fetch_{spec.name}",
                source=spec.name,
            )
            used_fallback = any(item.get("metadata", {}).get("fallback") for item in items)
            if used_fallback:
                raise RuntimeError(f"{spec.name}_source_returned_fallback_payload")
            ttl = max(settings.source_cache_ttl_seconds, 1800)
            await cache_set_json(spec.cache_key, items, ttl=ttl)
            await self._mark_run(spec)
            logger.info(
                "source_fetch_success",
                extra={
                    "source": spec.name,
                    "request_ts": request_ts,
                    "response_status": "ok",
                    "items_count": len(items),
                    "duration_ms": int((time.perf_counter() - started) * 1000),
                    "cache_hit": False,
                    "fallback": False,
                },
            )
            await self._set_source_status(
                source=spec.name,
                status="real",
                message="real_data_ok",
                items_count=len(items),
                used_cache=False,
                used_fallback=False,
            )
            return items
        except Exception as exc:  # noqa: BLE001
            cached = await cache_get_json(spec.cache_key)
            if cached:
                logger.warning(
                    "source_fetch_failed_using_cache",
                    extra={
                        "source": spec.name,
                        "request_ts": request_ts,
                        "response_status": "failed_cached",
                        "cache_hit": True,
                        "fallback": True,
                        "error": str(exc),
                    },
                )
                await self._set_source_status(
                    source=spec.name,
                    status="cached",
                    message=f"provider_failed_using_cached: {exc}",
                    items_count=len(cached),
                    used_cache=True,
                    used_fallback=True,
                )
                return cached

            blocked = any(token in str(exc).lower() for token in ["429", "too many", "blocked", "captcha"])
            if blocked:
                await self._mark_run(spec)

            logger.warning(
                "source_fetch_failed_no_real_data",
                extra={
                    "source": spec.name,
                    "request_ts": request_ts,
                    "response_status": "failed_unavailable",
                    "cache_hit": False,
                    "fallback": True,
                    "cooldown_applied": blocked,
                    "error": str(exc),
                    "items_count": 0,
                },
            )
            await self._set_source_status(
                source=spec.name,
                status="unavailable",
                message=f"provider_failed_no_cached_data: {exc}",
                items_count=0,
                used_cache=False,
                used_fallback=False,
            )
            return []

    async def collect_sources(
        self,
        sources: list[str] | None = None,
        force: bool = False,
        bypass_lock: bool = False,
    ) -> dict[str, list[dict[str, Any]]]:
        target_sources = sources or ["google", "youtube", "reddit", "tiktok"]
        acquired = True if bypass_lock else await self._acquire_global_lock()
        if not acquired:
            payloads: dict[str, list[dict[str, Any]]] = {}
            for source_name in target_sources:
                if source_name in SOURCE_SPECS:
                    cached = await cache_get_json(SOURCE_SPECS[source_name].cache_key)
                    if cached:
                        payloads[source_name] = cached
                        await self._set_source_status(
                            source=source_name,
                            status="locked_cached",
                            message="ingestion_overlap_using_cached_data",
                            items_count=len(cached),
                            used_cache=True,
                            used_fallback=any(item.get("metadata", {}).get("fallback") for item in cached),
                        )
                        continue
                    await self._set_source_status(
                        source=source_name,
                        status="locked",
                        message="ingestion_overlap_lock_active",
                        items_count=0,
                        used_cache=False,
                        used_fallback=False,
                    )
            logger.info("ingestion_skipped_overlap", extra={"status": "locked"})
            return payloads

        try:
            payloads: dict[str, list[dict[str, Any]]] = {}
            for source_name in target_sources:
                spec = SOURCE_SPECS.get(source_name)
                if not spec:
                    continue
                due = await self._is_due(spec, force=force)
                if not due:
                    cached = await cache_get_json(spec.cache_key)
                    if cached:
                        cached_has_fallback = any(item.get("metadata", {}).get("fallback") for item in cached)
                        payloads[source_name] = cached
                        logger.info(
                            "source_rate_limited_returning_cached",
                            extra={
                                "source": source_name,
                                "cache_hit": True,
                                "response_status": "rate_limited",
                                "items_count": len(cached),
                                "fallback": cached_has_fallback,
                            },
                        )
                        await self._set_source_status(
                            source=source_name,
                            status="cached",
                            message="rate_limited_cached_return",
                            items_count=len(cached),
                            used_cache=True,
                            used_fallback=cached_has_fallback,
                        )
                    continue
                payloads[source_name] = await self._fetch_source(spec)
            return payloads
        finally:
            if not bypass_lock:
                await self._release_global_lock()


async def get_source_results(source: str) -> list[dict[str, Any]]:
    controller = IngestionController()
    payload = await controller.collect_sources(sources=[source], force=True, bypass_lock=True)
    return payload.get(source, [])


async def get_sources_status(sources: list[str] | None = None) -> dict[str, dict[str, Any]]:
    target_sources = sources or ["google", "youtube", "reddit", "tiktok"]
    controller = IngestionController()
    result: dict[str, dict[str, Any]] = {}
    for source in target_sources:
        status_payload = await cache_get_json(controller._status_key(source))
        result[source] = status_payload or {
            "source": source,
            "status": "unknown",
            "message": "no_status_yet",
            "items_count": 0,
            "used_cache": False,
            "used_fallback": False,
            "updated_at": None,
        }
    return result
