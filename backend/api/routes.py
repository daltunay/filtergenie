import asyncio

import structlog
from fastapi import APIRouter, Depends, HTTPException, status

from backend.analyzer import Product, ProductAnalyzer, ProductFilter
from backend.api.models import ExtensionResponse, ProductsAnalysisRequest
from backend.auth.middleware import verify_api_key
from backend.common.cache import cached, clear_cache
from backend.config import settings
from backend.scrape import scrape_product

# Create logger
log = structlog.get_logger(name="api")

# Initialize analyzer
analyzer = ProductAnalyzer(use_local=settings.use_local_model)

# Create routers with proper organization
public_router = APIRouter(tags=["System"])
api_router = APIRouter()
products_router = APIRouter(prefix="/products", tags=["Products"])
vendors_router = APIRouter(prefix="/vendors", tags=["Vendors"])


@public_router.get("/health")
async def health_check():
    """Health check endpoint without authentication."""
    return {"status": "ok"}


@api_router.post("/system/cache/clear")
async def clear_cache_api():
    """Clear the application cache."""
    clear_cache()
    return {"status": "ok", "message": "Cache cleared"}


@cached
async def analyze_product(
    url: str, filters: list[str], html_content: str
) -> dict | None:
    """
    Analyze a single product with caching.

    Args:
        url: The product URL (used for identification)
        filters: List of filter descriptions to apply
        html_content: HTML content to parse
    """
    try:
        start_time = __import__("time").time()

        product = await scrape_product(html_content)

        if not product:
            log.warning("Product not found during analysis", url=url)
            return None

        product.filters = [ProductFilter(description=f) for f in filters]
        analyzed_product = await analyzer.analyze_product(product)

        result = {
            "url": str(url),
            "id": product.id,
            "title": analyzed_product.title,
            "matches_all_filters": analyzed_product.matches_all_filters,
            "filters": [
                {"description": f.description, "value": f.value}
                for f in analyzed_product.filters
            ],
            "match_count": sum(1 for f in analyzed_product.filters if f.value),
            "total_filters": len(analyzed_product.filters),
        }

        duration = __import__("time").time() - start_time
        if duration > 0.5:
            log.info(
                "Product analysis completed",
                url=url,
                duration_seconds=round(duration, 2),
            )

        return result
    except Exception as e:
        log.error("Product analysis failed", url=url, error=str(e), exc_info=True)
        return None


def _convert_to_dict(result):
    """Convert result to dictionary if it's a Product object, otherwise return as is."""
    if isinstance(result, Product):
        return result.to_extension_dict()
    return result  # It's already a dict


@products_router.post("/analyze", response_model=ExtensionResponse)
async def analyze_products(request: ProductsAnalysisRequest):
    """
    RESTful endpoint to analyze multiple products based on HTML content.
    """
    try:
        log.info(
            "Product analysis request",
            product_count=len(request.products),
            filters=request.filters,
        )

        if not request.products:
            return {"products": []}

        tasks = []
        for product in request.products:
            tasks.append(
                analyze_product(str(product.url), request.filters, product.html)
            )

        start_time = __import__("time").time()
        results = await asyncio.gather(*tasks)
        duration = __import__("time").time() - start_time

        valid_results = [result for result in results if result is not None]

        # Convert all Product objects to dictionaries
        valid_results = [_convert_to_dict(r) for r in valid_results]

        matched_results = [r for r in valid_results if r["matches_all_filters"]]

        log.info(
            "Product analysis complete",
            total=len(request.products),
            successful=len(valid_results),
            matched=len(matched_results),
            duration_seconds=round(duration, 2),
        )

        return {"products": valid_results}

    except Exception as e:
        log.error("Analysis error", error=str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error analyzing products: {str(e)}",
        ) from e


# Include all routers in the main router
api_router.include_router(products_router)
api_router.include_router(vendors_router)

# Create the main authenticated router with a more descriptive name
authenticated_router = APIRouter(dependencies=[Depends(verify_api_key)])
authenticated_router.include_router(api_router)
