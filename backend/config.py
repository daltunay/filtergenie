import os

from dotenv import load_dotenv
from pydantic import Field
from pydantic_settings import BaseSettings

load_dotenv()


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # API configuration
    api_key: str | None = Field(default=None, alias="API_KEY")

    # AI model configuration
    use_local_model: bool = Field(
        default=os.getenv("USE_LOCAL", "false") == "true",
        description="Use local VLM model instead of API",
        alias="USE_LOCAL",
    )
    gemini_api_key: str = Field(
        default=os.getenv("GEMINI_API_KEY", ""),
        description="API key for Gemini API",
        alias="GEMINI_API_KEY",
    )
    gemini_base_url: str = Field(
        default=os.environ.get(
            "GEMINI_BASE_URL",
            "https://generativelanguage.googleapis.com/v1beta/openai/",
        ),
        description="Base URL for Gemini API",
        alias="GEMINI_BASE_URL",
    )
    gemini_model_name: str = Field(
        default=os.environ.get("GEMINI_MODEL_NAME", "gemini-2.0-flash-lite"),
        description="Gemini model name",
        alias="GEMINI_MODEL_NAME",
    )

    # Local model settings
    local_model_name: str = Field(
        default=os.environ.get("LOCAL_MODEL_NAME", "HuggingFaceTB/SmolVLM-Instruct"),
        description="Local model name or path",
        alias="LOCAL_MODEL_NAME",
    )
    local_model_dtype: str = Field(
        default=os.environ.get("LOCAL_MODEL_DTYPE", "bfloat16"),
        description="Data type for local model",
        alias="LOCAL_MODEL_DTYPE",
    )
    local_model_device: str = Field(default="auto")

    # Cache database settings
    cache_db_path: str = Field(
        default=os.environ.get("CACHE_DB_PATH", "data/cache.db"),
        description="Path to SQLite database file for cache",
        alias="CACHE_DB_PATH",
    )


# Create settings instance
settings = Settings()
