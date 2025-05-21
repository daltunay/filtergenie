import traceback

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.analyzer import Analyzer
from backend.analyzer.models import FilterModel
from backend.auth import verify_api_key
from backend.common.cache import clear_cache
from backend.common.db import sessionmanager
from backend.common.logging import log
from backend.dependencies import get_analyzer, get_db_session

from .models import AnalysisRequest, AnalysisResponse, ItemSource
from .services import analyze_item as analyze_item_service
from .services import (
    get_cached_analysis_result,
    get_cached_scraped_item,
    scrape_and_truncate_images,
    write_analysis_result_cache,
    write_scraped_item_cache,
)

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


@authenticated_router.get("/auth/check")
async def check_api_auth():
    """Check API authentication validity."""
    return {"status": "ok", "message": "API key is valid."}


@authenticated_router.post("/cache/clear")
async def clear_cache_endpoint(session: AsyncSession = Depends(get_db_session)):
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
    session: AsyncSession,
    max_images: int,
) -> tuple[int, list[FilterModel]]:
    """Process and analyze a single item and return its results with index."""
    platform = item_request.platform
    url = item_request.url
    log.debug(f"Processing item {idx + 1}", platform=platform, url=url)
    async with sessionmanager.session() as task_session:
        try:
            item = await get_cached_scraped_item(
                task_session,
                platform=platform,
                url=url,
                max_images=max_images,
            )
            if item is None:
                item = scrape_and_truncate_images(
                    platform=platform,
                    url=url,
                    html=item_request.html,
                    max_images=max_images,
                )
                await write_scraped_item_cache(task_session, item, max_images)
            log.debug(
                f"ItemModel {idx + 1} scraped successfully",
                platform=platform,
                url=url,
                item=item,
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
            filter_models = [FilterModel(desc=desc) for desc in sorted(filters)]
            analyzed_filters = await get_cached_analysis_result(
                task_session,
                platform=item.platform,
                url=item.url,
                filters=filter_models,
                max_images=max_images,
            )
            if analyzed_filters is None:
                analyzed_filters = await analyze_item_service(analyzer, item, filter_models)
                await write_analysis_result_cache(task_session, item, analyzed_filters, max_images)
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


@authenticated_router.post("/item/analyze", response_model=AnalysisResponse)
async def analyze_item(
    request: AnalysisRequest,
    background_tasks: BackgroundTasks,
    analyzer: Analyzer = Depends(get_analyzer),
    session: AsyncSession = Depends(get_db_session),
):
    log.info("Received analysis request", filters_count=len(request.filters))
    try:
        item = await get_cached_scraped_item(
            session,
            platform=request.item.platform,
            url=request.item.url,
            max_images=request.max_images,
        )
        if item is None:
            item = scrape_and_truncate_images(
                platform=request.item.platform,
                url=request.item.url,
                html=request.item.html,
                max_images=request.max_images,
            )
            background_tasks.add_task(write_scraped_item_cache, session, item, request.max_images)

        filter_models = [FilterModel(desc=desc) for desc in sorted(request.filters)]

        analyzed_filters = await get_cached_analysis_result(
            session,
            platform=item.platform,
            url=item.url,
            filters=filter_models,
            max_images=request.max_images,
        )
        if analyzed_filters is None:
            analyzed_filters = await analyze_item_service(analyzer, item, filter_models)
            background_tasks.add_task(
                write_analysis_result_cache,
                session,
                item,
                analyzed_filters,
                request.max_images,
            )

        matched_count = sum(1 for f in analyzed_filters if f.value)
        log.info(
            "Analysis completed successfully",
            matched_filters=matched_count,
            total_filters=len(filter_models),
        )
        return AnalysisResponse(filters={f.desc: f.value for f in analyzed_filters})
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
