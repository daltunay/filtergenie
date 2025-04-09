from dataclasses import dataclass, field

import torch
from outlines import generate, models
from PIL import Image
from pydantic import BaseModel, Field, create_model
from transformers import AutoModelForImageTextToText

from utils import load_img, resize_img, sanitize_field_name


class FilterCheck(BaseModel):
    """A single filter check result with its condition and evaluation."""

    condition: str
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

    def get_unique_field_name(text: str, existing_fields: set) -> str:
        """Generate a unique field name for a filter text."""
        base_name = sanitize_field_name(text)
        field_name = base_name
        counter = 1
        while field_name in existing_fields:
            field_name = f"{base_name}_{counter}"
            counter += 1
        return field_name

    existing_fields = set()
    field_mapping = {}

    for filter_text in product.filters:
        field_name = get_unique_field_name(filter_text, existing_fields)
        field_mapping[field_name] = filter_text
        existing_fields.add(field_name)

    field_definitions = {
        field_name: (bool, Field(description=filter_text))
        for field_name, filter_text in field_mapping.items()
    }

    DynamicFilterResponse = create_model("DynamicFilterResponse", **field_definitions)

    fields_text = "\n".join(
        f"\t{i}. {filter_text}'"
        for i, filter_text in enumerate(product.filters, start=1)
    )

    prompt = f"""
    Analyze this product image and description. Respond with JSON containing boolean values for each filter.
    - Image: <image>
    - Description: {product.description}
    - Filters: \n{fields_text}"""
    print(f"Prompt:\n{prompt}")

    generator = generate.json(model, DynamicFilterResponse)
    response = generator(prompt, [product.image])

    results = []
    for field_name, filter_text in field_mapping.items():
        is_valid = getattr(response, field_name)
        results.append(FilterCheck(condition=filter_text, is_valid=is_valid))

    return results


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

    result = ProductFilterResults(results=analyze_product(product))
    print("Result:", result.model_dump_json(indent=2))


if __name__ == "__main__":
    demo()
