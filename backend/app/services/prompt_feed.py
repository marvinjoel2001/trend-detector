import ast
import csv
import datetime as dt
import hashlib
import io
import json
import logging
import random
from typing import Any

import requests

from app.core.config import get_settings
from app.services.cache import cache_get_json, cache_set_json
from app.services.ingestion_controller import SOURCE_SPECS, get_source_results

logger = logging.getLogger(__name__)
settings = get_settings()
_media_probe_cache: dict[str, bool] = {}

PROMPT_FEED_SOURCES = ("lexica", "prompthero", "krea", "github", "civitai", "youtube", "reddit", "tiktok")
PROMPT_FEED_FEED_SOURCES = ("lexica", "prompthero", "krea", "github", "civitai", "youtube", "reddit", "tiktok")
SOCIAL_PROMPT_FEED_SOURCES = ("youtube", "reddit", "tiktok")


def _trim(value: str | None, fallback: str = "") -> str:
    return str(value or "").strip() or fallback


def _source_status(
    source: str,
    *,
    configured: bool,
    enabled: bool,
    items_count: int,
    message: str,
    requires_api_key: bool = False,
) -> dict[str, Any]:
    return {
        "source": source,
        "configured": configured,
        "enabled": enabled,
        "items_count": items_count,
        "message": message,
        "requires_api_key": requires_api_key,
    }


def _github_defaults(
    owner: str | None = None,
    repo: str | None = None,
    branch: str | None = None,
    path: str | None = None,
) -> dict[str, str]:
    return {
        "owner": _trim(owner, settings.prompt_feed_default_github_owner),
        "repo": _trim(repo, settings.prompt_feed_default_github_repo),
        "branch": _trim(branch, settings.prompt_feed_default_github_branch),
        "path": _trim(path, settings.prompt_feed_default_github_path),
    }


def _safe_json_request(
    url: str,
    *,
    params: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
    timeout: int = 15,
) -> dict[str, Any] | list[Any]:
    response = requests.get(url, params=params, headers=headers, timeout=timeout)
    response.raise_for_status()
    return response.json()


def _safe_text_request(
    url: str,
    *,
    params: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
    timeout: int = 20,
) -> str:
    response = requests.get(url, params=params, headers=headers, timeout=timeout)
    response.raise_for_status()
    return response.text


def _title_from_prompt(prompt: str, fallback: str) -> str:
    clean = " ".join(prompt.split()).strip()
    if clean:
        return clean[:96]
    return fallback


def _normalize_media_url(value: Any) -> str | None:
    raw = str(value or "").strip()
    if raw.startswith("http://") or raw.startswith("https://"):
        return raw
    return None


def _is_reachable_media_url(url: str | None) -> bool:
    normalized = _normalize_media_url(url)
    if not normalized:
        return False
    cached = _media_probe_cache.get(normalized)
    if cached is not None:
        return cached
    try:
        response = requests.get(
            normalized,
            timeout=8,
            stream=True,
            allow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0", "Range": "bytes=0-0"},
        )
        content_type = str(response.headers.get("Content-Type") or "").lower()
        ok = response.status_code < 400 and ("image/" in content_type or "video/" in content_type or "octet-stream" in content_type)
        _media_probe_cache[normalized] = ok
        return ok
    except Exception:  # noqa: BLE001
        _media_probe_cache[normalized] = False
        return False


def _pick_reachable_media_url(candidates: list[Any]) -> str | None:
    normalized_candidates: list[str] = []
    for candidate in candidates:
        url = _normalize_media_url(candidate)
        if not url:
            continue
        normalized_candidates.append(url)
        if _is_reachable_media_url(url):
            return url
    return normalized_candidates[0] if normalized_candidates else None


def _extract_markdown_image_url(text: str) -> str | None:
    if not text:
        return None
    marker = "]("
    start = 0
    lowered = text.lower()
    while True:
        idx = lowered.find(marker, start)
        if idx == -1:
            return None
        end = text.find(")", idx + len(marker))
        if end == -1:
            return None
        url = text[idx + len(marker) : end].strip()
        normalized = _normalize_media_url(url)
        if normalized:
            return normalized
        start = end + 1


def _extract_promptish_text(item: dict[str, Any]) -> str:
    for key in ("prompt", "title", "description", "text", "content"):
        value = str(item.get(key) or "").strip()
        if value:
            return value
    return ""


