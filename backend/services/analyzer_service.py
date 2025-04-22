import structlog

from backend.analyzer import Product, ProductAnalyzer, ProductFilter
from backend.config import settings

log = structlog.get_logger(__name__=__name__)

# Initialize analyzer once at module level
analyzer = ProductAnalyzer(use_local=settings.use_local_model)
log.info("Analyzer initialized", use_local=settings.use_local_model)


async def analyze_product(product: Product, filters: list[str]) -> Product:
    """Apply filters to a product and analyze it."""
    product.filters = [ProductFilter(description=f) for f in filters]
    return await analyzer.analyze_product(product)
