import base64
import io
import re

import requests
from PIL import Image


def sanitize_text(text):
    """Convert text to a valid attribute name."""
    return re.sub(r"[^a-z0-9_]", "_", text.lower()).strip("_")


def load_img(url_or_path):
    """Load an image from a URL or local path."""
    try:
        if url_or_path.startswith(("http://", "https://")):
            response = requests.get(url_or_path, stream=True)
            response.raise_for_status()
            return Image.open(io.BytesIO(response.content))
        else:
            return Image.open(url_or_path)
    except Exception as e:
        raise ValueError(f"Failed to load image from {url_or_path}: {e}") from e


def resize_img(img, max_size=(512, 512)):
    """Resize an image while maintaining aspect ratio."""
    if img.width > max_size[0] or img.height > max_size[1]:
        img.thumbnail(max_size)
    return img


def image_to_base64(img):
    """Convert an image to base64 encoding."""
    buffer = io.BytesIO()
    img.save(buffer, format="JPEG")
    return (
        f"data:image/jpeg;base64,{base64.b64encode(buffer.getvalue()).decode('utf-8')}"
    )


def extract_price(text):
    """Extract price from text."""
    price_pattern = r"(\d+(?:\s?\d+)*(?:,\d+)?)\s*(?:€|EUR)"
    match = re.search(price_pattern, text)
    if match:
        price = match.group(1)
        # Clean the price (remove spaces)
        price = re.sub(r"\s", "", price)
        return f"{price} €"
    return None
