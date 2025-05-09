from pydantic import BaseModel, ConfigDict, Field, computed_field

from backend.common.utils import sanitize_text, url_to_base64


class ImageModel(BaseModel):
    """Model for item images with computed properties."""

    url: str = Field(...)

    @computed_field
    @property
    def base64(self) -> str:
        return url_to_base64(self.url)


class ItemModel(BaseModel):
    """Flexible item model that can handle varying attributes from different platforms."""

    model_config = ConfigDict(extra="allow")

    platform: str = Field(...)
    title: str = Field(...)
    images: list[ImageModel] = Field(default_factory=list)


class FilterModel(BaseModel):
    desc: str = Field(...)
    value: bool | None = Field(default=None, init=False)

    @computed_field
    @property
    def name(self) -> str:
        return sanitize_text(self.desc)
