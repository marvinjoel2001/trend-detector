import json
import mimetypes
import re
from html import unescape
from typing import Any
from urllib.parse import urljoin

import requests

from app.core.config import get_settings
from app.schemas.prompt import PromptGeneratorConfigIn

settings = get_settings()

MAX_REMOTE_FILE_BYTES = 40_000_000
MAX_LOCAL_FILE_BYTES = 60_000_000


def _extract_json_object(text: str) -> dict[str, Any]:
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


def _resolve_generator_config(generator_config: PromptGeneratorConfigIn | None) -> tuple[str | None, str]:
    override_key = str(generator_config.api_key or "").strip() if generator_config else ""
    override_model = str(generator_config.model or "").strip() if generator_config else ""
    api_key = override_key or settings.gemini_api_key
    model = override_model or settings.gemini_model
    return api_key, model


def _guess_mime_type(filename: str, fallback: str = "application/octet-stream") -> str:
    guessed = mimetypes.guess_type(filename)[0]
    return guessed or fallback


def _extract_title(html: str) -> str:
    match = re.search(r"<title[^>]*>(.*?)</title>", html, flags=re.IGNORECASE | re.DOTALL)
    return unescape(re.sub(r"\s+", " ", match.group(1)).strip()) if match else ""


def _extract_meta(html: str, key: str) -> str:
    patterns = [
        rf'<meta[^>]+property=["\']{re.escape(key)}["\'][^>]+content=["\']([^"\']+)["\']',
        rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']{re.escape(key)}["\']',
        rf'<meta[^>]+name=["\']{re.escape(key)}["\'][^>]+content=["\']([^"\']+)["\']',
        rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']{re.escape(key)}["\']',
    ]
    for pattern in patterns:
        match = re.search(pattern, html, flags=re.IGNORECASE)
        if match:
            return unescape(match.group(1).strip())
    return ""


def _normalize_hashtags(values: Any) -> list[str]:
    if not isinstance(values, list):
        values = []
    result: list[str] = []
    for value in values:
        raw = str(value).strip().lower()
        if not raw:
            continue
        tag = raw if raw.startswith("#") else f"#{raw}"
        if tag not in result:
            result.append(tag)
    return result[:8]


def _normalize_list(values: Any) -> list[str]:
    if not isinstance(values, list):
        return []
    result: list[str] = []
    for value in values:
        text = str(value).strip()
        if text:
            result.append(text)
    return result[:8]


def _upload_bytes_to_gemini(api_key: str, filename: str, mime_type: str, data: bytes) -> dict[str, str]:
    start_response = requests.post(
        "https://generativelanguage.googleapis.com/upload/v1beta/files",
        params={"key": api_key},
        headers={
            "X-Goog-Upload-Protocol": "resumable",
            "X-Goog-Upload-Command": "start",
            "X-Goog-Upload-Header-Content-Length": str(len(data)),
            "X-Goog-Upload-Header-Content-Type": mime_type,
            "Content-Type": "application/json",
        },
        json={"file": {"display_name": filename}},
        timeout=30,
    )
    start_response.raise_for_status()
    upload_url = start_response.headers.get("X-Goog-Upload-URL", "").strip()
    if not upload_url:
        raise RuntimeError("gemini_upload_url_missing")

    finalize_response = requests.post(
        upload_url,
        headers={
            "X-Goog-Upload-Offset": "0",
            "X-Goog-Upload-Command": "upload, finalize",
            "Content-Type": mime_type,
        },
        data=data,
        timeout=120,
    )
    finalize_response.raise_for_status()
    file_payload = (finalize_response.json() or {}).get("file") or {}
    file_uri = str(file_payload.get("uri") or "").strip()
    if not file_uri:
        raise RuntimeError("gemini_file_uri_missing")
    return {
        "file_uri": file_uri,
        "mime_type": str(file_payload.get("mimeType") or mime_type).strip() or mime_type,
        "name": str(file_payload.get("name") or "").strip(),
    }


def _download_remote_asset(url: str) -> dict[str, Any] | None:
    response = requests.get(url, timeout=25, stream=True, headers={"User-Agent": "TrendPrompt/1.0"})
    response.raise_for_status()
    mime_type = str(response.headers.get("Content-Type") or "").split(";")[0].strip().lower()
    if not mime_type.startswith(("image/", "video/")):
        return None

    chunks: list[bytes] = []
    size = 0
    for chunk in response.iter_content(1024 * 256):
        if not chunk:
            continue
        size += len(chunk)
        if size > MAX_REMOTE_FILE_BYTES:
            raise RuntimeError("remote_asset_too_large")
        chunks.append(chunk)

    data = b"".join(chunks)
    if not data:
        return None

    filename = url.rstrip("/").split("/")[-1] or "remote-asset"
    return {"filename": filename, "mime_type": mime_type, "data": data, "source_url": url}


