from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import HttpUrl

from analyzer import Product, ProductAnalyzer
from scrape import get_page_type, scrape_product, scrape_search_page

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

analyzer = ProductAnalyzer(use_local=False)


@app.post("/products/scrape", response_model=Product)
async def scrape_single_product(url: HttpUrl):
    """
    Scrape a product from the given URL.
    Returns the scraped product data.
    """
    try:
        product = scrape_product(url)
        if not product:
            raise HTTPException(
                status_code=404,
                detail=f"Could not find a suitable scraper for URL: {url}",
            )
        return product
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Scraping failed: {str(e)}",
        ) from e


@app.post("/search/products", response_model=list[HttpUrl])
async def list_product_urls(url: HttpUrl, max_products: int = Query(10, ge=1, le=50)):
    """
    Extract product URLs from a search page URL.
    Returns a list of product URLs.
    """
    try:
        page_type = get_page_type(url)
        if page_type != "search":
            raise HTTPException(
                status_code=400,
                detail=f"URL is not a search page: {url}",
            )

        products = scrape_search_page(url, max_products=max_products)
        product_urls = [product.url for product in products]

        return product_urls
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Search scraping failed: {str(e)}",
        ) from e


@app.post("/products/validate", response_model=bool)
async def validate_product(product: Product | HttpUrl):
    """
    Validate if a single product meets all filter criteria.
    Returns a simple boolean indicating if all filters are satisfied.
    """
    try:
        if isinstance(product, HttpUrl):
            product_data = await scrape_single_product(product)
        else:
            product_data = product

        if not product_data:
            raise HTTPException(
                status_code=404,
                detail=f"Failed to scrape product from URL: {product}",
            )
        analyzed_product = analyzer.analyze_product(product_data)
        return all(filter_.value for filter_ in analyzed_product.filters)

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Validation failed: {str(e)}",
        ) from e


@app.post("/products/validate-batch", response_model=list[bool])
async def validate_products_batch(urls: list[HttpUrl]):
    """
    Validate multiple products from a list of URLs against filter criteria.
    Returns a list of booleans indicating if each product meets all filters.
    """
    results = []
    for url in urls:
        try:
            is_valid = await validate_product(url)
            results.append(is_valid)
        except Exception:
            results.append(False)
    return results


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok"}
