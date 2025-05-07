import asyncio

import structlog
from fastapi import APIRouter, Depends, HTTPException, status

from backend.api.models import ProductAnalysisResponse, ProductsAnalysisRequest
from backend.auth.middleware import verify_api_key
from backend.common.cache import clear_cache  # Import the clear_cache function
from backend.services.analyzer_service import analyze_product
from backend.services.scraper_service import process_product_from_html

log = structlog.get_logger(__name__=__name__)

public_router = APIRouter(tags=["System"])
authenticated_router = APIRouter(dependencies=[Depends(verify_api_key)])


@public_router.get("/health")
async def health_check():
    """Health check endpoint without authentication."""
    return {"status": "ok"}


@authenticated_router.post("/cache/clear", response_model=dict, tags=["System"])
async def clear_cache_endpoint():
    """Clear cache entries."""
    try:
        log.info("Cache clearing requested")

        count = await clear_cache()

        result = {
            "status": "success",
            "entries_cleared": count,
        }

        return result

    except Exception as e:
        log.error("Cache clearing error", error=str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error clearing cache: {str(e)}",
        ) from e


@authenticated_router.post(
    "/products/analyze", response_model=ProductAnalysisResponse, tags=["Products"]
)
async def analyze_products(request: ProductsAnalysisRequest):
    """RESTful endpoint to analyze multiple products based on HTML content."""
    try:
        log.info(
            "Product analysis request",
            product_count=len(request.products),
            filters=request.filters,
        )

        if not request.products:
            return {"products": []}

        tasks = []
        for product_data in request.products:
            url = str(product_data.url)
            html = product_data.html
            tasks.append(process_and_analyze(url, html, request.filters))

        start_time = __import__("time").time()
        results = await asyncio.gather(*tasks)
        duration = __import__("time").time() - start_time

        valid_results = [result for result in results if result is not None]

        log.info(
            "Product analysis complete",
            total=len(request.products),
            successful=len(valid_results),
            duration_seconds=round(duration, 2),
        )

        return {"products": valid_results}

    except Exception as e:
        log.error("Analysis error", error=str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error analyzing products: {str(e)}",
        ) from e


async def process_and_analyze(url: str, html: str, filters: list[str]) -> dict | None:
    """Process and analyze a single product."""
    try:
        product = await process_product_from_html(url, html)
        if not product:
            return None

        analyzed_product, analyzed_filters = await analyze_product(product, filters)

        # Construct response dictionary directly
        match_count = sum(1 for f in analyzed_filters if f.value)
        total_filters = len(analyzed_filters)

        # Convert to the response format
        return {
            "url": analyzed_product.url,
            "id": analyzed_product.id,
            "title": analyzed_product.title,
            "platform": analyzed_product.platform,
            "matches_all_filters": bool(analyzed_filters)
            and all(f.value for f in analyzed_filters),
            "filters": [{"description": f.description, "value": f.value} for f in analyzed_filters],
            "match_count": match_count,
            "total_filters": total_filters,
        }

    except Exception as e:
        log.error("Product processing failed", url=url, error=str(e), exc_info=True)
        return None
