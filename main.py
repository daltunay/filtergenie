import os
from dataclasses import dataclass, field
from textwrap import dedent
from typing import TYPE_CHECKING

from PIL import Image
from pydantic import BaseModel, Field, create_model

from utils import image_to_base64, load_img, resize_img, sanitize_text

if TYPE_CHECKING:
    from openai import OpenAI

    try:
        from outlines.models import TransformersVision
    except ImportError:
        pass


@dataclass
class ProductInput:
    title: str
    description: str
    image_urls_or_paths: list[str]
    filters: list[str]
    images: list[Image.Image] = field(init=False)

    def __post_init__(self):
        self.images = []
        for img_path in self.image_urls_or_paths:
            image = load_img(img_path)
            self.images.append(resize_img(image))


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
        self.use_local = use_local

        if self.use_local:
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
        """Create a local VLM model."""
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
        self, prompt: str, images: list[Image.Image], schema: type[DynamicSchema]
    ) -> DynamicSchema:
        """Run prediction using local model."""
        from outlines import generate

        generator = generate.json(self.model, schema)
        return generator(prompt, images)

    def _create_openai_model(self, model_name: str = "gemini-2.0-flash") -> "OpenAI":
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
        self, prompt: str, images: list[Image.Image], schema: type[DynamicSchema]
    ) -> DynamicSchema:
        """Run prediction using OpenAI API."""
        content = [
            {"type": "text", "text": prompt},
            *[
                {"type": "image_url", "image_url": {"url": image_to_base64(image)}}
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
    def _create_filter_schema(filters: list[str]) -> type[DynamicSchema]:
        """Create a Pydantic model schema based on a list of filters."""
        field_definitions = {
            sanitize_text(filter_text): (
                bool,
                Field(title=f"Filter {i}", description=filter_text),
            )
            for i, filter_text in enumerate(filters, start=1)
        }
        return create_model("DynamicSchema", **field_definitions)

    def analyze_product(self, product: ProductInput) -> DynamicSchema:
        """Analyze a single product against its filters."""
        prompt = self.PROMPT_TEMPLATE.format(
            title=product.title,
            description=product.description,
            images="<image>" * len(product.images),
        )
        DynamicSchema = self._create_filter_schema(product.filters)
        response = self.predict(prompt, product.images, DynamicSchema)
        return response
