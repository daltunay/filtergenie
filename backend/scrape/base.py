import typing as tp
from abc import ABC, abstractmethod
from urllib.parse import urlparse

import structlog
from bs4 import BeautifulSoup

from backend.analyzer import Product, ProductImage
from backend.common.cache import cached


class BaseScraper(ABC):
    """Abstract base class for all website scrapers."""

    SUPPORTED_DOMAINS: list[str] = []

    PAGE_TYPE_PATTERNS: dict[str, list[str]] = {
        "product": [],
        "search": [],
    }

    def __init__(self):
        """Initialize the scraper."""
        self.log = structlog.get_logger(__name__=__name__)

    @classmethod
    def get_vendor_name(cls) -> str:
        """Extract vendor name from the scraper class name."""
        vendor = cls.__name__.replace("Scraper", "").lower()
        return vendor

    @cached
    def scrape_product_detail(self, html_content: str, url: str) -> Product:
        """
        Scrape a product from HTML content.

        Args:
            html_content: HTML content to parse
            url: The URL of the product page
        """
        self.log.debug("Scraping product details from HTML")
        start_time = __import__("time").time()

        soup = BeautifulSoup(html_content, "html.parser")

        try:
            title = self.extract_product_title(soup)
        except Exception as e:
            self.log.error("Error extracting title", exception=str(e), exc_info=True)
            title = ""

        try:
            description = self.extract_product_description(soup)
        except Exception as e:
            self.log.error(
                "Error extracting description", exception=str(e), exc_info=True
            )
            description = ""

        try:
            image_urls = self.extract_product_images(soup)
            self.log.debug(f"Found {len(image_urls)} images")
            images = [ProductImage(url_or_path=img_url) for img_url in image_urls]
        except Exception as e:
            self.log.error("Error extracting images", exception=str(e), exc_info=True)
            images = []

        duration = __import__("time").time() - start_time
        product = Product(
            url=url,
            title=title,
            description=description,
            images=images,
        )

        self.log.debug(
            "Product scraped",
            duration_seconds=round(duration, 2),
            title=title,
            image_count=len(images),
        )

        return product

    @classmethod
    def can_handle_url(cls, url: str) -> bool:
        """Check if this scraper can handle the given URL based on supported domains."""
        if not cls.SUPPORTED_DOMAINS:
            return False

        parsed_url = urlparse(url)
        return any(
            parsed_url.netloc.endswith(domain) for domain in cls.SUPPORTED_DOMAINS
        )

    @classmethod
    def find_page_type(cls, url: str) -> tp.Literal["product", "search"] | None:
        """Determine if the URL is a product page or a search page."""
        parsed_url = urlparse(url)

        for page_type, patterns in cls.PAGE_TYPE_PATTERNS.items():
            for pattern in patterns:
                if pattern in parsed_url.path.lower():
                    return page_type

        return None

    @staticmethod
    @abstractmethod
    def extract_product_id(url: str) -> int:
        """Extract the product ID from the product URL."""
        pass

    @staticmethod
    @abstractmethod
    def extract_product_title(soup: BeautifulSoup) -> str:
        """Extract the product title from the product page."""
        pass

    @staticmethod
    @abstractmethod
    def extract_product_description(soup: BeautifulSoup) -> str:
        """Extract the product description from the product page."""
        pass

    @staticmethod
    @abstractmethod
    def extract_product_images(soup: BeautifulSoup) -> list[str]:
        """Extract the product image URLs from the product page."""
        pass

    @staticmethod
    @abstractmethod
    def extract_product_urls(soup: BeautifulSoup) -> list[str]:
        """Extract product URLs from the search results page."""
        pass
