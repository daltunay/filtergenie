import traceback

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status

from backend.analyzer import Analyzer
from backend.analyzer.models import FilterModel
from backend.api.models import AnalysisRequest, AnalysisResponse
from backend.api.services import get_or_analyze_filters, get_or_scrape_item
from backend.auth import verify_api_key
from backend.common.cache import clear_cache
from backend.common.logging import log
from backend.dependencies import get_analyzer, get_redis

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
async def clear_cache_endpoint(redis=Depends(get_redis)):
    """Clear cache entries."""
    from backend.config import settings

    if not settings.cache_enabled:
        return {
            "status": "disabled",
            "entries_cleared": None,
            "message": "Cache is disabled or unavailable.",
        }
    try:
        count = await clear_cache()
        return {
            "status": "success",
            "entries_cleared": count,
            "message": "Cache cleared successfully.",
        }
    except Exception as e:
        log.error("Error clearing cache", error=str(e), exc_info=e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error clearing cache: {str(e)}",
        ) from e


@authenticated_router.post("/item/analyze", response_model=AnalysisResponse)
async def analyze_item(
    request: AnalysisRequest,
    background_tasks: BackgroundTasks,
    analyzer: Analyzer = Depends(get_analyzer),
    redis=Depends(get_redis),
):
    try:
        item = await get_or_scrape_item(
            platform=request.item.platform,
            url=request.item.url,
            html=request.item.html,
            max_images=request.max_images,
            background_tasks=background_tasks,
        )

        filter_models = [FilterModel(desc=desc) for desc in sorted(request.filters)]

        analyzed_filters = await get_or_analyze_filters(
            analyzer=analyzer,
            item=item,
            filters=filter_models,
            max_images=request.max_images,
            background_tasks=background_tasks,
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
