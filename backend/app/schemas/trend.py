from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.prompt import PromptGeneratorConfigIn


class TrendOut(BaseModel):
    id: str
    title: str
    platform: str
    category: str
    velocity_score: float
    rank_score: float
    timestamp: datetime
    metadata: dict[str, Any] = Field(default_factory=dict, validation_alias="metadata_json")

    class Config:
        from_attributes = True
        populate_by_name = True


class TrendDetailOut(TrendOut):
    description: str | None = None


class SnapshotOut(BaseModel):
    snapshot_ts: datetime
    metric_views: int
    velocity_score: float

    class Config:
        from_attributes = True


class ForecastPoint(BaseModel):
    ts: datetime
    momentum: float


class ForecastOut(BaseModel):
    trend_id: str
    generated_at: datetime
    horizon_hours: int
    confidence: float
    points: list[ForecastPoint]


class ForecastExplainIn(BaseModel):
    trend_id: str
    language: str | None = None
    generator_config: PromptGeneratorConfigIn | None = None


class ForecastExplanationOut(BaseModel):
    title: str
    summary: str
    outlook: str
    could_go_viral: bool
    virality_window_hours: float | None = None
    virality_window_days: float | None = None
    based_on: list[str] = Field(default_factory=list)
    methodology: str
    generated_with: str
