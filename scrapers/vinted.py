import structlog
from bs4 import BeautifulSoup

from .base import BaseScraper

logger = structlog.get_logger(__name__)


class VintedScraper(BaseScraper):
    """Scraper for Vinted."""

    SUPPORTED_DOMAINS = ["vinted.fr", "vinted.com"]

    PAGE_TYPE_PATTERNS = {
        "product": {
            "path_patterns": ["/items/"],
            "query_params": [],
        },
        "search": {
            "path_patterns": ["/catalog"],
            "query_params": ["search_text=", "catalog="],
        },
    }

    @staticmethod
    def extract_product_title(soup: BeautifulSoup) -> str:
        title_elem = soup.find("span", class_="web_ui__Text__title")
        return title_elem.text.strip() if title_elem else ""

    @staticmethod
    def extract_product_description(soup: BeautifulSoup) -> str:
        desc_container = soup.find("div", attrs={"itemprop": "description"})
        desc_text = desc_container.find("span", class_="web_ui__Text__text")
        return desc_text.text.strip()

    @staticmethod
    def extract_product_images(soup: BeautifulSoup) -> list[str]:
        photos_container = soup.find("div", class_="item-photos")
        img_elements = photos_container.find_all("img")
        image_urls = []
        for img in img_elements:
            image_urls.append(img["src"])
        return image_urls

    @staticmethod
    def extract_search_results(soup: BeautifulSoup) -> list[str]:
        raise NotImplementedError("TODO")
