import typing as tp
from contextlib import asynccontextmanager

import structlog

from analyzer import Product

from .base import BaseScraper
from .vendors.ebay import EbayScraper
from .vendors.leboncoin import LeboncoinScraper
from .vendors.vinted import VintedScraper

SCRAPERS: list[type[BaseScraper]] = [
    LeboncoinScraper,
    VintedScraper,
    EbayScraper,
]

log = structlog.get_logger()


def get_scraper_class_for_url(url: str) -> type[BaseScraper] | None:
    """Find a suitable scraper class for the given URL."""
    for scraper_class in SCRAPERS:
        if scraper_class.can_handle_url(url):
            return scraper_class
    return None


def get_vendor_for_url(url: str) -> str | None:
    """Determine the vendor for a given URL without creating a scraper instance."""
    scraper_class = get_scraper_class_for_url(url)
    if scraper_class:
        return scraper_class.get_vendor_name()
    return None


def get_product_id_from_url(url: str) -> int | None:
    """Extract the product ID from a URL without creating a scraper instance."""
    scraper_class = get_scraper_class_for_url(url)
    if scraper_class:
        try:
            return scraper_class.extract_product_id(url)
        except Exception:
            log.exception(f"Failed to extract product ID from URL: {url}")
            return None
    return None


@asynccontextmanager
async def get_scraper(url: str) -> tp.AsyncIterator[BaseScraper | None]:
    """Context manager to get and properly close a scraper for a URL."""
    scraper_cls = get_scraper_class_for_url(url)
    if not scraper_cls:
        yield None
        return

    scraper = scraper_cls.__new__(scraper_cls)
    await scraper.__init__()

    try:
        yield scraper
    finally:
        await scraper.close()


async def scrape_product(url: str) -> Product | None:
    """Scrape a product from the given URL."""
    async with get_scraper(url) as scraper:
        if not scraper:
            return None
        return await scraper.scrape_product_detail(url)
