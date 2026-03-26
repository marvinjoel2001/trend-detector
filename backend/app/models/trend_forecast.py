from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, Float, ForeignKey, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class TrendForecast(Base):
    __tablename__ = "trend_forecasts"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    trend_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("trends.id", ondelete="CASCADE"), index=True)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    horizon_hours: Mapped[int] = mapped_column(default=6, nullable=False)
    points_json: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    confidence: Mapped[float] = mapped_column(Float, default=0.5, nullable=False)

    trend = relationship("Trend", back_populates="forecasts")

