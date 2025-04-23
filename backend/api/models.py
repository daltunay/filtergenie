import typing as tp

from pydantic import BaseModel, Field, HttpUrl


class ProductHtml(BaseModel):
    """Model for product HTML content"""

    url: HttpUrl
    html: str


class ProductsAnalysisRequest(BaseModel):
    """Request model for analyzing multiple products"""

    filters: list[str] = Field(..., description="List of filter descriptions to apply")
    products: list[ProductHtml] = Field(..., description="Products' HTML to analyze")


class ProductAnalysisResponse(BaseModel):
    """Response model for extension requests"""

    products: list[dict[str, tp.Any]]
