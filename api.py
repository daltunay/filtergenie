import asyncio
import os

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import AnyHttpUrl, BaseModel

from analyzer import Product, ProductAnalyzer, ProductFilter
from cache import cached, clear_cache
from scrape import (
    get_page_type,
    get_product_id_from_url,
    get_scraper,
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


class FilterBadgeRequest(BaseModel):
    filters: list[ProductFilter]
    container_class: str | None = "smart-filter-results"


class FilterRequest(BaseModel):
    url: str
    filters: list[str]
    product_ids: list[int] | None = None
    max_products: int = 5


class ProductIdRequest(BaseModel):
    urls: list[str]


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok"}


@app.post("/cache/clear")
async def clear_cache_endpoint():
    """Clear the application cache."""
    clear_cache()
    return {"status": "ok", "message": "Cache cleared"}


@app.post("/extract/product_ids")
@cached
async def extract_product_ids(request: ProductIdRequest):
    """Extract product IDs from product URLs."""
    try:
        result = {}
        for url in request.urls:
            product_id = get_product_id_from_url(url)
            if product_id:
                result[url] = product_id
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error extracting product IDs: {str(e)}"
        ) from e


@app.post("/render/filter_badges", response_class=HTMLResponse)
@cached
async def render_filter_badges(request: FilterBadgeRequest):
    """Generate HTML for filter badges."""
    try:
        # Create a simpler, more reliable badge container
        container_class = request.container_class or "smart-filter-results"

        html = f"""
        <div class="{container_class}" style="
            position: absolute;
            top: 0;
            left: 0;
            width: auto;
            display: flex;
            flex-direction: column;
            gap: 4px;
            padding: 5px;
            pointer-events: none;
            z-index: 1000;
        ">
        """

        # Create simple, compact badges
        for i, filter_ in enumerate(request.filters):
            bg_color = (
                "rgba(46,204,113,0.9)" if filter_.value else "rgba(231,76,60,0.9)"
            )
            status = "✓" if filter_.value else "✗"

            html += f"""
            <div class="smart-filter-badge" style="
                background-color: {bg_color};
                border-radius: 4px;
                padding: 3px 6px;
                font-size: 12px;
                color: white;
                box-shadow: 0 1px 2px rgba(0,0,0,0.2);
                max-width: 180px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                pointer-events: auto;
                font-weight: bold;
            ">
                {status} {filter_.description}
            </div>
            """

        html += "</div>"
        return html

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error rendering badges: {str(e)}"
        ) from e


@app.post("/filter", response_model=dict)
@cached
async def filter_products(request: FilterRequest):
    """Filter products based on specified criteria."""
    try:
        page_type = get_page_type(request.url)
        if page_type != "search":
            raise HTTPException(status_code=400, detail="URL must be a search page")

        async with get_scraper(request.url) as scraper:
            if not scraper:
                raise HTTPException(
                    status_code=400, detail="No suitable scraper for the URL"
                )

            soup = await scraper.fetch_page(request.url)
            product_urls = scraper.extract_product_urls(soup)[: request.max_products]

            if request.product_ids:
                url_id_pairs = [
                    (url, get_product_id_from_url(url)) for url in product_urls
                ]
                product_urls = [
                    url for url, id in url_id_pairs if id in request.product_ids
                ]

            if not product_urls:
                return {"products": [], "url_id_map": {}}

            url_id_map = {url: get_product_id_from_url(url) for url in product_urls}

            products = await asyncio.gather(
                *[scraper.scrape_product_detail(url) for url in product_urls]
            )

            filtered_products = []
            for product in products:
                if product:
                    product.filters = [
                        ProductFilter(description=filter_desc)
                        for filter_desc in request.filters
                    ]
                    analyzed_product = analyzer.analyze_product(product)
                    filtered_products.append(analyzed_product)

        return {"products": filtered_products, "url_id_map": url_id_map}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error filtering products: {str(e)}"
        ) from e


@app.get("/scrape/product", response_model=Product)
@cached
async def scrape_single_product(
    url: AnyHttpUrl = Query(..., description="URL of the product to scrape")
):
    """Scrape a single product from a product page URL."""
    try:
        page_type = get_page_type(str(url))
        if page_type != "product":
            raise HTTPException(status_code=400, detail="URL must be a product page")

        product = await scrape_product(str(url))
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        return product

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error scraping product: {str(e)}"
        ) from e


@app.exception_handler(Exception)
async def generic_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"detail": f"An unexpected error occurred: {str(exc)}"},
    )
