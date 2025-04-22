import structlog

from backend.services.analyzer_service import analyze_product
from backend.services.scraper_service import process_product_from_html

log = structlog.get_logger(__name__=__name__)


async def process_product(
    url: str, filters: list[str], html_content: str
) -> dict | None:
    """Process a single product and analyze it against filters."""
    try:
        # Scrape the product
        product = await process_product_from_html(url, html_content)
        if not product:
            return None

        # Apply filters and analyze
        analyzed_product = await analyze_product(product, filters)

        # Return dictionary representation
        return analyzed_product.to_extension_dict()
    except Exception as e:
        log.error("Product analysis failed", url=url, error=str(e), exc_info=True)
        return None
