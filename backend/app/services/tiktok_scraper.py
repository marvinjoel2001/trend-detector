import logging
import random
import time
from datetime import datetime, timezone
from typing import Any

from app.core.config import get_settings
from app.services.user_agents import get_next_user_agent, get_proxy_config

logger = logging.getLogger(__name__)


async def fetch_tiktok_trends() -> list[dict[str, Any]]:
    settings = get_settings()
    now = datetime.now(timezone.utc).isoformat()

    try:
        from playwright.async_api import async_playwright

        started = time.perf_counter()
        proxy_cfg = get_proxy_config()
        launch_kwargs: dict[str, Any] = {"headless": settings.tiktok_headless}
        if proxy_cfg:
            launch_kwargs["proxy"] = {"server": proxy_cfg.get("https") or proxy_cfg.get("http")}

        async with async_playwright() as p:
            browser = await p.chromium.launch(**launch_kwargs)
            page = await browser.new_page(
                user_agent=get_next_user_agent(),
                viewport={
                    "width": random.randint(1180, 1600),
                    "height": random.randint(700, 1024),
                },
            )
            await page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined});")
            await page.wait_for_timeout(random.randint(1200, 3200))
            await page.goto(settings.tiktok_search_url, wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_timeout(random.randint(1500, 4000))
            tags = await page.eval_on_selector_all(
                "a[href*='/tag/']",
                "els => els.map(e => e.textContent).slice(0, 12)",
            )
            await browser.close()
        cleaned_tags: list[str] = []
        for tag in tags:
            raw = str(tag).strip()
            normalized = raw.replace("#", "").strip()
            if not normalized:
                continue
            cleaned_tags.append(f"#{normalized}")
        tags = cleaned_tags

        if not tags:
            raise RuntimeError("tiktok_empty_tags")

        trends = [
            {
                "id": f"tt-{idx}-{tag.strip('#').replace(' ', '-').lower()}",
                "title": f"{tag} trend",
                "platform": "tiktok",
                "timestamp": now,
                "metadata": {
                    "views": max(900000 - idx * 55000, 20000),
                    "likes": max(50000 - idx * 1800, 1000),
                    "hashtag": tag,
                },
            }
            for idx, tag in enumerate(tags, 1)
        ]
        logger.info(
            "source_provider_response",
            extra={
                "source": "tiktok",
                "response_status": "ok",
                "duration_ms": int((time.perf_counter() - started) * 1000),
                "items_count": len(trends),
            },
        )
        return trends
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "source_provider_failed",
            extra={"source": "tiktok", "response_status": "failed", "error": str(exc), "items_count": 0},
        )
        raise
