import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Any

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def get_reddit_fallback_trends() -> list[dict[str, Any]]:
    now = datetime.now(timezone.utc).isoformat()
    return [
        {
            "id": "rd-demo-1",
            "title": "Prompt engineering side hustle stories",
            "platform": "reddit",
            "timestamp": now,
            "metadata": {"views": 180000, "likes": 4100, "subreddit": "entrepreneur"},
        },
        {
            "id": "rd-demo-2",
            "title": "New meme template using AI sports edits",
            "platform": "reddit",
            "timestamp": now,
            "metadata": {"views": 220000, "likes": 6200, "subreddit": "memes"},
        },
    ]


async def fetch_reddit_trends() -> list[dict[str, Any]]:
    settings = get_settings()
    if not settings.reddit_client_id or not settings.reddit_client_secret:
        raise RuntimeError("reddit_credentials_missing")

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
                items.append(
                    {
                        "id": f"rd-{post.id}",
                        "title": post.title,
                        "platform": "reddit",
                        "timestamp": now,
                        "metadata": {
                            "views": score * 45,
                            "likes": score,
                            "subreddit": sub,
                            "comments": int(post.num_comments or 0),
                        },
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

