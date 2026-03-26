from dataclasses import dataclass

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


def build_prompt(trend: Trend, platform_target: str, output_type: str, user_niche: str | None = None) -> PromptPayload:
    style, tone = STYLE_BY_CATEGORY.get(trend.category, STYLE_BY_CATEGORY["lifestyle"])
    fmt, duration = FORMAT_BY_OUTPUT.get(output_type.lower(), FORMAT_BY_OUTPUT["video"])
    hashtags = [
        f"#{trend.category}",
        f"#{trend.platform}",
        "#trendprompt",
        f"#{(user_niche or 'creator').replace(' ', '').lower()}",
    ]

    description = (
        f"{trend.title}. Create {output_type.lower()} content optimized for {platform_target} "
        f"with a {style}. Include clear viral hook in first 2 seconds and CTA at the end."
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

