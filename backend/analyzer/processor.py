import typing as tp
from textwrap import dedent

import structlog
from pydantic import BaseModel, Field, create_model

from backend.analyzer.models import Product, ProductImage
from backend.common.cache import cached
from backend.config import settings

if tp.TYPE_CHECKING:
    from openai import AsyncOpenAI as OpenAI

    try:
        from outlines.models import TransformersVision
    except ImportError:
        pass


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

    def __init__(self, use_local: bool | None = None):
        """Initialize the analyzer with either a local VLM model or OpenAI."""
        self.log = structlog.get_logger(name="analyzer")

        # Use settings if not explicitly provided
        if use_local is None:
            use_local = settings.use_local_model

        self.log.info("Initializing ProductAnalyzer", use_local=use_local)

        if use_local:
            self.model = self._create_local_model(
                model_name=settings.local_model_name,
                dtype=settings.local_model_dtype,
                device=settings.local_model_device,
            )
            self.predict = self._predict_local
        else:
            self.model = self._create_openai_model(model_name=settings.model_name)
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

        self.log.debug("Creating local VLM model", model_name=model_name, device=device)
        return models.transformers_vision(
            model_name=model_name,
            model_class=AutoModelForImageTextToText,
            model_kwargs={"torch_dtype": getattr(torch, dtype)},
            device=device,
        )

    async def _predict_local(
        self, prompt: str, images: list[ProductImage], schema: type[DynamicSchema]
    ) -> DynamicSchema:
        """Run prediction using local model."""
        from outlines import generate

        self.log.debug("Running local prediction", num_images=len(images))
        generator = generate.json(self.model, schema)

        import asyncio

        return await asyncio.to_thread(
            generator, prompt, [image.image for image in images]
        )

    def _create_openai_model(
        self, model_name: str = "gemini-2.0-flash-lite"
    ) -> "OpenAI":
        """Create an OpenAI/Gemini model with async client."""
        from openai import AsyncOpenAI as OpenAI

        self.log.debug("Creating API-based model", model_name=model_name)
        self.model_name = model_name
        return OpenAI(
            base_url=settings.openai_base_url,
            api_key=settings.openai_api_key,
        )

    async def _predict_openai(
        self, prompt: str, images: list[ProductImage], schema: type[DynamicSchema]
    ) -> DynamicSchema:
        """Run prediction using OpenAI/Gemini API asynchronously."""
        content = [
            {"type": "text", "text": prompt},
            *[
                {"type": "image_url", "image_url": {"url": image.base64}}
                for image in images
            ],
        ]

        self.log.debug(
            "Sending API request", model=self.model_name, num_images=len(images)
        )

        start_time = __import__("time").time()
        response = await self.model.beta.chat.completions.parse(
            model=self.model_name,
            messages=[{"role": "user", "content": content}],
            response_format=schema,
        )

        elapsed = __import__("time").time() - start_time
        self.log.debug("Received API response", elapsed_seconds=round(elapsed, 2))

        return response.choices[0].message.parsed

    @staticmethod
    def _create_filter_schema(
        filters: list[tp.Any],
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

    @cached
    async def analyze_product(self, product: Product) -> Product:
        """Analyze a single product and update its filters with results."""
        self.log.debug(
            "Analyzing product",
            product_id=product.id,
            vendor=product.vendor,
            num_filters=len(product.filters),
            num_images=len(product.images),
        )

        prompt = self.PROMPT_TEMPLATE.format(
            title=product.title,
            description=product.description,
            images="<image>" * len(product.images),
        )

        DynamicSchema = self._create_filter_schema(product.filters)
        response = await self.predict(prompt, product.images, DynamicSchema)

        for filter_ in product.filters:
            filter_.value = getattr(response, filter_.name)

        if product.matches_filters:
            self.log.info(
                "Found matching product",
                product_id=product.id,
                filter_results=[(f.description, f.value) for f in product.filters],
            )
        else:
            self.log.debug(
                "Product analysis complete",
                product_id=product.id,
                matches_filters=False,
            )

        return product
