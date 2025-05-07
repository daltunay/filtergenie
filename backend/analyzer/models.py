from pydantic import BaseModel, ConfigDict, Field, computed_field

from backend.common.utils import sanitize_text, url_to_base64


class Image(BaseModel):
    """Model for item images with computed properties."""

    url: str = Field(...)

    @property
    @computed_field
    def base64(self) -> str:
        return url_to_base64(self.url)


class Item(BaseModel):
    """Flexible item model that can handle varying attributes from different platforms."""

    model_config = ConfigDict(extra="allow")

    platform: str = Field(...)
    title: str = Field(...)
    images: list[Image] = Field(default_factory=list)


class Filter(BaseModel):
    description: str = Field(...)
    value: bool | None = Field(default=None, init=False)

    @property
    @computed_field
    def title(self) -> str:
        return sanitize_text(self.description)