def _extract_imageish_url(item: dict[str, Any]) -> str | None:
    for key in ("src", "srcSmall", "image_url", "image", "thumbnail", "thumbnail_url", "preview", "preview_url", "url"):
        raw_value = item.get(key)
        if isinstance(raw_value, dict):
            for nested_key in ("url", "src", "srcSmall"):
                value = _normalize_media_url(raw_value.get(nested_key))
                if value:
                    return value
        value = _normalize_media_url(raw_value)
        if value:
            return value
    return None


def _extract_videoish_url(item: dict[str, Any]) -> str | None:
    for key in ("video", "video_url", "mp4", "preview_video_url"):
        value = _normalize_media_url(item.get(key))
        if value:
            return value
    return None


def _decode_structured_value(raw_value: Any) -> dict[str, Any]:
    if isinstance(raw_value, dict):
        return raw_value
    if not isinstance(raw_value, str) or not raw_value.strip():
        return {}

    text = raw_value.strip()
    for parser in (json.loads, ast.literal_eval):
        try:
            parsed = parser(text)
            if isinstance(parsed, dict):
                return parsed
        except Exception:  # noqa: BLE001
            continue
    return {}


def _build_feed_item(
    *,
    source: str,
    external_id: str,
    title: str,
    prompt: str,
    image_url: str | None = None,
    thumbnail_url: str | None = None,
    video_url: str | None = None,
    source_url: str | None = None,
    model: str | None = None,
    width: int | None = None,
    height: int | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "source": source,
        "id": external_id,
        "title": title,
        "prompt": prompt,
        "image_url": image_url,
        "thumbnail_url": thumbnail_url,
        "video_url": video_url,
        "source_url": source_url,
        "model": model,
        "width": width,
        "height": height,
        "metadata": metadata or {},
    }


def _social_source_config(source: str) -> tuple[bool, bool, str]:
    if source == "youtube":
        configured = bool(_trim(settings.youtube_api_key))
        return configured, True, "Trending videos with thumbnails from the YouTube API"
    if source == "reddit":
        configured = bool(_trim(settings.reddit_client_id)) and bool(_trim(settings.reddit_client_secret))
        return configured, True, "Hot Reddit posts with preview images or videos"
    if source == "tiktok":
        return True, True, "TikTok discover scrape with post and hashtag previews"
    return True, True, "Social visual source"


def _social_requires_api_key(source: str) -> bool:
    return source in {"youtube", "reddit"}


def _social_dimensions(source: str) -> tuple[int | None, int | None]:
    if source == "tiktok":
        return 1080, 1920
    if source == "youtube":
        return 1280, 720
    if source == "reddit":
        return 1200, 675
    return None, None


def _build_social_reference_prompt(source: str, title: str, metadata: dict[str, Any]) -> str:
    safe_title = title.strip() or f"{source} trend"
    if source == "tiktok":
        hashtag = _trim(metadata.get("hashtag"), "")
        hashtag_hint = f" Lean into the language and vibe of {hashtag}." if hashtag else ""
        return (
            f'Create a TikTok-style vertical concept inspired by "{safe_title}". '
            "Use a strong first-frame hook, mobile-first composition, bold lighting contrast, dynamic movement, "
            "and a creator-native pacing that feels viral in the first two seconds."
            f"{hashtag_hint} Keep it visually clear enough to work as both cover frame and short-form storyboard."
        )
    if source == "youtube":
        channel = _trim(metadata.get("channel"), "")
        channel_hint = f" Borrow the creator energy of {channel} without copying branding." if channel else ""
        return (
            f'Create a YouTube Shorts concept inspired by "{safe_title}". '
            "Focus on a thumbnail-ready frame, clear subject separation, strong contrast, readable focal point, "
            "and short-form editing energy that would still feel compelling as a preview image."
            f"{channel_hint}"
        )
    subreddit = _trim(metadata.get("subreddit"), "")
    subreddit_hint = f" Ground the scene in the culture of r/{subreddit}." if subreddit else ""
    return (
        f'Create a shareable social visual inspired by the Reddit post "{safe_title}". '
        "Turn the idea into an instantly understandable scene, meme visual, or cover-style composition with strong context, "
        "internet-native humor or relevance, and a focal point that reads fast in feed."
        f"{subreddit_hint}"
    )


def _social_source_url(source: str, metadata: dict[str, Any]) -> str | None:
    direct = _normalize_media_url(metadata.get("source_url"))
    if direct:
        return direct
    video_id = _trim(metadata.get("video_id"), "")
    if source == "youtube" and video_id:
        return f"https://www.youtube.com/watch?v={video_id}"
    return None


