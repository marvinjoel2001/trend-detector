from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class TrendSnapshot(Base):
    __tablename__ = "trend_snapshots"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    trend_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("trends.id", ondelete="CASCADE"), index=True)
    platform: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    metric_views: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    metric_likes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    velocity_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    snapshot_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    metadata_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    trend = relationship("Trend", back_populates="snapshots")

