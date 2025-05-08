import typing as tp
from abc import ABC, abstractmethod
from urllib.parse import urlparse

from bs4 import BeautifulSoup

from backend.analyzer.models import Image, Item


class BaseScraper(ABC):
    """Abstract base class for all website scrapers."""

    PLATFORM: str = "N/A"
    SUPPORTED_DOMAINS: list[str] = []
    PAGE_TYPE_PATTERNS: dict[tp.Literal["item", "search"], list[str]] = {
        "item": [],
        "search": [],
    }

    def scrape_item_detail(self, html: str) -> Item:
        """Scrape an item from HTML content."""
        soup = BeautifulSoup(html, "html.parser")

        try:
            title = self.extract_item_title(soup)
        except Exception:
            title = ""

        try:
            additional_details = self.extract_additional_details(soup)
        except Exception:
            additional_details = {}

        try:
            image_urls = self.extract_item_images(soup)
            images = [Image(url=img_url) for img_url in image_urls]
        except Exception:
            images = []

        return Item(
            platform=self.PLATFORM,
            title=title,
            images=images,
            **additional_details,
        )

    @classmethod
    def can_handle_url(cls, url: str) -> bool:
        """Check if this scraper can handle the given URL based on supported domains."""
        if not cls.SUPPORTED_DOMAINS:
            return False

        parsed_url = urlparse(url)
        return any(parsed_url.netloc.endswith(domain) for domain in cls.SUPPORTED_DOMAINS)

    @classmethod
    def find_page_type(cls, url: str) -> tp.Literal["item", "search"] | None:
        """Determine if the URL is an item page or a search page."""
        parsed_url = urlparse(url)

        for page_type, patterns in cls.PAGE_TYPE_PATTERNS.items():
            for pattern in patterns:
                if pattern in parsed_url.path.lower():
                    return page_type

        return None

    @staticmethod
    @abstractmethod
    def extract_item_title(soup: BeautifulSoup) -> str:
        """Extract the item title from the item page."""
        pass

    @staticmethod
    @abstractmethod
    def extract_item_images(soup: BeautifulSoup) -> list[str]:
        """Extract the item image URLs from the item page."""
        pass

    @classmethod
    def extract_additional_details(cls, soup: BeautifulSoup) -> dict[str, str]:
        """Extract additional platform-specific attributes from the item page.

        Override this in platform-specific scrapers.
        """
        return {}
