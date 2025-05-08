from contextlib import asynccontextmanager

from asgi_correlation_id import CorrelationIdMiddleware
from fastapi import FastAPI, Request, status
from fastapi.exception_handlers import http_exception_handler
from fastapi.exceptions import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from backend.api.routes import authenticated_router, public_router
from backend.common.db import init_db
from backend.common.logging import log, setup_logging


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware to log requests and responses."""

    async def dispatch(self, request: Request, call_next):
        log.info(
            "Request started",
            method=request.method,
            path=request.url.path,
            client=request.client.host if request.client else "unknown",
        )

        response = await call_next(request)

        log.info(
            "Request completed",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
        )
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown event handler."""
    log.info("Application starting up - initializing database")
    init_db()
    yield
    log.info("Application shutting down")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    setup_logging()

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
        allow_headers=["*", "X-Request-ID"],
        expose_headers=["X-Request-ID"],
    )

    app.add_middleware(
        CorrelationIdMiddleware,
        header_name="X-Request-ID",
        update_request_header=True,
    )

    app.add_middleware(RequestLoggingMiddleware)

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        log.error(
            "Unhandled exception",
            method=request.method,
            path=request.url.path,
            error=str(exc),
            exc_info=exc,
        )
        return await http_exception_handler(
            request,
            HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal Server Error",
            ),
        )

    app.include_router(public_router)
    app.include_router(authenticated_router)
    log.info(
        "Registered API routes",
        public_routes=public_router.routes,
        authenticated_routes=authenticated_router.routes,
    )
    return app


app = create_app()
log.info(
    "API initialized and ready",
    title=app.title,
    version=app.version,
    description=app.description,
)
