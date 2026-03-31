from functools import lru_cache
from typing import Literal
from urllib.parse import quote

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL, make_url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False)

    app_name: str = "TrendPrompt Engine API"
    app_env: Literal["development", "staging", "production"] = "development"
    api_prefix: str = "/api"
    debug: bool = True
    cors_origins: str = "http://localhost:3000,http://frontend:3000"

    postgres_user: str = "trendprompt"
    postgres_password: str = "trendprompt"
    postgres_db: str = "trendprompt"
    postgres_host: str = "postgres"
    postgres_port: int = 5432
    database_url: str | None = None

    redis_url: str = "redis://redis:6379/0"
    redis_host: str | None = None
    redis_port: int | None = None
    redis_user: str | None = None
    redis_password: str | None = None
    redis_db: int = 0
    use_redis_cache: bool = True
    use_celery: bool = True
    scheduler_interval_minutes: int = 30
    ingestion_jitter_min_seconds: int = 5
    ingestion_jitter_max_seconds: int = 25
    source_retry_attempts: int = 3
    source_retry_base_delay_seconds: int = 2
    source_cache_ttl_seconds: int = 1800
    ingestion_lock_ttl_seconds: int = 900

    source_interval_google_minutes: int = 30
    source_interval_youtube_minutes: int = 30
    source_interval_reddit_minutes: int = 20
    source_interval_tiktok_minutes: int = 60

    youtube_api_key: str | None = None
    apify_api_base_url: str = "https://api.apify.com"
    apify_api_token: str | None = None
    apify_tiktok_actor_id: str = "novi/fast-tiktok-scraper"
    apify_request_timeout_seconds: int = 240
    apify_run_sync_timeout_seconds: int = 180
    apify_tiktok_limit: int = 18
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-1.5-flash"
    prompt_feed_cache_ttl: int = 900
    lexica_api_base_url: str = "https://lexica.art/api/v1"
    prompthero_api_base_url: str = "https://api.prompthero.com"
    prompthero_access_token_url: str = "https://api.prompthero.com/v1/access_token"
    prompthero_random_url: str = "https://api.prompthero.com/v1/random"
    prompthero_thumbnails_url: str = "https://api.prompthero.com/v1/thumbnails"
    prompthero_autocomplete_url: str = "https://api.prompthero.com/v1/autocomplete"
    prompthero_related_url: str = "https://api.prompthero.com/v1/related"
    prompthero_bearer_token: str | None = None
    krea_open_prompts_repo_url: str = "https://github.com/krea-ai/open-prompts"
    krea_open_prompts_csv_url: str = "https://raw.githubusercontent.com/krea-ai/open-prompts/main/data/1k.csv"
    github_api_base_url: str = "https://api.github.com"
    github_raw_base_url: str = "https://raw.githubusercontent.com"
    github_token: str | None = None
    prompt_feed_default_github_owner: str = "krea-ai"
    prompt_feed_default_github_repo: str = "open-prompts"
    prompt_feed_default_github_branch: str = "main"
    prompt_feed_default_github_path: str = "data/1k.csv"
    civitai_api_base_url: str = "https://civitai.com/api/v1"
    civitai_api_key: str | None = None
    reddit_client_id: str | None = None
    reddit_client_secret: str | None = None
    reddit_user_agent: str = "trendprompt-engine/1.0"
    tiktok_search_url: str = "https://www.tiktok.com/discover"
    tiktok_headless: bool = True

    http_proxy: str | None = Field(default=None, alias="HTTP_PROXY")
    https_proxy: str | None = Field(default=None, alias="HTTPS_PROXY")

    cache_ttl_trends: int = 1800
    cache_ttl_forecast: int = 1800
    cache_ttl_prompt: int = 900

    default_user_email: str = "demo@trendprompt.local"
    default_user_name: str = "Demo User"

    spacy_model: str = "en_core_web_sm"

    @property
    def sql_url(self) -> str:
        if self.database_url:
            return self._normalize_database_url(self.database_url)

        return URL.create(
            drivername="postgresql+asyncpg",
            username=self.postgres_user,
            password=self.postgres_password,
            host=self.postgres_host,
            port=self.postgres_port,
            database=self.postgres_db,
        ).render_as_string(hide_password=False)

    def _normalize_database_url(self, raw_url: str) -> str:
        url = raw_url.strip().strip('"').strip("'")
        if url.startswith("postgres://"):
            url = "postgresql+asyncpg://" + url[len("postgres://") :]
        elif url.startswith("postgresql://") and "+asyncpg" not in url:
            url = "postgresql+asyncpg://" + url[len("postgresql://") :]

        parsed = make_url(url)
        if parsed.drivername.startswith("postgresql") and "+asyncpg" not in parsed.drivername:
            parsed = parsed.set(drivername="postgresql+asyncpg")
        return parsed.render_as_string(hide_password=False)

    @property
    def redis_connection_url(self) -> str:
        raw = (self.redis_url or "").strip().strip('"').strip("'")
        if raw and raw != "redis://redis:6379/0":
            return raw

        host = (self.redis_host or "").strip()
        port = self.redis_port or 6379
        db = self.redis_db if self.redis_db is not None else 0
        password = self.redis_password
        user = (self.redis_user or "").strip() or ("default" if password else "")

        if host:
            if password:
                user_part = quote(user, safe="")
                pass_part = quote(password, safe="")
                return f"redis://{user_part}:{pass_part}@{host}:{port}/{db}"
            return f"redis://{host}:{port}/{db}"

        return "redis://redis:6379/0"

    @property
    def celery_broker_url(self) -> str:
        return self.redis_connection_url

    @property
    def celery_backend_url(self) -> str:
        return self.redis_connection_url


@lru_cache
def get_settings() -> Settings:
    return Settings()
