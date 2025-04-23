import structlog

from backend.analyzer import Product, ProductAnalyzer, ProductFilter
from backend.common.cache import async_cache
from backend.config import settings

log = structlog.get_logger(__name__=__name__)

# Initialize analyzer once at module level
analyzer = ProductAnalyzer(use_local=settings.use_local_model)
log.info("Analyzer initialized", use_local=settings.use_local_model)


@async_cache(ttl=1800)  # Cache analysis results for 30 minutes
async def analyze_product(
    product: Product, filter_descriptions: list[str]
) -> tuple[Product, list[ProductFilter]]:
    """Apply filters to a product and analyze it."""
    return await analyzer.analyze_product(product, filter_descriptions)
