from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class PromptGeneratorConfigIn(BaseModel):
    provider: Literal["system", "gemini"] = "system"
    api_key: str | None = None
    model: str | None = None


class PromptGenerateIn(BaseModel):
    trend_id: str
    platform_target: str
    output_type: str
    user_niche: str | None = None
    user_id: str | None = None
    generator_config: PromptGeneratorConfigIn | None = None


class PromptEnginePayload(BaseModel):
    description: str
    visual_style: str
    tone: str
    format: str
    hashtags: list[str]
    recommended_duration: str
    publish_time: str


class PromptGenerateOut(BaseModel):
    prompt_id: str = Field(validation_alias="id")
    prompt_text: str
    platform_target: str
    output_type: str
    payload: PromptEnginePayload = Field(validation_alias="payload_json")
    created_at: datetime

    class Config:
        from_attributes = True
        populate_by_name = True


class PromptHistoryOut(BaseModel):
    id: str
    trend_id: str
    prompt_text: str
    platform_target: str
    output_type: str
    user_niche: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict, validation_alias="payload_json")
    created_at: datetime

    class Config:
        from_attributes = True
        populate_by_name = True


class PromptFeedbackIn(BaseModel):
    prompt_id: str
    rating: int = Field(ge=1, le=5)
    notes: str | None = None


class PromptFeedbackOut(BaseModel):
    id: str
    prompt_id: str
    rating: int
    notes: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class PromptEngineConfigOut(BaseModel):
    provider: Literal["gemini"] = "gemini"
    default_model: str
    api_key_configured: bool


class MediaPromptInputOut(BaseModel):
    source_type: str
    name: str
    mime_type: str | None = None
    origin: str
    size_bytes: int | None = None
    source_url: str | None = None


class MediaPromptPayloadOut(BaseModel):
    summary: str
    hook: str
    subject: str
    motion: str
    camera: str
    visual_style: str
    aspect_ratio: str
    hashtags: list[str] = Field(default_factory=list)
    scene_beats: list[str] = Field(default_factory=list)
    clone_notes: list[str] = Field(default_factory=list)
    safety_notes: list[str] = Field(default_factory=list)


class MediaPromptGenerateOut(BaseModel):
    prompt_text: str
    generated_with: str
    payload: MediaPromptPayloadOut
    analyzed_inputs: list[MediaPromptInputOut] = Field(default_factory=list)
