import base64
import json
import logging
from dataclasses import dataclass
from typing import Any

import requests

from app.core.config import get_settings
from app.models.trend import Trend
from app.schemas.prompt import PromptGeneratorConfigIn


@dataclass
class PromptPayload:
    description: str
    visual_style: str
    tone: str
    format: str
    hashtags: list[str]
    recommended_duration: str
    publish_time: str


logger = logging.getLogger(__name__)
settings = get_settings()


STYLE_BY_CATEGORY = {
    "gaming": ("high-energy gameplay montage", "competitive, fast-paced"),
    "music": ("rhythmic cinematic cuts", "vibrant and emotional"),
    "lifestyle": ("clean aspirational aesthetics", "friendly and relatable"),
    "memes": ("punchy meme composition", "humorous and ironic"),
    "news": ("credible newsroom visuals", "urgent and informative"),
    "technology": ("futuristic cinematic lighting", "innovative and bold"),
    "finance": ("minimal financial dashboard visuals", "confident and practical"),
    "education": ("clear explainer storyboard", "helpful and authoritative"),
}

CONTENT_PROFILES = [
    {
        "label": "sports",
        "keywords": [
            "football",
            "futbol",
            "soccer",
            "goal",
            "gol",
            "match",
            "stadium",
            "cricket",
            "basketball",
            "nba",
            "tennis",
            "volleyball",
            "deporte",
            "sports",
            "athlete",
            "player",
            "juego",
            "jugando",
            "training",
            "workout",
            "gym",
        ],
        "style": "dynamic sports realism with kinetic camera energy",
        "tone": "intense, competitive, emotional payoff",
        "pattern": "highlight replay format: open with the key athletic moment, show 2-4 action replays/angles, close with challenge or prediction CTA",
        "scene_notes": "Keep the athlete/action central, include field or court context, and emphasize impact/reaction shots",
    },
    {
        "label": "music",
        "keywords": ["music", "musica", "song", "dance", "baile", "beat", "dj", "choreo", "bailando"],
        "style": "rhythmic cinematic cuts with human performance focus",
        "tone": "vibrant, expressive, and replayable",
        "pattern": "person-led performance format: open with strongest musical hook, show 3-5 beat-synced cuts, close with repeatable move CTA",
        "scene_notes": "Use visible body movement and rhythm cues that are easy to imitate",
    },
    {
        "label": "gaming",
        "keywords": ["game", "gaming", "gameplay", "fps", "ranked", "clutch", "stream", "controller"],
        "style": "high-energy gameplay montage",
        "tone": "competitive and fast-paced",
        "pattern": "challenge or clutch format: hook with key moment, fast progression of highlights, end with replayable challenge CTA",
        "scene_notes": "Focus on reaction + payoff and short overlays",
    },
    {
        "label": "technology",
        "keywords": ["tech", "ai", "startup", "software", "app", "gadget", "coding", "robot", "saas"],
        "style": "futuristic cinematic lighting",
        "tone": "innovative and bold",
        "pattern": "hook + explanation format: opening claim, 3 concise proof beats, CTA inviting opinions",
        "scene_notes": "Use clear proof points with concise overlays",
    },
]


def _read_metadata(trend: Trend) -> dict[str, Any]:
    raw = getattr(trend, "metadata_json", None)
    if isinstance(raw, dict):
        return raw
    return {}


def _to_int(value: Any) -> int:
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str):
        parsed = value.replace(",", "").strip()
        if parsed.isdigit():
            return int(parsed)
    return 0


def _build_signal_text(trend: Trend, metadata: dict[str, Any]) -> str:
    chunks = [
        str(getattr(trend, "title", "") or "").strip(),
        str(getattr(trend, "description", "") or "").strip(),
        str(metadata.get("hashtag") or "").strip(),
        str(metadata.get("caption") or "").strip(),
        str(metadata.get("source_url") or "").strip(),
    ]
    return " ".join(part for part in chunks if part).lower()


