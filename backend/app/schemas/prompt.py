from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class PromptGenerateIn(BaseModel):
    trend_id: str
    platform_target: str
    output_type: str
    user_niche: str | None = None
    user_id: str | None = None


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
