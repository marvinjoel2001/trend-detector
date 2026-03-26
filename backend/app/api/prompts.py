from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.session import get_db
from app.models.prompt import Prompt
from app.models.prompt_feedback import PromptFeedback
from app.models.trend import Trend
from app.models.user import User
from app.schemas.prompt import (
    PromptFeedbackIn,
    PromptFeedbackOut,
    PromptGenerateIn,
    PromptGenerateOut,
    PromptHistoryOut,
)
from app.services.cache import cache_get_json, cache_set_json
from app.services.prompt_generator import build_prompt

router = APIRouter(prefix="/prompt")
settings = get_settings()


async def _get_or_create_default_user(db: AsyncSession) -> User:
    user = (await db.execute(select(User).where(User.email == settings.default_user_email))).scalar_one_or_none()
    if user:
        return user
    user = User(email=settings.default_user_email, name=settings.default_user_name, niche="technology")
    db.add(user)
    await db.flush()
    return user


@router.post("/generate", response_model=PromptGenerateOut)
async def generate_prompt(payload: PromptGenerateIn, db: AsyncSession = Depends(get_db)) -> Prompt:
    cache_key = f"prompt:gen:{payload.trend_id}:{payload.platform_target}:{payload.output_type}:{payload.user_niche or 'none'}"
    cached = await cache_get_json(cache_key)
    if cached:
        return cached

    trend = await db.get(Trend, payload.trend_id)
    if not trend:
        raise HTTPException(status_code=404, detail="Trend not found")

    user = None
    if payload.user_id:
        user = await db.get(User, payload.user_id)
    if user is None:
        user = await _get_or_create_default_user(db)

    generated = build_prompt(trend, payload.platform_target, payload.output_type, payload.user_niche or user.niche)
    prompt_text = (
        f"{generated.description}. Visual Style: {generated.visual_style}. Tone: {generated.tone}. "
        f"Format: {generated.format}. Hashtags: {' '.join(generated.hashtags)}."
    )

    prompt = Prompt(
        trend_id=payload.trend_id,
        user_id=user.id,
        platform_target=payload.platform_target,
        output_type=payload.output_type,
        user_niche=payload.user_niche,
        prompt_text=prompt_text,
        payload_json=generated.__dict__,
    )
    db.add(prompt)
    await db.commit()
    await db.refresh(prompt)

    response_payload = PromptGenerateOut.model_validate(prompt).model_dump(mode="json")
    await cache_set_json(cache_key, response_payload, ttl=900)
    return response_payload


@router.get("/history", response_model=list[PromptHistoryOut])
async def get_prompt_history(limit: int = Query(default=50, ge=1, le=200), db: AsyncSession = Depends(get_db)) -> list[Prompt]:
    prompts = (
        await db.execute(
            select(Prompt)
            .order_by(Prompt.created_at.desc())
            .limit(limit)
        )
    ).scalars().all()
    return [PromptHistoryOut.model_validate(p).model_dump(mode="json") for p in prompts]


@router.post("/feedback", response_model=PromptFeedbackOut)
async def submit_feedback(payload: PromptFeedbackIn, db: AsyncSession = Depends(get_db)) -> PromptFeedback:
    prompt = await db.get(Prompt, payload.prompt_id)
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")

    feedback = PromptFeedback(prompt_id=payload.prompt_id, rating=payload.rating, notes=payload.notes)
    db.add(feedback)
    await db.commit()
    await db.refresh(feedback)
    return feedback
