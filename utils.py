import base64
import re
from io import BytesIO
from urllib.request import urlopen

from PIL import Image


def load_img(image_url_or_path: str) -> Image.Image:
    """Load an image from a URL or file path."""
    if image_url_or_path.startswith(("http://", "https://")):
        with urlopen(image_url_or_path) as response:
            fp = BytesIO(response.read())
    else:
        fp = image_url_or_path
    return Image.open(fp).convert("RGB")


def resize_img(image: Image.Image, max_size: int = 1024) -> Image.Image:
    """Resize an image while maintaining its aspect ratio."""
    if max(image.size) > max_size:
        ratio = max_size / max(image.size)
        new_size = tuple(int(dim * ratio) for dim in image.size)
        return image.resize(new_size, Image.Resampling.LANCZOS)
    return image


def image_to_base64(image: Image.Image, format: str = "JPEG") -> str:
    """Convert a PIL Image to a base64 string for API usage."""
    buffer = BytesIO()
    image.save(buffer, format=format)
    base64_image = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/{format.lower()};base64,{base64_image}"


def sanitize_text(text: str) -> str:
    """Convert a filter text into a valid Python identifier for use as a field name."""
    field_name = re.sub(r"[^a-zA-Z0-9]", "_", text.lower())
    if not field_name[0].isalpha():
        field_name = "f_" + field_name
    return re.sub(r"_+", "_", field_name).strip("_")
