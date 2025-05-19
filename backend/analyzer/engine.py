from textwrap import dedent

import instructor
from groq import AsyncGroq
from pydantic import BaseModel, Field, create_model

from backend.common.logging import log
from backend.config import settings

from .models import FilterModel, ImageModel, ItemModel


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

    def __init__(self):
        """Initialize the analyzer with Groq."""
        self.config = settings.groq
        log.info("Initializing Groq model", name=self.config.model_name)
        self.client = self._create_groq_client(api_key=self.config.api_key)

    def _create_groq_client(self, api_key: str) -> instructor.AsyncInstructor:
        """Create an AsyncGroq model with instructor patch."""
        log.debug("Creating AsyncGroq model")
        groq_client = AsyncGroq(api_key=api_key)
        return instructor.from_groq(groq_client)

    async def predict(
        self,
        model: str,
        prompt: str,
        images: list[ImageModel],
        schema: type[BaseModel],
    ) -> "BaseModel":
        response = await self.client.chat.completions.create(
            model=model,
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
            response_model=schema,
        )
        return response

    @staticmethod
    def _create_filter_schema(filters: list[FilterModel]) -> type[BaseModel]:
        """Create a Pydantic model schema based on filters list."""
        return create_model(
            "DynamicSchema",
            **{
                f.name: (bool, Field(title=f"FilterModel {i}", desc=f.desc))
                for i, f in enumerate(filters, start=1)
            },
        )

    async def analyze_item(self, item: ItemModel, filters: list[FilterModel]) -> list[FilterModel]:
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
            response = await self.predict(
                model=self.config.model_name,
                prompt=prompt,
                images=item.images,
                schema=DynamicSchema,
            )

            matched_filters = 0
            for f in filters:
                f.value = getattr(response, f.name)
                if f.value:
                    matched_filters += 1

            log.debug(
                "ItemModel analysis complete",
                title=item.title,
                matched_filters=matched_filters,
                total_filters=len(filters),
            )
            return filters
        except Exception as e:
            log.error("Error analyzing item", title=item.title, error=str(e), exc_info=e)
            raise e
