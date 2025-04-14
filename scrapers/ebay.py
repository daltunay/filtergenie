import structlog
from bs4 import BeautifulSoup

from .base import BaseScraper

logger = structlog.get_logger(__name__)


class EbayScraper(BaseScraper):
    """Scraper for eBay."""

    SUPPORTED_DOMAINS = ["ebay.com", "ebay.fr"]

    PAGE_TYPE_PATTERNS = {
        "product": {
            "path_patterns": [],
            "query_params": ["itm="],
        },
        "search": {
            "path_patterns": ["/sch/", "/b/", "/browse/"],
            "query_params": ["_nkw=", "_sacat=", "lh_"],
        },
    }

    @staticmethod
    def extract_product_title(soup: BeautifulSoup) -> str:
        title_elem = soup.find("h1", class_="x-item-title__mainTitle")
        title_span = title_elem.find("span", class_="ux-textspans")
        return title_span.text.strip()

    @staticmethod
    def extract_product_description(soup: BeautifulSoup) -> str:
        raise NotImplementedError("TODO")

    @staticmethod
    def extract_product_images(soup: BeautifulSoup) -> list[str]:
        image_urls = []
        image_container = soup.find("div", class_="ux-image-grid no-scrollbar")
        img_elements = image_container.find_all("img")
        for img in img_elements:
            if image_url := (img.get("src") or img.get("data-src")):
                image_urls.append(image_url)
        return image_urls

    @staticmethod
    def extract_search_results(soup: BeautifulSoup) -> list[str]:
        raise NotImplementedError("TODO")
