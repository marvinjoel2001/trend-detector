from fastapi import APIRouter

from app.api.prompts import router as prompts_router
from app.api.trends import router as trends_router

api_router = APIRouter()
api_router.include_router(trends_router, tags=["trends"])
api_router.include_router(prompts_router, tags=["prompts"])

