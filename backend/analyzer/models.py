import typing as tp

from PIL.Image import Image
from pydantic import BaseModel, Field, computed_field, field_serializer
from pydantic.networks import HttpUrl
from pydantic.types import Base64UrlStr, FilePath

from backend.common.utils import img_to_base64, load_img, resize_img, sanitize_text


class ProductImage(BaseModel):
    url_or_path: HttpUrl | FilePath = Field(default=None)

    @property
    def image(self) -> Image:
        img = load_img(self.url_or_path.__str__())
        return resize_img(img)

    @property
    def base64(self) -> Base64UrlStr:
        return img_to_base64(self.image)

    @field_serializer("url_or_path")
    def serialize_url(self, value: HttpUrl | FilePath) -> str:
        return str(value)


class ProductFilter(BaseModel):
    description: str = Field(default="")
    value: bool | None = Field(default=None, init=False)

    @computed_field
    @property
    def name(self) -> str:
        return sanitize_text(self.description)

    def __eq__(self, other: tp.Any) -> bool:
        if not isinstance(other, ProductFilter):
            return False
        return self.description == other.description


class Product(BaseModel):
    """Class to hold product data scraped from websites."""

    id: int | None = Field(default=None)
    platform: tp.Literal["ebay", "leboncoin", "vinted"] | None = Field(default=None)

    url: HttpUrl | None = Field(default=None)
    title: str = Field(default="")
    description: str = Field(default="")
    images: list[ProductImage] = Field(default_factory=list)
    filters: list[ProductFilter] = Field(default_factory=list)

    @field_serializer("url")
    def serialize_url(self, value: HttpUrl | None) -> str:
        return str(value)
