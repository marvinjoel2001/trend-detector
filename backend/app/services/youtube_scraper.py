import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Any

import requests

from app.core.config import get_settings
from app.services.user_agents import get_next_user_agent, get_proxy_config

logger = logging.getLogger(__name__)


def get_youtube_fallback_trends() -> list[dict[str, Any]]:
    now = datetime.now(timezone.utc).isoformat()
    return [
        {
            "id": "yt-demo-1",
            "title": "AI avatar challenge explodes on Shorts",
            "platform": "youtube",
            "timestamp": now,
            "metadata": {
                "views": 1200000,
                "likes": 78000,
                "channel": "FutureLab",
                "video_id": "M7lc1UVf-VE",
                "thumbnail_url": "https://i.ytimg.com/vi/M7lc1UVf-VE/hqdefault.jpg",
                "source_url": "https://www.youtube.com/watch?v=M7lc1UVf-VE",
            },
        },
        {
            "id": "yt-demo-2",
            "title": "Cyberpunk car edits trend",
            "platform": "youtube",
            "timestamp": now,
            "metadata": {
                "views": 840000,
                "likes": 54000,
                "channel": "EditWave",
                "video_id": "dQw4w9WgXcQ",
                "thumbnail_url": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
                "source_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            },
        },
    ]


async def fetch_youtube_trends() -> list[dict[str, Any]]:
    settings = get_settings()
    if not settings.youtube_api_key:
        raise RuntimeError("youtube_api_key_missing")

    def _call() -> list[dict[str, Any]]:
        url = "https://www.googleapis.com/youtube/v3/videos"
        started = time.perf_counter()
        params = {
            "part": "snippet,statistics",
            "chart": "mostPopular",
            "maxResults": 25,
            "regionCode": "US",
            "key": settings.youtube_api_key,
        }
        response = requests.get(
            url,
            params=params,
            timeout=20,
            headers={"User-Agent": get_next_user_agent()},
            proxies=get_proxy_config(),
        )
        response.raise_for_status()
        data = response.json()
        now = datetime.now(timezone.utc).isoformat()
        results: list[dict[str, Any]] = []
        for item in data.get("items", []):
            stats = item.get("statistics", {})
            snippet = item.get("snippet", {})
            video_id = str(item.get("id") or "").strip()
            thumbnails = snippet.get("thumbnails", {}) or {}
            best_thumbnail = (
                (thumbnails.get("maxres") or {}).get("url")
                or (thumbnails.get("standard") or {}).get("url")
                or (thumbnails.get("high") or {}).get("url")
                or (thumbnails.get("medium") or {}).get("url")
                or (thumbnails.get("default") or {}).get("url")
            )
            results.append(
                {
                    "id": video_id,
                    "title": snippet.get("title", "Untitled YouTube Trend"),
                    "platform": "youtube",
                    "timestamp": now,
                    "metadata": {
                        "views": int(stats.get("viewCount", 0)),
                        "likes": int(stats.get("likeCount", 0)),
                        "channel": snippet.get("channelTitle"),
                        "video_id": video_id,
                        "thumbnail_url": best_thumbnail,
                        "source_url": f"https://www.youtube.com/watch?v={video_id}" if video_id else None,
                    },
                }
            )
        logger.info(
            "source_provider_response",
            extra={
                "source": "youtube",
                "response_status": response.status_code,
                "duration_ms": int((time.perf_counter() - started) * 1000),
                "items_count": len(results),
            },
        )
        return results

    return await asyncio.to_thread(_call)
