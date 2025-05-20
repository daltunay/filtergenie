from pydantic import BaseModel


class ItemSource(BaseModel):
    """Input model for item detail scraping"""

    platform: str
    url: str
    html: str


class AnalysisRequest(BaseModel):
    """Request model for analyzing a single item against filters"""

    item: ItemSource
    filters: list[str]
    max_images: int


class AnalysisResponse(BaseModel):
    """Response model for the analyzer endpoint"""

    filters: dict[str, bool]
