import typing as tp

from loguru import logger
from pydantic import BaseModel, Field, computed_field, field_serializer, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


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


class RemoteModelConfig(BaseModel):
    """Remote model configuration settings."""

    base_url: str = Field(default="https://generativelanguage.googleapis.com/v1beta/openai/")
    api_key: str = Field(...)
    name: str = Field(default="gemini-2.0-flash-lite")

    @field_serializer("api_key")
    def serialize_key(self, value: str) -> str:
        return "*" * len(value)


class LocalModelConfig(BaseModel):
    """Local model configuration settings."""

    name: str = Field(default="HuggingFaceTB/SmolVLM-Instruct")
    dtype: str = Field(default="bfloat16")
    device: str = Field(default="auto")


class ModelConfig(BaseModel):
    """Unified model configuration settings."""

    use_local: bool = Field(default=False)
    remote: RemoteModelConfig | None = Field(default=None)
    local: LocalModelConfig | None = Field(default=None)

    @model_validator(mode="after")
    def update_model_config(self) -> tp.Self:
        if self.use_local:
            self.local = self.local or LocalModelConfig()
        else:
            self.remote = self.remote or RemoteModelConfig()
        return self


class CacheConfig(BaseModel):
    """Cache configuration settings."""

    db_path: str = Field(default="data/cache.db")


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_ignore_empty=True,
        env_nested_delimiter="_",
        env_nested_max_split=2,
        env_file=".env",
        env_file_encoding="utf-8",
    )

    api: ApiConfig = Field(default_factory=ApiConfig)
    model: ModelConfig = Field(default_factory=ModelConfig)
    cache: CacheConfig = Field(default_factory=CacheConfig)


settings = Settings()
# Log more concise and informative settings summary
logger.info(
    f"Settings loaded: API security {'enabled' if settings.api.is_secure else 'disabled'}, "
    f"Model: {'local (' + settings.model.local.name + ')' if settings.model.use_local else 'remote (' + settings.model.remote.name + ')'}, "
    f"Cache DB: {settings.cache.db_path}"
)
