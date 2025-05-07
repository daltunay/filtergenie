import asyncio

import structlog
from fastapi import APIRouter, Depends, HTTPException, status

from backend.analyzer.models import Filter, Item
from backend.analyzer.processor import Analyzer
from backend.api.models import (
    FilterAnalysisRequest,
    ItemAnalysis,
    ScrapedItemInput,
)
from backend.auth.middleware import verify_api_key
from backend.common.cache import cached, clear_cache
from backend.dependencies import get_analyzer
from backend.scrape import scrape_item_from_html

log = structlog.get_logger(__name__=__name__)

public_router = APIRouter()
authenticated_router = APIRouter(dependencies=[Depends(verify_api_key)])


@public_router.get("/health", response_model=dict, tags=["System"])
async def health_check():
    """Health check endpoint without authentication."""
    return {"status": "ok"}


@authenticated_router.post("/cache/clear", response_model=dict, tags=["System"])
async def clear_cache_endpoint():
    """Clear cache entries."""
    try:
        log.info("Cache clearing requested")
        count = await clear_cache()
        return {"status": "success", "entries_cleared": count}

    except Exception as e:
        log.error("Cache clearing error", error=str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error clearing cache: {str(e)}",
        ) from e


@cached
def scrape_item(url: str, html_content: str) -> Item:
    """Scrape an item with caching."""
    return scrape_item_from_html(url, html_content)


@authenticated_router.post("/items/analyze", response_model=list[ItemAnalysis], tags=["Items"])
async def analyze_items(request: FilterAnalysisRequest, analyzer: Analyzer = Depends(get_analyzer)):
    """RESTful endpoint to analyze multiple items based on HTML content."""
    try:
        log.info(
            "Item analysis request",
            item_count=len(request.items),
            filters=request.filters,
        )

        async def analyze_single_item(item_request: ScrapedItemInput):
            """Process and analyze a single item and return its results."""
            item: Item = scrape_item(item_request.url, item_request.html)
            analyzed_filters: list[Filter] = await analyzer.analyze_item(
                item, [Filter(description=desc) for desc in request.filters]
            )
            return ItemAnalysis(url=item_request.url, filters=analyzed_filters)

        tasks = [analyze_single_item(item) for item in request.items]
        results = await asyncio.gather(*tasks)

        log.info(
            "Item analysis complete",
            total=len(request.items),
            successful=len(results),
        )

        return results

    except Exception as e:
        log.error("Analysis error", error=str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error analyzing items: {str(e)}",
        ) from e
