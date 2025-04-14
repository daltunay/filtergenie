from .base import BaseScraper, ScrapedProduct
from .ebay import EbayScraper
from .leboncoin import LeboncoinScraper
from .vinted import VintedScraper

SCRAPERS = [
    LeboncoinScraper,
    VintedScraper,
    EbayScraper,
]


def get_scraper_class_for_url(url: str) -> type[BaseScraper] | None:
    """Find a suitable scraper class for the given URL."""
    for scraper_class in SCRAPERS:
        if scraper_class.can_handle_url(url):
            return scraper_class
    return None


def get_page_type(url: str) -> str | None:
    """Determine if the URL is for a product or a search page."""
    scraper_class = get_scraper_class_for_url(url)
    if scraper_class:
        return scraper_class.find_page_type(url)
    return None


# CLI utility functions
# These are only used by the command-line interface and are not needed by the API
def get_scraper_for_url(url: str) -> BaseScraper | None:
    """Get an initialized scraper instance for the given URL (CLI use only)."""
    scraper_class = get_scraper_class_for_url(url)
    if scraper_class:
        return scraper_class()
    return None


def scrape_product(url: str) -> ScrapedProduct | None:
    """Scrape a product from the given URL (CLI use only)."""
    scraper = get_scraper_for_url(url)
    if not scraper:
        return None

    try:
        return scraper.get_product_from_url(url)
    finally:
        scraper.close()


def scrape_search_results(url: str, max_items: int = 5) -> list[ScrapedProduct]:
    """Scrape search results from the given URL (CLI use only)."""
    scraper = get_scraper_for_url(url)
    if not scraper:
        return []

    try:
        return scraper.get_products_from_url(url, max_items=max_items)
    finally:
        scraper.close()


__all__ = [
    "BaseScraper",
    "ScrapedProduct",
    "get_scraper_class_for_url",
    "get_page_type",
]
