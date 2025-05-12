import asyncio
import time
import traceback

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.analyzer import Analyzer
from backend.analyzer.models import FilterModel
from backend.auth import verify_api_key
from backend.common.cache import clear_cache
from backend.common.logging import log
from backend.dependencies import get_analyzer, get_db_session

from .models import AnalysisRequest, AnalysisResponse, ItemSource
from .services import cached_analyze_item, cached_scrape_item

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


@public_router.get("/badge")
async def badge_check():
    """Health check endpoint for badge service."""
    return {
        "schemaVersion": 1,
        "label": "FilterGenie",
        "message": "up",
        "color": "green",
    }


@authenticated_router.get("/auth/check")
async def check_api_auth():
    """Check API authentication validity."""
    return {"status": "ok", "message": "API key is valid."}


@authenticated_router.post("/cache/clear")
async def clear_cache_endpoint(session: Session = Depends(get_db_session)):
    """Clear cache entries."""
    try:
        log.info("Clearing cache entries")
        count = await clear_cache(session=session)
        log.info("Cache cleared successfully", entries_removed=count)
        return {"status": "success", "entries_cleared": count}

    except Exception as e:
        log.error("Error clearing cache", error=str(e), exc_info=e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error clearing cache: {str(e)}",
        ) from e


async def _analyze_single_item(
    idx: int,
    item_request: ItemSource,
    filters: list[str],
    analyzer: Analyzer,
    session: Session,
) -> tuple[int, list[FilterModel]]:
    """Process and analyze a single item and return its results with index."""
    platform = item_request.platform
    url = item_request.url
    log.debug(f"Processing item {idx + 1}", platform=platform, url=url)
    try:
        item = await cached_scrape_item(session, platform=platform, url=url, html=item_request.html)
        log.debug(
            f"ItemModel {idx + 1} scraped successfully", platform=platform, url=url, item=item
        )
    except Exception as e:
        log.error(
            f"Failed to scrape item {idx + 1}",
            platform=platform,
            url=url,
            error=str(e),
            exc_info=e,
        )
        raise

    try:
        filter_models = [FilterModel(desc=desc) for desc in filters]
        analyzed_filters = await cached_analyze_item(session, analyzer, item, filter_models)
        matched_count = sum(1 for f in analyzed_filters if f.value)
        log.debug(
            f"ItemModel {idx + 1} analyzed successfully",
            platform=platform,
            url=url,
            title=item.title,
            matched_filters=matched_count,
            total_filters=len(filter_models),
        )
        return idx, analyzed_filters
    except Exception as e:
        log.error(
            f"Failed to analyze item {idx + 1}",
            platform=platform,
            url=url,
            title=item.title,
            error=str(e),
            exc_info=e,
        )
        raise


@authenticated_router.post("/items/analyze", response_model=AnalysisResponse)
async def analyze_items(
    request: AnalysisRequest,
    analyzer: Analyzer = Depends(get_analyzer),
    session: Session = Depends(get_db_session),
):
    """RESTful endpoint to analyze multiple items based on HTML content."""
    log.info(
        "Received analysis request",
        items_count=len(request.items),
        filters_count=len(request.filters),
    )
    try:
        start_time = time.perf_counter()
        tasks = [
            _analyze_single_item(i, item, request.filters, analyzer, session)
            for i, item in enumerate(request.items)
        ]
        results = await asyncio.gather(*tasks)
        duration = time.perf_counter() - start_time
        avg_duration = duration / len(request.items) if request.items else 0.0
        analyzed_results = [r[1] for r in sorted(results, key=lambda x: x[0])]

        log.info(
            "Analysis completed successfully",
            items_count=len(request.items),
            filters_processed=len(request.filters) * len(request.items),
            duration=f"{duration:.2f}s",
            avg_per_item=f"{avg_duration:.2f}s",
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
