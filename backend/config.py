import os
import typing as tp

from pydantic import Field
from pydantic_settings import BaseSettings


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
    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    openai_base_url: str | None = Field(default=None, alias="OPENAI_BASE_URL")
    model_name: str = Field(default="gemini-2.0-flash-lite")

    # Local model settings
    local_model_name: str = Field(default="HuggingFaceTB/SmolVLM-Instruct")
    local_model_dtype: tp.Literal["float16", "float32", "bfloat16"] = Field(
        default="bfloat16"
    )
    local_model_device: str = Field(default="auto")


# Create settings instance
settings = Settings()
