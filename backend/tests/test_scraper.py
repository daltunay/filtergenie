import os
from unittest.mock import patch

import pytest
from bs4 import BeautifulSoup

from backend.analyzer import Product
from backend.scrape import (
    get_scraper_class_for_url,
    get_scraper_for_url,
    scrape_product_from_html,
)
from backend.scrape.base import BaseScraper
from backend.scrape.platforms.ebay import EbayScraper
from backend.scrape.platforms.leboncoin import LeboncoinScraper
from backend.scrape.platforms.vinted import VintedScraper


def load_test_html(filename: str) -> str:
    """Load HTML test fixture from file."""
    fixtures_dir = os.path.join(os.path.dirname(__file__), "fixtures")
    filepath = os.path.join(fixtures_dir, filename)

    # Create a simple fixture if it doesn't exist
    if not os.path.exists(filepath):
        os.makedirs(fixtures_dir, exist_ok=True)
        with open(filepath, "w") as f:
            f.write(
                "<html><body><h1>Test Product</h1><div>Test description</div></body></html>"
            )

    with open(filepath, "r") as f:
        return f.read()


class TestScraperRegistry:
    """Tests for scraper registration and selection."""

    def test_get_scraper_class_for_url(self) -> None:
        """Test getting the appropriate scraper class for a URL."""
        leboncoin_url = "https://www.leboncoin.fr/ventes_immobilieres/2134567890"
        vinted_url = "https://www.vinted.fr/items/1234567-test-product"
        ebay_url = "https://www.ebay.fr/itm/123456789"
        unknown_url = "https://www.example.com/product/123"

        assert get_scraper_class_for_url(leboncoin_url) == LeboncoinScraper
        assert get_scraper_class_for_url(vinted_url) == VintedScraper
        assert get_scraper_class_for_url(ebay_url) == EbayScraper
        assert get_scraper_class_for_url(unknown_url) is None

    def test_get_scraper_for_url(self) -> None:
        """Test instantiating a scraper for a URL."""
        leboncoin_url = "https://www.leboncoin.fr/ventes_immobilieres/2134567890"
        unknown_url = "https://www.example.com/product/123"

        assert isinstance(get_scraper_for_url(leboncoin_url), LeboncoinScraper)
        assert get_scraper_for_url(unknown_url) is None


class TestBaseScraper:
    """Tests for the BaseScraper functionality."""

    def test_can_handle_url(self) -> None:
        """Test URL handling detection."""

        class TestScraper(BaseScraper):
            SUPPORTED_DOMAINS = ["example.com", "test.org"]

            @staticmethod
            def extract_product_id(url: str) -> int:
                return 0

            @staticmethod
            def extract_product_title(soup: BeautifulSoup) -> str:
                return ""

            @staticmethod
            def extract_product_description(soup: BeautifulSoup) -> str:
                return ""

            @staticmethod
            def extract_product_images(soup: BeautifulSoup) -> list[str]:
                return []

            @staticmethod
            def extract_product_urls(soup: BeautifulSoup) -> list[str]:
                return []

        assert TestScraper.can_handle_url("https://www.example.com/product/123")
        assert TestScraper.can_handle_url("https://sub.test.org/item/456")
        assert not TestScraper.can_handle_url("https://www.other.com/product/789")

    def test_find_page_type(self) -> None:
        """Test page type detection."""

        class TestScraper(BaseScraper):
            PAGE_TYPE_PATTERNS = {
                "product": ["/product/", "/item/"],
                "search": ["/search", "/catalog"],
            }

            @staticmethod
            def extract_product_id(url: str) -> int:
                return 0

            @staticmethod
            def extract_product_title(soup: BeautifulSoup) -> str:
                return ""

            @staticmethod
            def extract_product_description(soup: BeautifulSoup) -> str:
                return ""

            @staticmethod
            def extract_product_images(soup: BeautifulSoup) -> list[str]:
                return []

            @staticmethod
            def extract_product_urls(soup: BeautifulSoup) -> list[str]:
                return []

        assert (
            TestScraper.find_page_type("https://www.example.com/product/123")
            == "product"
        )
        assert (
            TestScraper.find_page_type("https://www.example.com/item/456") == "product"
        )
        assert (
            TestScraper.find_page_type("https://www.example.com/search?q=test")
            == "search"
        )
        assert TestScraper.find_page_type("https://www.example.com/catalog") == "search"
        assert TestScraper.find_page_type("https://www.example.com/other/789") is None


@pytest.mark.asyncio
async def test_scrape_product_from_html() -> None:
    """Test scraping a product from HTML content."""
    leboncoin_url = "https://www.leboncoin.fr/ventes_immobilieres/2134567890"

    mock_product = Product(
        id=2134567890,
        platform="leboncoin",
        title="Test Product",
        description="Product description",
        url=leboncoin_url,
    )

    # Mock the scraper's scrape_product_detail method
    with patch.object(
        LeboncoinScraper, "scrape_product_detail", return_value=mock_product
    ):
        html_content = "<html><body>Test content</body></html>"

        product = await scrape_product_from_html(html_content, leboncoin_url)

        assert product is not None
        assert product.id == 2134567890
        assert product.platform == "leboncoin"
        assert product.title == "Test Product"


class TestPlatformSpecificScrapers:
    """Tests for platform-specific scraper implementations."""

    def test_leboncoin_extract_product_id(self) -> None:
        """Test extracting product ID for Leboncoin."""
        url = "https://www.leboncoin.fr/ad/ventes_immobilieres/2134567890"
        assert LeboncoinScraper.extract_product_id(url) == 2134567890

    def test_vinted_extract_product_id(self) -> None:
        """Test extracting product ID for Vinted."""
        url = "https://www.vinted.fr/items/1234567-test-product"
        assert VintedScraper.extract_product_id(url) == 1234567

    def test_ebay_extract_product_id(self) -> None:
        """Test extracting product ID for eBay."""
        url = "https://www.ebay.fr/itm/123456789"
        assert EbayScraper.extract_product_id(url) == 123456789

        # Test with query parameters
        url_with_params = "https://www.ebay.fr/itm/123456789?param=value"
        assert EbayScraper.extract_product_id(url_with_params) == 123456789
