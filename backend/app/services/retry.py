import asyncio
import logging
from collections.abc import Awaitable, Callable
from typing import TypeVar

T = TypeVar("T")
logger = logging.getLogger(__name__)


async def with_retry(
    fn: Callable[[], Awaitable[T]],
    retries: int = 3,
    base_delay_seconds: float = 2.0,
    context: str = "operation",
    source: str | None = None,
) -> T:
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            return await fn()
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            logger.warning(
                "external_request_retry",
                extra={
                    "source": source or "unknown",
                    "context": context,
                    "attempt": attempt,
                    "max_attempts": retries,
                    "status": "failed",
                    "error": str(exc),
                },
            )
            if attempt < retries:
                delay_seconds = base_delay_seconds**attempt
                await asyncio.sleep(delay_seconds)
    raise RuntimeError(f"{context} failed after retries: {last_error}") from last_error

