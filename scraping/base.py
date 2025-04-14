import typing as tp
from abc import ABC, abstractmethod
from urllib.parse import urlparse

import structlog
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

from analyzer import Product, ProductImage

logger = structlog.get_logger(__name__)


class BaseScraper(ABC):
    """Abstract base class for all website scrapers."""

    # Class attributes
    HEADLESS_MODE: bool = True
    SUPPORTED_DOMAINS: list[str] = []

    PAGE_TYPE_PATTERNS: dict[str, list[str]] = {
        "product": [],
        "search": [],
    }

    # Initialization and cleanup
    def __init__(self):
        """Initialize the scraper with Playwright and browser instances."""
        self.playwright = sync_playwright().start()
        self.browser = self.playwright.firefox.launch(headless=self.HEADLESS_MODE)

    def close(self):
        """Close the browser and Playwright instance."""
        self.browser.close()
        self.playwright.stop()

    # Primary public methods
    def get_product_from_url(self, product_url: str) -> Product:
        """Main method to scrape a product from a given URL."""
        soup = self.fetch_page(product_url)

        try:
            title = self.extract_product_title(soup)
        except Exception as e:
            logger.error("Error extracting title", exception=str(e))
            title = ""

        try:
            description = self.extract_product_description(soup)
        except Exception as e:
            logger.error("Error extracting description", exception=str(e))
            description = ""

        try:
            image_urls = self.extract_product_images(soup)
            images = [ProductImage(url_or_path=url) for url in image_urls]
        except Exception as e:
            logger.error("Error extracting images", exception=str(e))
            images = []

        return Product(
            url=product_url,
            title=title,
            description=description,
            images=images,
        )

    def get_products_from_url(self, search_url: str, max_products: int = 5) -> list[Product]:
        """Main method to scrape search results from a given URL."""
        soup = self.fetch_page(search_url)
        product_urls = self.extract_product_urls(soup)
        products: list[Product] = []
        for url in product_urls[:max_products]:
            product = self.get_product_from_url(url)
            products.append(product)
        return products

    # Implementation methods
    def fetch_page(self, url: str) -> BeautifulSoup:
        """Fetch the page content using the instance browser and return a BeautifulSoup object."""
        logger.info(f"Fetching {self.__class__.__name__} page with Playwright", url=url)

        page = self.browser.new_page()
        page.goto(url)
        html_content = page.content()
        page.close()
        return BeautifulSoup(html_content, "html.parser")

    # Class methods
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

        for page_type, patterns in cls.PAGE_TYPE_PATTERNS.products():
            for pattern in patterns:
                if pattern in parsed_url.path.lower():
                    return page_type

        return None

    # Abstract methods that subclasses must implement
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
