import asyncio
import logging
import random
import re
import time
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote, urljoin

import requests

from app.core.config import get_settings
from app.services.geo_targets import attach_geo_metadata, resolve_geo_target
from app.services.user_agents import get_next_user_agent, get_proxy_config

logger = logging.getLogger(__name__)
_GENERIC_TIKTOK_HASHTAGS = {
    "fyp",
    "foryou",
    "foryoupage",
    "fy",
    "viral",
    "parati",
    "paratodos",
    "tiktok",
    "trend",
    "trending",
}


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


def _truncate_text(raw_value: str, limit: int = 96) -> str:
    normalized = " ".join(str(raw_value or "").split()).strip()
    if not normalized:
        return ""
    if len(normalized) <= limit:
        return normalized
    return normalized[: limit - 1].rstrip() + "..."


def _first_http_url(value: Any) -> str | None:
    if isinstance(value, str):
        normalized = value.strip()
        if normalized.startswith("http://") or normalized.startswith("https://"):
            return normalized
        return None

    if isinstance(value, dict):
        url_list = value.get("url_list")
        if isinstance(url_list, list):
            for candidate in url_list:
                resolved = _first_http_url(candidate)
                if resolved:
                    return resolved
        for key in ("url", "play_url", "download_url"):
            resolved = _first_http_url(value.get(key))
            if resolved:
                return resolved
    if isinstance(value, list):
        for candidate in value:
            resolved = _first_http_url(candidate)
            if resolved:
                return resolved
    return None


def _to_int(value: Any, default: int = 0) -> int:
    if isinstance(value, bool):
        return default
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str):
        cleaned = value.strip().replace(",", "")
        if not cleaned:
            return default
        try:
            return int(float(cleaned))
        except ValueError:
            return default
    return default


def _extract_hashtags_from_text_extra(text_extra: Any) -> list[str]:
    if not isinstance(text_extra, list):
        return []
    seen: set[str] = set()
    hashtags: list[str] = []
    for entry in text_extra:
        if not isinstance(entry, dict):
            continue
        tag = _sanitize_hashtag(str(entry.get("hashtag_name") or entry.get("hashtagName") or entry.get("hashtag") or ""))
        if not tag:
            continue
        lowered = tag.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        hashtags.append(tag)
    return hashtags


def _pick_primary_hashtag(hashtags: list[str]) -> str:
    for tag in hashtags:
        if tag.strip("#").lower() not in _GENERIC_TIKTOK_HASHTAGS:
            return tag
    return hashtags[0] if hashtags else ""


def _build_tiktok_title(description: str, primary_hashtag: str, sound_title: str, creator_handle: str) -> str:
    if primary_hashtag:
        return f"{primary_hashtag} trend"
    snippet = _truncate_text(description, limit=88)
    if snippet:
        return snippet
    sound_snippet = _truncate_text(sound_title, limit=72)
    if sound_snippet:
        return f"{sound_snippet} trend"
    if creator_handle:
        return f"@{creator_handle} viral clip"
    return "TikTok trend"


def _build_tiktok_source_url(item: dict[str, Any], creator_handle: str, aweme_id: str) -> str | None:
    direct = str(item.get("share_url") or item.get("shareUrl") or "").strip()
    if direct.startswith("http://") or direct.startswith("https://"):
        return direct
    if creator_handle and aweme_id:
        return f"https://www.tiktok.com/@{creator_handle}/video/{aweme_id}"
    return None


