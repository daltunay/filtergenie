from .base import BaseScraper, ScrapedProduct
from .ebay import EbayScraper
from .leboncoin import LeboncoinScraper
from .vinted import VintedScraper

SCRAPERS = [
    LeboncoinScraper,
    VintedScraper,
    EbayScraper,
]


def get_scraper_for_url(url: str) -> BaseScraper | None:
    """Get the appropriate scraper for a given URL."""
    for scraper_class in SCRAPERS:
        if scraper_class.can_handle_url(url):
            return scraper_class()
    return None


def get_scraper_class_for_url(url: str) -> type[BaseScraper] | None:
    """Get the appropriate scraper class for a given URL without instantiating it."""
    for scraper_class in SCRAPERS:
        if scraper_class.can_handle_url(url):
            return scraper_class
    return None


def is_search_page(url: str) -> bool:
    """Determine if a URL is a search page by checking with the appropriate scraper class."""
    scraper_class = get_scraper_class_for_url(url)
    if scraper_class:
        return scraper_class.find_page_type(url) == "search"
    return False


def is_product_page(url: str) -> bool:
    """Determine if a URL is a product page by checking with the appropriate scraper class."""
    scraper_class = get_scraper_class_for_url(url)
    if scraper_class:
        return scraper_class.find_page_type(url) == "product"
    return False


def scrape_product_from_url(url: str) -> ScrapedProduct:
    """Scrape product information from a URL."""
    scraper = get_scraper_for_url(url)
    if not scraper:
        raise ValueError(f"No scraper available for URL: {url}")

    return scraper.scrape_product(url)


def scrape_search_from_url(url: str) -> list[ScrapedProduct]:
    """Scrape search results from a URL."""
    scraper = get_scraper_for_url(url)
    if not scraper:
        raise ValueError(f"No scraper available for URL: {url}")

    if not is_search_page(url):
        raise ValueError(f"URL does not appear to be a search page: {url}")

    return scraper.scrape_search(url)
