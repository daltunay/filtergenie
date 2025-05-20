import base64
import io
import re

import requests
from PIL import Image


def sanitize_text(text: str) -> str:
    """Convert text to a valid attribute title."""
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")


def resize_img(img: Image.Image, max_size=(256, 256)) -> Image.Image:
    """Resize an image while maintaining aspect ratio."""
    if img.width > max_size[0] or img.height > max_size[1]:
        img.thumbnail(max_size)
    return img


def url_to_pil(url: str) -> Image.Image:
    """Load an image from a URL and resize it."""
    response = requests.get(url, stream=True, timeout=5)
    response.raise_for_status()
    img = Image.open(io.BytesIO(response.content))
    img = resize_img(img)
    return img


def pil_to_base64(img: Image.Image) -> str:
    """Convert an image to base64 encoding with lower quality to save RAM."""
    buffer = io.BytesIO()
    img.save(buffer, format="JPEG", quality=85, optimize=True)
    base64_str = f"data:image/jpeg;base64,{base64.b64encode(buffer.getvalue()).decode('utf-8')}"
    buffer.close()
    return base64_str
