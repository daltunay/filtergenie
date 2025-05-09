import asyncio
import traceback

from fastapi import APIRouter, Depends, HTTPException, status

from backend.analyzer.models import Filter, Item
from backend.analyzer.processor import Analyzer
from backend.auth.middleware import verify_api_key
from backend.common.cache import cached, clear_cache
from backend.common.logging import log
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
        log.info("Clearing cache entries")
        count = await clear_cache()
        log.info("Cache cleared successfully", entries_removed=count)
        return {"status": "success", "entries_cleared": count}

    except Exception as e:
        log.error("Error clearing cache", error=str(e), exc_info=e)
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
    log.info(
        "Received analysis request",
        items_count=len(request.items),
        filters_count=len(request.filters),
    )
    try:

        @cached
        async def cached_scrape_item_from_html(platform: str, html: str) -> Item:
            """Cached scrape item from HTML."""
            return scrape_item_from_html(platform=platform, html=html)

        @cached
        async def cached_analyze_item(item: Item, filters: list[Filter]) -> list[Filter]:
            """Cached analyze item."""
            return await analyzer.analyze_item(item=item, filters=filters)

        async def analyze_single_item(
            item_request: ItemSource, idx: int
        ) -> tuple[int, list[Filter]]:
            """Process and analyze a single item and return its results with index."""
            platform = item_request.platform
            log.debug(f"Processing item {idx + 1}", platform=platform)

            try:
                item: Item = await cached_scrape_item_from_html(
                    platform=platform, html=item_request.html
                )
                log.debug(
                    f"Item {idx + 1} scraped successfully",
                    platform=platform,
                    title=item.title,
                    images_count=len(item.images),
                )
            except Exception as e:
                log.error(
                    f"Failed to scrape item {idx + 1}", platform=platform, error=str(e), exc_info=e
                )
                raise

            try:
                filters = [Filter(desc=desc) for desc in request.filters]
                analyzed_filters: list[Filter] = await cached_analyze_item(
                    item=item, filters=filters
                )

                matched_count = sum(1 for f in analyzed_filters if f.value)

                log.debug(
                    f"Item {idx + 1} analyzed successfully",
                    platform=platform,
                    title=item.title,
                    matched_filters=matched_count,
                    total_filters=len(filters),
                )
                return idx, analyzed_filters
            except Exception as e:
                log.error(
                    f"Failed to analyze item {idx + 1}",
                    platform=platform,
                    title=item.title,
                    error=str(e),
                    exc_info=e,
                )
                raise

        tasks = [analyze_single_item(item, i) for i, item in enumerate(request.items)]
        results = await asyncio.gather(*tasks)

        sorted_results = sorted(results, key=lambda x: x[0])
        analyzed_results = [r[1] for r in sorted_results]

        log.info(
            "Analysis completed successfully",
            items_count=len(request.items),
            filters_processed=len(request.filters) * len(request.items),
        )

        return AnalysisResponse(
            filters=[
                {f.desc: f.value for f in analyzed_filters} for analyzed_filters in analyzed_results
            ]
        )

    except Exception as e:
        error_traceback = traceback.format_exc()
        log.error(
            "Error during analysis",
            error=str(e),
            traceback=error_traceback,
            exc_info=e,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": str(e), "traceback": error_traceback},
        ) from e
