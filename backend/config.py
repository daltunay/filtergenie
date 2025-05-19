from pydantic import BaseModel, Field, computed_field, field_serializer
from pydantic_settings import BaseSettings, SettingsConfigDict

from .common.logging import log


class ApiConfig(BaseModel):
    """API configuration settings."""

    key: str | None = Field(
        default=None,
        description="API key for authentication",
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
    groq: GroqConfig = Field(default_factory=GroqConfig, validation_alias="GROQ")


settings = Settings()
log.info("Settings loaded (groq)", **settings.groq.model_dump(exclude_none=True))
