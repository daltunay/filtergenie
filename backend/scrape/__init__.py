"""Item scraping functionality."""

from loguru import logger

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


def scrape_item_from_html(url: str, html: str) -> Item:
    """Scrape an item from HTML content using the appropriate scraper class."""
    for scraper_class in REGISTERED_SCRAPERS:
        if scraper_class.can_handle_url(url):
            logger.debug(f"Using {scraper_class.PLATFORM} scraper for URL: {url}")
            break
    else:
        logger.error(f"No suitable scraper found for URL: {url}")
        raise ValueError(f"No suitable scraper found for URL: {url}")

    try:
        scraper = scraper_class()
        item = scraper.scrape_item_detail(html)
        logger.debug(f"Successfully scraped item: {item.title[:30]}...")
        return item
    except Exception as e:
        logger.error(f"Error scraping item from URL {url}: {str(e)}")
        raise


__all__ = ["scrape_item_from_html"]
