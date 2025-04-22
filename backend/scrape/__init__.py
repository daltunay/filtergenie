import structlog
from bs4 import BeautifulSoup

from backend.analyzer.models import Product
from backend.common.cache import cached

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


def extract_url_from_html(html_content: str) -> str | None:
    """Extract the canonical URL from HTML content."""
    soup = BeautifulSoup(html_content, "html.parser")

    # Try to find canonical URL in the HTML
    link = soup.find("link", rel="canonical")
    if link and link.get("href"):
        url = link.get("href")
        # Handle relative LeBonCoin URLs
        if url.startswith("/ad/") and "leboncoin" not in url:
            return f"https://www.leboncoin.fr{url}"
        return url

    # Try Open Graph URL
    meta = soup.find("meta", property="og:url")
    if meta and meta.get("content"):
        url = meta.get("content")
        # Handle relative LeBonCoin URLs
        if url.startswith("/ad/") and "leboncoin" not in url:
            return f"https://www.leboncoin.fr{url}"
        return url

    return None


@cached
async def scrape_product(html_content: str) -> Product | None:
    """
    Scrape a product from HTML content.

    Args:
        html_content: HTML content to parse
    """
    log.debug("Scraping product from HTML content")
    start_time = __import__("time").time()

    # Extract the URL from HTML content
    canonical_url = extract_url_from_html(html_content)

    if not canonical_url:
        log.warning("Could not determine URL from HTML content")
        return None

    # Find the appropriate scraper
    scraper_cls = get_scraper_class_for_url(canonical_url)
    if not scraper_cls:
        log.warning("No scraper found for URL in HTML content", url=canonical_url)
        return None

    # Create scraper instance and process the HTML
    scraper = scraper_cls()
    product = scraper.scrape_product_detail(html_content)

    duration = __import__("time").time() - start_time
    log.debug(
        "Product scraped",
        url=product.url if product else "unknown",
        product_id=getattr(product, "id", "unknown"),
        duration_seconds=round(duration, 2),
    )

    return product
