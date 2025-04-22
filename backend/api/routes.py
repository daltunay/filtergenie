import asyncio

import structlog
from fastapi import APIRouter, Depends, HTTPException, status

from backend.api.models import ExtensionResponse, ProductsAnalysisRequest
from backend.auth.middleware import verify_api_key
from backend.services.product_service import process_product

# Create logger
log = structlog.get_logger(__name__=__name__)

# Create routers with proper organization
public_router = APIRouter(tags=["System"])
authenticated_router = APIRouter(dependencies=[Depends(verify_api_key)])


@public_router.get("/health")
async def health_check():
    """Health check endpoint without authentication."""
    return {"status": "ok"}


@authenticated_router.post(
    "/products/analyze", response_model=ExtensionResponse, tags=["Products"]
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

        # Create tasks for each product using the service
        tasks = [
            process_product(
                url=str(product.url),
                filters=request.filters,
                html_content=product.html,
            )
            for product in request.products
        ]

        # Run all tasks concurrently
        start_time = __import__("time").time()
        results = await asyncio.gather(*tasks)
        duration = __import__("time").time() - start_time

        # Filter out failed results
        valid_results = [result for result in results if result is not None]
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
