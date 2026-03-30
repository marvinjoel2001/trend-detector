import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Any

from app.core.config import get_settings
from app.services.geo_targets import attach_geo_metadata, resolve_geo_target

logger = logging.getLogger(__name__)


def get_reddit_fallback_trends() -> list[dict[str, Any]]:
    now = datetime.now(timezone.utc).isoformat()
    return [
        {
            "id": "rd-demo-1",
            "title": "Prompt engineering side hustle stories",
            "platform": "reddit",
            "timestamp": now,
            "metadata": {
                "views": 180000,
                "likes": 4100,
                "subreddit": "entrepreneur",
                "thumbnail_url": "https://www.redditstatic.com/new-icon.png",
                "source_url": "https://www.reddit.com/r/entrepreneur/",
            },
        },
        {
            "id": "rd-demo-2",
            "title": "New meme template using AI sports edits",
            "platform": "reddit",
            "timestamp": now,
            "metadata": {
                "views": 220000,
                "likes": 6200,
                "subreddit": "memes",
                "thumbnail_url": "https://www.redditstatic.com/new-icon.png",
                "source_url": "https://www.reddit.com/r/memes/",
            },
        },
    ]


async def fetch_reddit_trends(geo_code: str | None = None) -> list[dict[str, Any]]:
    settings = get_settings()
    if not settings.reddit_client_id or not settings.reddit_client_secret:
        raise RuntimeError("reddit_credentials_missing")
    target = resolve_geo_target(geo_code)

    def _call() -> list[dict[str, Any]]:
        import praw

        now = datetime.now(timezone.utc).isoformat()
        started = time.perf_counter()
        reddit = praw.Reddit(
            client_id=settings.reddit_client_id,
            client_secret=settings.reddit_client_secret,
            user_agent=settings.reddit_user_agent,
        )
        subs = ["technology", "gaming", "memes", "music", "worldnews"]
        items: list[dict[str, Any]] = []
        for sub in subs:
            subreddit = reddit.subreddit(sub)
            for post in subreddit.hot(limit=4):
                score = int(post.score or 0)
                thumbnail = str(getattr(post, "thumbnail", "") or "").strip()
                if not thumbnail.startswith("http"):
                    thumbnail = None
                preview_image = None
                try:
                    preview_images = (getattr(post, "preview", {}) or {}).get("images", [])
                    if preview_images:
                        preview_image = (
                            preview_images[0]
                            .get("source", {})
                            .get("url", "")
                            .replace("&amp;", "&")
                        )
                except Exception:  # noqa: BLE001
                    preview_image = None
                image_url = preview_image or thumbnail

                source_url = f"https://www.reddit.com{post.permalink}"
                video_url = None
                if bool(getattr(post, "is_video", False)):
                    media = getattr(post, "media", {}) or {}
                    video_url = ((media.get("reddit_video") or {}).get("fallback_url")) or None
                items.append(
                    {
                        "id": f"rd-{post.id}",
                        "title": post.title,
                        "platform": "reddit",
                        "timestamp": now,
                        "metadata": attach_geo_metadata(
                            {
                                "views": score * 45,
                                "likes": score,
                                "subreddit": sub,
                                "comments": int(post.num_comments or 0),
                                "thumbnail_url": image_url,
                                "source_url": source_url,
                                "video_url": video_url,
                            },
                            target.code,
                            precise=False,
                        ),
                    }
                )

        logger.info(
            "source_provider_response",
            extra={
                "source": "reddit",
                "response_status": "ok",
                "duration_ms": int((time.perf_counter() - started) * 1000),
                "items_count": len(items),
            },
        )
        return items

    return await asyncio.to_thread(_call)
