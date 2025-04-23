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
    platform: str | None = None


class AnalysisRequest(BaseModel):
    """Request model for product analysis"""

    filters: list[str] = Field(..., description="List of filter descriptions to check")
    url: HttpUrl = Field(..., description="Product URL to analyze")


class AnalysisResponse(ProductBase):
    """Response model with filter analysis results"""

    matches_all_filters: bool
    filters: list[FilterResult]
    match_count: int
    total_filters: int


class ProductHtml(BaseModel):
    """Model for product HTML content"""

    url: HttpUrl
    html: str


class ProductsAnalysisRequest(BaseModel):
    """RESTful request model for analyzing multiple products"""

    filters: list[str] = Field(..., description="List of filter descriptions to apply")
    products: list[ProductHtml] = Field(..., description="Products' HTML to analyze")


class ExtensionResponse(BaseModel):
    """Response model for extension requests"""

    products: list[dict[str, tp.Any]]
