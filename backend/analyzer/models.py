from PIL.Image import Image
from pydantic import BaseModel, ConfigDict, Field, computed_field

from backend.common.logging import log
from backend.common.utils import pil_to_base64, sanitize_text, url_to_pil


class ImageModel(BaseModel):
    """Model for item images with computed properties."""

    url: str = Field(...)

    @property
    def pil(self) -> Image:
        return url_to_pil(self.url)

    @property
    def base64(self) -> str:
        return pil_to_base64(self.pil)


class ItemModel(BaseModel):
    """Flexible item model that can handle varying attributes from different platforms."""

    model_config = ConfigDict(extra="allow")

    platform: str = Field(...)
    title: str = Field(...)
    images: list[ImageModel] = Field(default_factory=list)
    url: str = Field(...)

    @classmethod
    def from_source(cls, platform: str, url: str, html: str) -> "ItemModel":
        from backend.scraper import PARSER_BY_PLATFORM

        try:
            parse_item = PARSER_BY_PLATFORM[platform]
        except KeyError as e:
            log.error(
                "No parser found for platform",
                platform=platform,
                error=str(e),
                exc_info=e,
            )
            raise ValueError(f"No parser found for platform: {platform}") from e
        data = parse_item(html)
        return cls(platform=platform, url=url, **data)


class FilterModel(BaseModel):
    desc: str = Field(...)
    value: bool | None = Field(default=None, init=False)

    @computed_field
    @property
    def name(self) -> str:
        return sanitize_text(self.desc)
