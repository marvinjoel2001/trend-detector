from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Prompt(Base):
    __tablename__ = "prompts"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    trend_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("trends.id", ondelete="CASCADE"), index=True)
    platform_target: Mapped[str] = mapped_column(String(40), nullable=False)
    output_type: Mapped[str] = mapped_column(String(20), nullable=False)
    user_niche: Mapped[str | None] = mapped_column(String(80), nullable=True)
    prompt_text: Mapped[str] = mapped_column(Text, nullable=False)
    payload_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    trend = relationship("Trend", back_populates="prompts")
    user = relationship("User", back_populates="prompts")
    feedback_entries = relationship("PromptFeedback", back_populates="prompt", cascade="all,delete")

