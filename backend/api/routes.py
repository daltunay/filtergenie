import asyncio
import traceback

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from backend.analyzer import Analyzer
from backend.analyzer.models import FilterModel
from backend.auth.middleware import verify_api_key
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
    log.debug(f"Processing item {idx + 1}", platform=platform)
    try:
        item = await cached_scrape_item(session, platform=platform, html=item_request.html)
        log.debug(f"ItemModel {idx + 1} scraped successfully", platform=platform, item=item)
    except Exception as e:
        log.error(
            f"Failed to scrape item {idx + 1}",
            platform=platform,
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
            title=item.title,
            matched_filters=matched_count,
            total_filters=len(filter_models),
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
        tasks = [
            _analyze_single_item(i, item, request.filters, analyzer, session)
            for i, item in enumerate(request.items)
        ]
        results = await asyncio.gather(*tasks)
        analyzed_results = [r[1] for r in sorted(results, key=lambda x: x[0])]

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
