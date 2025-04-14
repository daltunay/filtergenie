from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import HttpUrl

from analyzer import Product, ProductAnalyzer
from scraping import scrape_product

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


@app.post("/scrape", response_model=Product)
async def scrape(url: HttpUrl):
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


@app.post("/validate", response_model=bool)
async def validate(product: Product | HttpUrl):
    """
    Validate if a single product meets all filter criteria.
    Returns a simple boolean indicating if all filters are satisfied.
    """
    try:
        if isinstance(product, HttpUrl):
            product_data = await scrape(product)
            if not product_data:
                raise HTTPException(
                    status_code=404,
                    detail=f"Failed to scrape product from URL: {product}",
                )
            product = product_data
        analyzed_product = analyzer.analyze_product(product)
        return all(filter_.value for filter_ in analyzed_product.filters)

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Validation failed: {str(e)}",
        ) from e


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok"}
