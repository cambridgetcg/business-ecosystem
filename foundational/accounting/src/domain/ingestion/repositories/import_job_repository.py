"""
Import Job Repository - data access for import jobs.

Follows the repository pattern established in the general ledger domain.
"""

from datetime import datetime, timedelta
from typing import Sequence

from sqlalchemy import func, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.domain.ingestion.models.import_job import (
    ImportJob,
    ImportJobStatus,
    ImportTarget,
)
from src.domain.ingestion.models.import_error import ImportError
from src.domain.ingestion.models.job_sequence import ImportJobSequence


class ImportJobRepository:
    """
    Repository for ImportJob entities.

    Provides CRUD operations and queries for import jobs.
    """

    def __init__(self, session: AsyncSession) -> None:
        """
        Initialize the repository.

        Args:
            session: SQLAlchemy async session
        """
        self.session = session

    async def get_by_id(
        self,
        job_id: str,
        include_errors: bool = False,
    ) -> ImportJob | None:
        """
        Get an import job by ID.

        Args:
            job_id: The job ID
            include_errors: Whether to eagerly load errors

        Returns:
            The job if found, None otherwise
        """
        stmt = select(ImportJob).where(ImportJob.id == job_id)

        if include_errors:
            stmt = stmt.options(selectinload(ImportJob.errors))

        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_job_number(
        self,
        job_number: str,
        include_errors: bool = False,
    ) -> ImportJob | None:
        """
        Get an import job by job number.

        Args:
            job_number: The job number (e.g., "IMP-2026-00001")
            include_errors: Whether to eagerly load errors

        Returns:
            The job if found, None otherwise
        """
        stmt = select(ImportJob).where(ImportJob.job_number == job_number)

        if include_errors:
            stmt = stmt.options(selectinload(ImportJob.errors))

        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def add(self, job: ImportJob) -> ImportJob:
        """
        Add a new import job.

        Args:
            job: The job to add

        Returns:
            The added job with generated ID
        """
        self.session.add(job)
        await self.session.flush()
        await self.session.refresh(job)
        return job

    async def save(self, job: ImportJob) -> ImportJob:
        """
        Save an import job.

        Args:
            job: The job to save

        Returns:
            The saved job
        """
        self.session.add(job)
        await self.session.flush()
        await self.session.refresh(job)
        return job

    async def add_error(self, error: ImportError) -> ImportError:
        """
        Add an error to an import job.

        Args:
            error: The error to add

        Returns:
            The saved error
        """
        self.session.add(error)
        await self.session.flush()
        return error

    async def add_errors_batch(self, errors: list[ImportError]) -> None:
        """
        Add multiple errors in a batch.

        Args:
            errors: List of errors to add
        """
        self.session.add_all(errors)
        await self.session.flush()

    async def get_next_job_number(self, year: int) -> str:
        """
        Generate the next job number for the year atomically.

        Uses PostgreSQL's INSERT ... ON CONFLICT ... DO UPDATE pattern
        to atomically increment and return the next sequence number.
        This ensures uniqueness even under concurrent load.

        Format: IMP-YYYY-NNNNN (e.g., IMP-2026-00001)

        Args:
            year: The year for the job number

        Returns:
            The next available job number (guaranteed unique)
        """
        # Use PostgreSQL upsert for atomic increment
        # INSERT with conflict resolution: if year exists, increment; else insert with 1
        stmt = insert(ImportJobSequence).values(
            year=year,
            last_sequence=1,
        ).on_conflict_do_update(
            index_elements=["year"],
            set_={"last_sequence": ImportJobSequence.last_sequence + 1},
        ).returning(ImportJobSequence.last_sequence)

        result = await self.session.execute(stmt)
        sequence = result.scalar_one()

        return f"IMP-{year}-{sequence:05d}"

    async def get_by_status(
        self,
        status: ImportJobStatus,
        limit: int = 100,
    ) -> Sequence[ImportJob]:
        """
        Get jobs by status.

        Args:
            status: The status to filter by
            limit: Maximum number of jobs to return

        Returns:
            List of jobs with the specified status
        """
        stmt = (
            select(ImportJob)
            .where(ImportJob.status == status)
            .order_by(ImportJob.created_at.desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_active_jobs(self) -> Sequence[ImportJob]:
        """
        Get all active (non-terminal) jobs.

        Returns:
            List of active jobs
        """
        active_statuses = [
            ImportJobStatus.PENDING,
            ImportJobStatus.VALIDATING,
            ImportJobStatus.PROCESSING,
            ImportJobStatus.PAUSED,
        ]
        stmt = (
            select(ImportJob)
            .where(ImportJob.status.in_(active_statuses))
            .order_by(ImportJob.created_at)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_by_initiator(
        self,
        user_id: str,
        limit: int = 50,
        include_completed: bool = True,
    ) -> Sequence[ImportJob]:
        """
        Get jobs initiated by a specific user.

        Args:
            user_id: The user ID
            limit: Maximum number of jobs to return
            include_completed: Whether to include completed jobs

        Returns:
            List of jobs initiated by the user
        """
        stmt = (
            select(ImportJob)
            .where(ImportJob.initiated_by == user_id)
            .order_by(ImportJob.created_at.desc())
            .limit(limit)
        )

        if not include_completed:
            stmt = stmt.where(
                ImportJob.status.not_in([
                    ImportJobStatus.COMPLETED,
                    ImportJobStatus.COMPLETED_WITH_ERRORS,
                    ImportJobStatus.FAILED,
                    ImportJobStatus.CANCELLED,
                ])
            )

        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_by_target(
        self,
        target: ImportTarget,
        limit: int = 50,
    ) -> Sequence[ImportJob]:
        """
        Get jobs for a specific import target.

        Args:
            target: The target entity type
            limit: Maximum number of jobs to return

        Returns:
            List of jobs for the target
        """
        stmt = (
            select(ImportJob)
            .where(ImportJob.target == target)
            .order_by(ImportJob.created_at.desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_recent_jobs(
        self,
        days: int = 7,
        limit: int = 100,
    ) -> Sequence[ImportJob]:
        """
        Get recently created jobs.

        Args:
            days: Number of days to look back
            limit: Maximum number of jobs to return

        Returns:
            List of recent jobs
        """
        cutoff = datetime.utcnow() - timedelta(days=days)
        stmt = (
            select(ImportJob)
            .where(ImportJob.created_at >= cutoff)
            .order_by(ImportJob.created_at.desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_errors_for_job(
        self,
        job_id: str,
        limit: int = 1000,
        offset: int = 0,
    ) -> Sequence[ImportError]:
        """
        Get errors for a specific job.

        Args:
            job_id: The job ID
            limit: Maximum number of errors to return
            offset: Number of errors to skip

        Returns:
            List of errors for the job
        """
        stmt = (
            select(ImportError)
            .where(ImportError.import_job_id == job_id)
            .order_by(ImportError.row_number)
            .limit(limit)
            .offset(offset)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def count_errors_for_job(self, job_id: str) -> int:
        """
        Count errors for a specific job.

        Args:
            job_id: The job ID

        Returns:
            Number of errors
        """
        stmt = (
            select(func.count(ImportError.id))
            .where(ImportError.import_job_id == job_id)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one()

    async def get_error_summary_for_job(
        self,
        job_id: str,
    ) -> dict[str, int]:
        """
        Get error count by error code for a job.

        Args:
            job_id: The job ID

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

    async def delete_job(self, job: ImportJob) -> None:
        """
        Delete an import job and its errors.

        Note: Only non-completed jobs should typically be deleted.

        Args:
            job: The job to delete
        """
        await self.session.delete(job)
        await self.session.flush()

    async def list_all(
        self,
        target: ImportTarget | None = None,
        status: ImportJobStatus | None = None,
        initiated_by: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Sequence[ImportJob]:
        """
        List jobs with optional filtering and pagination.

        Args:
            target: Filter by import target type
            status: Filter by job status
            initiated_by: Filter by user ID
            limit: Maximum number of jobs to return
            offset: Number of jobs to skip

        Returns:
            List of matching jobs
        """
        stmt = select(ImportJob)

        if target is not None:
            stmt = stmt.where(ImportJob.target == target)
        if status is not None:
            stmt = stmt.where(ImportJob.status == status)
        if initiated_by is not None:
            stmt = stmt.where(ImportJob.initiated_by == initiated_by)

        stmt = (
            stmt
            .order_by(ImportJob.created_at.desc())
            .limit(limit)
            .offset(offset)
        )

        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def count(
        self,
        target: ImportTarget | None = None,
        status: ImportJobStatus | None = None,
        initiated_by: str | None = None,
    ) -> int:
        """
        Count jobs with optional filtering.

        Args:
            target: Filter by import target type
            status: Filter by job status
            initiated_by: Filter by user ID

        Returns:
            Number of matching jobs
        """
        stmt = select(func.count(ImportJob.id))

        if target is not None:
            stmt = stmt.where(ImportJob.target == target)
        if status is not None:
            stmt = stmt.where(ImportJob.status == status)
        if initiated_by is not None:
            stmt = stmt.where(ImportJob.initiated_by == initiated_by)

        result = await self.session.execute(stmt)
        return result.scalar_one()
