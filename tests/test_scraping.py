import asyncio
from unittest.mock import AsyncMock, patch

import pytest
from bs4 import BeautifulSoup

from backend.analyzer.models import Product
from backend.scrape import get_scraper_class_for_url, get_vendor_for_url
from backend.scrape.vendors.leboncoin import LeboncoinScraper


@pytest.fixture
def mock_html_content():
    """Create mock HTML content for testing."""
    return """
    <html>
        <body>
            <section aria-label="Aller à la galerie de photos">
                <picture>
                    <source type="image/jpeg" srcset="https://example.com/image1.jpg">
                </picture>
                <picture>
                    <source type="image/jpeg" srcset="https://example.com/image2.jpg">
                </picture>
            </section>
            <h1 class="text-headline-1-expanded" data-qa-id="adview_title">Guitare acoustique</h1>
            <div data-qa-id="adview_description_container">
                <p>Belle guitare acoustique en parfait état</p>
            </div>
        </body>
    </html>
    """


@pytest.fixture
def mock_search_html():
    """Create mock search results HTML for testing."""
    return """
    <html>
        <body>
            <article data-test-id="ad" data-qa-id="aditem_container">
                <a href="/ad/instruments_de_musique/1234567890">Guitare acoustique</a>
            </article>
            <article data-test-id="ad" data-qa-id="aditem_container">
                <a href="/ad/instruments_de_musique/9876543210">Guitare électrique</a>
            </article>
        </body>
    </html>
    """


def test_get_scraper_class_for_url():
    """Test getting the correct scraper class for a URL."""
    # LeBonCoin URL
    scraper_class = get_scraper_class_for_url(
        "https://www.leboncoin.fr/recherche?text=guitare"
    )
    assert scraper_class == LeboncoinScraper

    # Unsupported URL
    scraper_class = get_scraper_class_for_url(
        "https://www.unknown-site.com/search?q=guitar"
    )
    assert scraper_class is None


def test_get_vendor_for_url():
    """Test getting the vendor name for a URL."""
    vendor = get_vendor_for_url("https://www.leboncoin.fr/recherche?text=guitare")
    assert vendor == "leboncoin"

    vendor = get_vendor_for_url("https://www.unknown-site.com/search?q=guitar")
    assert vendor is None


def test_leboncoin_scraper_page_type():
    """Test LeBonCoin scraper page type detection."""
    # Search page
    page_type = LeboncoinScraper.find_page_type(
        "https://www.leboncoin.fr/recherche?text=guitare"
    )
    assert page_type == "search"

    # Product page
    page_type = LeboncoinScraper.find_page_type("https://www.leboncoin.fr/ad/12345")
    assert page_type == "product"

    # Unknown page
    page_type = LeboncoinScraper.find_page_type("https://www.leboncoin.fr/help")
    assert page_type is None


@patch("backend.scrape.vendors.leboncoin.BeautifulSoup")
def test_extract_product_details(mock_bs, mock_html_content):
    """Test extracting product details from HTML."""
    soup = BeautifulSoup(mock_html_content, "html.parser")

    # Test title extraction
    title = LeboncoinScraper.extract_product_title(soup)
    assert title == "Guitare acoustique"

    # Test description extraction
    description = LeboncoinScraper.extract_product_description(soup)
    assert description == "Belle guitare acoustique en parfait état"

    # Test image extraction
    images = LeboncoinScraper.extract_product_images(soup)
    assert len(images) == 2
    assert images[0] == "https://example.com/image1.jpg"
    assert images[1] == "https://example.com/image2.jpg"


@patch("backend.scrape.vendors.leboncoin.BeautifulSoup")
def test_extract_product_urls(mock_bs, mock_search_html):
    """Test extracting product URLs from search results."""
    soup = BeautifulSoup(mock_search_html, "html.parser")

    urls = LeboncoinScraper.extract_product_urls(soup)
    assert len(urls) == 2
    assert urls[0] == "https://www.leboncoin.fr/ad/instruments_de_musique/1234567890"
    assert urls[1] == "https://www.leboncoin.fr/ad/instruments_de_musique/9876543210"


@patch("backend.scrape.LeboncoinScraper.create")
@patch("backend.scrape.LeboncoinScraper.scrape_product_detail")
async def test_scrape_product_integration(mock_scrape_detail, mock_create):
    """Test the scrape_product function with integration approach."""
    from backend.scrape import scrape_product

    # Create mock product
    mock_product = Product(
        url="https://www.leboncoin.fr/ad/instruments_de_musique/1234567890",
        title="Guitare acoustique",
        description="Belle guitare acoustique en parfait état",
    )
    mock_product.id = 1234567890
    mock_product.vendor = "leboncoin"

    # Setup mocks
    mock_scraper = AsyncMock()
    mock_create.return_value = mock_scraper
    mock_scraper.scrape_product_detail = AsyncMock(return_value=mock_product)

    # Call the function
    result = await scrape_product(
        "https://www.leboncoin.fr/ad/instruments_de_musique/1234567890"
    )

    # Verify results
    assert result is not None
    assert result.id == 1234567890
    assert result.vendor == "leboncoin"
    assert result.title == "Guitare acoustique"


if __name__ == "__main__":
    asyncio.run(test_scrape_product_integration())
