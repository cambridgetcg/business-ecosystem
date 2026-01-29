"""
Import query handlers - execute import read operations.

Query handlers retrieve data from repositories and return DTOs.
They never modify state.

Design Principles:
1. Read-only - queries never modify data
2. Protocol dependencies - injectable for testing
3. DTO returns - never expose domain entities directly
4. Pagination support - all list queries support pagination

Research Grounding: docs/architecture/ingestion-pipeline-phase1.md
"""

from typing import Protocol

from src.application.queries.import_queries import (
    GetImportJobQuery,
    GetImportJobByNumberQuery,
    GetImportJobsQuery,
    GetImportErrorsQuery,
    GetImportStatisticsQuery,
)
from src.application.dtos.import_dtos import (
    ImportJobDTO,
    ImportJobListDTO,
    ImportErrorListDTO,
    ImportStatisticsDTO,
)


class IImportJobQueryRepository(Protocol):
    """Protocol for import job read operations."""

    async def get_by_id(self, job_id: str):
        """Get job by ID."""
        ...

    async def get_by_number(self, job_number: str):
        """Get job by job number."""
        ...

    async def list_jobs(
        self,
        target: str | None = None,
        status: str | None = None,
        initiated_by: str | None = None,
        date_from=None,
        date_to=None,
        sort_by: str = "created_at",
        sort_direction: str = "desc",
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list, int]:
        """
        List jobs with filtering and pagination.

        Returns:
            Tuple of (jobs, total_count)
        """
        ...


class IImportErrorQueryRepository(Protocol):
    """Protocol for import error read operations."""

    async def list_errors(
        self,
        job_id: str,
        severity: str | None = None,
        error_code: str | None = None,
        row_number_from: int | None = None,
        row_number_to: int | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list, int]:
        """
        List errors for a job with filtering and pagination.

        Returns:
            Tuple of (errors, total_count)
        """
        ...

    async def count_by_job(self, job_id: str) -> int:
        """Count errors for a job."""
        ...


class GetImportJobHandler:
    """
    Handler for GetImportJobQuery and GetImportJobByNumberQuery.

    Retrieves a single import job by ID or job number.

    Usage:
        handler = GetImportJobHandler(job_repository, error_repository)
        result = await handler.execute(query)
    """

    def __init__(
        self,
        job_repository: IImportJobQueryRepository,
        error_repository: IImportErrorQueryRepository | None = None,
    ) -> None:
        """
        Initialize the handler.

        Args:
            job_repository: Repository for import jobs
            error_repository: Repository for import errors (for include_errors)
        """
        self._job_repo = job_repository
        self._error_repo = error_repository

    async def execute(
        self,
        query: GetImportJobQuery | GetImportJobByNumberQuery,
    ) -> ImportJobDTO | None:
        """
        Execute the get import job query.

        Args:
            query: Query with job ID or job number

        Returns:
            ImportJobDTO if found, None otherwise
        """
        # Fetch the job
        if isinstance(query, GetImportJobQuery):
            job = await self._job_repo.get_by_id(query.job_id)
        else:
            job = await self._job_repo.get_by_number(query.job_number)

        if job is None:
            return None

        # Convert to DTO
        return ImportJobDTO.from_entity(
            job,
            include_errors=query.include_errors,
        )


class GetImportJobsHandler:
    """
    Handler for GetImportJobsQuery.

    Retrieves a paginated list of import jobs with filtering.

    Usage:
        handler = GetImportJobsHandler(job_repository)
        result = await handler.execute(query)
    """

    def __init__(self, job_repository: IImportJobQueryRepository) -> None:
        """
        Initialize the handler.

        Args:
            job_repository: Repository for import jobs
        """
        self._job_repo = job_repository

    async def execute(self, query: GetImportJobsQuery) -> ImportJobListDTO:
        """
        Execute the list import jobs query.

        Args:
            query: Query with filters and pagination

        Returns:
            ImportJobListDTO with paginated results
        """
        # Fetch jobs with filters
        jobs, total_count = await self._job_repo.list_jobs(
            target=query.target,
            status=query.status,
            initiated_by=query.initiated_by,
            date_from=query.date_from,
            date_to=query.date_to,
            sort_by=query.sort_by.value,
            sort_direction=query.sort_direction.value,
            offset=query.offset,
            limit=query.page_size,
        )

        # Convert to DTO
        return ImportJobListDTO.from_entities(
            entities=jobs,
            page=query.page,
            page_size=query.page_size,
            total_items=total_count,
        )


class GetImportErrorsHandler:
    """
    Handler for GetImportErrorsQuery.

    Retrieves a paginated list of errors for an import job.

    Usage:
        handler = GetImportErrorsHandler(error_repository, job_repository)
        result = await handler.execute(query)
    """

    def __init__(
        self,
        error_repository: IImportErrorQueryRepository,
        job_repository: IImportJobQueryRepository | None = None,
    ) -> None:
        """
        Initialize the handler.

        Args:
            error_repository: Repository for import errors
            job_repository: Optional repository to verify job exists
        """
        self._error_repo = error_repository
        self._job_repo = job_repository

    async def execute(self, query: GetImportErrorsQuery) -> ImportErrorListDTO | None:
        """
        Execute the get import errors query.

        Args:
            query: Query with job ID, filters, and pagination

        Returns:
            ImportErrorListDTO with paginated errors, None if job not found
        """
        # Optionally verify job exists
        if self._job_repo:
            job = await self._job_repo.get_by_id(query.job_id)
            if job is None:
                return None

        # Fetch errors
        errors, total_count = await self._error_repo.list_errors(
            job_id=query.job_id,
            severity=query.severity,
            error_code=query.error_code,
            row_number_from=query.row_number_from,
            row_number_to=query.row_number_to,
            offset=query.offset,
            limit=query.page_size,
        )

        # Convert to DTO
        return ImportErrorListDTO.from_entities(
            job_id=query.job_id,
            entities=errors,
            page=query.page,
            page_size=query.page_size,
            total_items=total_count,
        )


class GetImportStatisticsHandler:
    """
    Handler for GetImportStatisticsQuery.

    Retrieves aggregated import statistics.

    Usage:
        handler = GetImportStatisticsHandler(job_repository)
        result = await handler.execute(query)
    """

    def __init__(self, job_repository: IImportJobQueryRepository) -> None:
        """
        Initialize the handler.

        Args:
            job_repository: Repository for import jobs
        """
        self._job_repo = job_repository

    async def execute(self, query: GetImportStatisticsQuery) -> ImportStatisticsDTO:
        """
        Execute the get import statistics query.

        Args:
            query: Query with date range and filters

        Returns:
            ImportStatisticsDTO with aggregated statistics
        """
        # This would typically call a specialized statistics method on the repository
        # For now, return a placeholder that can be implemented when needed
        # The repository would aggregate data using SQL

        # In a real implementation, the repository would have a method like:
        # stats = await self._job_repo.get_statistics(
        #     target=query.target,
        #     date_from=query.date_from,
        #     date_to=query.date_to,
        #     initiated_by=query.initiated_by,
        # )

        return ImportStatisticsDTO(
            period_start=query.date_from.isoformat() if query.date_from else None,
            period_end=query.date_to.isoformat() if query.date_to else None,
            total_jobs=0,
            completed_jobs=0,
            failed_jobs=0,
            jobs_with_errors=0,
            total_rows_processed=0,
            total_rows_imported=0,
            total_rows_failed=0,
            average_success_rate=0.0,
            by_target={},
        )
