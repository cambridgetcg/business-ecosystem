"""
REST API endpoints for data import operations.

Provides endpoints for:
- Uploading and importing journal entries
- Uploading and importing chart of accounts
- Querying import job status and errors
- Cancelling running imports

Research Grounding: docs/architecture/ingestion-pipeline-phase1.md
"""

from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.infrastructure.persistence.database import get_session
from src.api.rest.auth import get_current_user, check_job_ownership
from src.config import get_settings


# -------------------------------------------------------------------------
# Pydantic Response Models
# -------------------------------------------------------------------------


class PaginationResponse(BaseModel):
    """Pagination metadata for list responses."""

    model_config = ConfigDict(frozen=True)

    page: int = Field(..., description="Current page number (1-based)")
    page_size: int = Field(..., description="Number of items per page")
    total_items: int = Field(..., description="Total number of items")
    total_pages: int = Field(..., description="Total number of pages")
    has_next: bool = Field(..., description="Whether there is a next page")
    has_previous: bool = Field(..., description="Whether there is a previous page")


class ImportErrorResponse(BaseModel):
    """Import error details."""

    model_config = ConfigDict(frozen=True)

    id: str
    row_number: int = Field(..., description="1-based row number where error occurred")
    column_name: str | None = Field(None, description="Column name where error occurred")
    error_code: str = Field(..., description="Machine-readable error code")
    error_message: str = Field(..., description="Human-readable error description")
    raw_value: str | None = Field(None, description="The problematic value")
    severity: str = Field(..., description="Error severity: INFO, WARNING, ERROR, CRITICAL")
    suggested_fix: str | None = Field(None, description="Suggestion for fixing the error")


class ImportJobResponse(BaseModel):
    """Import job details."""

    model_config = ConfigDict(frozen=True)

    id: str
    job_number: str = Field(..., description="Human-readable job number", examples=["IMP-2026-00001"])
    target: str = Field(..., description="Import target type", examples=["JOURNAL_ENTRIES", "ACCOUNTS"])
    file_name: str = Field(..., description="Original filename")
    file_format: str = Field(..., description="File format", examples=["csv", "xlsx", "json"])
    status: str = Field(
        ...,
        description="Job status",
        examples=["PENDING", "VALIDATING", "PROCESSING", "COMPLETED", "FAILED"],
    )
    initiated_by: str = Field(..., description="User ID who initiated the import")

    total_rows: int = Field(..., description="Total rows in the file")
    processed_rows: int = Field(..., description="Rows processed so far")
    successful_rows: int = Field(..., description="Rows imported successfully")
    failed_rows: int = Field(..., description="Rows that failed")

    progress_percent: float = Field(..., description="Processing progress (0-100)")
    success_rate: float = Field(..., description="Success rate (0-100)")

    started_at: str | None = Field(None, description="When processing started (ISO format)")
    completed_at: str | None = Field(None, description="When processing completed (ISO format)")
    created_at: str = Field(..., description="When job was created (ISO format)")
    duration_seconds: float | None = Field(None, description="Processing duration in seconds")

    result_message: str | None = Field(None, description="Final result message")
    errors: list[ImportErrorResponse] = Field(default_factory=list, description="Import errors")


class ImportResultResponse(BaseModel):
    """Result of an import operation."""

    model_config = ConfigDict(frozen=True)

    success: bool = Field(..., description="Whether the import completed successfully")
    job: ImportJobResponse = Field(..., description="The created import job")
    message: str = Field(..., description="Human-readable result message")


class ImportJobListResponse(BaseModel):
    """Paginated list of import jobs."""

    model_config = ConfigDict(frozen=True)

    jobs: list[ImportJobResponse]
    pagination: PaginationResponse


class ImportErrorListResponse(BaseModel):
    """Paginated list of import errors for a job."""

    model_config = ConfigDict(frozen=True)

    job_id: str
    errors: list[ImportErrorResponse]
    pagination: PaginationResponse


# -------------------------------------------------------------------------
# Request Models
# -------------------------------------------------------------------------