def _map_apify_tiktok_item(
    item: dict[str, Any],
    *,
    now: str,
    geo_code: str,
) -> dict[str, Any] | None:
    aweme_id = str(item.get("aweme_id") or item.get("awemeId") or item.get("id") or "").strip()
    if not aweme_id:
        return None

    author = item.get("author") if isinstance(item.get("author"), dict) else {}
    music = item.get("music") if isinstance(item.get("music"), dict) else {}
    video = item.get("video") if isinstance(item.get("video"), dict) else {}
    stats = item.get("statistics") if isinstance(item.get("statistics"), dict) else {}

    description = str(item.get("desc") or item.get("content_desc") or item.get("contentDesc") or "").strip()
    hashtags = _extract_hashtags_from_text_extra(item.get("text_extra") or item.get("textExtra"))
    fallback_hashtag = _extract_first_hashtag(description)
    if fallback_hashtag and fallback_hashtag.lower() not in {tag.lower() for tag in hashtags}:
        hashtags.append(fallback_hashtag)
    primary_hashtag = _pick_primary_hashtag(hashtags)

    creator_handle = str(author.get("unique_id") or author.get("uniqueId") or "").strip()
    creator_name = str(author.get("nickname") or "").strip()
    sound_title = str(music.get("title") or "").strip()
    sound_author = str(music.get("author") or creator_name or "").strip()
    title = _build_tiktok_title(description, primary_hashtag, sound_title, creator_handle)
    source_url = _build_tiktok_source_url(item, creator_handle, aweme_id)
    thumbnail_url = (
        _first_http_url(video.get("cover"))
        or _first_http_url(video.get("origin_cover"))
        or _first_http_url(video.get("dynamic_cover"))
        or _first_http_url(music.get("cover_large"))
        or _first_http_url(music.get("cover_medium"))
        or _first_http_url(author.get("avatar_medium"))
    )
    video_url = _first_http_url(video.get("play_addr")) or _first_http_url(video.get("download_addr"))

    views = _to_int(stats.get("play_count") or stats.get("playCount"))
    likes = _to_int(stats.get("digg_count") or stats.get("diggCount"))
    comments = _to_int(stats.get("comment_count") or stats.get("commentCount"))
    shares = _to_int(stats.get("share_count") or stats.get("shareCount"))
    if not source_url or (views <= 0 and likes <= 0 and not description and not primary_hashtag):
        return None

    created_ts = item.get("create_time") or item.get("createTime")
    published_at = None
    if isinstance(created_ts, (int, float)) and created_ts > 0:
        published_at = datetime.fromtimestamp(created_ts, tz=timezone.utc).isoformat()

    return {
        "id": aweme_id,
        "title": title,
        "description": description or None,
        "platform": "tiktok",
        "timestamp": now,
        "metadata": attach_geo_metadata(
            {
                "views": views,
                "likes": likes,
                "comments": comments,
                "shares": shares,
                "hashtag": primary_hashtag or "",
                "hashtags": hashtags,
                "sound_title": sound_title,
                "sound_author": sound_author,
                "sound_cover_url": _first_http_url(music.get("cover_large")) or _first_http_url(music.get("cover_medium")),
                "creator_handle": creator_handle,
                "creator_name": creator_name,
                "creator_region": author.get("region"),
                "source_region": item.get("region"),
                "source_url": source_url,
                "thumbnail_url": thumbnail_url,
                "video_url": video_url,
                "music_id": str(music.get("id") or "").strip() or None,
                "published_at": published_at,
                "source_provider": "apify",
            },
            geo_code,
            precise=True,
        ),
    }


async def _fetch_tiktok_trends_via_apify(geo_code: str | None = None) -> list[dict[str, Any]]:
    settings = get_settings()
    if not settings.apify_api_token:
        raise RuntimeError("apify_api_token_missing")

    now = datetime.now(timezone.utc).isoformat()
    target = resolve_geo_target(geo_code)
    actor_id = quote(settings.apify_tiktok_actor_id.replace("/", "~"), safe="~")
    dataset_limit = max(min(settings.apify_tiktok_limit, 24), 6)

    def _call() -> list[dict[str, Any]]:
        started = time.perf_counter()
        response = requests.post(
            f"{settings.apify_api_base_url.rstrip('/')}/v2/acts/{actor_id}/run-sync-get-dataset-items",
            params={
                "timeout": settings.apify_run_sync_timeout_seconds,
                "limit": dataset_limit,
                "clean": "true",
                "format": "json",
            },
            json={
                "type": "TREND",
                "region": target.tiktok_country,
                "maxItems": dataset_limit,
                "isUnlimited": False,
            },
            timeout=settings.apify_request_timeout_seconds,
            headers={
                "Authorization": f"Bearer {settings.apify_api_token}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": get_next_user_agent(),
            },
            proxies=get_proxy_config(),
        )
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, list):
            raise RuntimeError("apify_tiktok_invalid_response")

        trends: list[dict[str, Any]] = []
        seen_ids: set[str] = set()
        for item in payload:
            if not isinstance(item, dict):
                continue
            mapped = _map_apify_tiktok_item(item, now=now, geo_code=target.code)
            if not mapped or mapped["id"] in seen_ids:
                continue
            seen_ids.add(mapped["id"])
            trends.append(mapped)

        if not trends:
            raise RuntimeError("apify_tiktok_empty_results")

        logger.info(
            "source_provider_response",
            extra={
                "source": "tiktok",
                "provider": "apify",
                "response_status": response.status_code,
                "duration_ms": int((time.perf_counter() - started) * 1000),
                "items_count": len(trends),
                "geo_code": target.code,
            },
        )
        return trends

    return await asyncio.to_thread(_call)


async def _fetch_tiktok_trends_via_playwright(geo_code: str | None = None) -> list[dict[str, Any]]:
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
                "provider": "playwright",
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


async def fetch_tiktok_trends(geo_code: str | None = None) -> list[dict[str, Any]]:
    settings = get_settings()
    if settings.apify_api_token:
        try:
            return await _fetch_tiktok_trends_via_apify(geo_code)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "tiktok_apify_failed_falling_back",
                extra={"source": "tiktok", "provider": "apify", "error": str(exc)},
            )
    return await _fetch_tiktok_trends_via_playwright(geo_code)