def _extract_media_references(metadata: dict[str, Any]) -> dict[str, str]:
    def _read_url(key: str) -> str:
        value = str(metadata.get(key) or "").strip()
        if value.startswith("http://") or value.startswith("https://"):
            return value
        return ""

    video_id = str(metadata.get("video_id") or "").strip()
    source_url = _read_url("source_url")
    thumbnail_url = _read_url("thumbnail_url")
    image_url = _read_url("image_url") or _read_url("preview_image_url")
    video_url = _read_url("video_url")
    embed_url = f"https://www.youtube.com/embed/{video_id}" if video_id else ""
    if not source_url and video_id:
        source_url = f"https://www.youtube.com/watch?v={video_id}"
    if not thumbnail_url and video_id:
        thumbnail_url = f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"
    reference_lines = []
    if source_url:
        reference_lines.append(f"source_url={source_url}")
    if video_url:
        reference_lines.append(f"video_url={video_url}")
    if thumbnail_url:
        reference_lines.append(f"thumbnail_url={thumbnail_url}")
    if image_url:
        reference_lines.append(f"image_url={image_url}")
    if embed_url:
        reference_lines.append(f"embed_url={embed_url}")

    return {
        "source_url": source_url,
        "video_url": video_url,
        "thumbnail_url": thumbnail_url,
        "image_url": image_url,
        "embed_url": embed_url,
        "reference_text": "; ".join(reference_lines) if reference_lines else "N/A",
    }


def _infer_content_profile(trend: Trend, metadata: dict[str, Any]) -> dict[str, str]:
    signal_text = _build_signal_text(trend, metadata)
    for profile in CONTENT_PROFILES:
        if any(token in signal_text for token in profile["keywords"]):
            return {
                "label": profile["label"],
                "style": profile["style"],
                "tone": profile["tone"],
                "pattern": profile["pattern"],
                "scene_notes": profile["scene_notes"],
            }

    fallback_style, fallback_tone = STYLE_BY_CATEGORY.get(trend.category, STYLE_BY_CATEGORY["lifestyle"])
    if trend.category in {"news", "technology", "finance", "education"}:
        pattern = "hook + explanation format: opening claim, 3 concise proof beats, CTA inviting comments/opinions"
        scene_notes = "Use concise evidence overlays and keep every beat practical"
    elif trend.category == "gaming":
        pattern = "challenge or clutch format: key moment hook, fast highlight progression, replayable challenge CTA"
        scene_notes = "Keep reactions and payoff clear in each beat"
    else:
        pattern = "relatable short format: start with a strong hook, show transformation/action in 3 beats, end with direct CTA"
        scene_notes = "Keep a real person or clear subject visible and the result obvious"
    return {
        "label": trend.category,
        "style": fallback_style,
        "tone": fallback_tone,
        "pattern": pattern,
        "scene_notes": scene_notes,
    }


def _build_viral_context(trend: Trend, output_type: str, user_niche: str | None = None) -> dict[str, str]:
    metadata = _read_metadata(trend)
    media_refs = _extract_media_references(metadata)
    title = str(getattr(trend, "title", "") or "").strip()
    description = str(getattr(trend, "description", "") or "").strip()
    hashtag = str(metadata.get("hashtag") or "").strip()
    source_url = media_refs["source_url"]
    views = _to_int(metadata.get("views"))
    likes = _to_int(metadata.get("likes"))
    engagement = round((likes / views) * 100, 2) if views > 0 else 0.0
    profile = _infer_content_profile(trend, metadata)

    topic_seed = hashtag or title or "viral trend"
    trend_subject = title or hashtag or description or "main viral subject in the trend"
    context_summary = f"title={title or 'N/A'} | hashtag={hashtag or 'N/A'} | description={description or 'N/A'}"
    return {
        "topic_seed": topic_seed,
        "source_url": source_url,
        "views": str(views),
        "likes": str(likes),
        "engagement_rate": f"{engagement}%",
        "output_type": output_type.lower(),
        "user_niche": user_niche or "creator",
        "replication_pattern": profile["pattern"],
        "scene_notes": profile["scene_notes"],
        "style_hint": profile["style"],
        "tone_hint": profile["tone"],
        "content_profile": profile["label"],
        "trend_subject": trend_subject,
        "context_summary": context_summary,
        "media_reference_text": media_refs["reference_text"],
        "thumbnail_url": media_refs["thumbnail_url"],
        "image_url": media_refs["image_url"],
        "video_url": media_refs["video_url"],
        "embed_url": media_refs["embed_url"],
    }

