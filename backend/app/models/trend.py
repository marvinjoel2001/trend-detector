from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, Float, Index, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Trend(Base):
    __tablename__ = "trends"
    __table_args__ = (
        Index("ix_trends_platform_velocity", "platform", "velocity_score"),
        Index("ix_trends_category_velocity", "category", "velocity_score"),
    )

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    external_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    platform: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    velocity_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    rank_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    snapshots = relationship("TrendSnapshot", back_populates="trend", cascade="all,delete")
    forecasts = relationship("TrendForecast", back_populates="trend", cascade="all,delete")
    prompts = relationship("Prompt", back_populates="trend", cascade="all,delete")

