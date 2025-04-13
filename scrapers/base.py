from abc import ABC, abstractmethod
from dataclasses import dataclass
from urllib.parse import urlparse

import structlog
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

logger = structlog.get_logger(__name__)


@dataclass
class ScrapedProduct:
    """Class to hold product data scraped from websites."""

    title: str
    description: str
    image_urls: list[str]


class BaseScraper(ABC):
    """Abstract base class for all website scrapers."""

    HEADLESS_MODE: bool = True
    SUPPORTED_DOMAINS: list[str] = []

    def scrape(self, url: str) -> ScrapedProduct:
        """Main method to scrape a product from a given URL."""
        soup = self.fetch_page(url)

        try:
            title = self.extract_title(soup)
        except Exception as e:
            logger.error("Error extracting title", error=str(e))
            title = ""

        try:
            description = self.extract_description(soup)
        except Exception as e:
            logger.error("Error extracting description", error=str(e))
            description = ""

        try:
            image_urls = self.extract_images(soup)
        except Exception as e:
            logger.error("Error extracting images", error=str(e))
            image_urls = []

        return ScrapedProduct(
            title=title,
            description=description,
            image_urls=image_urls,
        )

    def fetch_page(self, url: str) -> BeautifulSoup:
        """Fetch the page content using Playwright and return a BeautifulSoup object."""
        logger.info(f"Fetching {self.__class__.__name__} page with Playwright", url=url)

        with sync_playwright() as p:
            browser = p.firefox.launch(headless=self.HEADLESS_MODE)
            page = browser.new_page()
            page.goto(url)
            html_content = page.content()
            browser.close()
        return BeautifulSoup(html_content, "html.parser")

    @classmethod
    def can_handle_url(cls, url: str) -> bool:
        """Check if this scraper can handle the given URL based on supported domains."""
        if not cls.SUPPORTED_DOMAINS:
            return False

        parsed_url = urlparse(url)
        return any(
            parsed_url.netloc.endswith(domain) for domain in cls.SUPPORTED_DOMAINS
        )

    @staticmethod
    @abstractmethod
    def extract_title(soup: BeautifulSoup) -> str:
        """Extract the product title from the page."""
        pass

    @staticmethod
    @abstractmethod
    def extract_description(soup: BeautifulSoup) -> str:
        """Extract the product description from the page."""
        pass

    @staticmethod
    @abstractmethod
    def extract_images(soup: BeautifulSoup) -> list[str]:
        """Extract the product image URLs from the page."""
        pass