OUTPUT_TYPE_RULES = {
    "video": {
        "format_hint": "vertical 9:16 short-form storyboard",
        "duration_hint": "12-20 seconds",
        "description_hint": "Include hook in first 2 seconds, progression, and CTA ending",
    },
    "image": {
        "format_hint": "single high-detail visual composition",
        "duration_hint": "N/A",
        "description_hint": "Describe composition, subject framing, text overlay, and visual hierarchy",
    },
    "audio": {
        "format_hint": "short hook-first audio script",
        "duration_hint": "20-30 seconds",
        "description_hint": "Describe opening hook, key beats, and close with CTA",
    },
}

FORMAT_BY_OUTPUT = {
    "video": ("vertical 9:16 short-form", "12-20 seconds"),
    "image": ("high-detail still composition", "N/A"),
    "audio": ("hook-first short audio segment", "20-30 seconds"),
}

PUBLISH_BY_PLATFORM = {
    "tiktok": "18:00-21:00 local time",
    "youtube": "17:00-20:00 local time",
    "instagram": "11:00-13:00 local time",
    "reddit": "08:00-10:00 local time",
}


def _build_local_prompt_payload(
    trend: Trend,
    platform_target: str,
    output_type: str,
    user_niche: str | None = None,
) -> PromptPayload:
    metadata = _read_metadata(trend)
    profile = _infer_content_profile(trend, metadata)
    style = profile["style"]
    tone = profile["tone"]
    fmt, duration = FORMAT_BY_OUTPUT.get(output_type.lower(), FORMAT_BY_OUTPUT["video"])
    viral_context = _build_viral_context(trend, output_type=output_type, user_niche=user_niche)
    hashtag_candidates = [
        viral_context["topic_seed"] if viral_context["topic_seed"].startswith("#") else "",
        f"#{viral_context['content_profile']}",
        f"#{trend.platform.lower()}",
        "#trendprompt",
        f"#{(user_niche or 'creator').replace(' ', '').lower()}",
    ]
    hashtags: list[str] = []
    for tag in hashtag_candidates:
        cleaned = str(tag).strip().lower()
        if not cleaned:
            continue
        normalized = cleaned if cleaned.startswith("#") else f"#{cleaned}"
        if normalized not in hashtags:
            hashtags.append(normalized)

    if output_type.lower() == "image":
        description = (
            f"Create an image for {platform_target} that replicates this viral concept: {viral_context['trend_subject']}. "
            f"Keep the same core subject/action and visual context from the trend signal ({viral_context['context_summary']}). "
            f"Media references (if available): {viral_context['media_reference_text']}. "
            f"Use style {style}. Composition must include a clear focal subject, dynamic action freeze-frame feeling, background context, and bold short text overlay. "
            f"Replication pattern to preserve: {viral_context['replication_pattern']}. "
            f"Scene notes: {viral_context['scene_notes']}. "
            f"Trend signal: views={viral_context['views']}, likes={viral_context['likes']}, engagement={viral_context['engagement_rate']}."
        )
    elif output_type.lower() == "audio":
        description = (
            f"Create an audio-first script for {platform_target} cloning the viral idea around {viral_context['trend_subject']}. "
            f"Media references (if available): {viral_context['media_reference_text']}. "
            f"Follow pattern: {viral_context['replication_pattern']}. Scene notes: {viral_context['scene_notes']}. "
            f"Ensure opening hook, key beats, and closing CTA. Trend signal: views={viral_context['views']}, likes={viral_context['likes']}."
        )
    else:
        description = (
            f"Create a {output_type.lower()} concept for {platform_target} cloning this viral trend: {viral_context['trend_subject']}. "
            f"Preserve subject/action context from trend signal ({viral_context['context_summary']}) and execute pattern: {viral_context['replication_pattern']}. "
            f"Media references (if available): {viral_context['media_reference_text']}. "
            f"Scene notes: {viral_context['scene_notes']}. "
            f"Use style {style}. Include hook in first 2 seconds, progression beats, and final CTA. "
            f"Trend signal: views={viral_context['views']}, likes={viral_context['likes']}, engagement={viral_context['engagement_rate']}."
        )
    return PromptPayload(
        description=description,
        visual_style=style,
        tone=tone,
        format=fmt,
        hashtags=hashtags,
        recommended_duration=duration,
        publish_time=PUBLISH_BY_PLATFORM.get(platform_target.lower(), "18:00-21:00 local time"),
    )