def _social_preview_image(source: str, metadata: dict[str, Any]) -> str | None:
    video_id = _trim(metadata.get("video_id"), "")
    youtube_thumbnail = f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg" if source == "youtube" and video_id else None
    return _pick_reachable_media_url(
        [
            metadata.get("thumbnail_url"),
            metadata.get("image_url"),
            metadata.get("preview_image_url"),
            youtube_thumbnail,
        ]
    )


async def _collect_social_feed(source: str, limit: int) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    spec = SOURCE_SPECS.get(source)
    cached_items = await cache_get_json(spec.cache_key) if spec else None
    raw_items = cached_items if isinstance(cached_items, list) and cached_items else None
    used_cache = raw_items is not None
    if raw_items is None:
        raw_items = await get_source_results(source)

    configured, enabled, _note = _social_source_config(source)
    items: list[dict[str, Any]] = []

    for index, raw_item in enumerate(raw_items or []):
        if not isinstance(raw_item, dict):
            continue
        metadata = raw_item.get("metadata")
        if not isinstance(metadata, dict):
            metadata = {}

        title = _trim(raw_item.get("title"), f"{source} trend")
        prompt = _trim(metadata.get("prompt") or metadata.get("reference_prompt"), "")
        prompt_origin = "source" if prompt else "synthesized"
        if not prompt:
            prompt = _build_social_reference_prompt(source, title, metadata)

        image_url = _social_preview_image(source, metadata)
        video_url = _normalize_media_url(metadata.get("video_url"))
        width, height = _social_dimensions(source)

        items.append(
            _build_feed_item(
                source=source,
                external_id=_trim(raw_item.get("id"), f"{source}-{index}"),
                title=title,
                prompt=prompt,
                image_url=image_url,
                thumbnail_url=image_url,
                video_url=video_url,
                source_url=_social_source_url(source, metadata),
                width=width,
                height=height,
                metadata={**metadata, "prompt_origin": prompt_origin, "reference_platform": source},
            )
        )

        if len(items) >= limit:
            break

    message = "cached_ok" if used_cache and items else "ok" if items else "no_results"
    if not items and not configured and _social_requires_api_key(source):
        message = "missing_credentials"
    status = _source_status(
        source,
        configured=configured,
        enabled=enabled or bool(items),
        items_count=len(items),
        message=message,
        requires_api_key=_social_requires_api_key(source),
    )
    return items, status


def _collect_lexica(query: str, limit: int) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    normalized_query = query.strip().lower()
    endpoint_base = settings.lexica_api_base_url.rstrip("/")
    if endpoint_base.endswith("/v1"):
        endpoint_base = endpoint_base[:-3]
    endpoint = f"{endpoint_base}/infinite-prompts"
    try:
        payload = _safe_json_request(
            endpoint,
            params=None,
            headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"},
            timeout=20,
        )
    except requests.exceptions.HTTPError as exc:
        status_code = exc.response.status_code if exc.response is not None else "unknown"
        return [], _source_status("lexica", configured=True, enabled=False, items_count=0, message=f"http_{status_code}")
    except Exception as exc:  # noqa: BLE001
        return [], _source_status("lexica", configured=True, enabled=False, items_count=0, message=f"failed: {exc}")
    images = payload.get("images") if isinstance(payload, dict) else []
    prompts = payload.get("prompts") if isinstance(payload, dict) else []

    prompt_by_id: dict[str, str] = {}
    prompt_by_image_id: dict[str, str] = {}

    if isinstance(prompts, list):
        for prompt_entry in prompts:
            if not isinstance(prompt_entry, dict):
                continue
            prompt_id = _trim(prompt_entry.get("id"))
            prompt_text = _trim(prompt_entry.get("prompt") or prompt_entry.get("cleanedPrompt"))
            if prompt_id and prompt_text:
                prompt_by_id[prompt_id] = prompt_text
            images_for_prompt = prompt_entry.get("images")
            if isinstance(images_for_prompt, list) and prompt_text:
                for prompt_image in images_for_prompt:
                    if not isinstance(prompt_image, dict):
                        continue
                    prompt_image_id = _trim(prompt_image.get("id"))
                    if prompt_image_id:
                        prompt_by_image_id[prompt_image_id] = prompt_text

    items = []
    for image in (images or []):
        if not isinstance(image, dict):
            continue
        image_id = _trim(image.get("id"))
        prompt_id = _trim(image.get("promptid"))
        prompt = _trim(prompt_by_id.get(prompt_id) or prompt_by_image_id.get(image_id) or image.get("prompt"))

        if normalized_query and normalized_query not in prompt.lower():
            continue

        image_url = f"https://image.lexica.art/md2/{image_id}" if image_id else None

        items.append(
            _build_feed_item(
                source="lexica",
                external_id=image_id,
                title=_title_from_prompt(prompt, "Lexica prompt"),
                prompt=prompt,
                image_url=image_url,
                thumbnail_url=image_url,
                source_url=f"https://lexica.art/prompt/{prompt_id}" if prompt_id else None,
                model=_trim(image.get("model_mode") or image.get("model")) or None,
                width=int(image["width"]) if isinstance(image.get("width"), int) else None,
                height=int(image["height"]) if isinstance(image.get("height"), int) else None,
                metadata={
                    "prompt_id": prompt_id or None,
                    "raw_mode": image.get("raw_mode"),
                    "image_prompt_strength": image.get("image_prompt_strength"),
                },
            )
        )
        if len(items) >= limit:
            break
    return items, _source_status("lexica", configured=True, enabled=True, items_count=len(items), message="ok")


