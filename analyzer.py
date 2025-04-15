import os
import typing as tp
from textwrap import dedent

import structlog
from PIL.Image import Image
from pydantic import BaseModel, Field, create_model
from pydantic.networks import HttpUrl
from pydantic.types import Base64Str, FilePath

from utils import image_to_base64, load_img, resize_img, sanitize_text

if tp.TYPE_CHECKING:
    from openai import OpenAI

    try:
        from outlines.models import TransformersVision
    except ImportError:
        pass


class ProductImage(BaseModel):
    url_or_path: HttpUrl | FilePath = Field(default=None)
    image: Image = Field(default=None, repr=False, exclude=True, init=False)
    base64: Base64Str = Field(default=None, repr=False, exclude=True, init=False)

    model_config = {"arbitrary_types_allowed": True}

    def model_post_init(self, __context):
        self.image = resize_img(load_img(self.url_or_path.__str__()))
        self.base64 = image_to_base64(self.image)


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
            from scrape import get_product_id_from_url, get_vendor_for_url

            self.url = HttpUrl(self.url.__str__().split("?")[0])
            self.vendor = get_vendor_for_url(self.url.__str__())
            self.id = get_product_id_from_url(self.url.__str__())

    @property
    def matches_filters(self) -> bool:
        """Check if the product matches all filters."""
        return all(filter_.value for filter_ in self.filters)


class DynamicSchema(BaseModel):
    """Placeholder for dynamic schema generation. For type hinting only."""

    ...


class ProductAnalyzer:
    """A class to analyze products against filters with a reusable model."""

    PROMPT_TEMPLATE = dedent(
        """
        Analyze this product with the following details:
        - Title: {title}
        - Description: {description}
        - Images: {images}

        For each of the following filters, determine if it applies to this product.
        """
    )

    def __init__(self, use_local: bool = False):
        """Initialize the analyzer with either a local VLM model or OpenAI."""
        self.log = structlog.get_logger()

        if use_local:
            self.model = self._create_local_model()
            self.predict = self._predict_local
        else:
            self.model = self._create_openai_model()
            self.predict = self._predict_openai

    def _create_local_model(
        self,
        model_name: str = "HuggingFaceTB/SmolVLM-Instruct",
        dtype: str = "bfloat16",
        device: str = "auto",
    ) -> "TransformersVision":
        """Create a local VLM."""
        import torch
        from outlines import models
        from transformers import AutoModelForImageTextToText

        return models.transformers_vision(
            model_name=model_name,
            model_class=AutoModelForImageTextToText,
            model_kwargs={"torch_dtype": getattr(torch, dtype)},
            device=device,
        )

    def _predict_local(
        self, prompt: str, images: list[ProductImage], schema: type[DynamicSchema]
    ) -> DynamicSchema:
        """Run prediction using local model."""
        from outlines import generate

        generator = generate.json(self.model, schema)
        return generator(prompt, [image.image for image in images])

    def _create_openai_model(
        self, model_name: str = "gemini-2.0-flash-lite"
    ) -> "OpenAI":
        """Create an OpenAI model."""
        from dotenv import load_dotenv
        from openai import OpenAI

        load_dotenv()

        self.model_name = model_name
        return OpenAI(
            base_url=os.getenv("GEMINI_BASE_URL"),
            api_key=os.getenv("GEMINI_API_KEY"),
        )

    def _predict_openai(
        self, prompt: str, images: list[ProductImage], schema: type[DynamicSchema]
    ) -> DynamicSchema:
        """Run prediction using OpenAI API."""
        content = [
            {"type": "text", "text": prompt},
            *[
                {"type": "image_url", "image_url": {"url": image.base64}}
                for image in images
            ],
        ]

        response = self.model.beta.chat.completions.parse(
            model=self.model_name,
            messages=[{"role": "user", "content": content}],
            response_format=schema,
        )

        return response.choices[0].message.parsed

    @staticmethod
    def _create_filter_schema(
        filters: list[ProductFilter],
    ) -> type[DynamicSchema]:
        """Create a Pydantic model schema based on filters list."""
        field_definitions = {
            filter_.name: (
                bool,
                Field(title=f"Filter {i}", description=filter_.description),
            )
            for i, filter_ in enumerate(filters, start=1)
        }
        return create_model("DynamicSchema", **field_definitions)

    def analyze_product(self, product: Product) -> Product:
        """Analyze a single product and update its filters with results."""

        prompt = self.PROMPT_TEMPLATE.format(
            title=product.title,
            description=product.description,
            images="<image>" * len(product.images),
        )

        DynamicSchema = self._create_filter_schema(product.filters)
        response = self.predict(prompt, product.images, DynamicSchema)

        for filter_ in product.filters:
            filter_.value = getattr(response, filter_.name)

        return product


if __name__ == "__main__":
    product = Product(
        title="Guitar",
        description="A beautiful guitar.",
        images=[
            ProductImage(url_or_path="guitar_1.jpg"),
            ProductImage(url_or_path="guitar_2.jpg"),
        ],
        filters=[
            ProductFilter(description="Is it a guitar?"),
            ProductFilter(description="Is it a bass guitar?"),
        ],
    )
    analyzer = ProductAnalyzer(use_local=False)
    analyzed_product = analyzer.analyze_product(product)
    print(analyzed_product)
