"""
Import Error Repository - data access for import errors.

Follows the repository pattern established in the general ledger domain.
"""

from typing import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.ingestion.models.import_error import ImportError, ImportErrorSeverity


class ImportErrorRepository:
    """
    Repository for ImportError entities.

    Provides CRUD operations and queries for import errors.
    """

    def __init__(self, session: AsyncSession) -> None:
        """
        Initialize the repository.

        Args:
            session: SQLAlchemy async session
        """
        self.session = session

    async def add(self, error: ImportError) -> ImportError:
        """
        Add a single import error.

        Args:
            error: The error to add

        Returns:
            The added error
        """
        self.session.add(error)
        await self.session.flush()
        return error

    async def add_batch(self, errors: list[ImportError]) -> None:
        """
        Add multiple errors in a batch.

        More efficient than individual adds for large numbers of errors.

        Args:
            errors: List of errors to add
        """
        if errors:
            self.session.add_all(errors)
            await self.session.flush()

    async def get_by_id(self, error_id: str) -> ImportError | None:
        """
        Get an error by ID.

        Args:
            error_id: The error ID

        Returns:
            The error if found, None otherwise
        """
        stmt = select(ImportError).where(ImportError.id == error_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_job_id(
        self,
        job_id: str,
        severity: ImportErrorSeverity | None = None,
        error_code: str | None = None,
        limit: int = 1000,
        offset: int = 0,
    ) -> Sequence[ImportError]:
        """
        Get errors for a specific job.

        Args:
            job_id: The import job ID
            severity: Optional severity filter
            error_code: Optional error code filter
            limit: Maximum number of errors to return
            offset: Number of errors to skip

        Returns:
            List of errors for the job
        """
        stmt = select(ImportError).where(ImportError.import_job_id == job_id)

        if severity is not None:
            stmt = stmt.where(ImportError.severity == severity)
        if error_code is not None:
            stmt = stmt.where(ImportError.error_code == error_code)

        stmt = (
            stmt
            .order_by(ImportError.row_number)
            .limit(limit)
            .offset(offset)
        )

        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def count_by_job_id(
        self,
        job_id: str,
        severity: ImportErrorSeverity | None = None,
    ) -> int:
        """
        Count errors for a specific job.

        Args:
            job_id: The import job ID
            severity: Optional severity filter

        Returns:
            Number of errors
        """
        stmt = select(func.count(ImportError.id)).where(
            ImportError.import_job_id == job_id
        )

        if severity is not None:
            stmt = stmt.where(ImportError.severity == severity)

        result = await self.session.execute(stmt)
        return result.scalar_one()

    async def get_summary_by_job_id(self, job_id: str) -> dict[str, int]:
        """
        Get error count by error code for a job.

        Args:
            job_id: The import job ID

        Returns:
            Dictionary of error_code -> count
        """
        stmt = (
            select(ImportError.error_code, func.count(ImportError.id))
            .where(ImportError.import_job_id == job_id)
            .group_by(ImportError.error_code)
        )
        result = await self.session.execute(stmt)
        return dict(result.all())

    async def delete_by_job_id(self, job_id: str) -> int:
        """
        Delete all errors for a job.

        Args:
            job_id: The import job ID

        Returns:
            Number of errors deleted
        """
        from sqlalchemy import delete

        stmt = delete(ImportError).where(ImportError.import_job_id == job_id)
        result = await self.session.execute(stmt)
        await self.session.flush()
        return result.rowcount