def _resolve_remote_context(source_url: str) -> tuple[str, list[dict[str, Any]], list[dict[str, Any]]]:
    cleaned_url = str(source_url or "").strip()
    if not cleaned_url:
        return "", [], []

    response = requests.get(cleaned_url, timeout=25, headers={"User-Agent": "TrendPrompt/1.0"})
    response.raise_for_status()
    content_type = str(response.headers.get("Content-Type") or "").split(";")[0].strip().lower()

    attachments: list[dict[str, Any]] = []
    analyzed_inputs: list[dict[str, Any]] = []

    if content_type.startswith(("image/", "video/")):
        data = response.content or b""
        if len(data) > MAX_REMOTE_FILE_BYTES:
            raise RuntimeError("remote_asset_too_large")
        filename = cleaned_url.rstrip("/").split("/")[-1] or "remote-source"
        attachments.append({"filename": filename, "mime_type": content_type, "data": data, "source_url": cleaned_url})
        analyzed_inputs.append(
            {
                "source_type": "url",
                "name": filename,
                "mime_type": content_type,
                "origin": "remote-media",
                "size_bytes": len(data),
                "source_url": cleaned_url,
            }
        )
        return f"Direct media URL provided: {cleaned_url}", attachments, analyzed_inputs

    html = response.text
    title = _extract_title(html)
    description = _extract_meta(html, "description") or _extract_meta(html, "og:description")
    canonical = _extract_meta(html, "og:url") or cleaned_url
    media_candidates = [
        _extract_meta(html, "og:video"),
        _extract_meta(html, "og:video:url"),
        _extract_meta(html, "twitter:player:stream"),
        _extract_meta(html, "og:image"),
        _extract_meta(html, "twitter:image"),
    ]
    normalized_candidates = []
    for candidate in media_candidates:
        candidate = str(candidate or "").strip()
        if not candidate:
            continue
        absolute = urljoin(cleaned_url, candidate)
        if absolute not in normalized_candidates:
            normalized_candidates.append(absolute)

    for candidate in normalized_candidates[:2]:
        try:
            asset = _download_remote_asset(candidate)
        except Exception:  # noqa: BLE001
            asset = None
        if not asset:
            continue
        attachments.append(asset)
        analyzed_inputs.append(
            {
                "source_type": "url",
                "name": asset["filename"],
                "mime_type": asset["mime_type"],
                "origin": "page-media",
                "size_bytes": len(asset["data"]),
                "source_url": candidate,
            }
        )

    summary_parts = [
        f"Source URL: {canonical}",
        f"Page title: {title or 'N/A'}",
        f"Page description: {description or 'N/A'}",
    ]
    if normalized_candidates:
        summary_parts.append(f"Detected media references: {', '.join(normalized_candidates[:3])}")
    return " | ".join(summary_parts), attachments, analyzed_inputs


def _sanitize_payload(payload: dict[str, Any]) -> dict[str, Any]:
    summary = str(payload.get("summary") or "").strip() or "Reference analyzed and converted into a TikTok-style generation brief."
    hook = str(payload.get("hook") or "").strip() or "Open with the strongest visual action from the reference in the first second."
    subject = str(payload.get("subject") or "").strip() or "Main performer or focal subject from the reference."
    motion = str(payload.get("motion") or "").strip() or "Keep the same movement logic, pacing, and repeatable viral mechanic."
    camera = str(payload.get("camera") or "").strip() or "Vertical 9:16 framing, close-to-medium composition, energetic handheld feel."
    visual_style = str(payload.get("visual_style") or "").strip() or "Cinematic TikTok realism with glossy motion transitions."
    aspect_ratio = str(payload.get("aspect_ratio") or "").strip() or "9:16"
    prompt_text = str(payload.get("prompt_text") or "").strip()

    scene_beats = _normalize_list(payload.get("scene_beats"))
    clone_notes = _normalize_list(payload.get("clone_notes"))
    safety_notes = _normalize_list(payload.get("safety_notes"))
    hashtags = _normalize_hashtags(payload.get("hashtags"))

    if not clone_notes:
        clone_notes = [
            "Clone the choreography, pacing, framing, and transition logic instead of copying a real person's exact identity.",
            "Keep the same viral mechanic but adapt wardrobe, environment details, and facial identity into a fresh character result.",
        ]
    if not safety_notes:
        safety_notes = [
            "Do not instruct exact real-person impersonation unless you own or have rights to the likeness.",
            "Preserve movement language and scene structure, not biometric identity.",
        ]
    if not scene_beats:
        scene_beats = [
            "Beat 1: strongest hook pose or action.",
            "Beat 2: visible body movement synced to the main rhythm.",
            "Beat 3: closer shot or dynamic camera move for payoff.",
            "Beat 4: end on a replayable CTA frame.",
        ]
    if not hashtags:
        hashtags = ["#tiktok", "#videoprompt", "#viralremix"]
    if not prompt_text:
        prompt_text = (
            f"Create a vertical {aspect_ratio} TikTok-style AI video. Subject: {subject}. "
            f"Movement: {motion}. Camera: {camera}. Visual style: {visual_style}. "
            f"Hook: {hook}. Scene beats: {' | '.join(scene_beats)}. "
            f"Clone notes: {' | '.join(clone_notes)}."
        )

    return {
        "summary": summary,
        "hook": hook,
        "subject": subject,
        "motion": motion,
        "camera": camera,
        "visual_style": visual_style,
        "aspect_ratio": aspect_ratio,
        "hashtags": hashtags,
        "scene_beats": scene_beats,
        "clone_notes": clone_notes,
        "safety_notes": safety_notes,
        "prompt_text": prompt_text,
    }


