from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    redis_url: str = "redis://redis:6379/0"
    token_secret: str = Field(min_length=32)
    public_base_url: str = "http://localhost:3000"
    event_retention_hours: int = Field(default=168, ge=1, le=720)
    max_body_bytes: int = Field(default=262_144, ge=1024, le=1_048_576)
    rate_limit_per_minute: int = Field(default=120, ge=10, le=10_000)

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]

