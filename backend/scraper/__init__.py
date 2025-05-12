"""Item scraping functionality."""

import typing as tp

from backend.analyzer.models import ItemModel
from backend.common.logging import log

from .platforms.ebay import EbayScraper
from .platforms.leboncoin import LeboncoinScraper
from .platforms.vinted import VintedScraper

PARSER_BY_PLATFORM: dict[str, tp.Callable[[str], dict[str, str]]] = {
    "vinted": VintedScraper.parse_item,
    "leboncoin": LeboncoinScraper.parse_item,
    "ebay": EbayScraper.parse_item,
}


def scrape_item(platform: str, url: str, html: str) -> ItemModel:
    """Scrape an item from HTML content using the appropriate parser."""
    try:
        item = ItemModel.from_source(platform, url, html)
        log.debug(
            "Successfully scraped item",
            platform=platform,
            url=url,
            title=item.title,
        )
        return item
    except Exception as e:
        log.error("Error scraping item", platform=platform, url=url, error=str(e), exc_info=e)
        raise


__all__ = ["scrape_item", "PARSER_BY_PLATFORM"]