def generate_media_prompt(
    uploaded_files: list[dict[str, Any]],
    source_url: str | None,
    platform_target: str,
    desired_output: str,
    notes: str | None,
    user_niche: str | None,
    generator_config: PromptGeneratorConfigIn | None = None,
) -> dict[str, Any]:
    api_key, model = _resolve_generator_config(generator_config)
    if not api_key:
        raise RuntimeError("gemini_api_key_missing")

    prepared_files: list[dict[str, Any]] = []
    analyzed_inputs: list[dict[str, Any]] = []
    for item in uploaded_files:
        filename = str(item.get("filename") or "upload").strip() or "upload"
        mime_type = str(item.get("mime_type") or "").strip() or _guess_mime_type(filename)
        data = item.get("data") or b""
        if not isinstance(data, bytes) or not data:
            continue
        if len(data) > MAX_LOCAL_FILE_BYTES:
            raise RuntimeError(f"uploaded_file_too_large:{filename}")
        prepared_files.append({"filename": filename, "mime_type": mime_type, "data": data})
        analyzed_inputs.append(
            {
                "source_type": "upload",
                "name": filename,
                "mime_type": mime_type,
                "origin": "local-upload",
                "size_bytes": len(data),
                "source_url": None,
            }
        )

    remote_summary, remote_attachments, remote_inputs = _resolve_remote_context(source_url or "")
    prepared_files.extend(remote_attachments)
    analyzed_inputs.extend(remote_inputs)

    if not prepared_files and not remote_summary:
        raise RuntimeError("missing_media_input")

    parts: list[dict[str, Any]] = []
    for prepared in prepared_files:
        uploaded = _upload_bytes_to_gemini(api_key, prepared["filename"], prepared["mime_type"], prepared["data"])
        parts.append({"fileData": {"mimeType": uploaded["mime_type"], "fileUri": uploaded["file_uri"]}})

    notes_text = str(notes or "").strip() or "Favor smooth morph transitions, stylish pacing, and a creator-ready result."
    niche_text = str(user_niche or "").strip() or "creator"
    prompt = (
        "You are a senior TikTok creative strategist and AI video prompt engineer.\n"
        "Analyze the attached reference media and convert it into a production-ready prompt for an AI video model.\n"
        "Return ONLY one JSON object with keys: prompt_text, summary, hook, subject, motion, camera, visual_style, aspect_ratio, hashtags, scene_beats, clone_notes, safety_notes.\n"
        "hashtags, scene_beats, clone_notes, and safety_notes must be arrays of strings.\n"
        f"Target platform: {platform_target}\n"
        f"Desired output: {desired_output}\n"
        f"User niche: {niche_text}\n"
        f"Additional notes: {notes_text}\n"
        f"Remote URL context: {remote_summary or 'No external URL provided.'}\n"
        "Prioritize: choreography, body language, framing, camera distance, angle changes, pacing, transitions, text-overlay logic, styling, lighting, and scene progression.\n"
        "If the source shows a real identifiable person, do not instruct exact identity impersonation or biometric replication. Clone the scene mechanics, rhythm, silhouette, mood, and performance logic instead.\n"
        "The final prompt_text must be concise but detailed enough to paste into an AI video generator immediately.\n"
        "Use a stylish TikTok-native tone, keep the result practical, and default to vertical 9:16 unless the reference clearly demands otherwise."
    )

    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        params={"key": api_key},
        json={
            "contents": [{"parts": [{"text": prompt}, *parts]}],
            "generationConfig": {"temperature": 0.2, "topP": 0.8, "candidateCount": 1},
        },
        timeout=180,
    )
    response.raise_for_status()
    data = response.json()
    candidates = data.get("candidates") or []
    if not candidates:
        raise RuntimeError("gemini_empty_candidates")

    text_parts = (((candidates[0] or {}).get("content") or {}).get("parts") or [])
    combined_text = "\n".join(str(part.get("text") or "") for part in text_parts if isinstance(part, dict)).strip()
    payload = _sanitize_payload(_extract_json_object(combined_text))

    return {
        "prompt_text": payload["prompt_text"],
        "generated_with": f"gemini:{model}",
        "payload": {
            "summary": payload["summary"],
            "hook": payload["hook"],
            "subject": payload["subject"],
            "motion": payload["motion"],
            "camera": payload["camera"],
            "visual_style": payload["visual_style"],
            "aspect_ratio": payload["aspect_ratio"],
            "hashtags": payload["hashtags"],
            "scene_beats": payload["scene_beats"],
            "clone_notes": payload["clone_notes"],
            "safety_notes": payload["safety_notes"],
        },
        "analyzed_inputs": analyzed_inputs,
    }
