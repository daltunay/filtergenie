from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class ApiConfig(BaseModel):
    """API configuration settings."""

    key: str | None = Field(
        default=None,
        description="API key for authentication",
    )


class RemoteModelConfig(BaseModel):
    """Remote model configuration settings."""

    base_url: str = Field(
        default="https://generativelanguage.googleapis.com/v1beta/openai/",
        description="Base URL for model API",
    )
    api_key: str = Field(
        default="",
        description="API key for model API",
    )
    name: str = Field(
        default="gemini-2.0-flash-lite",
        description="Model name to use",
    )


class LocalModelConfig(BaseModel):
    """Local model configuration settings."""

    name: str = Field(
        default="HuggingFaceTB/SmolVLM-Instruct",
        description="Local model name or path",
    )
    dtype: str = Field(
        default="bfloat16",
        description="Data type for local model",
    )
    device: str = Field(
        default="auto",
        description="Device for local model",
    )


class ModelConfig(BaseModel):
    """Unified model configuration settings."""

    use_local: bool = Field(
        default=False,
        description="Flag to use local model",
    )
    remote: RemoteModelConfig | None = Field(default_factory=RemoteModelConfig)
    local: LocalModelConfig | None = Field(default_factory=LocalModelConfig)


class CacheConfig(BaseModel):
    """Cache configuration settings."""

    db_path: str = Field(
        default="data/cache.db",
        description="Path to SQLite database file for cache",
    )


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_ignore_empty=True,
        env_nested_delimiter="_",
        env_nested_max_split=2,
    )

    api: ApiConfig = Field(default_factory=ApiConfig)
    model: ModelConfig = Field(default_factory=ModelConfig)
    cache: CacheConfig = Field(default_factory=CacheConfig)

    def __post_init__(self):
        if self.model.use_local:
            self.model.remote = None
        else:
            self.model.local = None


settings = Settings(_env_file=".env", _env_file_encoding="utf-8")
