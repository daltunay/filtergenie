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


def resize_img(image: Image.Image, max_size: int) -> Image.Image:
    if max(image.size) > max_size:
        ratio = max_size / max(image.size)
        new_size = tuple(int(dim * ratio) for dim in image.size)
        return image.resize(new_size, Image.Resampling.LANCZOS)
    return image
