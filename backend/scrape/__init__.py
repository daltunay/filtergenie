"""Item scraping functionality."""

from backend.analyzer.models import Item
from backend.common.logging import log

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
            log.debug("Using scraper", url=url, platform=scraper_class.PLATFORM)
            break
    else:
        log.error("No suitable scraper found", url=url)
        raise ValueError(f"No suitable scraper found for URL: {url}")

    try:
        scraper = scraper_class()
        item = scraper.scrape_item_detail(html)
        log.debug(
            "Successfully scraped item",
            url=url,
            title=item.title,
            platform=item.platform,
        )
        return item
    except Exception as e:
        log.error("Error scraping item", url=url, error=str(e), exc_info=e)
        raise


__all__ = ["scrape_item_from_html"]