def _extract_prompthero_entries(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if not isinstance(payload, dict):
        return []
    for key in ("results", "items", "data", "thumbnails", "prompts"):
        value = payload.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
    return []


def _collect_prompthero(query: str, limit: int) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    token = _trim(settings.prompthero_bearer_token)
    if not token:
        return [], _source_status(
            "prompthero",
            configured=False,
            enabled=False,
            items_count=0,
            message="missing_bearer_token",
            requires_api_key=True,
        )

    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    endpoint = settings.prompthero_random_url
    params: dict[str, Any] | None = None
    if query:
        endpoint = settings.prompthero_thumbnails_url
        params = {"q": query}

    try:
        payload = _safe_json_request(endpoint, params=params, headers=headers)
    except Exception:
        if query:
            payload = _safe_json_request(endpoint, params={"query": query}, headers=headers)
        else:
            raise

    entries = _extract_prompthero_entries(payload)
    items = []
    for entry in entries[:limit]:
        prompt = _extract_promptish_text(entry)
        items.append(
            _build_feed_item(
                source="prompthero",
                external_id=str(entry.get("id") or entry.get("slug") or ""),
                title=_title_from_prompt(prompt, str(entry.get("title") or "PromptHero prompt")),
                prompt=prompt,
                image_url=_extract_imageish_url(entry),
                thumbnail_url=_extract_imageish_url(entry),
                video_url=_extract_videoish_url(entry),
                source_url=_normalize_media_url(entry.get("url")) or _normalize_media_url(entry.get("gallery")),
                model=str(entry.get("model") or entry.get("engine") or "").strip() or None,
                metadata=entry,
            )
        )
    return items, _source_status("prompthero", configured=True, enabled=True, items_count=len(items), message="ok", requires_api_key=True)


def _extract_krea_media(raw_data: dict[str, Any]) -> tuple[str | None, str | None]:
    image_url = _normalize_media_url(raw_data.get("image_uri")) or _normalize_media_url(raw_data.get("thumbnail_uri"))
    thumbnail_url = _normalize_media_url(raw_data.get("thumbnail_uri")) or image_url
    raw_discord = raw_data.get("raw_discord_data")
    if isinstance(raw_discord, dict):
        image_url = (
            image_url
            or _normalize_media_url(raw_discord.get("image_uri"))
            or _normalize_media_url(raw_discord.get("image_proxy_uri"))
        )
        thumbnail_url = (
            thumbnail_url
            or _normalize_media_url(raw_discord.get("thumbnail_uri"))
            or _normalize_media_url(raw_discord.get("image_proxy_uri"))
            or image_url
        )
        attachments = raw_discord.get("attachments")
        if isinstance(attachments, list):
            for item in attachments:
                if isinstance(item, dict):
                    candidate = _normalize_media_url(item.get("url")) or _normalize_media_url(item.get("proxy_url"))
                    if candidate:
                        image_url = image_url or candidate
                        thumbnail_url = thumbnail_url or candidate
                        break
    selected = _pick_reachable_media_url([image_url, thumbnail_url])
    return selected, selected


def _collect_krea(query: str, limit: int) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    content = _safe_text_request(settings.krea_open_prompts_csv_url)
    reader = csv.DictReader(io.StringIO(content))
    candidates: list[dict[str, Any]] = []
    normalized_query = query.strip().lower()

    for row_index, row in enumerate(reader):
        prompt = str(row.get("prompt") or "").strip()
        raw_data = _decode_structured_value(row.get("raw_data"))
        searchable_blob = f"{prompt} {json.dumps(raw_data, default=str)}"
        if normalized_query and normalized_query not in searchable_blob.lower():
            continue
        image_url, thumbnail_url = _extract_krea_media(raw_data)
        candidates.append(
            _build_feed_item(
                source="krea",
                external_id=f"krea-{row_index}",
                title=_title_from_prompt(prompt, "Krea open prompt"),
                prompt=prompt,
                image_url=image_url,
                thumbnail_url=thumbnail_url,
                source_url=settings.krea_open_prompts_repo_url,
                model=str(raw_data.get("model") or "").strip() or None,
                width=int(raw_data.get("raw_discord_data", {}).get("width")) if isinstance(raw_data.get("raw_discord_data"), dict) and isinstance(raw_data.get("raw_discord_data", {}).get("width"), int) else None,
                height=int(raw_data.get("raw_discord_data", {}).get("height")) if isinstance(raw_data.get("raw_discord_data"), dict) and isinstance(raw_data.get("raw_discord_data", {}).get("height"), int) else None,
                metadata=raw_data,
            )
        )
    items = _diversify_candidates(candidates, limit, seed=f"krea:{normalized_query}")
    return items, _source_status("krea", configured=True, enabled=True, items_count=len(items), message="ok")


def _civitai_headers() -> dict[str, str]:
    headers = {"Accept": "application/json"}
    token = _trim(settings.civitai_api_key)
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def _civitai_prompt(meta: dict[str, Any]) -> str:
    for key in ("prompt", "Prompt", "description", "Description"):
        value = str(meta.get(key) or "").strip()
        if value:
            return value
    return ""


def _civitai_model(meta: dict[str, Any]) -> str | None:
    model = meta.get("Model") or meta.get("model")
    if isinstance(model, dict):
        value = str(model.get("name") or "").strip()
        return value or None
    value = str(model or "").strip()
    return value or None


def _collect_civitai(query: str, limit: int) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    endpoint = f"{settings.civitai_api_base_url.rstrip('/')}/images"
    params: dict[str, Any] = {
        "limit": max(limit, 1),
        "sort": "Most Reactions",
        "period": "Week",
    }
    if query:
        params["query"] = query
    token = _trim(settings.civitai_api_key)
    if token:
        params["token"] = token
    payload = _safe_json_request(endpoint, params=params, headers=_civitai_headers())
    entries = payload.get("items") if isinstance(payload, dict) else []
    items: list[dict[str, Any]] = []
    for entry in entries or []:
        if not isinstance(entry, dict):
            continue
        meta = entry.get("meta")
        if not isinstance(meta, dict):
            meta = {}
        prompt = _civitai_prompt(meta)
        image_url = _normalize_media_url(entry.get("url")) or _extract_imageish_url(meta)
        thumbnail_url = _extract_imageish_url(meta) or image_url
        external_id = str(entry.get("id") or "").strip()
        if not external_id:
            external_id = hashlib.sha256(json.dumps(entry, default=str, sort_keys=True).encode("utf-8")).hexdigest()[:24]
        items.append(
            _build_feed_item(
                source="civitai",
                external_id=external_id,
                title=_title_from_prompt(prompt, str(entry.get("name") or "Civitai image")),
                prompt=prompt,
                image_url=image_url,
                thumbnail_url=thumbnail_url,
                source_url=f"https://civitai.com/images/{external_id}",
                model=_civitai_model(meta),
                width=int(entry["width"]) if isinstance(entry.get("width"), int) else None,
                height=int(entry["height"]) if isinstance(entry.get("height"), int) else None,
                metadata={
                    "nsfw": entry.get("nsfw"),
                    "stats": entry.get("stats"),
                    "meta": meta,
                },
            )
        )
        if len(items) >= limit:
            break
    message = "ok" if items else "no_results"
    configured = bool(token)
    status = _source_status("civitai", configured=configured, enabled=True, items_count=len(items), message=message, requires_api_key=True)
    return items, status


def _github_headers() -> dict[str, str]:
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    token = _trim(settings.github_token)
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def _parse_prompt_records(content: str, file_extension: str, source_url: str, query: str, limit: int) -> list[dict[str, Any]]:
    normalized_query = query.strip().lower()
    items: list[dict[str, Any]] = []

    if file_extension == ".csv":
        reader = csv.DictReader(io.StringIO(content))
        for row_index, row in enumerate(reader):
            prompt = str(row.get("prompt") or row.get("title") or row.get("text") or "").strip()
            raw_data = _decode_structured_value(row.get("raw_data"))
            searchable_blob = " ".join(str(value) for value in row.values())
            if normalized_query and normalized_query not in searchable_blob.lower():
                continue
            markdown_url = _extract_markdown_image_url(prompt) or _extract_markdown_image_url(searchable_blob)
            image_url = _pick_reachable_media_url(
                [
                    row.get("image_url"),
                    row.get("thumbnail_url"),
                    raw_data.get("image_uri"),
                    raw_data.get("thumbnail_uri"),
                    markdown_url,
                ]
            )
            items.append(
                _build_feed_item(
                    source="github",
                    external_id=f"github-csv-{row_index}",
                    title=_title_from_prompt(prompt, "GitHub prompt"),
                    prompt=prompt or searchable_blob[:280],
                    image_url=image_url,
                    thumbnail_url=image_url,
                    source_url=source_url,
                    model=str(row.get("model") or raw_data.get("model") or "").strip() or None,
                    metadata={**row, "raw_data_parsed": raw_data},
                )
            )
            if len(items) >= limit:
                break
        return items

    if file_extension == ".json":
        parsed = json.loads(content)
        if isinstance(parsed, dict):
            candidate_lists = [value for value in parsed.values() if isinstance(value, list)]
            if candidate_lists:
                parsed = candidate_lists[0]
            else:
                parsed = [parsed]
        if not isinstance(parsed, list):
            parsed = []

        for row_index, row in enumerate(parsed):
            if isinstance(row, str):
                prompt = row.strip()
                if normalized_query and normalized_query not in prompt.lower():
                    continue
                items.append(
                    _build_feed_item(
                        source="github",
                        external_id=f"github-json-{row_index}",
                        title=_title_from_prompt(prompt, "GitHub prompt"),
                        prompt=prompt,
                        source_url=source_url,
                    )
                )
            elif isinstance(row, dict):
                prompt = _extract_promptish_text(row)
                searchable_blob = json.dumps(row, default=str)
                if normalized_query and normalized_query not in searchable_blob.lower():
                    continue
                image_url = _pick_reachable_media_url(
                    [
                        _extract_imageish_url(row),
                        _extract_markdown_image_url(prompt),
                        _extract_markdown_image_url(searchable_blob),
                    ]
                )
                items.append(
                    _build_feed_item(
                        source="github",
                        external_id=str(row.get("id") or f"github-json-{row_index}"),
                        title=_title_from_prompt(prompt, "GitHub prompt"),
                        prompt=prompt or searchable_blob[:280],
                        image_url=image_url,
                        thumbnail_url=image_url,
                        video_url=_extract_videoish_url(row),
                        source_url=_normalize_media_url(row.get("url")) or source_url,
                        model=str(row.get("model") or "").strip() or None,
                        metadata=row,
                    )
                )
            if len(items) >= limit:
                break
        return items

    for row_index, line in enumerate(content.splitlines()):
        prompt = line.strip()
        if not prompt or prompt.startswith("#"):
            continue
        if normalized_query and normalized_query not in prompt.lower():
            continue
        items.append(
            _build_feed_item(
                source="github",
                external_id=f"github-text-{row_index}",
                title=_title_from_prompt(prompt, "GitHub prompt"),
                prompt=prompt,
                source_url=source_url,
            )
        )
        if len(items) >= limit:
            break
    return items


def _collect_github(
    query: str,
    limit: int,
    *,
    owner: str | None = None,
    repo: str | None = None,
    branch: str | None = None,
    path: str | None = None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    github = _github_defaults(owner=owner, repo=repo, branch=branch, path=path)
    api_url = (
        f"{settings.github_api_base_url.rstrip('/')}/repos/{github['owner']}/{github['repo']}/contents/"
        f"{github['path'].lstrip('/')}"
    )
    payload = _safe_json_request(api_url, params={"ref": github["branch"]}, headers=_github_headers())
    if not isinstance(payload, dict):
        raise ValueError("github_content_not_file")

    download_url = _normalize_media_url(payload.get("download_url"))
    if not download_url:
        download_url = (
            f"{settings.github_raw_base_url.rstrip('/')}/{github['owner']}/{github['repo']}/"
            f"{github['branch']}/{github['path'].lstrip('/')}"
        )

    content = _safe_text_request(download_url, headers=_github_headers())
    extension = f".{github['path'].split('.')[-1].lower()}" if "." in github["path"] else ".txt"
    html_url = _normalize_media_url(payload.get("html_url")) or download_url
    items = _parse_prompt_records(content, extension, html_url, query, limit)
    status = _source_status("github", configured=True, enabled=True, items_count=len(items), message="ok", requires_api_key=False)
    status["repo"] = github
    return items, status


def _item_has_media(item: dict[str, Any]) -> bool:
    return bool(_normalize_media_url(item.get("thumbnail_url")) or _normalize_media_url(item.get("image_url")) or _normalize_media_url(item.get("video_url")))


def _stable_daily_seed(salt: str) -> int:
    today = dt.datetime.utcnow().strftime("%Y-%m-%d")
    digest = hashlib.sha256(f"{today}:{salt}".encode("utf-8")).hexdigest()[:12]
    return int(digest, 16)


def _diversify_candidates(items: list[dict[str, Any]], limit: int, *, seed: str) -> list[dict[str, Any]]:
    if not items:
        return []
    with_media = [item for item in items if _item_has_media(item)]
    without_media = [item for item in items if not _item_has_media(item)]
    shuffled_with_media = with_media[:]
    shuffled_without_media = without_media[:]
    rng = random.Random(_stable_daily_seed(seed))
    rng.shuffle(shuffled_with_media)
    rng.shuffle(shuffled_without_media)
    ranked = [*shuffled_with_media, *shuffled_without_media]
    return ranked[:limit]


def _interleave_sources(items: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    buckets: dict[str, list[dict[str, Any]]] = {}
    order: list[str] = []
    for item in items:
        source = str(item.get("source") or "")
        if source not in buckets:
            buckets[source] = []
            order.append(source)
        buckets[source].append(item)
    merged: list[dict[str, Any]] = []
    while len(merged) < limit and any(buckets[source] for source in order):
        for source in order:
            if not buckets[source]:
                continue
            merged.append(buckets[source].pop(0))
            if len(merged) >= limit:
                break
    return merged


def _finalize_feed_items(items: list[dict[str, Any]], limit: int, *, seed: str) -> list[dict[str, Any]]:
    deduped: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in items:
        source = str(item.get("source") or "")
        external_id = str(item.get("id") or "")
        prompt = str(item.get("prompt") or "")
        key = f"{source}:{external_id or hashlib.sha256(prompt.encode('utf-8')).hexdigest()[:16]}"
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
    enriched = _diversify_candidates(deduped, max(limit * 2, limit), seed=seed)
    return _interleave_sources(enriched, limit)


def get_prompt_feed_config() -> dict[str, Any]:
    github_defaults = _github_defaults()
    return {
        "default_query": "",
        "github_defaults": github_defaults,
        "sources": [
            {
                "source": "lexica",
                "configured": True,
                "enabled": True,
                "requires_api_key": False,
                "base_url": settings.lexica_api_base_url,
                "note": "Public infinite prompts feed from Lexica",
            },
            {
                "source": "prompthero",
                "configured": bool(_trim(settings.prompthero_bearer_token)),
                "enabled": bool(_trim(settings.prompthero_bearer_token)),
                "requires_api_key": True,
                "base_url": settings.prompthero_api_base_url,
                "note": "Configured via bearer token and endpoint URLs",
            },
            {
                "source": "krea",
                "configured": True,
                "enabled": True,
                "requires_api_key": False,
                "base_url": settings.krea_open_prompts_csv_url,
                "note": "Open Prompts CSV lite dataset",
            },
            {
                "source": "github",
                "configured": True,
                "enabled": True,
                "requires_api_key": False,
                "base_url": settings.github_api_base_url,
                "note": "Public repo contents/raw import with optional token",
            },
            {
                "source": "civitai",
                "configured": bool(_trim(settings.civitai_api_key)),
                "enabled": True,
                "requires_api_key": True,
                "base_url": settings.civitai_api_base_url,
                "note": "Images API sorted by most reactions with optional token",
            },
            {
                "source": "youtube",
                "configured": bool(_trim(settings.youtube_api_key)),
                "enabled": True,
                "requires_api_key": True,
                "base_url": "https://www.googleapis.com/youtube/v3/videos",
                "note": "Trending videos with thumbnails from the YouTube API",
            },
            {
                "source": "reddit",
                "configured": bool(_trim(settings.reddit_client_id)) and bool(_trim(settings.reddit_client_secret)),
                "enabled": True,
                "requires_api_key": True,
                "base_url": "https://www.reddit.com",
                "note": "Hot Reddit posts with preview images and videos",
            },
            {
                "source": "tiktok",
                "configured": True,
                "enabled": True,
                "requires_api_key": False,
                "base_url": settings.tiktok_search_url,
                "note": "Discover scrape with post and hashtag thumbnails",
            },
        ],
    }


async def get_prompt_feed(
    *,
    query: str,
    source: str = "all",
    limit: int = 24,
    offset: int = 0,
    github_owner: str | None = None,
    github_repo: str | None = None,
    github_branch: str | None = None,
    github_path: str | None = None,
) -> dict[str, Any]:
    normalized_query = _trim(query, "")
    normalized_source = _trim(source, "all").lower()
    normalized_offset = max(offset, 0)
    normalized_limit = max(limit, 1)
    github_defaults = _github_defaults(
        owner=github_owner,
        repo=github_repo,
        branch=github_branch,
        path=github_path,
    )
    signature_raw = json.dumps(
        {
            "query": normalized_query,
            "source": normalized_source,
            "limit": normalized_limit,
            "offset": normalized_offset,
            "github": github_defaults,
        },
        sort_keys=True,
    )
    cache_key = f"prompt_feed:v3:{hashlib.sha256(signature_raw.encode('utf-8')).hexdigest()}"
    cached = await cache_get_json(cache_key)
    if isinstance(cached, dict) and cached.get("items"):
        return cached

    sources = [normalized_source] if normalized_source in PROMPT_FEED_SOURCES else list(PROMPT_FEED_FEED_SOURCES)
    page_window = max(normalized_offset + (normalized_limit * 3), normalized_limit * 3)
    if len(sources) == 1:
        per_source_limit = min(max(page_window, 48), 160)
    else:
        per_source_limit = min(max(page_window, 48), 120)

    items: list[dict[str, Any]] = []
    source_status: dict[str, dict[str, Any]] = {}

    for source_name in sources:
        try:
            if source_name == "lexica":
                current_items, status = _collect_lexica(normalized_query, per_source_limit)
            elif source_name == "prompthero":
                current_items, status = _collect_prompthero(normalized_query, per_source_limit)
            elif source_name == "krea":
                current_items, status = _collect_krea(normalized_query, per_source_limit)
            elif source_name == "civitai":
                current_items, status = _collect_civitai(normalized_query, per_source_limit)
            elif source_name in SOCIAL_PROMPT_FEED_SOURCES:
                current_items, status = await _collect_social_feed(source_name, per_source_limit)
            else:
                current_items, status = _collect_github(
                    normalized_query,
                    per_source_limit,
                    owner=github_defaults["owner"],
                    repo=github_defaults["repo"],
                    branch=github_defaults["branch"],
                    path=github_defaults["path"],
                )
        except Exception as exc:  # noqa: BLE001
            logger.warning("prompt_feed_source_failed source=%s error=%s", source_name, exc)
            current_items = []
            status = _source_status(
                source_name,
                configured=(
                    source_name != "prompthero"
                    or bool(_trim(settings.prompthero_bearer_token))
                ) and (source_name != "civitai" or bool(_trim(settings.civitai_api_key))),
                enabled=False,
                items_count=0,
                message=f"failed: {exc}",
                requires_api_key=source_name in {"prompthero", "civitai"},
            )

        items.extend(current_items)
        source_status[source_name] = status

    ranked_items = _finalize_feed_items(items, page_window, seed=f"{normalized_query}:{normalized_source}")
    page_items = ranked_items[normalized_offset : normalized_offset + normalized_limit]
    has_more = len(ranked_items) > (normalized_offset + normalized_limit)
    next_offset = normalized_offset + len(page_items) if has_more else None

    payload = {
        "query": normalized_query,
        "source": normalized_source,
        "offset": normalized_offset,
        "limit": normalized_limit,
        "has_more": has_more,
        "next_offset": next_offset,
        "github": github_defaults,
        "items": page_items,
        "source_status": source_status,
    }
    if page_items:
        await cache_set_json(cache_key, payload, ttl=max(settings.prompt_feed_cache_ttl, 300))
    return payload
