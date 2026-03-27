import json
import logging
from dataclasses import dataclass
from typing import Any

import requests

from app.core.config import get_settings
from app.models.trend import Trend


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


def _build_viral_context(trend: Trend, output_type: str, user_niche: str | None = None) -> dict[str, str]:
    metadata = _read_metadata(trend)
    title = str(getattr(trend, "title", "") or "").strip()
    hashtag = str(metadata.get("hashtag") or "").strip()
    source_url = str(metadata.get("source_url") or "").strip()
    views = _to_int(metadata.get("views"))
    likes = _to_int(metadata.get("likes"))
    engagement = round((likes / views) * 100, 2) if views > 0 else 0.0

    signal_text = f"{title} {hashtag}".lower()
    is_music_signal = trend.category == "music" or any(
        token in signal_text
        for token in ["music", "musica", "song", "dance", "baile", "funk", "samba", "forro", "sertanejo", "pagode"]
    )

    if is_music_signal:
        replication_pattern = (
            "person-led performance format: open with the strongest song hook, show a human dancing or acting on-beat, "
            "use 3-5 beat-synced cuts, and close with a repeatable move CTA"
        )
        scene_notes = (
            "Use visible body movement, clear rhythm cues, and captions that instruct viewers to recreate the move in their own style"
        )
    elif trend.category == "gaming":
        replication_pattern = (
            "challenge or clutch format: hook with the key moment, then fast progression of 2-4 highlights, ending with replayable challenge prompt"
        )
        scene_notes = "Keep overlays short, focus on reaction + payoff, and end with a clear skill/challenge CTA"
    elif trend.category in {"news", "technology", "finance", "education"}:
        replication_pattern = (
            "hook + explanation format: 2-second shocking claim, 3 concise evidence beats, and CTA inviting comments/opinions"
        )
        scene_notes = "Use text overlays for proof points and keep each beat under 4 seconds"
    else:
        replication_pattern = (
            "relatable lifestyle short: start with problem/pain hook, show transformation in 3 visual beats, end with direct next-step CTA"
        )
        scene_notes = "Feature a real person on camera, concrete before/after moments, and caption-first storytelling"

    topic_seed = hashtag or title or "viral trend"
    return {
        "topic_seed": topic_seed,
        "source_url": source_url,
        "views": str(views),
        "likes": str(likes),
        "engagement_rate": f"{engagement}%",
        "output_type": output_type.lower(),
        "user_niche": user_niche or "creator",
        "replication_pattern": replication_pattern,
        "scene_notes": scene_notes,
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
    style, tone = STYLE_BY_CATEGORY.get(trend.category, STYLE_BY_CATEGORY["lifestyle"])
    fmt, duration = FORMAT_BY_OUTPUT.get(output_type.lower(), FORMAT_BY_OUTPUT["video"])
    viral_context = _build_viral_context(trend, output_type=output_type, user_niche=user_niche)
    hashtags = [
        f"#{trend.category}",
        f"#{trend.platform}",
        "#trendprompt",
        f"#{(user_niche or 'creator').replace(' ', '').lower()}",
    ]
    if viral_context["topic_seed"].startswith("#"):
        hashtags.insert(0, viral_context["topic_seed"])

    description = (
        f"{trend.title}. Create {output_type.lower()} content optimized for {platform_target} with a {style}. "
        f"Base concept on viral seed {viral_context['topic_seed']} and replicate the pattern: {viral_context['replication_pattern']}. "
        f"Scene notes: {viral_context['scene_notes']}. "
        f"Trend signal context: views={viral_context['views']}, likes={viral_context['likes']}, engagement={viral_context['engagement_rate']}. "
        "Include clear viral hook in first 2 seconds and CTA at the end."
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


def _sanitize_gemini_payload(payload: dict, output_type: str, platform_target: str, user_niche: str | None) -> PromptPayload:
    output_key = output_type.lower()
    rules = OUTPUT_TYPE_RULES.get(output_key, OUTPUT_TYPE_RULES["video"])
    hashtags_raw = payload.get("hashtags")
    if not isinstance(hashtags_raw, list):
        hashtags_raw = []
    hashtags = [str(tag).strip() for tag in hashtags_raw if str(tag).strip()]
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
    user_niche: str | None = None,
) -> PromptPayload:
    if not settings.gemini_api_key:
        raise RuntimeError("gemini_api_key_missing")

    model = settings.gemini_model
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
    prompt = (
        f"Trend title: {trend.title}\n"
        f"Trend category: {trend.category}\n"
        f"Trend platform: {trend.platform}\n"
        f"Trend hashtag/topic seed: {viral_context['topic_seed']}\n"
        f"Trend views: {viral_context['views']}\n"
        f"Trend likes: {viral_context['likes']}\n"
        f"Trend engagement rate: {viral_context['engagement_rate']}\n"
        f"Trend source URL (if available): {source_hint}\n"
        f"Target platform: {platform_target}\n"
        f"Output type: {output_key}\n"
        f"User niche: {viral_context['user_niche']}\n"
        f"Output-specific format guidance: {rules['format_hint']}\n"
        f"Output-specific duration guidance: {rules['duration_hint']}\n"
        f"Output-specific content guidance: {rules['description_hint']}\n"
        f"Viral replication pattern to follow: {viral_context['replication_pattern']}\n"
        f"Scene execution notes: {viral_context['scene_notes']}\n"
        "Describe actionable on-camera direction: who appears, what they do each beat, camera movement, text overlays, and CTA.\n"
        f"{music_replication_hint}\n"
        "The response must be creator-ready and practical for immediate production.\n"
        f"{instruction}"
    )

    response = requests.post(
        endpoint,
        params={"key": settings.gemini_api_key},
        json={"contents": [{"parts": [{"text": prompt}]}]},
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


def build_prompt(trend: Trend, platform_target: str, output_type: str, user_niche: str | None = None) -> PromptPayload:
    try:
        if settings.gemini_api_key:
            payload = _build_with_gemini(trend, platform_target, output_type, user_niche=user_niche)
            if payload.description and payload.visual_style and payload.tone and payload.format:
                logger.info(
                    "prompt_generator_gemini_success",
                    extra={"output_type": output_type.lower(), "platform_target": platform_target.lower()},
                )
                return payload
            raise RuntimeError("gemini_incomplete_payload")
    except Exception as exc:  # noqa: BLE001
        logger.warning("prompt_generator_gemini_failed_fallback_local", extra={"error": str(exc)})

    return _build_local_prompt_payload(trend, platform_target, output_type, user_niche=user_niche)

