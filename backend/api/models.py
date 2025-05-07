from pydantic import BaseModel

from backend.analyzer.models import Filter


class ScrapedItemInput(BaseModel):
    """Input model for item detail scraping"""

    url: str
    html: str


class FilterAnalysisRequest(BaseModel):
    """Request model for analyzing multiple items against filters"""

    filters: list[str]
    items: list[ScrapedItemInput]


class ItemAnalysis(BaseModel):
    """Analysis result for a single item"""

    url: str
    filters: list[Filter]
