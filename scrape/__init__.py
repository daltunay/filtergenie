import asyncio
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


def get_page_type(url: str) -> str | None:
    """Determine if the URL is for a product or a search page."""
    scraper_class = get_scraper_class_for_url(url)
    if scraper_class:
        return scraper_class.find_page_type(url)
    return None


@asynccontextmanager
async def get_scraper(url: str) -> tp.AsyncIterator[BaseScraper | None]:
    """Context manager to get and properly close a scraper for a URL."""
    scraper_cls = get_scraper_class_for_url(url)
    if not scraper_cls:
        yield None
        return

    # Create the instance first
    scraper = scraper_cls.__new__(scraper_cls)
    # Then initialize it
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


async def scrape_search_page(url: str, max_products: int = 5) -> list[Product]:
    """Scrape search results from the given URL."""
    async with get_scraper(url) as scraper:
        if not scraper:
            return []
        return await scraper.scrape_search_results(url, max_products=max_products)


async def scrape_batch(urls: list[str]) -> list[Product]:
    """Scrape multiple URLs in batches using a single scraper per domain."""
    results: list[Product] = []

    url_by_scraper: dict[type[BaseScraper], list[str]] = {}
    for url in urls:
        scraper_cls = get_scraper_class_for_url(url)
        if scraper_cls:
            if scraper_cls not in url_by_scraper:
                url_by_scraper[scraper_cls] = []
            url_by_scraper[scraper_cls].append(url)

    # Process each scraper's URLs in parallel
    batch_results = await asyncio.gather(
        *[
            _process_scraper_batch(scraper_cls, urls)
            for scraper_cls, urls in url_by_scraper.items()
        ]
    )

    # Flatten results
    for batch in batch_results:
        results.extend(batch)

    return results


async def _process_scraper_batch(
    scraper_cls: type[BaseScraper], urls: list[str]
) -> list[Product]:
    """Process a batch of URLs with a single scraper instance."""
    batch_results = []

    # Create the instance
    scraper = scraper_cls.__new__(scraper_cls)
    await scraper.__init__()

    try:
        # Filter URLs to product pages only
        product_urls = [
            url for url in urls if scraper_cls.find_page_type(url) == "product"
        ]

        # Fetch all products in parallel
        products = await asyncio.gather(
            *[scraper.scrape_product_detail(url) for url in product_urls]
        )

        # Add non-None results to batch_results
        batch_results.extend([p for p in products if p])

    finally:
        await scraper.close()

    return batch_results
