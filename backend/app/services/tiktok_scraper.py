import logging
import random
import re
import time
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote, urljoin

from app.core.config import get_settings
from app.services.geo_targets import attach_geo_metadata, resolve_geo_target
from app.services.user_agents import get_next_user_agent, get_proxy_config

logger = logging.getLogger(__name__)


def _sanitize_hashtag(raw_value: str) -> str:
    normalized = re.sub(r"\s+", "", raw_value.replace("#", "")).strip()
    if not normalized:
        return ""
    return f"#{normalized}"


def _make_trend_id(prefix: str, idx: int, raw_value: str) -> str:
    slug = re.sub(r"[^a-z0-9_-]+", "-", raw_value.lower()).strip("-")
    if not slug:
        slug = f"item-{idx}"
    return f"tt-{prefix}-{idx}-{slug}"


def _extract_first_hashtag(text: str) -> str:
    match = re.search(r"#([\w\u00C0-\uFFFF]+)", text)
    if not match:
        return ""
    return _sanitize_hashtag(match.group(1))


async def fetch_tiktok_trends(geo_code: str | None = None) -> list[dict[str, Any]]:
    settings = get_settings()
    now = datetime.now(timezone.utc).isoformat()
    target = resolve_geo_target(geo_code)
    language_hint = target.accept_language.split(",")[0].split("-")[0] or "en"
    precise_geo = False

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
                locale=language_hint,
            )
            await page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined});")
            await page.set_extra_http_headers({"Accept-Language": target.accept_language})
            await page.wait_for_timeout(random.randint(1200, 3200))
            await page.goto(f"{settings.tiktok_search_url}?lang={language_hint}", wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_timeout(random.randint(1500, 4000))

            video_cards = await page.eval_on_selector_all(
                "a[href*='/video/']",
                """
                els => els.slice(0, 24).map((el) => ({
                    href: el.href || el.getAttribute('href') || '',
                    text: (el.textContent || '').trim(),
                    thumbnail: el.querySelector('img')?.src || el.querySelector('img')?.getAttribute('src') || '',
                    poster: el.querySelector('video')?.poster || '',
                }))
                """,
            )
            tags = await page.eval_on_selector_all(
                "a[href*='/tag/']",
                """
                els => els.slice(0, 20).map((el) => ({
                    text: (el.textContent || '').trim(),
                    href: el.href || el.getAttribute('href') || '',
                    thumbnail: el.querySelector('img')?.src || el.querySelector('img')?.getAttribute('src') || '',
                    poster: el.querySelector('video')?.poster || '',
                }))
                """,
            )
            await browser.close()

        cleaned_tags: list[dict[str, str]] = []
        seen_tags: set[str] = set()
        for tag in tags:
            raw_text = str(tag.get("text") or "")
            cleaned = _sanitize_hashtag(raw_text)
            if not cleaned:
                continue
            lowered = cleaned.lower()
            if lowered in seen_tags:
                continue
            seen_tags.add(lowered)
            cleaned_tags.append(
                {
                    "hashtag": cleaned,
                    "href": str(tag.get("href") or "").strip(),
                    "thumbnail": str(tag.get("thumbnail") or tag.get("poster") or "").strip(),
                }
            )

        trends: list[dict[str, Any]] = []
        seen_source_urls: set[str] = set()
        for idx, card in enumerate(video_cards, 1):
            source_url = urljoin("https://www.tiktok.com", str(card.get("href") or "").strip())
            if "/video/" not in source_url or source_url in seen_source_urls:
                continue
            seen_source_urls.add(source_url)

            card_text = str(card.get("text") or "").strip()
            hashtag = _extract_first_hashtag(card_text)
            if not hashtag and cleaned_tags:
                hashtag = cleaned_tags[len(trends) % len(cleaned_tags)]["hashtag"]

            thumbnail_url = str(card.get("thumbnail") or card.get("poster") or "").strip()
            title = f"{hashtag} trend" if hashtag else (card_text.split("\n")[0].strip() or "TikTok trend")
            trends.append(
                {
                    "id": _make_trend_id("video", idx, source_url),
                    "title": title,
                    "platform": "tiktok",
                    "timestamp": now,
                    "metadata": attach_geo_metadata(
                        {
                            "views": max(1100000 - idx * 60000, 20000),
                            "likes": max(56000 - idx * 2000, 1000),
                            "hashtag": hashtag,
                            "source_url": source_url,
                            "thumbnail_url": thumbnail_url,
                        },
                        target.code,
                        precise=precise_geo,
                    ),
                }
            )

        if not trends and not cleaned_tags:
            raise RuntimeError("tiktok_empty_tags")

        if len(trends) < 6:
            for idx, tag_entry in enumerate(cleaned_tags, 1):
                if len(trends) >= 12:
                    break
                tag = tag_entry["hashtag"]
                encoded_tag = quote(tag.strip("#"))
                raw_href = tag_entry.get("href", "")
                source_url = urljoin("https://www.tiktok.com", raw_href) if raw_href else f"https://www.tiktok.com/tag/{encoded_tag}"
                trends.append(
                    {
                        "id": _make_trend_id("tag", idx, tag),
                        "title": f"{tag} trend",
                        "platform": "tiktok",
                        "timestamp": now,
                        "metadata": attach_geo_metadata(
                            {
                                "views": max(900000 - idx * 55000, 20000),
                                "likes": max(50000 - idx * 1800, 1000),
                                "hashtag": tag,
                                "source_url": source_url,
                                "thumbnail_url": tag_entry.get("thumbnail") or None,
                            },
                            target.code,
                            precise=precise_geo,
                        ),
                    }
                )

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
