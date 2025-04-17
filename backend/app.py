from contextlib import asynccontextmanager

import structlog
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.routes import router as api_router
from backend.auth.middleware import verify_api_key
from backend.config import settings

log = structlog.get_logger(name="app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup event code
    log.info("Starting the application", config=settings.model_dump())
    yield
    # Shutdown event code
    log.info("Shutting down the application")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="Product Filter API",
        description="API for validating products against filters using AI",
        version="1.0.0",
        dependencies=[Depends(verify_api_key)],  # Apply API key auth globally
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

    # Include API routes
    app.include_router(api_router)

    return app


app = create_app()
