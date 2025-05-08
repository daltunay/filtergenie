"""Item scraping functionality."""

from backend.analyzer.models import Item

from .base import BaseScraper
from .platforms.ebay import EbayScraper
from .platforms.leboncoin import LeboncoinScraper
from .platforms.vinted import VintedScraper

REGISTERED_SCRAPERS: list[type[BaseScraper]] = [
    LeboncoinScraper,
    VintedScraper,
    EbayScraper,
]


def scrape_item_from_html(url: str, html_content: str) -> Item:
    """Scrape an item from HTML content using the appropriate scraper class."""
    for scraper_class in REGISTERED_SCRAPERS:
        if scraper_class.can_handle_url(url):
            break
    else:
        raise ValueError(f"No suitable scraper found for URL: {url}")
    scraper = scraper_class()
    item = scraper.scrape_item_detail(html_content)
    return item


__all__ = ["scrape_item_from_html"]
