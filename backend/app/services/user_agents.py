from itertools import cycle
from typing import Any

from app.core.config import get_settings

_USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
]
_user_agent_cycle = cycle(_USER_AGENTS)


def get_next_user_agent() -> str:
    return next(_user_agent_cycle)


def get_proxy_config() -> dict[str, Any] | None:
    settings = get_settings()
    proxy = settings.https_proxy or settings.http_proxy
    if not proxy:
        return None
    return {"http": settings.http_proxy or proxy, "https": settings.https_proxy or proxy}
