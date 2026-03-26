from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


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
