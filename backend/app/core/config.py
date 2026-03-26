from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


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
            return self.database_url
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def celery_broker_url(self) -> str:
        return self.redis_url

    @property
    def celery_backend_url(self) -> str:
        return self.redis_url


@lru_cache
def get_settings() -> Settings:
    return Settings()

