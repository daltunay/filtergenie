import typing as tp
from textwrap import dedent

from pydantic import BaseModel, Field, create_model

from backend.analyzer.models import Filter, Image, Item
from backend.common.logging import log
from backend.config import LocalModelConfig, RemoteModelConfig

if tp.TYPE_CHECKING:
    from openai import AsyncOpenAI

    try:
        from outlines.models import TransformersVision
    except ImportError:
        pass


DynamicSchema = BaseModel


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
        if use_local:
            self.local_config = local_config or LocalModelConfig()
            log.info("Initializing local model", name=self.local_config.name)
            self.model = self._create_local_model()
            self.predict = self._predict_local
        else:
            self.remote_config = remote_config or RemoteModelConfig()
            log.info("Initializing remote model", name=self.remote_config.name)
            self.model = self._create_openai_model()
            self.predict = self._predict_openai

    def _create_local_model(self) -> "TransformersVision":
        """Create a local VLM."""
        import torch
        from outlines import models
        from transformers import AutoModelForImageTextToText

        log.debug(
            "Loading local model",
            dtype=self.local_config.dtype,
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
        from outlines import generate

        generator = generate.json(self.model, schema)
        return generator(prompt, [image.base64 for image in images])

    def _create_openai_model(self) -> "AsyncOpenAI":
        """Create an AsyncOpenAI model with async client."""
        from openai import AsyncOpenAI

        log.debug("Creating AsyncOpenAI model", base_url=self.remote_config.base_url)
        return AsyncOpenAI(
            base_url=self.remote_config.base_url,
            api_key=self.remote_config.api_key,
        )

    async def _predict_openai(
        self, prompt: str, images: list[Image], schema: type[DynamicSchema]
    ) -> DynamicSchema:
        """Run prediction using AsyncOpenAI/Gemini API asynchronously."""
        response = await self.model.beta.chat.completions.parse(
            model=self.remote_config.name,
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
        return response.choices[0].message.parsed

    @staticmethod
    def _create_filter_schema(
        filters: list[Filter],
    ) -> type[DynamicSchema]:
        """Create a Pydantic model schema based on filters list."""
        field_definitions: dict[str, tp.Any] = {
            f.name: (
                bool,
                Field(title=f"Filter {i}", desc=f.desc),
            )
            for i, f in enumerate(filters, start=1)
        }
        return create_model("DynamicSchema", **field_definitions)

    async def analyze_item(self, item: Item, filters: list[Filter]) -> list[Filter]:
        """Analyze a single item against the provided filter descriptions."""
        log.debug(
            "Analyzing item",
            title=item.title,
            platform=item.platform,
            filters_count=len(filters),
            images_count=len(item.images),
        )

        if item.model_extra is not None:
            item_details = [
                f"- {key.title().replace('_', ' ')}: {value}"
                for key, value in item.model_extra.items()
            ]
        else:
            item_details = ["N/A"]

        prompt = self.PROMPT_TEMPLATE.format(
            item_title=item.title,
            item_images="<image>" * len(item.images),
            item_details="\n".join(item_details),
        )

        DynamicSchema = self._create_filter_schema(filters)

        try:
            response = await self.predict(prompt=prompt, images=item.images, schema=DynamicSchema)

            matched_filters = 0
            for f in filters:
                f.value = getattr(response, f.name)
                if f.value:
                    matched_filters += 1

            log.debug(
                "Item analysis complete",
                title=item.title,
                matched_filters=matched_filters,
                total_filters=len(filters),
            )
            return filters
        except Exception as e:
            log.error("Error analyzing item", title=item.title, error=str(e), exc_info=e)
            raise
