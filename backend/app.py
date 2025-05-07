from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.routes import authenticated_router, public_router
from backend.common.db import init_db
from backend.config import settings

log = structlog.get_logger(__name__=__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Starting the application", config=settings.model_dump())

    init_db()

    yield

    log.info("Shutting down the application")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="Item Filter API",
        description="API for validating items against filters using AI",
        version="1.0.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(public_router)

    app.include_router(authenticated_router)

    return app


app = create_app()
