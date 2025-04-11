import os
from dataclasses import dataclass, field
from textwrap import dedent

import torch
from dotenv import load_dotenv
from openai import OpenAI
from outlines import generate, models
from PIL import Image
from pydantic import BaseModel, Field, create_model
from transformers import AutoModelForImageTextToText

from utils import image_to_base64, load_img, resize_img, sanitize_text

load_dotenv()


class FilterCheck(BaseModel):
    """A single filter check result with its description and evaluation."""

    description: str
    is_valid: bool


@dataclass
class ProductInput:
    image_url_or_path: str
    description: str
    filters: list[str]
    image: Image.Image = field(init=False)

    def __post_init__(self):
        image = load_img(self.image_url_or_path)
        self.image = resize_img(image)


class ProductAnalyzer:
    """A class to analyze products against filters with a reusable model."""

    PROMPT_TEMPLATE = dedent(
        """
        Analyze this product image and description:
        - Image: <image>
        - Description: {description}

        For each of the following filters, determine if it applies to this product.
        """
    )

    def __init__(self, use_local: bool = True):
        """Initialize the analyzer with either a local VLM model or OpenAI."""
        self.use_local = use_local

        if self.use_local:
            self.model = self._create_local_model()
            self.predict = self._predict_local
        else:
            self.model = OpenAI(
                base_url=os.getenv("GEMINI_BASE_URL"),
                api_key=os.getenv("GEMINI_API_KEY"),
            )
            self.predict = self._predict_openai

    def _create_local_model(self) -> models.TransformersVision:
        """Create a local VLM model."""
        return models.transformers_vision(
            model_name="HuggingFaceTB/SmolVLM-Instruct",
            model_class=AutoModelForImageTextToText,
            model_kwargs={"torch_dtype": torch.bfloat16},
            device="auto",
        )

    def _predict_local(
        self, prompt: str, image: Image.Image, schema: type[BaseModel]
    ) -> BaseModel:
        """Run prediction using local model."""
        generator = generate.json(self.model, schema)
        return generator(prompt, [image])

    def _predict_openai(
        self, prompt: str, image: Image.Image, schema: type[BaseModel]
    ) -> BaseModel:
        """Run prediction using OpenAI API."""
        image_data_url = image_to_base64(image)
        return (
            self.model.beta.chat.completions.parse(
                model="gemini-2.0-flash",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {"type": "image_url", "image_url": {"url": image_data_url}},
                        ],
                    }
                ],
                response_format=schema,
            )
            .choices[0]
            .message.parsed
        )

    @staticmethod
    def _create_filter_schema(filters: list[str]) -> type[BaseModel]:
        """Create a Pydantic model schema based on a list of filters."""
        field_definitions = {
            sanitize_text(filter_text): (
                bool,
                Field(title=f"Filter {i}", description=filter_text),
            )
            for i, filter_text in enumerate(filters, start=1)
        }
        return create_model("DynamicSchema", **field_definitions)

    def analyze_product(self, product: ProductInput) -> BaseModel:
        """Analyze a single product against its filters."""
        prompt = self.PROMPT_TEMPLATE.format(description=product.description)
        schema = self._create_filter_schema(product.filters)
        response = self.predict(prompt, product.image, schema)
        return response


def demo():
    """Run a demo of the product filtering system."""
    product = ProductInput(
        image_url_or_path="guitar.jpg",
        description="Squier by Fender Acoustic Guitar, Natural Finish, Mahogany",
        filters=[
            "the guitar is red",
            "the guitar is natural",
            "the guitar is electro-acoustic",
            "the guitar is a Fender",
            "this is a piano",
            "the guitar is in a case",
            "the guitar is a bass",
            "the guitar is a 6-string guitar",
            "the guitar has no pickguard",
            "the guitar has a pickguard",
            "the guitar has a cutaway",
        ],
    )
    analyzer = ProductAnalyzer(use_local=False)
    response = analyzer.analyze_product(product)
    print(response.model_dump_json(indent=2))


if __name__ == "__main__":
    demo()
