import base64
import io
import re

import requests
from PIL import Image


def sanitize_text(text: str) -> str:
    """Convert text to a valid attribute title."""
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")


def load_img(url: str) -> Image.Image:
    """Load an image from a URL."""
    response = requests.get(url)
    response.raise_for_status()
    return Image.open(io.BytesIO(response.content))


def resize_img(img: Image.Image, max_size=(512, 512)) -> Image.Image:
    """Resize an image while maintaining aspect ratio."""
    if img.width > max_size[0] or img.height > max_size[1]:
        img.thumbnail(max_size)
    return img


def img_to_base64(img: Image.Image) -> str:
    """Convert an image to base64 encoding."""
    buffer = io.BytesIO()
    img.save(buffer, format="JPEG")
    return f"data:image/jpeg;base64,{base64.b64encode(buffer.getvalue()).decode('utf-8')}"


def url_to_base64(url: str) -> str:
    """Convert a URL to base64 encoding."""
    img = load_img(url)
    img = resize_img(img)
    return img_to_base64(img)
