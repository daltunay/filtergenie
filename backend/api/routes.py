import asyncio

import structlog
from fastapi import APIRouter, Depends, HTTPException, status

from backend.api.models import ExtensionResponse, ProductsAnalysisRequest
from backend.auth.middleware import verify_api_key
from backend.services.analyzer_service import analyze_product
from backend.services.scraper_service import process_product_from_html

log = structlog.get_logger(__name__=__name__)

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

        analyzed = await analyze_product(product, filters)
        return analyzed.to_extension_dict()

    except Exception as e:
        log.error("Product processing failed", url=url, error=str(e), exc_info=True)
        return None
