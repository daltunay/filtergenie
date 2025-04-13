import urllib.request
from abc import ABC, abstractmethod
from dataclasses import dataclass

from bs4 import BeautifulSoup


@dataclass
class ScrapedProduct:
    """Class to hold product data scraped from websites."""

    title: str
    description: str
    image_urls: list[str]


class BaseScraper(ABC):
    """Abstract base class for all website scrapers."""

    HEADLESS_MODE = True
    PLAYWRIGHT_TIMEOUT = 30_000

    def scrape(self, url: str) -> ScrapedProduct:
        """Main method to scrape a product from a given URL."""
        soup = self.fetch_page(url)

        title = self.extract_title(soup)
        description = self.extract_description(soup)
        image_urls = self.extract_images(soup)

        return ScrapedProduct(
            title=title, description=description, image_urls=image_urls
        )

    def fetch_page(self, url: str) -> BeautifulSoup:
        """Fetch the page content and return a BeautifulSoup object."""
        with urllib.request.urlopen(url) as response:
            return BeautifulSoup(response.read().decode("utf-8"), "html.parser")

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

    @staticmethod
    @abstractmethod
    def can_handle_url(url: str) -> bool:
        """Check if this scraper can handle the given URL."""
        pass
