from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from backend.api.routes import authenticated_router, public_router
from backend.common.db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Application starting up - initializing database")
    init_db()
    yield
    logger.info("Application shutting down")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="FilterGenie API",
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

    logger.info("Registering API routes")
    app.include_router(public_router)
    app.include_router(authenticated_router)

    return app


app = create_app()
logger.info("FilterGenie API initialized and ready")
