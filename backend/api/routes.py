import asyncio

import structlog
from fastapi import APIRouter, Depends, HTTPException, status

from backend.analyzer import ProductAnalyzer, ProductFilter
from backend.api.models import (
    AnalysisRequest,
    AnalysisResponse,
    BatchFilterRequest,
    ExtensionResponse,
    ProductResponse,
)
from backend.auth.middleware import verify_api_key
from backend.common.cache import cached, clear_cache
from backend.config import settings
from backend.scrape import get_product_id_from_url, scrape_product

# Create logger
log = structlog.get_logger(name="api")

# Initialize analyzer
analyzer = ProductAnalyzer(use_local=settings.use_local_model)

# Create nested routers
api_router = APIRouter()
system_router = APIRouter(prefix="/system", tags=["System"])
products_router = APIRouter(prefix="/products", tags=["Products"])
filters_router = APIRouter(prefix="/filters", tags=["Filters"])
extension_router = APIRouter(prefix="/extension", tags=["Extension"])

# Public router for health checks (no auth)
public_router = APIRouter(tags=["System"])


@public_router.get("/health")
async def health_check():
    """Health check endpoint without authentication."""
    return {"status": "ok"}


@system_router.post("/cache/clear")
async def clear_cache_api():
    """Clear the application cache."""
    clear_cache()
    return {"status": "ok", "message": "Cache cleared"}


@products_router.get("/{product_url:path}", response_model=ProductResponse)
@cached
async def get_product(product_url: str):
    """Get information for a specific product by URL."""
    try:
        if not product_url.startswith(("http://", "https://")):
            product_url = f"https://{product_url}"

        product = await scrape_product(product_url)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        return {
            "id": product.id,
            "url": str(product.url),
            "title": product.title,
            "vendor": product.vendor,
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error fetching product: {str(e)}"
        ) from e


@products_router.post("/analyze", response_model=AnalysisResponse)
@cached
async def analyze_product(product_url: str, request: AnalysisRequest):
    """Analyze a product against provided filters."""
    try:
        log.debug(
            "Analyzing product",
            url=product_url,
            num_filters=len(request.filters),
        )

        product = await scrape_product(product_url)
        if not product:
            log.warning("Product not found", url=product_url)
            raise HTTPException(status_code=404, detail="Product not found")

        product.filters = [
            ProductFilter(description=filter_desc) for filter_desc in request.filters
        ]

        analyzed_product = await analyzer.analyze_product(product)

        if analyzed_product.matches_filters:
            log.info(
                "Product matched filters",
                product_id=analyzed_product.id,
                url=product_url,
            )

        return {
            "id": analyzed_product.id,
            "url": str(analyzed_product.url),
            "title": analyzed_product.title,
            "matches_filters": analyzed_product.matches_filters,
            "filters": [
                {"description": f.description, "value": f.value}
                for f in analyzed_product.filters
            ],
        }
    except Exception as e:
        log.error("Analysis error", url=product_url, error=str(e), exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Error analyzing product: {str(e)}"
        ) from e


@cached
async def analyze_product_safely(url: str, filters: list[str], product_id: int):
    """Analyze a product and handle exceptions gracefully for batch processing."""
    try:
        # Sort filters for consistent cache keys
        sorted_filters = sorted(filters)

        product = await scrape_product(url)
        if not product:
            log.warning("Product not found during batch processing", url=url)
            return None

        if product.id != product_id:
            log.warning(
                "Product ID mismatch",
                expected=product_id,
                actual=product.id,
                url=url,
            )
            product_id = product.id

        product.filters = [ProductFilter(description=f) for f in sorted_filters]

        # Analyze the product (this is already cached internally by the analyzer)
        analyzed_product = await analyzer.analyze_product(product)

        return {
            "url": str(url),
            "id": product.id,
            "title": analyzed_product.title,
            "matches_filters": analyzed_product.matches_filters,
            "filters": [
                {"description": f.description, "value": f.value}
                for f in analyzed_product.filters
            ],
        }
    except Exception as e:
        log.error("Product analysis failed", url=url, error=str(e), exc_info=True)
        return None


@filters_router.post("/batch", response_model=ExtensionResponse)
@cached
async def batch_filter_products(request: BatchFilterRequest):
    """Filter multiple products in batch against provided filters."""
    try:
        product_urls = request.product_urls[: request.max_products]
        log.info(
            "Batch request received",
            num_urls=len(product_urls),
            filters=request.filters,
        )

        if not product_urls:
            return {"products": []}

        tasks = []
        for url in product_urls:
            product_id = get_product_id_from_url(url)
            if product_id:
                tasks.append(analyze_product_safely(url, request.filters, product_id))

        start_time = __import__("time").time()
        results = await asyncio.gather(*tasks)
        duration = __import__("time").time() - start_time

        valid_results = [result for result in results if result is not None]

        for result in valid_results:
            if "filters" in result:
                result["match_count"] = sum(
                    1 for f in result["filters"] if f.get("value", False)
                )
                result["total_filters"] = len(result["filters"])

        matched_results = [r for r in valid_results if r["matches_filters"]]

        log.info(
            "Batch analysis complete",
            total=len(product_urls),
            successful=len(valid_results),
            matched=len(matched_results),
            duration_seconds=round(duration, 2),
        )

        return {"products": valid_results}

    except Exception as e:
        log.error("Batch filter error", error=str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error filtering products: {str(e)}",
        ) from e


@extension_router.get("/validate-url")
async def validate_url(url: str):
    """
    Check if a URL is supported and determine its type.
    """
    from backend.scrape import get_scraper_class_for_url

    scraper_class = get_scraper_class_for_url(url)
    if not scraper_class:
        return {"supported": False}

    page_type = scraper_class.find_page_type(url)
    return {
        "supported": True,
        "vendor": scraper_class.get_vendor_name(),
        "page_type": page_type,
        "is_search_page": page_type == "search",
    }


@extension_router.post("/filter", response_model=ExtensionResponse)
@cached
async def extension_filter_products(request: BatchFilterRequest):
    """Endpoint for Chrome extension to filter multiple products."""
    return await batch_filter_products(request)


# Include all routers
api_router.include_router(public_router)
api_router.include_router(system_router)
api_router.include_router(products_router)
api_router.include_router(filters_router)
api_router.include_router(extension_router)

# Create the main authenticated router
router = APIRouter(dependencies=[Depends(verify_api_key)])
router.include_router(api_router)
