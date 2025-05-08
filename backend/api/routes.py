import asyncio
import traceback

from fastapi import APIRouter, Depends, HTTPException, status

from backend.analyzer.models import Filter, Item
from backend.analyzer.processor import Analyzer
from backend.auth.middleware import verify_api_key
from backend.common.cache import cached, clear_cache
from backend.dependencies import get_analyzer
from backend.scrape import scrape_item_from_html

from .models import AnalysisRequest, AnalysisResponse, ItemSource

public_router = APIRouter()
authenticated_router = APIRouter(dependencies=[Depends(verify_api_key)])


@public_router.get("/")
def index():
    """Index endpoint."""
    return {"message": "Welcome to the FilterGenie API!"}


@public_router.get("/health")
async def health_check():
    """Health check endpoint without authentication."""
    return {"status": "ok"}


@authenticated_router.post("/cache/clear")
async def clear_cache_endpoint():
    """Clear cache entries."""
    try:
        count = await clear_cache()
        return {"status": "success", "entries_cleared": count}

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error clearing cache: {str(e)}",
        ) from e


@authenticated_router.post("/items/analyze", response_model=AnalysisResponse)
async def analyze_items(
    request: AnalysisRequest,
    analyzer: Analyzer = Depends(get_analyzer),
):
    """RESTful endpoint to analyze multiple items based on HTML content."""
    try:

        @cached
        async def cached_scrape_item_from_html(url: str, html: str) -> Item:
            """Cached scrape item from HTML."""
            return scrape_item_from_html(url=url, html=html)

        @cached
        async def cached_analyze_item(item: Item, filters: list[Filter]) -> list[Filter]:
            """Cached analyze item."""
            return await analyzer.analyze_item(item=item, filters=filters)

        async def analyze_single_item(item_request: ItemSource) -> list[Filter]:
            """Process and analyze a single item and return its results."""
            item: Item = await cached_scrape_item_from_html(
                url=item_request.url, html=item_request.html
            )
            analyzed_filters: list[Filter] = await cached_analyze_item(
                item=item,
                filters=[Filter(desc=desc) for desc in request.filters],
            )
            return analyzed_filters

        tasks = [analyze_single_item(item) for item in request.items]
        results = await asyncio.gather(*tasks)
        return AnalysisResponse(
            filters=[{f.desc: f.value for f in analyzed_filters} for analyzed_filters in results]
        )

    except Exception as e:
        error_traceback = traceback.format_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": str(e), "traceback": error_traceback},
        ) from e
