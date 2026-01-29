"""
Import DTOs - Data Transfer Objects for import operations.

These DTOs convert domain entities (ImportJob, ImportError) to API-friendly
formats. They are serializable and contain no business logic.

Design Principles:
1. Serializable - all fields are JSON-serializable types
2. Immutable - frozen dataclasses
3. Complete - include all fields needed by API consumers
4. Derived - created from domain entities via factory methods

Research Grounding: docs/architecture/ingestion-pipeline-phase1.md
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from src.domain.ingestion.models.import_job import ImportJob
    from src.domain.ingestion.models.import_error import ImportError as ImportErrorEntity


@dataclass(frozen=True)
class PaginationDTO:
    """
    Pagination metadata for list responses.

    Attributes:
        page: Current page number (1-based)
        page_size: Number of items per page
        total_items: Total number of items
        total_pages: Total number of pages
        has_next: Whether there is a next page
        has_previous: Whether there is a previous page
    """

    page: int
    page_size: int
    total_items: int
    total_pages: int
    has_next: bool
    has_previous: bool

    @classmethod
    def create(cls, page: int, page_size: int, total_items: int) -> "PaginationDTO":
        """Create pagination metadata from query parameters."""
        total_pages = (total_items + page_size - 1) // page_size if page_size > 0 else 0
        return cls(
            page=page,
            page_size=page_size,
            total_items=total_items,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_previous=page > 1,
        )


@dataclass(frozen=True)
class ImportErrorDTO:
    """
    DTO for import error details.

    Attributes:
        id: Error ID
        row_number: 1-based row number where error occurred
        column_name: Column name where error occurred (if applicable)
        error_code: Machine-readable error code
        error_message: Human-readable error description
        raw_value: The problematic value (truncated if too long)
        severity: Error severity level
        suggested_fix: Optional suggestion for fixing the error
    """

    id: str
    row_number: int
    column_name: str | None
    error_code: str
    error_message: str
    raw_value: str | None
    severity: str
    suggested_fix: str | None

    @classmethod
    def from_entity(cls, entity: "ImportErrorEntity") -> "ImportErrorDTO":
        """Create DTO from domain entity."""
        # Truncate raw_value if too long for API response
        raw_value = entity.raw_value
        if raw_value and len(raw_value) > 500:
            raw_value = raw_value[:497] + "..."

        return cls(
            id=entity.id,
            row_number=entity.row_number,
            column_name=entity.column_name,
            error_code=entity.error_code,
            error_message=entity.error_message,
            raw_value=raw_value,
            severity=entity.severity.value,
            suggested_fix=entity.suggested_fix,
        )


@dataclass(frozen=True)
class ImportJobDTO:
    """
    DTO for import job details.

    Attributes:
        id: Job ID
        job_number: Human-readable job number
        target: Import target type
        file_name: Original filename
        file_format: File format
        status: Current job status
        initiated_by: User who initiated the import

        total_rows: Total rows in the file
        processed_rows: Rows processed so far
        successful_rows: Rows imported successfully
        failed_rows: Rows that failed

        progress_percent: Processing progress (0-100)
        success_rate: Success rate (0-100)

        started_at: When processing started (ISO format)
        completed_at: When processing completed (ISO format)
        created_at: When job was created (ISO format)
        duration_seconds: Processing duration in seconds

        result_message: Final result message
        errors: List of errors (if include_errors=True)
    """

    id: str
    job_number: str
    target: str
    file_name: str
    file_format: str
    status: str
    initiated_by: str

    total_rows: int
    processed_rows: int
    successful_rows: int
    failed_rows: int

    progress_percent: float
    success_rate: float

    started_at: str | None
    completed_at: str | None
    created_at: str
    duration_seconds: float | None

    result_message: str | None
    errors: list[ImportErrorDTO] = field(default_factory=list)

    @classmethod
    def from_entity(
        cls,
        entity: "ImportJob",
        include_errors: bool = False,
    ) -> "ImportJobDTO":
        """Create DTO from domain entity."""
        errors: list[ImportErrorDTO] = []
        if include_errors and entity.errors:
            errors = [ImportErrorDTO.from_entity(e) for e in entity.errors]

        return cls(
            id=entity.id,
            job_number=entity.job_number,
            target=entity.target.value,
            file_name=entity.file_name,
            file_format=entity.file_format,
            status=entity.status.value,
            initiated_by=entity.initiated_by,
            total_rows=entity.total_rows,
            processed_rows=entity.processed_rows,
            successful_rows=entity.successful_rows,
            failed_rows=entity.failed_rows,
            progress_percent=entity.progress_percent,
            success_rate=entity.success_rate,
            started_at=entity.started_at.isoformat() if entity.started_at else None,
            completed_at=entity.completed_at.isoformat() if entity.completed_at else None,
            created_at=entity.created_at.isoformat() if entity.created_at else "",
            duration_seconds=entity.duration_seconds,
            result_message=entity.result_message,
            errors=errors,
        )


@dataclass(frozen=True)
class ImportResultDTO:
    """
    DTO for import command result.

    Returned immediately after submitting an import command.

    Attributes:
        success: Whether the import completed (may still have row errors)
        job: The created import job details
        message: Human-readable result message
    """

    success: bool
    job: ImportJobDTO
    message: str

    @classmethod
    def from_result(
        cls,
        success: bool,
        job: "ImportJob",
        message: str | None = None,
    ) -> "ImportResultDTO":
        """Create DTO from import result."""
        if message is None:
            if success:
                message = f"Import completed: {job.successful_rows} rows imported"
                if job.failed_rows > 0:
                    message += f", {job.failed_rows} rows failed"
            else:
                message = job.result_message or "Import failed"

        return cls(
            success=success,
            job=ImportJobDTO.from_entity(job),
            message=message,
        )


@dataclass(frozen=True)
class ImportJobListDTO:
    """
    DTO for paginated list of import jobs.

    Attributes:
        jobs: List of import job DTOs
        pagination: Pagination metadata
    """

    jobs: list[ImportJobDTO]
    pagination: PaginationDTO

    @classmethod
    def from_entities(
        cls,
        entities: list["ImportJob"],
        page: int,
        page_size: int,
        total_items: int,
    ) -> "ImportJobListDTO":
        """Create DTO from list of domain entities."""
        return cls(
            jobs=[ImportJobDTO.from_entity(e) for e in entities],
            pagination=PaginationDTO.create(page, page_size, total_items),
        )


@dataclass(frozen=True)
class ImportErrorListDTO:
    """
    DTO for paginated list of import errors.

    Attributes:
        job_id: ID of the import job
        errors: List of error DTOs
        pagination: Pagination metadata
    """

    job_id: str
    errors: list[ImportErrorDTO]
    pagination: PaginationDTO

    @classmethod
    def from_entities(
        cls,
        job_id: str,
        entities: list["ImportErrorEntity"],
        page: int,
        page_size: int,
        total_items: int,
    ) -> "ImportErrorListDTO":
        """Create DTO from list of domain entities."""
        return cls(
            job_id=job_id,
            errors=[ImportErrorDTO.from_entity(e) for e in entities],
            pagination=PaginationDTO.create(page, page_size, total_items),
        )


@dataclass(frozen=True)
class ImportStatisticsDTO:
    """
    DTO for aggregated import statistics.

    Attributes:
        period_start: Start of the statistics period
        period_end: End of the statistics period
        total_jobs: Total number of import jobs
        completed_jobs: Jobs that completed successfully
        failed_jobs: Jobs that failed
        jobs_with_errors: Jobs that completed with some row errors
        total_rows_processed: Total rows processed across all jobs
        total_rows_imported: Total rows imported successfully
        total_rows_failed: Total rows that failed
        average_success_rate: Average success rate across jobs
        by_target: Breakdown by import target
    """

    period_start: str | None
    period_end: str | None
    total_jobs: int
    completed_jobs: int
    failed_jobs: int
    jobs_with_errors: int
    total_rows_processed: int
    total_rows_imported: int
    total_rows_failed: int
    average_success_rate: float
    by_target: dict[str, dict[str, int]] = field(default_factory=dict)
