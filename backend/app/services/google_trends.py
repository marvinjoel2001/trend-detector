import asyncio
import logging
import random
import time
from datetime import datetime, timezone
from typing import Any
from xml.etree import ElementTree

import requests
from app.core.config import get_settings
from app.services.user_agents import get_next_user_agent, get_proxy_config

logger = logging.getLogger(__name__)
_pytrends_client: Any | None = None
_cooldown_until_ts = 0.0


def _fallback_google_trends(now_iso: str) -> list[dict[str, Any]]:
    fallback_queries = ["AI tools", "Crypto market", "Tech layoffs", "Gaming news", "Study hacks"]
    return [
        {
            "id": f"gtr-fallback-{idx}-{query.lower().replace(' ', '-')}",
            "title": query,
            "platform": "google",
            "timestamp": now_iso,
            "metadata": {
                "views": max(12000 - idx * 800, 3000),
                "likes": max(700 - idx * 35, 80),
                "fallback": True,
                "source_url": f"https://trends.google.com/trends/explore?q={query.replace(' ', '%20')}",
            },
        }
        for idx, query in enumerate(fallback_queries, 1)
    ]


def _get_pytrends_client() -> Any:
    global _pytrends_client  # noqa: PLW0603
    if _pytrends_client is not None:
        return _pytrends_client

    from pytrends.request import TrendReq

    proxy_cfg = get_proxy_config()
    request_args: dict[str, Any] = {"headers": {"User-Agent": get_next_user_agent()}}
    if proxy_cfg:
        request_args["proxies"] = proxy_cfg
    _pytrends_client = TrendReq(hl="en-US", tz=360, requests_args=request_args)
    return _pytrends_client


async def fetch_google_trends() -> list[dict[str, Any]]:
    settings = get_settings()
    now = datetime.now(timezone.utc)

    def _call() -> list[dict[str, Any]]:
        global _cooldown_until_ts  # noqa: PLW0603
        if time.time() < _cooldown_until_ts:
            raise RuntimeError("google_trends_cooldown_active")

        started = time.perf_counter()
        sleep_before = random.uniform(1.0, 3.5)
        time.sleep(sleep_before)

        pytrends = _get_pytrends_client()
        try:
            trending_df = pytrends.trending_searches(pn="united_states")
        except Exception as exc:  # noqa: BLE001
            message = str(exc).lower()
            blocked = any(token in message for token in ["429", "blocked", "captcha", "too many"])
            if blocked:
                cooldown_seconds = max(settings.source_interval_google_minutes * 60, 1800)
                _cooldown_until_ts = time.time() + cooldown_seconds
            raise

        time.sleep(random.uniform(0.4, 1.6))
        items: list[dict[str, Any]] = []
        for i, row in trending_df.head(20).iterrows():
            query = str(row[0])
            items.append(
                {
                    "id": f"gtr-{i}-{query.lower().replace(' ', '-')}",
                    "title": query,
                    "platform": "google",
                    "timestamp": now.isoformat(),
                    "metadata": {"views": max(10000 - i * 250, 1000), "likes": max(500 - i * 10, 10)},
                }
            )
            items[-1]["metadata"]["source_url"] = (
                f"https://trends.google.com/trends/explore?q={query.replace(' ', '%20')}"
            )

        logger.info(
            "source_provider_response",
            extra={
                "source": "google",
                "response_status": "ok",
                "duration_ms": int((time.perf_counter() - started) * 1000),
                "items_count": len(items),
            },
        )
        return items

    def _call_rss_backup() -> list[dict[str, Any]]:
        started = time.perf_counter()
        response = requests.get(
            "https://trends.google.com/trending/rss?geo=US",
            timeout=20,
            headers={"User-Agent": get_next_user_agent()},
            proxies=get_proxy_config(),
        )
        response.raise_for_status()
        root = ElementTree.fromstring(response.content)
        items: list[dict[str, Any]] = []
        for idx, item in enumerate(root.findall("./channel/item")[:20], 1):
            title = (item.findtext("title") or "").strip()
            if not title:
                continue
            items.append(
                {
                    "id": f"gtr-rss-{idx}-{title.lower().replace(' ', '-')}",
                    "title": title,
                    "platform": "google",
                    "timestamp": now.isoformat(),
                    "metadata": {"views": max(10000 - idx * 250, 1000), "likes": max(500 - idx * 10, 10)},
                }
            )
            items[-1]["metadata"]["source_url"] = (
                f"https://trends.google.com/trends/explore?q={title.replace(' ', '%20')}"
            )

        if not items:
            raise RuntimeError("google_trends_rss_empty")

        logger.info(
            "source_provider_response",
            extra={
                "source": "google",
                "response_status": "ok_rss_backup",
                "duration_ms": int((time.perf_counter() - started) * 1000),
                "items_count": len(items),
            },
        )
        return items

    try:
        return await asyncio.to_thread(_call)
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "source_provider_primary_failed_trying_backup",
            extra={"source": "google", "response_status": "primary_failed", "error": str(exc)},
        )
        try:
            return await asyncio.to_thread(_call_rss_backup)
        except Exception as backup_exc:  # noqa: BLE001
            logger.warning(
                "source_provider_backup_failed_using_fallback",
                extra={"source": "google", "response_status": "backup_failed", "error": str(backup_exc)},
            )
            return _fallback_google_trends(now.isoformat())
