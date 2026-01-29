"""
Import queries - read operations for data ingestion.

Queries encapsulate all parameters needed to retrieve import data.
They are immutable and describe what information is requested.

Design Principles:
1. Immutable - frozen dataclasses
2. Focused - each query has a single purpose
3. Filterable - support common filter patterns
4. Pageable - support pagination for list queries

Research Grounding: docs/architecture/ingestion-pipeline-phase1.md
"""

from dataclasses import dataclass
from datetime import date, datetime
from enum import Enum


class ImportJobSortField(str, Enum):
    """Fields available for sorting import jobs."""

    CREATED_AT = "created_at"
    STARTED_AT = "started_at"
    COMPLETED_AT = "completed_at"
    JOB_NUMBER = "job_number"
    STATUS = "status"
    TOTAL_ROWS = "total_rows"


class SortDirection(str, Enum):
    """Sort direction for queries."""

    ASC = "asc"
    DESC = "desc"


@dataclass(frozen=True)
class GetImportJobQuery:
    """
    Query to retrieve a single import job by ID.

    Attributes:
        job_id: ID of the import job to retrieve
        include_errors: Whether to include error details
        include_statistics: Whether to include computed statistics
    """

    job_id: str
    include_errors: bool = False
    include_statistics: bool = True

    def __post_init__(self) -> None:
        """Validate query parameters."""
        if not self.job_id:
            raise ValueError("job_id is required")


@dataclass(frozen=True)
class GetImportJobByNumberQuery:
    """
    Query to retrieve a single import job by job number.

    Attributes:
        job_number: Human-readable job number (e.g., "IMP-2026-00001")
        include_errors: Whether to include error details
        include_statistics: Whether to include computed statistics
    """

    job_number: str
    include_errors: bool = False
    include_statistics: bool = True

    def __post_init__(self) -> None:
        """Validate query parameters."""
        if not self.job_number:
            raise ValueError("job_number is required")


@dataclass(frozen=True)
class GetImportJobsQuery:
    """
    Query to list import jobs with filtering and pagination.

    Attributes:
        target: Filter by import target (JOURNAL_ENTRIES, ACCOUNTS, etc.)
        status: Filter by job status
        initiated_by: Filter by user who initiated the import
        date_from: Filter jobs created on or after this date
        date_to: Filter jobs created on or before this date
        sort_by: Field to sort by
        sort_direction: Sort direction
        page: Page number (1-based)
        page_size: Number of items per page
    """

    target: str | None = None
    status: str | None = None
    initiated_by: str | None = None
    date_from: date | None = None
    date_to: date | None = None
    sort_by: ImportJobSortField = ImportJobSortField.CREATED_AT
    sort_direction: SortDirection = SortDirection.DESC
    page: int = 1
    page_size: int = 20

    def __post_init__(self) -> None:
        """Validate query parameters."""
        if self.page < 1:
            object.__setattr__(self, "page", 1)
        if self.page_size < 1 or self.page_size > 100:
            object.__setattr__(self, "page_size", min(max(self.page_size, 1), 100))

    @property
    def offset(self) -> int:
        """Calculate offset for pagination."""
        return (self.page - 1) * self.page_size


@dataclass(frozen=True)
class GetImportErrorsQuery:
    """
    Query to retrieve errors for an import job.

    Attributes:
        job_id: ID of the import job
        severity: Filter by error severity
        error_code: Filter by error code
        row_number_from: Filter errors from this row number
        row_number_to: Filter errors up to this row number
        page: Page number (1-based)
        page_size: Number of items per page
    """

    job_id: str
    severity: str | None = None
    error_code: str | None = None
    row_number_from: int | None = None
    row_number_to: int | None = None
    page: int = 1
    page_size: int = 50

    def __post_init__(self) -> None:
        """Validate query parameters."""
        if not self.job_id:
            raise ValueError("job_id is required")
        if self.page < 1:
            object.__setattr__(self, "page", 1)
        if self.page_size < 1 or self.page_size > 500:
            object.__setattr__(self, "page_size", min(max(self.page_size, 1), 500))

    @property
    def offset(self) -> int:
        """Calculate offset for pagination."""
        return (self.page - 1) * self.page_size


@dataclass(frozen=True)
class GetImportStatisticsQuery:
    """
    Query to retrieve aggregated import statistics.

    Attributes:
        target: Filter by import target
        date_from: Start date for statistics period
        date_to: End date for statistics period
        initiated_by: Filter by user
    """

    target: str | None = None
    date_from: date | None = None
    date_to: date | None = None
    initiated_by: str | None = None
