from fastapi import FastAPI

from main import ProductAnalyzer, ProductInput

app = FastAPI(
    title="E-commerce Smart Filtering API",
    description="API for analyzing products against custom filters",
    version="0.1.0",
)

analyzer = ProductAnalyzer(use_local=False)


@app.post("/analyze", response_model=dict[str, bool])
async def analyze_product(product_input: dict):
    """Analyze a product against provided filters."""
    product = ProductInput(
        title=product_input.get("title", ""),
        description=product_input.get("description", ""),
        image_urls_or_paths=product_input.get("image_urls_or_paths", []),
        filters=product_input.get("filters", []),
    )

    response = analyzer.analyze_product(product)
    filters = response.model_dump()
    return filters


@app.get("/health")
async def health_check():
    """Simple health check endpoint."""
    return {"status": "healthy"}
