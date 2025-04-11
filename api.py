from fastapi import FastAPI, HTTPException

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
    try:
        product = ProductInput(
            image_url_or_path=product_input.get("image_url", ""),
            description=product_input.get("description", ""),
            filters=product_input.get("filters", []),
        )

        response = analyzer.analyze_product(product)
        filters = response.model_dump()
        return filters

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}") from e


@app.get("/health")
async def health_check():
    """Simple health check endpoint."""
    return {"status": "healthy"}
