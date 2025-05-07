import typing as tp
from textwrap import dedent

import structlog
from pydantic import BaseModel, Field, create_model

from backend.analyzer.models import Filter, Image, Item
from backend.config import LocalModelConfig, RemoteModelConfig

if tp.TYPE_CHECKING:
    from openai import AsyncOpenAI

    try:
        from outlines.models import TransformersVision
    except ImportError:
        pass

log = structlog.get_logger(__name__=__name__)


class DynamicSchema(BaseModel):
    """Placeholder for dynamic schema generation. For type hinting only."""

    ...


class Analyzer:
    """A class to analyze items against filters with a reusable model."""

    PROMPT_TEMPLATE = dedent(
        """
        Analyze this item with the following details:
        - Title: {item_title}
        - Images: {item_images}

        Additional details:
        {item_details}

        For each of the following filters, determine if it applies to the item.
        """
    )

    def __init__(
        self,
        use_local: bool = False,
        local_config: LocalModelConfig | None = None,
        remote_config: RemoteModelConfig | None = None,
    ):
        """Initialize the analyzer with either a local VLM model or AsyncOpenAI."""
        log.info("Initializing Analyzer", use_local=use_local)

        if use_local:
            self.local_config = local_config or LocalModelConfig()
            self.model = self._create_local_model()
            self.predict = self._predict_local
        else:
            self.remote_config = remote_config or RemoteModelConfig()
            self.model = self._create_openai_model()
            self.predict = self._predict_openai

    def _create_local_model(self) -> "TransformersVision":
        """Create a local VLM."""
        import torch
        from outlines import models
        from transformers import AutoModelForImageTextToText

        log.debug(
            "Creating local VLM model",
            model_name=self.local_config.name,
            device=self.local_config.device,
        )
        return models.transformers_vision(
            model_name=self.local_config.name,
            model_class=AutoModelForImageTextToText,
            model_kwargs={"torch_dtype": getattr(torch, self.local_config.dtype)},
            device=self.local_config.device,
        )

    async def _predict_local(
        self, prompt: str, images: list[Image], schema: type[DynamicSchema]
    ) -> DynamicSchema:
        """Run prediction using local model asynchronously."""
        log.debug("Running local prediction", num_images=len(images))

        import asyncio

        from outlines import generate

        generator = generate.json(self.model, schema)
        return await asyncio.to_thread(generator, prompt, [image.base64 for image in images])

    def _create_openai_model(self) -> "AsyncOpenAI":
        """Create an AsyncOpenAI model with async client."""
        log.debug("Creating API-based model", model_name=self.remote_config.name)

        from openai import AsyncOpenAI

        self.model_name = self.remote_config.name
        return AsyncOpenAI(base_url=self.remote_config.base_url, api_key=self.remote_config.api_key)

    async def _predict_openai(
        self, prompt: str, images: list[Image], schema: type[DynamicSchema]
    ) -> DynamicSchema:
        """Run prediction using AsyncOpenAI/Gemini API asynchronously."""
        log.debug("Sending API request", model=self.model_name, num_images=len(images))

        response = await self.model.beta.chat.completions.parse(
            model=self.model_name,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        *[
                            {"type": "image_url", "image_url": {"url": image.base64}}
                            for image in images
                        ],
                    ],
                }
            ],
            response_format=schema,
        )

        log.debug("Received API response")

        return response.choices[0].message.parsed

    @staticmethod
    def _create_filter_schema(
        filters: list[Filter],
    ) -> type[DynamicSchema]:
        """Create a Pydantic model schema based on filters list."""
        field_definitions: dict[str, tp.Any] = {
            filter_.title: (
                bool,
                Field(title=f"Filter {i}", description=filter_.description),
            )
            for i, filter_ in enumerate(filters, start=1)
        }
        return create_model("DynamicSchema", **field_definitions)

    async def analyze_item(self, item: Item, filters: list[Filter]) -> list[Filter]:
        """Analyze a single item against the provided filter descriptions."""
        log.debug(
            "Analyzing item",
            platform=item.platform,
            num_filters=len(filters),
            num_images=len(item.images),
        )

        if item.model_extra is not None:
            item_details = "\n".join(
                [
                    f"- {key.title().replace('_', ' ')}: {value}"
                    for key, value in item.model_extra.items()
                ]
            )
        else:
            item_details = "N/A"

        prompt = self.PROMPT_TEMPLATE.format(
            item_title=item.title,
            item_images="<image>" * len(item.images),
            item_details=item_details,
        )

        DynamicSchema = self._create_filter_schema(filters)
        response = await self.predict(prompt=prompt, images=item.images, schema=DynamicSchema)

        for filter_ in filters:
            filter_.value = getattr(response, filter_.title)

        log.debug(
            "Item analysis complete",
            platform=item.platform,
            matches=len([f for f in filters if f.value]),
            num_filters=len(filters),
        )

        return filters
