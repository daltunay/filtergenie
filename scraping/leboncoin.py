import structlog
from bs4 import BeautifulSoup

from .base import BaseScraper

logger = structlog.get_logger(__name__)


class LeboncoinScraper(BaseScraper):
    """Scraper for leboncoin."""

    SUPPORTED_DOMAINS = ["leboncoin.fr"]

    PAGE_TYPE_PATTERNS = {
        "product": ["/ad/"],
        "search": ["/recherche", "/c/"],
    }

    @staticmethod
    def extract_product_title(soup: BeautifulSoup) -> str:
        title_elem = soup.find(
            "h1",
            class_="text-headline-1-expanded",
            attrs={"data-qa-id": "adview_title"},
        )
        return title_elem.text.strip()

    @staticmethod
    def extract_product_description(soup: BeautifulSoup) -> str:
        desc_container = soup.find(
            "div", attrs={"data-qa-id": "adview_description_container"}
        )
        desc_elem = desc_container.find("p")
        return desc_elem.text.strip()

    @staticmethod
    def extract_product_images(soup: BeautifulSoup) -> list[str]:
        image_urls = []
        gallery_section = soup.find(
            "section", attrs={"aria-label": "Aller à la galerie de photos"}
        )
        picture_elements = gallery_section.find_all("picture")
        for picture in picture_elements:
            jpeg_source = picture.find("source", attrs={"type": "image/jpeg"})
            image_urls.append(jpeg_source["srcset"].strip())

        return image_urls

    @staticmethod
    def extract_product_urls(soup: BeautifulSoup) -> list[str]:
        ad_articles = soup.find_all(
            "article", attrs={"data-test-id": "ad", "data-qa-id": "aditem_container"}
        )

        product_urls = []

        for article in ad_articles:
            anchor = article.find("a")
            relative_url = anchor["href"].strip("/")
            product_url = f"https://www.leboncoin.fr/{relative_url}"
            product_urls.append(product_url)

        return product_urls
