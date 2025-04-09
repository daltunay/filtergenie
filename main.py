import json
from dataclasses import dataclass, field

import torch
from outlines import generate, models
from PIL import Image
from pydantic import BaseModel, Field, create_model
from transformers import AutoModelForImageTextToText

from utils import load_img, resize_img, sanitize_field_name


class FilterCheck(BaseModel):
    """A single filter check result with its description and evaluation."""

    description: str
    is_valid: bool


class ProductFilterResults(BaseModel):
    """Collection of filter checks for a product."""

    results: list[FilterCheck]


@dataclass
class ProductInput:
    image_url_or_path: str
    description: str
    filters: list[str]
    image: Image.Image = field(init=False)

    def __post_init__(self):
        image = load_img(self.image_url_or_path)
        self.image = resize_img(image)


def analyze_product(product: ProductInput) -> list[FilterCheck]:
    """Analyze a single product against its filters."""
    model = models.transformers_vision(
        model_name="HuggingFaceTB/SmolVLM-Instruct",
        model_class=AutoModelForImageTextToText,
        model_kwargs={"torch_dtype": torch.bfloat16},
        device="auto",
    )

    prompt = f"""
        Analyze this product image and description:
        - Image: <image>
        - Description: {product.description}
    """
    print(f"Prompt: \n{prompt}")

    field_definitions = {
        sanitize_field_name(filter_text): (
            bool,
            Field(title=f"Filter {i}", description=filter_text),
        )
        for i, filter_text in enumerate(product.filters, start=1)
    }

    dynamic_schema: type[BaseModel] = create_model("DynamicSchema", **field_definitions)
    print(f"DynamicSchema: {json.dumps(dynamic_schema.model_json_schema(), indent=2)}")

    generator = generate.json(model, dynamic_schema)
    response = generator(prompt, [product.image])

    results = []
    for field_name, (_, filter_field) in field_definitions.items():
        is_valid = getattr(response, field_name)
        results.append(
            FilterCheck(description=filter_field.description, is_valid=is_valid)
        )

    return results


def demo():
    """Run a demo of the product filtering system."""
    product = ProductInput(
        image_url_or_path="guitar_in_case.jpg",
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

    results = ProductFilterResults(results=analyze_product(product))
    print("Result:", results.model_dump_json(indent=2))


if __name__ == "__main__":
    demo()
