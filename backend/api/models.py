import typing as tp

from pydantic import BaseModel, Field, HttpUrl


class FilterResult(BaseModel):
    """Represents a filter result with description and match status"""

    description: str
    value: bool


class ProductBase(BaseModel):
    """Base model for product data"""

    id: int | None = None
    url: str
    title: str


class ProductResponse(ProductBase):
    """Simple product response without filter results"""

    vendor: str | None = None


class AnalysisRequest(BaseModel):
    """Request model for product analysis"""

    filters: list[str] = Field(..., description="List of filter descriptions to check")
    url: HttpUrl = Field(..., description="Product URL to analyze")


class AnalysisResponse(ProductBase):
    """Response model with filter analysis results"""

    matches_all_filters: bool
    filters: list[FilterResult]


class BatchFilterRequest(BaseModel):
    """Request model for batch filtering products"""

    filters: list[str] = Field(..., description="List of filter descriptions to apply")
    product_urls: list[HttpUrl] = Field(
        ..., description="List of product URLs to analyze"
    )
    max_products: int = Field(
        10, ge=1, le=50, description="Maximum number of products to process"
    )


class ExtensionResponse(BaseModel):
    """Response model for extension requests"""

    products: list[dict[str, tp.Any]]
