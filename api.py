import asyncio
import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from analyzer import ProductAnalyzer, ProductFilter
from cache import cached, clear_cache
from scrape import (
    get_product_id_from_url,
    scrape_product,
)

app = FastAPI(
    title="Product Filter API",
    description="API for validating products against filters",
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


@app.get("/product/{product_url:path}", response_model=ProductResponse)
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


@app.post("/product/analyze", response_model=AnalysisResponse)
@cached
async def analyze_product_endpoint(product_url: str, request: AnalysisRequest):
    """Analyze a product against the provided filters."""
    try:
        product = await scrape_product(product_url)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        product.filters = [
            ProductFilter(description=filter_desc) for filter_desc in request.filters
        ]

        analyzed_product = analyzer.analyze_product(product)

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
        raise HTTPException(
            status_code=500, detail=f"Error analyzing product: {str(e)}"
        ) from e


async def analyze_product_safely(url: str, filters: list[str], product_id: int):
    """Analyze a product and handle exceptions gracefully for batch processing."""
    try:
        analyzed_product = await analyze_product_endpoint(
            url, AnalysisRequest(filters=filters)
        )

        return {
            "url": str(url),
            "id": product_id,
            "title": analyzed_product["title"],
            "matches_filters": analyzed_product["matches_filters"],
            "filters": analyzed_product["filters"],
        }
    except Exception:
        return None


@app.post("/extension/filter", response_model=ExtensionResponse)
async def extension_filter(request: BatchFilterRequest):
    """Simplified endpoint for Chrome extension integration, using cached sub-operations."""
    try:
        product_urls = request.product_urls[: request.max_products]

        if not product_urls:
            return {"products": []}

        tasks = []
        for url in product_urls:
            product_id = get_product_id_from_url(url)
            if product_id:
                tasks.append(analyze_product_safely(url, request.filters, product_id))

        results = await asyncio.gather(*tasks)

        valid_results = [result for result in results if result is not None]

        return {"products": valid_results}

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error filtering products: {str(e)}"
        ) from e


@app.exception_handler(Exception)
async def generic_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"detail": f"An unexpected error occurred: {str(exc)}"},
    )
