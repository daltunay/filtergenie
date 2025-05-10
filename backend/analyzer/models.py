from pydantic import BaseModel, ConfigDict, Field, computed_field

from backend.common.utils import sanitize_text, url_to_base64


class ImageModel(BaseModel):
    """Model for item images with computed properties."""

    url: str = Field(...)

    @property
    def base64(self) -> str:
        return url_to_base64(self.url)


class ItemModel(BaseModel):
    """Flexible item model that can handle varying attributes from different platforms."""

    model_config = ConfigDict(extra="allow")

    platform: str = Field(...)
    title: str = Field(...)
    images: list[ImageModel] = Field(default_factory=list)

    @classmethod
    def from_source(cls, platform: str, html: str) -> "ItemModel":
        from backend.scraper import PARSER_BY_PLATFORM

        try:
            parse_item = PARSER_BY_PLATFORM[platform]
        except KeyError:
            raise ValueError(f"No parser found for platform: {platform}")
        data = parse_item(html)
        return cls(platform=platform, **data)


class FilterModel(BaseModel):
    desc: str = Field(...)
    value: bool | None = Field(default=None, init=False)

    @computed_field
    @property
    def name(self) -> str:
        return sanitize_text(self.desc)
