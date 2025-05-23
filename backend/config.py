import os

from pydantic import BaseModel, Field, computed_field, field_serializer, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from backend.common.logging import log


class ApiConfig(BaseModel):
    """API configuration settings."""

    key: str | None = Field(
        default=None,
        description="API key for authentication",
    )
    profile: bool = Field(
        default=os.getenv("DEV", "false").lower() == "true",
        description="Enable request profiling middleware",
    )

    @computed_field
    @property
    def is_secure(self) -> bool:
        """Check if the API key is set."""
        return self.key is not None

    @field_serializer("key")
    def serialize_key(self, value: str | None) -> str | None:
        if value is None:
            return None
        return "*" * len(value)


class GroqConfig(BaseModel):
    api_key: str = Field(default="")
    model_name: str = Field(default="meta-llama/llama-4-scout-17b-16e-instruct")

    @field_serializer("api_key")
    def serialize_key(self, value: str) -> str:
        return "*" * len(value)


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_ignore_empty=True,
        env_nested_delimiter="_",
        env_nested_max_split=1,
        env_file=".env",
        env_file_encoding="utf-8",
    )

    api: ApiConfig = Field(default_factory=ApiConfig)
    groq: GroqConfig = Field(default_factory=GroqConfig)
    cache_enabled: bool = Field(default=False)

    @field_validator("cache_enabled", mode="after")
    @classmethod
    def check_redis_available(cls, v):
        if not v:
            return False
        try:
            import redis

            r = redis.Redis(host="localhost", port=6379, socket_connect_timeout=1)
            r.ping()
            return True
        except Exception:
            return False


settings = Settings()
log.info("Settings loaded", **settings.model_dump(exclude_none=True))
