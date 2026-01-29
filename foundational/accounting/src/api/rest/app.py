"""
FastAPI application factory and configuration.

This is the main entry point for the REST API.
"""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import structlog

from src.config import Settings, get_settings
from src.domain.shared.exceptions import (
    DomainError,
    EntityNotFoundError,
    ValidationError,
)
from src.infrastructure.persistence.database import get_database
from src.api.rest.accounts import router as accounts_router
from src.api.rest.imports import router as imports_router
from src.api.rest.journal_entries import router as journal_entries_router
from src.api.rest.middleware import RateLimitMiddleware


logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager - startup and shutdown."""
    settings = get_settings()
    logger.info("Starting application", environment=settings.environment)

    # Startup
    db = get_database()
    logger.info("Database connection pool initialized")

    yield

    # Shutdown
    await db.close()
    logger.info("Database connection pool closed")
    logger.info("Application shutdown complete")


def create_app(settings: Settings | None = None) -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = settings or get_settings()

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description="Double-entry bookkeeping and financial management API",
        docs_url="/api/docs" if not settings.is_production else None,
        redoc_url="/api/redoc" if not settings.is_production else None,
        openapi_url="/api/openapi.json" if not settings.is_production else None,
        lifespan=lifespan,
    )

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Rate limiting middleware
    app.add_middleware(RateLimitMiddleware)

    # Exception handlers
    @app.exception_handler(ValidationError)
    async def validation_error_handler(
        request: Request, exc: ValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=400,
            content={
                "error": exc.code,
                "message": exc.message,
                "field": exc.field,
            },
        )

    @app.exception_handler(EntityNotFoundError)
    async def not_found_handler(
        request: Request, exc: EntityNotFoundError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=404,
            content={
                "error": exc.code,
                "message": exc.message,
                "entity_type": exc.entity_type,
                "entity_id": exc.entity_id,
            },
        )

    @app.exception_handler(DomainError)
    async def domain_error_handler(
        request: Request, exc: DomainError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "error": exc.code,
                "message": exc.message,
            },
        )

    # Health check endpoint
    @app.get("/health", tags=["Health"])
    async def health_check() -> dict[str, str]:
        """Health check endpoint for load balancers and monitoring."""
        return {"status": "healthy"}

    @app.get("/", tags=["Health"])
    async def root() -> dict[str, str]:
        """Root endpoint with API information."""
        return {
            "name": settings.app_name,
            "version": "0.1.0",
            "docs": "/api/docs",
        }

    # Register routers
    # Register domain routers
    app.include_router(accounts_router, prefix=settings.api_prefix)
    app.include_router(imports_router, prefix=settings.api_prefix)
    app.include_router(journal_entries_router, prefix=settings.api_prefix)
    # app.include_router(reports_router, prefix=settings.api_prefix)

    return app


# Application instance for uvicorn
app = create_app()
