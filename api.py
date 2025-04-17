import asyncio
import hashlib
import os

import structlog
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from analyzer import ProductAnalyzer, ProductFilter
from auth import get_api_key
from cache import _cache, cached, clear_cache
from scrape import get_product_id_from_url, get_scraper_class_for_url, scrape_product

log = structlog.get_logger(name="api")

app = FastAPI(
    title="Product Filter API",
    description="API for validating products against filters",
    dependencies=[Depends(get_api_key)],  # Apply API key auth globally
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

analyzer = ProductAnalyzer(
    use_local=os.getenv("USE_LOCAL", "false").lower() in ["1", "true", "yes"],
)


class ProductRequest(BaseModel):
    url: str


class ProductResponse(BaseModel):
    id: int | None
    url: str
    title: str
    vendor: str | None


class AnalysisRequest(BaseModel):
    filters: list[str]


class AnalysisResponse(BaseModel):
    id: int | None
    url: str
    title: str
    matches_filters: bool
    filters: list[dict]


class BatchFilterRequest(BaseModel):
    filters: list[str]
    product_urls: list[str]
    max_products: int = 10


class ExtensionResponse(BaseModel):
    products: list[dict]


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok"}


@app.post("/cache/clear")
async def clear_cache_endpoint():
    """Clear the application cache."""
    clear_cache()
    return {"status": "ok", "message": "Cache cleared"}


@app.get(
    "/product/{product_url:path}",
    response_model=ProductResponse,
)
@cached
async def get_product(product_url: str):
    """Scrape and return product information."""
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


@app.post(
    "/product/analyze",
    response_model=AnalysisResponse,
)
@cached
async def analyze_product_endpoint(product_url: str, request: AnalysisRequest):
    """Analyze a product against the provided filters."""
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


async def analyze_product_safely(url: str, filters: list[str], product_id: int):
    """Analyze a product and handle exceptions gracefully for batch processing."""
    try:
        sorted_filters = sorted(filters)
        url_snippet = url[:50]
        cache_key = (
            f"analyze_safely:{product_id}:{url_snippet}:{','.join(sorted_filters)}"
        )
        cache_hash = hashlib.md5(cache_key.encode(), usedforsecurity=False).hexdigest()

        if cache_hash in _cache:
            log.debug(
                "Using cached analysis result",
                product_id=product_id,
                url=url,
            )
            return _cache[cache_hash]

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

        analyzer_key = f"analyzer:{product.id}:{url_snippet}:{','.join(sorted_filters)}"
        analyzer_hash = hashlib.md5(
            analyzer_key.encode(), usedforsecurity=False
        ).hexdigest()

        if analyzer_hash in _cache:
            log.debug(
                "Using cached analyzer result",
                product_id=product.id,
                url=url,
            )
            analyzed_product = _cache[analyzer_hash]
        else:
            log.debug(
                "Analyzing product",
                product_id=product.id,
                url=url,
                filter_count=len(product.filters),
            )
            analyzed_product = await analyzer.analyze_product(product)
            _cache[analyzer_hash] = analyzed_product

        result = {
            "url": str(url),
            "id": product.id,
            "title": analyzed_product.title,
            "matches_filters": analyzed_product.matches_filters,
            "filters": [
                {"description": f.description, "value": f.value}
                for f in analyzed_product.filters
            ],
        }

        _cache[cache_hash] = result

        return result
    except Exception as e:
        log.error("Product analysis failed", url=url, error=str(e), exc_info=True)
        return None


@app.post(
    "/extension/filter",
    response_model=ExtensionResponse,
)
@cached
async def extension_filter(request: BatchFilterRequest):
    """Simplified endpoint for Chrome extension integration, using parallel analysis."""
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


@app.get("/extension/check-url")
async def check_url(url: str):
    """
    Check if a URL is supported by any scraper and return relevant information.
    """
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


@app.exception_handler(Exception)
async def generic_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"detail": f"An unexpected error occurred: {str(exc)}"},
    )
