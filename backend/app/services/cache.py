import asyncio
import json
from typing import Any

from redis.asyncio import Redis

from app.core.config import get_settings

settings = get_settings()
_clients: dict[int, Redis] = {}


def redis_client() -> Redis:
    try:
        loop = asyncio.get_running_loop()
        key = id(loop)
    except RuntimeError:
        key = -1

    client = _clients.get(key)
    if client is None:
        client = Redis.from_url(settings.redis_url, decode_responses=True)
        _clients[key] = client
    return client


async def close_redis_clients() -> None:
    for client in list(_clients.values()):
        try:
            await client.aclose()
        except Exception:  # noqa: BLE001
            pass
    _clients.clear()


async def cache_get_json(key: str) -> Any | None:
    if not settings.use_redis_cache:
        return None
    raw = await redis_client().get(key)
    return json.loads(raw) if raw else None


async def cache_set_json(key: str, payload: Any, ttl: int) -> None:
    if not settings.use_redis_cache:
        return
    await redis_client().set(key, json.dumps(payload, default=str), ex=ttl)


async def cache_delete_prefix(prefix: str) -> None:
    if not settings.use_redis_cache:
        return
    client = redis_client()
    cursor = 0
    while True:
        cursor, keys = await client.scan(cursor=cursor, match=f"{prefix}*")
        if keys:
            await client.delete(*keys)
        if cursor == 0:
            break
