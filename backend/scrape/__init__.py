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


def get_scraper_class_for_url(url: str) -> type[BaseScraper] | None:
    """Find a suitable scraper class for the given URL."""
    for scraper_class in REGISTERED_SCRAPERS:
        if scraper_class.can_handle_url(url):
            return scraper_class
    return None


def scrape_item_from_html(url: str, html_content: str) -> Item:
    """Scrape an item from HTML content using the appropriate scraper class."""
    scraper_class = get_scraper_class_for_url(url)
    if not scraper_class:
        raise ValueError(f"No suitable scraper found for URL: {url}")
    scraper = scraper_class()
    item = scraper.scrape_item_detail(html_content)
    return item


__all__ = ["scrape_item_from_html"]
