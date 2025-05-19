from pydantic import BaseModel


class ItemSource(BaseModel):
    """Input model for item detail scraping"""

    platform: str
    url: str
    html: str


class AnalysisRequest(BaseModel):
    """Request model for analyzing multiple items against filters"""

    items: list[ItemSource]
    filters: list[str]
    max_images_per_item: int


class AnalysisResponse(BaseModel):
    """Response model for the analyzer endpoint"""

    filters: list[dict[str, bool]]
