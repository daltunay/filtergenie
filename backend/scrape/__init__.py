"""Item scraping functionality."""

from backend.analyzer import Item
from backend.common.logging import log

from .base import BaseScraper
from .platforms.ebay import EbayScraper
from .platforms.leboncoin import LeboncoinScraper
from .platforms.vinted import VintedScraper

SCRAPER_BY_PLATFORM: dict[str, type[BaseScraper]] = {
    scraper.PLATFORM: scraper for scraper in (LeboncoinScraper, VintedScraper, EbayScraper)
}


def scrape_item(platform: str, html: str) -> Item:
    """Scrape an item from HTML content using the appropriate scraper class."""
    try:
        scraper_class = SCRAPER_BY_PLATFORM[platform]
    except KeyError as e:
        log.error("No scraper found for platform", platform=platform)
        raise ValueError(f"No scraper found for platform: {platform}") from e

    log.debug(
        "Using scraper class",
        platform=platform,
        scraper_class=scraper_class.__name__,
    )

    try:
        scraper = scraper_class()
        item = scraper.scrape_item_detail(html)
        log.debug(
            "Successfully scraped item",
            platform=platform,
            title=item.title,
        )
        return item
    except Exception as e:
        log.error("Error scraping item", platform=platform, error=str(e), exc_info=e)
        raise


__all__ = ["scrape_item"]
