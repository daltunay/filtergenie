import typing as tp
from contextlib import asynccontextmanager

import structlog

from analyzer import Product
from cache import cached

from .base import BaseScraper
from .vendors.ebay import EbayScraper
from .vendors.leboncoin import LeboncoinScraper
from .vendors.vinted import VintedScraper

SCRAPERS: list[type[BaseScraper]] = [
    LeboncoinScraper,
    VintedScraper,
    EbayScraper,
]

log = structlog.get_logger(name="scrape")
log.debug(f"Registered scrapers: {[s.__name__ for s in SCRAPERS]}")


def get_scraper_class_for_url(url: str) -> type[BaseScraper] | None:
    """Find a suitable scraper class for the given URL."""
    for scraper_class in SCRAPERS:
        if scraper_class.can_handle_url(url):
            log.debug(
                f"Using {scraper_class.__name__} for URL",
                url=url,
                scraper=scraper_class.__name__,
            )
            return scraper_class
    log.warning("No scraper found for URL", url=url)
    return None


def get_vendor_for_url(url: str) -> str | None:
    """Determine the vendor for a given URL without creating a scraper instance."""
    scraper_class = get_scraper_class_for_url(url)
    if scraper_class:
        vendor = scraper_class.get_vendor_name()
        return vendor
    return None


def get_product_id_from_url(url: str) -> int | None:
    """Extract the product ID from a URL without creating a scraper instance."""
    scraper_class = get_scraper_class_for_url(url)
    if scraper_class:
        try:
            product_id = scraper_class.extract_product_id(url)
            return product_id
        except Exception as e:
            log.error(
                "Failed to extract product ID from URL", url=url, exception=str(e)
            )
            return None
    return None


@asynccontextmanager
async def get_scraper(url: str) -> tp.AsyncIterator[BaseScraper | None]:
    """Context manager to get and properly close a scraper for a URL."""
    log.debug("Getting scraper for URL", url=url)
    scraper_cls = get_scraper_class_for_url(url)
    if not scraper_cls:
        log.warning("No suitable scraper found", url=url)
        yield None
        return

    log.debug(f"Initializing {scraper_cls.__name__} for URL", url=url)
    scraper = await scraper_cls.create()

    try:
        yield scraper
    finally:
        log.debug("Closing scraper instance", scraper=scraper_cls.__name__)
        await scraper.close()


@cached
async def scrape_product(url: str) -> Product | None:
    """Scrape a product from the given URL."""
    log.debug("Scraping product", url=url)
    start_time = __import__("time").time()

    async with get_scraper(url) as scraper:
        if not scraper:
            log.warning("No scraper available for URL", url=url)
            return None

        product = await scraper.scrape_product_detail(url)

    duration = __import__("time").time() - start_time
    if duration > 5:
        log.info(
            "Product scraping completed",
            url=url,
            product_id=product.id,
            vendor=product.vendor,
            duration_seconds=round(duration, 2),
        )
    else:
        log.debug(
            "Product scraped",
            url=url,
            product_id=product.id,
            duration_seconds=round(duration, 2),
        )

    return product
