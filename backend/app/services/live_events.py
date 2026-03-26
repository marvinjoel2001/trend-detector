import asyncio
import json
import logging
from collections.abc import Awaitable, Callable
from typing import Any

from app.services.cache import redis_client

logger = logging.getLogger(__name__)
LIVE_TRENDS_CHANNEL = "live_trends_events"


async def publish_live_event(payload: dict[str, Any]) -> None:
    try:
        await redis_client().publish(LIVE_TRENDS_CHANNEL, json.dumps(payload, default=str))
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed publishing live event error=%s", exc)


async def listen_live_events(on_event: Callable[[dict[str, Any]], Awaitable[None]]) -> None:
    pubsub = redis_client().pubsub()
    await pubsub.subscribe(LIVE_TRENDS_CHANNEL)
    logger.info("Subscribed to Redis channel=%s", LIVE_TRENDS_CHANNEL)
    try:
        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if message and message.get("data"):
                raw = message["data"]
                payload = json.loads(raw) if isinstance(raw, str) else raw
                if isinstance(payload, dict):
                    await on_event(payload)
            await asyncio.sleep(0.2)
    finally:
        await pubsub.unsubscribe(LIVE_TRENDS_CHANNEL)
        await pubsub.close()

