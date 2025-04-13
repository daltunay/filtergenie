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


def scrape_product_from_url(url: str) -> ScrapedProduct:
    """Scrape product information from a URL."""
    scraper = get_scraper_for_url(url)
    if not scraper:
        raise ValueError(f"No scraper available for URL: {url}")

    return scraper.scrape(url)
