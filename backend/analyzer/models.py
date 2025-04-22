import typing as tp

from PIL.Image import Image
from pydantic import BaseModel, Field
from pydantic.networks import HttpUrl
from pydantic.types import Base64Str, FilePath

from backend.common.utils import img_to_base64, load_img, resize_img, sanitize_text


class ProductImage(BaseModel):
    url_or_path: HttpUrl | FilePath = Field(default=None)

    @property
    def image(self) -> Image:
        """Load and resize the image."""
        img = load_img(self.url_or_path.__str__())
        return resize_img(img)

    @property
    def base64(self) -> Base64Str:
        """Convert the image to base64 encoding."""
        return img_to_base64(self.image)


class ProductFilter(BaseModel):
    description: str = Field(default="")
    value: bool | None = Field(default=None, init=False)
    name: str = Field(default="", init=False)

    def model_post_init(self, __context):
        self.name = sanitize_text(self.description)


class Product(BaseModel):
    """Class to hold product data scraped from websites."""

    id: int | None = Field(default=None, init=False)
    vendor: tp.Literal["ebay", "leboncoin", "vinted"] | None = Field(
        default=None, init=False
    )
    url: HttpUrl | None = Field(default=None)
    title: str = Field(default="")
    description: str = Field(default="")
    images: list[ProductImage] = Field(default_factory=list)
    filters: list[ProductFilter] = Field(default_factory=list)

    def model_post_init(self, __context):
        if self.url is not None:
            from backend.scrape import get_product_id_from_url, get_vendor_for_url

            self.url = HttpUrl(self.url.__str__().split("?")[0])
            self.vendor = get_vendor_for_url(self.url.__str__())
            self.id = get_product_id_from_url(self.url.__str__())

    def matches_min_filters(self, min_count: int) -> bool:
        """Check if the product matches at least min_count filters."""
        if not self.filters:
            return True

        matching_count = sum(1 for filter_ in self.filters if filter_.value)
        return matching_count >= min_count

    @property
    def matches_all_filters(self) -> bool:
        """Check if the product matches all filters."""
        return self.matches_min_filters(len(self.filters)) if self.filters else True

    @property
    def cache_key(self) -> tuple[str, int]:
        """Return a tuple that uniquely identifies this product for caching."""
        if self.vendor and self.id is not None:
            return (self.vendor, self.id)
        return None

    @property
    def filter_descriptions(self) -> list[str]:
        """Get a list of filter descriptions for this product."""
        return [f.description for f in self.filters] if self.filters else []
