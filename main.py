from dataclasses import dataclass, field

import torch
from outlines import generate, models
from PIL import Image
from pydantic import BaseModel, Field
from transformers import AutoModelForImageTextToText

from utils import load_img, resize_img


class FilterCheck(BaseModel):
    """A single filter check result with its condition and evaluation."""

    condition: str
    is_valid: bool


class ProductFilterResults(BaseModel):
    """Collection of filter checks for a product."""

    results: list[FilterCheck]


class BooleanResponse(BaseModel):
    """Simple model for receiving boolean responses from the model."""

    values: list[bool] = Field(..., min_length=1)


@dataclass
class ProductInput:
    image_url_or_path: str
    description: str
    filters: list[str]
    image: Image.Image = field(init=False)
    max_size: int = 512

    def __post_init__(self):
        image = load_img(self.image_url_or_path)
        self.image = resize_img(image, self.max_size)


def analyze_product(product: ProductInput) -> list[FilterCheck]:
    """Analyze a single product against its filters."""
    model = models.transformers_vision(
        model_name="HuggingFaceTB/SmolVLM-Instruct",
        model_class=AutoModelForImageTextToText,
        model_kwargs={"torch_dtype": torch.bfloat16},
        device="auto",
    )

    filters_text = "\n".join(
        f"\t{i+1}. {filter_text}"
        for i, filter_text in enumerate(product.filters, start=1)
    )

    prompt = f"""
    Analyze this product image and description. Respond with a list of true/false values corresponding to each filter.
    - Image: <image>
    - Description: {product.description}
    - Filters: \n{filters_text}"""
    print(f"Prompt:\n{prompt}")

    generator = generate.json(model, BooleanResponse)
    bool_response: BooleanResponse = generator(prompt, [product.image])

    results = [
        FilterCheck(condition=desc, is_valid=val)
        for desc, val in zip(product.filters, bool_response.values, strict=True)
    ]

    return results


def demo():
    """Run a demo of the product filtering system."""
    product = ProductInput(
        image_url_or_path="guitar.jpg",
        description="Squier by Fender Acoustic Guitar, Natural Finish, Mahogany",
        filters=[
            "the guitar is red",
            "the guitar is electro-acoustic",
            "the guitar is a Fender",
            "this is a piano",
            "the guitar is in a case",
            "the guitar is a bass",
            "the guitar is a 6-string guitar",
            "the guitar has no pickguard",
        ],
    )

    result = ProductFilterResults(results=analyze_product(product))
    print(result)


if __name__ == "__main__":
    demo()
