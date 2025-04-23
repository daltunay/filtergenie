import asyncio
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.routes import authenticated_router, public_router
from backend.common.cache import cache_cleanup_task
from backend.config import settings

log = structlog.get_logger(__name__=__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup event code
    log.info(
        "Starting the application",
        config=settings.model_dump(exclude={"api_key", "gemini_api_key"}),
    )

    # Start background cache cleanup task
    cleanup_task = asyncio.create_task(cache_cleanup_task())

    yield

    # Shutdown event code
    cleanup_task.cancel()
    log.info("Shutting down the application")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="Product Filter API",
        description="API for validating products against filters using AI",
        version="1.0.0",
        lifespan=lifespan,
    )

    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include public routes first (without authentication)
    app.include_router(public_router)

    # Include authenticated API routes
    app.include_router(authenticated_router)

    return app


app = create_app()
