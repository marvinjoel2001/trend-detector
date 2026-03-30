from typing import Any

from fastapi import APIRouter, Query

from app.services.prompt_feed import get_prompt_feed, get_prompt_feed_config

router = APIRouter(prefix="/prompt-feed")


@router.get("")
async def list_prompt_feed(
    query: str = Query(default=""),
    source: str = Query(default="all"),
    limit: int = Query(default=24, ge=1, le=48),
    offset: int = Query(default=0, ge=0),
    github_owner: str | None = Query(default=None),
    github_repo: str | None = Query(default=None),
    github_branch: str | None = Query(default=None),
    github_path: str | None = Query(default=None),
) -> dict[str, Any]:
    return await get_prompt_feed(
        query=query,
        source=source,
        limit=limit,
        offset=offset,
        github_owner=github_owner,
        github_repo=github_repo,
        github_branch=github_branch,
        github_path=github_path,
    )


@router.get("/config")
async def prompt_feed_config() -> dict[str, Any]:
    return get_prompt_feed_config()
