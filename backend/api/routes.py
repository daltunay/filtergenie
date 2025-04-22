import asyncio

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import HttpUrl

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
from backend.scrape import scrape_product

# Create logger
log = structlog.get_logger(name="api")

# Initialize analyzer
analyzer = ProductAnalyzer(use_local=settings.use_local_model)

# Create routers with proper organization
public_router = APIRouter(tags=["System"])
api_router = APIRouter()
products_router = APIRouter(prefix="/products", tags=["Products"])
filters_router = APIRouter(prefix="/filters", tags=["Filters"])
extension_router = APIRouter(prefix="/extension", tags=["Extension"])


@public_router.get("/health")
async def health_check():
    """Health check endpoint without authentication."""
    return {"status": "ok"}


@api_router.post("/system/cache/clear")
async def clear_cache_api():
    """Clear the application cache."""
    clear_cache()
    return {"status": "ok", "message": "Cache cleared"}


@products_router.get("/{product_url:path}", response_model=ProductResponse)
@cached
async def get_product_info(product_url: str):
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
async def analyze_product_api(request: AnalysisRequest):
    """Analyze a product against provided filters."""
    try:
        product_url = str(request.url)

        log.debug(
            "Analyzing product",
            url=product_url,
            num_filters=len(request.filters),
        )

        result = await analyze_single_product(product_url, request.filters)
        if not result:
            raise HTTPException(
                status_code=404, detail="Product not found or analysis failed"
            )

        return {
            "id": result["id"],
            "url": result["url"],
            "title": result["title"],
            "matches_all_filters": result["matches_all_filters"],
            "filters": result["filters"],
        }
    except HTTPException:
        raise
    except Exception as e:
        log.error("Analysis error", url=str(request.url), error=str(e), exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Error analyzing product: {str(e)}"
        ) from e


@cached
async def analyze_single_product(url: str, filters: list[str]) -> dict | None:
    """
    Analyze a single product with caching.
    This is the core function that should be cached to maximize reuse across different batch requests.
    """
    try:
        product = await scrape_product(url)
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

        return result
    except Exception as e:
        log.error("Product analysis failed", url=url, error=str(e), exc_info=True)
        return None


@filters_router.post("/batch", response_model=ExtensionResponse)
async def batch_filter_products(request: BatchFilterRequest):
    """
    Filter multiple products in batch against provided filters.
    Not cached directly since we want to cache at the individual product level.
    """
    try:
        product_urls = [
            str(url) for url in request.product_urls[: request.max_products]
        ]
        log.info(
            "Batch request received",
            num_urls=len(product_urls),
            filters=request.filters,
        )

        if not product_urls:
            return {"products": []}

        tasks = []
        for url in product_urls:
            tasks.append(analyze_single_product(url, request.filters))

        start_time = __import__("time").time()
        results = await asyncio.gather(*tasks)
        duration = __import__("time").time() - start_time

        valid_results = [result for result in results if result is not None]
        matched_results = [r for r in valid_results if r["matches_all_filters"]]

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
async def validate_url(url: HttpUrl):
    """Check if a URL is supported and determine its type."""
    from backend.scrape import get_scraper_class_for_url

    url_str = str(url)
    scraper_class = get_scraper_class_for_url(url_str)
    if not scraper_class:
        return {"supported": False}

    page_type = scraper_class.find_page_type(url_str)
    return {
        "supported": True,
        "vendor": scraper_class.get_vendor_name(),
        "page_type": page_type,
        "is_search_page": page_type == "search",
    }


@extension_router.post("/filter", response_model=ExtensionResponse)
async def extension_filter_products(request: BatchFilterRequest):
    """Endpoint for Chrome extension to filter multiple products."""
    return await batch_filter_products(request)


# Include all routers in the main router
api_router.include_router(products_router)
api_router.include_router(filters_router)
api_router.include_router(extension_router)

# Create the main authenticated router
router = APIRouter(dependencies=[Depends(verify_api_key)])
router.include_router(api_router)
