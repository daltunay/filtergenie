import time

import structlog

from backend.analyzer import Product
from backend.common.cache import cached
from backend.scrape import scrape_product_from_html

log = structlog.get_logger(__name__=__name__)


@cached
async def process_product_from_html(url: str, html_content: str) -> Product | None:
    """Process a product from URL and HTML content."""
    start_time = time.time()

    product = await scrape_product_from_html(html_content, url)

    duration = time.time() - start_time
    log.info("Product scraped", url=url, duration_seconds=round(duration, 2))

    return product
