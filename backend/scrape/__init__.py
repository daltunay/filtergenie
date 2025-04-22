"""Product scraping functionality."""

import structlog

from backend.analyzer import Product
from backend.scrape.base import BaseScraper
from backend.scrape.vendors.ebay import EbayScraper
from backend.scrape.vendors.leboncoin import LeboncoinScraper
from backend.scrape.vendors.vinted import VintedScraper

# Set up logger
log = structlog.get_logger(__name__=__name__)

# Register scrapers at module level
REGISTERED_SCRAPERS: list[type[BaseScraper]] = [
    LeboncoinScraper,
    VintedScraper,
    EbayScraper,
]
log.debug(f"Registered scrapers: {[s.__name__ for s in REGISTERED_SCRAPERS]}")


def get_scraper_class_for_url(url: str) -> type[BaseScraper] | None:
    """Find a suitable scraper class for the given URL."""
    for scraper_class in REGISTERED_SCRAPERS:
        if scraper_class.can_handle_url(url):
            return scraper_class
    return None


def get_scraper_for_url(url: str) -> BaseScraper | None:
    """Find and instantiate a suitable scraper for the given URL."""
    scraper_class = get_scraper_class_for_url(url)
    if scraper_class:
        log.debug(f"Using {scraper_class.__name__} for URL", url=url)
        return scraper_class()
    log.warning("No scraper found for URL", url=url)
    return None


def get_product_info_from_url(url: str) -> tuple[str | None, int | None]:
    """Extract the vendor name and product ID from a URL."""
    scraper_class = get_scraper_class_for_url(url)
    if scraper_class:
        try:
            vendor = scraper_class.get_vendor_name()
            product_id = scraper_class.extract_product_id(url)
            return vendor, product_id
        except Exception as e:
            log.error(
                "Failed to extract vendor and product ID from URL",
                url=url,
                exception=str(e),
            )
    return None, None


async def scrape_product_from_html(html_content: str, url: str) -> Product | None:
    """Scrape a product from HTML content using the appropriate scraper."""
    scraper = get_scraper_for_url(url)
    if not scraper:
        return None

    product = scraper.scrape_product_detail(html_content, url)

    # Set vendor and ID directly
    if product.url:
        product.vendor, product.id = get_product_info_from_url(str(product.url))

    return product


__all__ = ["scrape_product_from_html"]