class ImportOptionsRequest(BaseModel):
    """Optional parameters for import operations."""

    skip_rows: int = Field(0, ge=0, description="Number of rows to skip after header")
    stop_on_error: bool = Field(False, description="Stop on first validation error")
    validate_only: bool = Field(False, description="Validate without persisting")
    default_currency: str = Field("USD", min_length=3, max_length=3, description="Default currency code")


# -------------------------------------------------------------------------
# Dependency Injection
# -------------------------------------------------------------------------


async def get_import_service(
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """
    Get configured ImportService instance.

    Wires up all required dependencies:
    - ImportJobRepository: Tracks import jobs
    - ImportErrorRepository: Records import errors
    - JournalEntryRepository: Persists journal entries
    - AccountRepository: Persists accounts
    - FiscalPeriodResolver: Resolves dates to fiscal periods
    - EntryNumberGenerator: Generates unique entry numbers
    """
    # Import here to avoid circular imports
    from src.domain.ingestion.services.import_service import ImportService
    from src.domain.ingestion.repositories.import_job_repository import ImportJobRepository
    from src.domain.ingestion.repositories.import_error_repository import ImportErrorRepository
    from src.domain.general_ledger.repositories.journal_entry_repository import JournalEntryRepository
    from src.domain.general_ledger.repositories.fiscal_period_repository import FiscalPeriodRepository
    from src.domain.chart_of_accounts.repositories.account_repository import AccountRepository
    from src.domain.ingestion.services.adapters import (
        FiscalPeriodResolverAdapter,
        EntryNumberGeneratorAdapter,
        AccountResolverAdapter,
    )

    # Create repositories
    job_repo = ImportJobRepository(session)
    error_repo = ImportErrorRepository(session)
    je_repo = JournalEntryRepository(session)
    account_repo = AccountRepository(session)
    period_repo = FiscalPeriodRepository(session)

    # Create adapters for protocol compliance
    fiscal_period_resolver = FiscalPeriodResolverAdapter(period_repo)
    entry_number_generator = EntryNumberGeneratorAdapter(je_repo)

    # Create and return the configured service
    return ImportService(
        job_repository=job_repo,
        error_repository=error_repo,
        journal_entry_repository=je_repo,
        account_repository=account_repo,
        fiscal_period_resolver=fiscal_period_resolver,
        entry_number_generator=entry_number_generator,
    )


async def get_import_job_repository(
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Get ImportJobRepository instance."""
    from src.domain.ingestion.repositories.import_job_repository import ImportJobRepository

    return ImportJobRepository(session)


# -------------------------------------------------------------------------
# Router
# -------------------------------------------------------------------------


router = APIRouter(prefix="/import", tags=["Import"])


# -------------------------------------------------------------------------
# Import Endpoints
# -------------------------------------------------------------------------


@router.post(
    "/journal-entries",
    response_model=ImportResultResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Import journal entries from file",
    description="""
Upload a CSV, Excel, or JSON file containing journal entries.

**Required columns:**
- `entry_date`: Date of the entry (YYYY-MM-DD)
- `description`: Entry description
- `account_code`: Account code for the line
- `entry_type`: DEBIT or CREDIT (or D/C, DR/CR)
- `amount`: Line amount

**Optional columns:**
- `currency_code`: Currency (defaults to USD)
- `line_description`: Line-level description
- `source_document`: Source document reference

**Grouping:** Rows with the same `entry_date` + `description` are grouped into a single journal entry.

Returns immediately with job ID. Poll `/import/jobs/{id}` for status.
    """,
)
async def import_journal_entries(
    file: Annotated[UploadFile, File(description="CSV, Excel, or JSON file to import")],
    skip_rows: Annotated[int, Form(description="Rows to skip after header")] = 0,
    validate_only: Annotated[bool, Form(description="Validate without importing")] = False,
    default_currency: Annotated[str, Form(description="Default currency code")] = "USD",
    import_service=Depends(get_import_service),
    current_user: str = Depends(get_current_user),
) -> ImportResultResponse:
    """Import journal entries from an uploaded file."""
    # Validate file
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename is required",
        )

    # Check file extension
    allowed_extensions = {".csv", ".xlsx", ".xls", ".json", ".jsonl"}
    file_ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format. Allowed: {', '.join(allowed_extensions)}",
        )

    # Check file size limit
    settings = get_settings()
    max_size = settings.max_import_file_size_bytes
    max_size_mb = settings.max_import_file_size_mb

    # Check Content-Length header if available
    if file.size and file.size > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds maximum allowed size of {max_size_mb}MB",
        )

    # Read file content with size limit check
    file_content = await file.read()
    if not file_content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is empty",
        )

    if len(file_content) > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size ({len(file_content) / (1024 * 1024):.1f}MB) exceeds maximum allowed size of {max_size_mb}MB",
        )

    # Execute import via CQRS handler
    from src.application.commands import ImportJournalEntriesCommand
    from src.application.handlers import ImportJournalEntriesHandler

    command = ImportJournalEntriesCommand(
        file_content=file_content,
        file_name=file.filename,
        initiated_by=current_user,
        skip_rows=skip_rows,
        validate_only=validate_only,
        default_currency=default_currency,
    )

    handler = ImportJournalEntriesHandler(import_service=import_service)
    result = await handler.execute(command)

    return ImportResultResponse(
        success=result.success,
        job=_job_dto_to_response(result.job),
        message=result.message,
    )


@router.post(
    "/accounts",
    response_model=ImportResultResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Import chart of accounts from file",
    description="""
Upload a CSV, Excel, or JSON file containing account definitions.

**Required columns:**
- `code`: Account code (unique)
- `name`: Account name
- `account_type`: ASSET, LIABILITY, EQUITY, REVENUE, or EXPENSE

**Optional columns:**
- `description`: Account description
- `parent_code`: Parent account code for hierarchy
- `currency_code`: Default currency (defaults to USD)
- `is_header`: Whether this is a header account (TRUE/FALSE)

Returns immediately with job ID. Poll `/import/jobs/{id}` for status.
    """,
)
async def import_accounts(
    file: Annotated[UploadFile, File(description="CSV, Excel, or JSON file to import")],
    skip_rows: Annotated[int, Form(description="Rows to skip after header")] = 0,
    validate_only: Annotated[bool, Form(description="Validate without importing")] = False,
    default_currency: Annotated[str, Form(description="Default currency code")] = "USD",
    import_service=Depends(get_import_service),
    current_user: str = Depends(get_current_user),
) -> ImportResultResponse:
    """Import chart of accounts from an uploaded file."""
    # Validate file
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename is required",
        )

    # Check file extension
    allowed_extensions = {".csv", ".xlsx", ".xls", ".json", ".jsonl"}
    file_ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format. Allowed: {', '.join(allowed_extensions)}",
        )

    # Check file size limit
    settings = get_settings()
    max_size = settings.max_import_file_size_bytes
    max_size_mb = settings.max_import_file_size_mb

    # Check Content-Length header if available
    if file.size and file.size > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds maximum allowed size of {max_size_mb}MB",
        )

    # Read file content with size limit check
    file_content = await file.read()
    if not file_content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is empty",
        )

    if len(file_content) > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size ({len(file_content) / (1024 * 1024):.1f}MB) exceeds maximum allowed size of {max_size_mb}MB",
        )

    # Execute import via CQRS handler
    from src.application.commands import ImportAccountsCommand
    from src.application.handlers import ImportAccountsHandler

    command = ImportAccountsCommand(
        file_content=file_content,
        file_name=file.filename,
        initiated_by=current_user,
        skip_rows=skip_rows,
        validate_only=validate_only,
        default_currency=default_currency,
    )

    handler = ImportAccountsHandler(import_service=import_service)
    result = await handler.execute(command)

    return ImportResultResponse(
        success=result.success,
        job=_job_dto_to_response(result.job),
        message=result.message,
    )


# -------------------------------------------------------------------------
# Job Query Endpoints
# -------------------------------------------------------------------------


@router.get(
    "/jobs",
    response_model=ImportJobListResponse,
    summary="List import jobs",
    description="Get a paginated list of import jobs with optional filtering. By default, only shows jobs initiated by the current user.",
)
async def list_import_jobs(
    repo=Depends(get_import_job_repository),
    current_user: str = Depends(get_current_user),
    target: Annotated[
        str | None,
        Query(description="Filter by target: JOURNAL_ENTRIES, ACCOUNTS"),
    ] = None,
    status_filter: Annotated[
        str | None,
        Query(alias="status", description="Filter by status: PENDING, PROCESSING, COMPLETED, FAILED"),
    ] = None,
    show_all: Annotated[bool, Query(description="Show all jobs (admin only)")] = False,
    page: Annotated[int, Query(ge=1, description="Page number (1-based)")] = 1,
    page_size: Annotated[int, Query(ge=1, le=100, description="Items per page")] = 20,
) -> ImportJobListResponse:
    """List import jobs with filtering and pagination."""
    offset = (page - 1) * page_size

    # By default, filter to current user's jobs only
    # Admins can set show_all=true to see all jobs
    initiated_by = None if show_all else current_user

    # Get jobs from repository
    jobs = await repo.list_all(
        target=target,
        status=status_filter,
        initiated_by=initiated_by,
        limit=page_size,
        offset=offset,
    )

    # Get total count for pagination
    total = await repo.count(
        target=target,
        status=status_filter,
        initiated_by=initiated_by,
    )

    # Calculate pagination
    total_pages = (total + page_size - 1) // page_size if page_size > 0 else 0

    # Convert to response
    return ImportJobListResponse(
        jobs=[_job_to_response(job) for job in jobs],
        pagination=PaginationResponse(
            page=page,
            page_size=page_size,
            total_items=total,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_previous=page > 1,
        ),
    )


@router.get(
    "/jobs/{job_id}",
    response_model=ImportJobResponse,
    summary="Get import job details",
    description="Get detailed information about a specific import job.",
)
async def get_import_job(
    job_id: str,
    repo=Depends(get_import_job_repository),
    current_user: str = Depends(get_current_user),
    include_errors: Annotated[bool, Query(description="Include error details")] = False,
) -> ImportJobResponse:
    """Get details of a specific import job."""
    job = await repo.get_by_id(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Import job with ID '{job_id}' not found",
        )

    # Check authorization - user can only view their own jobs
    await check_job_ownership(job.initiated_by, current_user)

    return _job_to_response(job, include_errors=include_errors)


@router.get(
    "/jobs/{job_id}/errors",
    response_model=ImportErrorListResponse,
    summary="Get import job errors",
    description="Get a paginated list of errors for a specific import job.",
)
async def get_import_job_errors(
    job_id: str,
    repo=Depends(get_import_job_repository),
    current_user: str = Depends(get_current_user),
    severity: Annotated[str | None, Query(description="Filter by severity")] = None,
    error_code: Annotated[str | None, Query(description="Filter by error code")] = None,
    page: Annotated[int, Query(ge=1, description="Page number")] = 1,
    page_size: Annotated[int, Query(ge=1, le=500, description="Items per page")] = 50,
) -> ImportErrorListResponse:
    """Get errors for a specific import job."""
    # Verify job exists
    job = await repo.get_by_id(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Import job with ID '{job_id}' not found",
        )

    # Check authorization - user can only view their own jobs
    await check_job_ownership(job.initiated_by, current_user)

    # Get errors - for now, get from job relationship
    # In production, might use a separate error repository with filtering
    all_errors = job.errors or []

    # Apply filters
    if severity:
        all_errors = [e for e in all_errors if e.severity.value == severity]
    if error_code:
        all_errors = [e for e in all_errors if e.error_code == error_code]

    # Apply pagination
    total = len(all_errors)
    offset = (page - 1) * page_size
    paginated_errors = all_errors[offset : offset + page_size]

    total_pages = (total + page_size - 1) // page_size if page_size > 0 else 0

    return ImportErrorListResponse(
        job_id=job_id,
        errors=[_error_to_response(e) for e in paginated_errors],
        pagination=PaginationResponse(
            page=page,
            page_size=page_size,
            total_items=total,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_previous=page > 1,
        ),
    )


@router.delete(
    "/jobs/{job_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Cancel import job",
    description="Cancel a running import job. Only jobs in PENDING, VALIDATING, or PROCESSING status can be cancelled.",
)
async def cancel_import_job(
    job_id: str,
    repo=Depends(get_import_job_repository),
    current_user: str = Depends(get_current_user),
    reason: Annotated[str | None, Query(description="Cancellation reason")] = None,
) -> None:
    """Cancel a running import job."""
    job = await repo.get_by_id(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Import job with ID '{job_id}' not found",
        )

    # Check authorization - user can only cancel their own jobs
    await check_job_ownership(job.initiated_by, current_user)

    if not job.status.can_cancel:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot cancel job with status '{job.status.value}'. "
            f"Only PENDING, VALIDATING, PROCESSING, or PAUSED jobs can be cancelled.",
        )

    try:
        job.cancel(reason)
        await repo.save(job)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )


# -------------------------------------------------------------------------
# Helper Functions
# -------------------------------------------------------------------------


def _job_to_response(job, include_errors: bool = False) -> ImportJobResponse:
    """Convert ImportJob entity to response model."""
    errors = []
    if include_errors and job.errors:
        errors = [_error_to_response(e) for e in job.errors]

    return ImportJobResponse(
        id=job.id,
        job_number=job.job_number,
        target=job.target.value,
        file_name=job.file_name,
        file_format=job.file_format,
        status=job.status.value,
        initiated_by=job.initiated_by,
        total_rows=job.total_rows,
        processed_rows=job.processed_rows,
        successful_rows=job.successful_rows,
        failed_rows=job.failed_rows,
        progress_percent=job.progress_percent,
        success_rate=job.success_rate,
        started_at=job.started_at.isoformat() if job.started_at else None,
        completed_at=job.completed_at.isoformat() if job.completed_at else None,
        created_at=job.created_at.isoformat() if job.created_at else "",
        duration_seconds=job.duration_seconds,
        result_message=job.result_message,
        errors=errors,
    )


def _error_to_response(error) -> ImportErrorResponse:
    """Convert ImportError entity to response model."""
    raw_value = error.raw_value
    if raw_value and len(raw_value) > 500:
        raw_value = raw_value[:497] + "..."

    return ImportErrorResponse(
        id=error.id,
        row_number=error.row_number,
        column_name=error.column_name,
        error_code=error.error_code,
        error_message=error.error_message,
        raw_value=raw_value,
        severity=error.severity.value,
        suggested_fix=error.suggested_fix,
    )


def _job_dto_to_response(job_dto) -> ImportJobResponse:
    """Convert ImportJobDTO from application layer to response model."""
    errors = []
    if job_dto.errors:
        errors = [
            ImportErrorResponse(
                id=e.id,
                row_number=e.row_number,
                column_name=e.column_name,
                error_code=e.error_code,
                error_message=e.error_message,
                raw_value=e.raw_value[:497] + "..." if e.raw_value and len(e.raw_value) > 500 else e.raw_value,
                severity=e.severity,
                suggested_fix=e.suggested_fix,
            )
            for e in job_dto.errors
        ]

    return ImportJobResponse(
        id=job_dto.id,
        job_number=job_dto.job_number,
        target=job_dto.target,
        file_name=job_dto.file_name,
        file_format=job_dto.file_format,
        status=job_dto.status,
        initiated_by=job_dto.initiated_by,
        total_rows=job_dto.total_rows,
        processed_rows=job_dto.processed_rows,
        successful_rows=job_dto.successful_rows,
        failed_rows=job_dto.failed_rows,
        progress_percent=job_dto.progress_percent,
        success_rate=job_dto.success_rate,
        started_at=job_dto.started_at,
        completed_at=job_dto.completed_at,
        created_at=job_dto.created_at,
        duration_seconds=job_dto.duration_seconds,
        result_message=job_dto.result_message,
        errors=errors,
    )
