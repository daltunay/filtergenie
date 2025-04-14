from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl

from product_analyzer import Item, ProductAnalyzer
from scraping import ScrapedProduct, get_page_type, get_scraper_class_for_url
from scraping.base import BaseScraper

app = FastAPI(
    title="E-commerce Smart Filtering API",
    description="API for analyzing products against custom filters",
    version="0.1.0",
)

# Add CORS middleware to allow requests from the Chrome extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify the exact origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize analyzer and scraper pool
analyzer = ProductAnalyzer(use_local=False)
scraper_pool: Dict[str, BaseScraper] = {}


# Request models
class FilterRequest(BaseModel):
    url: HttpUrl
    filters: List[str]
    max_items: Optional[int] = 10


@app.get("/health")
async def health_check():
    """Simple health check endpoint."""
    return {"status": "healthy"}


@app.post("/analyze/product", response_model=Item)
async def analyze_product(request: FilterRequest):
    """Analyze a single product against specified filters."""
    url = str(request.url)
    page_type = get_page_type(url)

    if page_type != "product":
        raise HTTPException(status_code=400, detail="URL is not a valid product page")

    product_data = get_product_data(url)
    if not product_data:
        raise HTTPException(status_code=404, detail="Failed to scrape product")

    # Convert ScrapedProduct to Item with unanalyzed filters
    item = convert_to_item(product_data, request.filters)
    
    # Analyze the item and update its filters
    analyzed_item = analyzer.analyze_item(item)

    return analyzed_item


@app.post("/analyze/search", response_model=List[Item])
async def analyze_search_results(request: FilterRequest):
    """Analyze multiple products from a search page against specified filters."""
    url = str(request.url)
    page_type = get_page_type(url)

    if page_type != "search":
        raise HTTPException(
            status_code=400, detail="URL is not a valid search results page"
        )

    products = get_search_results(url, max_items=request.max_items)
    if not products:
        raise HTTPException(status_code=404, detail="Failed to scrape search results")

    results = []
    for product_data in products:
        item = convert_to_item(product_data, request.filters)
        analyzed_item = analyzer.analyze_item(item)
        results.append(analyzed_item)

    return results


def convert_to_item(product: ScrapedProduct, filters: List[str]) -> Item:
    """Convert a ScrapedProduct to an Item with unanalyzed filters."""
    return Item(
        url=product.url,
        title=product.title,
        description=product.description,
        image_urls=product.image_urls,
        filters={filter_text: None for filter_text in filters}
    )


def get_or_create_scraper(url: str) -> BaseScraper:
    """Get an existing scraper or create a new one for the domain."""
    scraper_class = get_scraper_class_for_url(url)
    if not scraper_class:
        raise HTTPException(status_code=400, detail="Unsupported website")

    domain = scraper_class.__name__
    if domain not in scraper_pool:
        scraper_pool[domain] = scraper_class()

    return scraper_pool[domain]


def get_product_data(url: str) -> ScrapedProduct:
    """Get product data using the scraper pool."""
    scraper = get_or_create_scraper(url)
    return scraper.get_product_from_url(url)


def get_search_results(url: str, max_items: int = 10) -> List[ScrapedProduct]:
    """Get search results using the scraper pool."""
    scraper = get_or_create_scraper(url)
    return scraper.get_products_from_url(url, max_items=max_items)


@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources when the application shuts down."""
    for scraper in scraper_pool.values():
        scraper.close()