def _extract_json_object(text: str) -> dict:
    stripped = text.strip()
    if stripped.startswith("```"):
        lines = stripped.splitlines()
        if len(lines) >= 3:
            stripped = "\n".join(lines[1:-1]).strip()
    start = stripped.find("{")
    end = stripped.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("gemini_response_no_json_object")
    return json.loads(stripped[start : end + 1])


def _build_inline_preview_part(viral_context: dict[str, str]) -> dict[str, Any] | None:
    candidate_urls = [viral_context.get("thumbnail_url"), viral_context.get("image_url")]
    preview_url = next((url for url in candidate_urls if isinstance(url, str) and url.startswith("http")), "")
    if not preview_url:
        return None

    try:
        response = requests.get(preview_url, timeout=8)
        response.raise_for_status()
        content_type = str(response.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        if not content_type.startswith("image/"):
            return None
        content = response.content or b""
        if len(content) > 3_000_000:
            return None
        encoded = base64.b64encode(content).decode("utf-8")
        if not encoded:
            return None
        return {"inlineData": {"mimeType": content_type, "data": encoded}}
    except Exception:  # noqa: BLE001
        return None


def _sanitize_gemini_payload(payload: dict, output_type: str, platform_target: str, user_niche: str | None) -> PromptPayload:
    output_key = output_type.lower()
    rules = OUTPUT_TYPE_RULES.get(output_key, OUTPUT_TYPE_RULES["video"])
    hashtags_raw = payload.get("hashtags")
    if not isinstance(hashtags_raw, list):
        hashtags_raw = []
    hashtags: list[str] = []
    for tag in hashtags_raw:
        raw = str(tag).strip()
        if not raw:
            continue
        normalized = raw if raw.startswith("#") else f"#{raw}"
        normalized = normalized.lower()
        if normalized not in hashtags:
            hashtags.append(normalized)
    if not hashtags:
        hashtags = [
            f"#{output_key}",
            f"#{platform_target.lower()}",
            f"#{(user_niche or 'creator').replace(' ', '').lower()}",
            "#trendprompt",
        ]

    return PromptPayload(
        description=str(payload.get("description", "")).strip() or rules["description_hint"],
        visual_style=str(payload.get("visual_style", "")).strip() or "modern high-contrast aesthetic",
        tone=str(payload.get("tone", "")).strip() or "engaging and clear",
        format=str(payload.get("format", "")).strip() or rules["format_hint"],
        hashtags=hashtags,
        recommended_duration=str(payload.get("recommended_duration", "")).strip() or rules["duration_hint"],
        publish_time=str(payload.get("publish_time", "")).strip()
        or PUBLISH_BY_PLATFORM.get(platform_target.lower(), "18:00-21:00 local time"),
    )


def _build_with_gemini(
    trend: Trend,
    platform_target: str,
    output_type: str,
    api_key: str,
    model: str,
    user_niche: str | None = None,
) -> PromptPayload:
    if not api_key:
        raise RuntimeError("gemini_api_key_missing")

    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    output_key = output_type.lower()
    rules = OUTPUT_TYPE_RULES.get(output_key, OUTPUT_TYPE_RULES["video"])
    viral_context = _build_viral_context(trend, output_type=output_type, user_niche=user_niche)
    source_hint = viral_context["source_url"] or "N/A"
    music_replication_hint = (
        "If the trend is music/dance oriented, the concept MUST include a person dancing or performing to the musical hook."
    )

    instruction = (
        "Return ONLY one valid JSON object with keys: "
        "description, visual_style, tone, format, hashtags, recommended_duration, publish_time. "
        "hashtags must be an array of strings. No markdown, no code fences, no extra text."
    )
    preview_part = _build_inline_preview_part(viral_context)
    preview_attachment_hint = (
        "An inline preview image from the trend is attached in this request; use it as visual evidence to clone subject/action/framing."
        if preview_part
        else "No inline preview image was attached."
    )
    prompt = (
        f"Trend title: {trend.title}\n"
        f"Trend category: {trend.category}\n"
        f"Trend platform: {trend.platform}\n"
        f"Detected content profile (higher priority than category/niche when conflicting): {viral_context['content_profile']}\n"
        f"Core subject/action to clone: {viral_context['trend_subject']}\n"
        f"Trend textual context: {viral_context['context_summary']}\n"
        f"Trend hashtag/topic seed: {viral_context['topic_seed']}\n"
        f"Trend views: {viral_context['views']}\n"
        f"Trend likes: {viral_context['likes']}\n"
        f"Trend engagement rate: {viral_context['engagement_rate']}\n"
        f"Trend source URL (if available): {source_hint}\n"
        f"Trend media references (if available): {viral_context['media_reference_text']}\n"
        f"{preview_attachment_hint}\n"
        f"Target platform: {platform_target}\n"
        f"Output type: {output_key}\n"
        f"User niche: {viral_context['user_niche']}\n"
        f"Output-specific format guidance: {rules['format_hint']}\n"
        f"Output-specific duration guidance: {rules['duration_hint']}\n"
        f"Output-specific content guidance: {rules['description_hint']}\n"
        f"Preferred style hint from detected content profile: {viral_context['style_hint']}\n"
        f"Preferred tone hint from detected content profile: {viral_context['tone_hint']}\n"
        f"Viral replication pattern to follow: {viral_context['replication_pattern']}\n"
        f"Scene execution notes: {viral_context['scene_notes']}\n"
        "You must clone the viral mechanics from the trend subject/action and keep the scenario similar, not generic.\n"
        "If media reference URLs are available, use them as primary context anchors for subject, environment, and action.\n"
        "User niche is a secondary adaptation layer and must never overwrite the core trend scenario.\n"
        "Never force technology/news explanation format when trend subject is clearly sports, dance, lifestyle, or gaming.\n"
        "For image output, do not mention seconds/beats timeline; focus on composition, subject, action freeze, framing, and overlay text.\n"
        "Describe actionable on-camera direction: who appears, what they do each beat, camera movement, text overlays, and CTA.\n"
        f"{music_replication_hint}\n"
        "The response must be creator-ready and practical for immediate production.\n"
        f"{instruction}"
    )

    response = requests.post(
        endpoint,
        params={"key": api_key},
        json={
            "contents": [{"parts": [{"text": prompt}, *([preview_part] if preview_part else [])]}],
            "generationConfig": {"temperature": 0.2, "topP": 0.8, "candidateCount": 1},
        },
        timeout=20,
    )
    response.raise_for_status()
    data = response.json()
    candidates = data.get("candidates") or []
    if not candidates:
        raise RuntimeError("gemini_empty_candidates")

    parts = (((candidates[0] or {}).get("content") or {}).get("parts") or [])
    text = "\n".join(str(p.get("text", "")) for p in parts if isinstance(p, dict)).strip()
    payload = _extract_json_object(text)

    return _sanitize_gemini_payload(payload, output_type=output_key, platform_target=platform_target, user_niche=user_niche)


def _resolve_generator_config(
    generator_config: PromptGeneratorConfigIn | None,
) -> tuple[str | None, str]:
    override_key = str(generator_config.api_key or "").strip() if generator_config else ""
    override_model = str(generator_config.model or "").strip() if generator_config else ""
    api_key = override_key or settings.gemini_api_key
    model = override_model or settings.gemini_model
    return api_key, model


def build_prompt(
    trend: Trend,
    platform_target: str,
    output_type: str,
    user_niche: str | None = None,
    generator_config: PromptGeneratorConfigIn | None = None,
) -> PromptPayload:
    api_key, model = _resolve_generator_config(generator_config)
    try:
        if api_key:
            payload = _build_with_gemini(
                trend,
                platform_target,
                output_type,
                api_key=api_key,
                model=model,
                user_niche=user_niche,
            )
            if payload.description and payload.visual_style and payload.tone and payload.format:
                logger.info(
                    "prompt_generator_gemini_success",
                    extra={
                        "output_type": output_type.lower(),
                        "platform_target": platform_target.lower(),
                        "gemini_model": model,
                        "custom_api_key": bool(generator_config and str(generator_config.api_key or "").strip()),
                    },
                )
                return payload
            raise RuntimeError("gemini_incomplete_payload")
    except Exception as exc:  # noqa: BLE001
        logger.warning("prompt_generator_gemini_failed_fallback_local", extra={"error": str(exc)})

    return _build_local_prompt_payload(trend, platform_target, output_type, user_niche=user_niche)
