"""
Unit of Work pattern implementation for transaction management.

The Unit of Work maintains a list of objects affected by a business transaction
and coordinates writing out changes and resolving concurrency problems.

Design Principles:
1. Single transaction boundary - all changes commit or rollback together
2. Repository coordination - repositories share the same session
3. Explicit commit - changes are only persisted when commit() is called
4. Rollback on error - automatic rollback if commit fails

Usage:
    async with UnitOfWork() as uow:
        account = await uow.accounts.get_by_id(account_id)
        journal_entry = JournalEntry(...)
        await uow.journal_entries.add(journal_entry)
        await uow.commit()
"""

from typing import AsyncGenerator, Self
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncSession

from src.infrastructure.persistence.database import get_database
from src.domain.chart_of_accounts.repositories.account_repository import AccountRepository
from src.domain.general_ledger.repositories.journal_entry_repository import JournalEntryRepository
from src.domain.general_ledger.repositories.fiscal_period_repository import FiscalPeriodRepository
from src.domain.ingestion.repositories.import_job_repository import ImportJobRepository
from src.domain.ingestion.repositories.import_error_repository import ImportErrorRepository


class UnitOfWork:
    """
    Unit of Work for coordinating repository operations within a transaction.

    All repository operations within a UnitOfWork share the same database
    session and transaction. Changes are only persisted when commit() is called.

    Example:
        async with UnitOfWork() as uow:
            # All operations share the same transaction
            account = await uow.accounts.get_by_code("1000")
            entry = JournalEntry(...)
            entry.add_line(account_id=account.id, ...)
            await uow.journal_entries.add(entry)
            await uow.commit()  # All changes committed atomically
    """

    def __init__(self, session: AsyncSession | None = None) -> None:
        """
        Initialize Unit of Work.

        Args:
            session: Optional existing session to use. If not provided,
                    a new session will be created from the database pool.
        """
        self._session = session
        self._owns_session = session is None

        # Repositories - lazily initialized
        self._accounts: AccountRepository | None = None
        self._journal_entries: JournalEntryRepository | None = None
        self._fiscal_periods: FiscalPeriodRepository | None = None
        self._import_jobs: ImportJobRepository | None = None
        self._import_errors: ImportErrorRepository | None = None

    async def __aenter__(self) -> Self:
        """Enter the unit of work context."""
        if self._session is None:
            database = get_database()
            self._session = database.session_factory()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Exit the unit of work context, rolling back on error."""
        if exc_type is not None:
            await self.rollback()

        if self._owns_session and self._session is not None:
            await self._session.close()

    @property
    def session(self) -> AsyncSession:
        """Get the underlying database session."""
        if self._session is None:
            raise RuntimeError("UnitOfWork must be used within async context manager")
        return self._session

    # -------------------------------------------------------------------------
    # Repository Properties
    # -------------------------------------------------------------------------

    @property
    def accounts(self) -> AccountRepository:
        """Get the account repository."""
        if self._accounts is None:
            self._accounts = AccountRepository(self.session)
        return self._accounts

    @property
    def journal_entries(self) -> JournalEntryRepository:
        """Get the journal entry repository."""
        if self._journal_entries is None:
            self._journal_entries = JournalEntryRepository(self.session)
        return self._journal_entries

    @property
    def fiscal_periods(self) -> FiscalPeriodRepository:
        """Get the fiscal period repository."""
        if self._fiscal_periods is None:
            self._fiscal_periods = FiscalPeriodRepository(self.session)
        return self._fiscal_periods

    @property
    def import_jobs(self) -> ImportJobRepository:
        """Get the import job repository."""
        if self._import_jobs is None:
            self._import_jobs = ImportJobRepository(self.session)
        return self._import_jobs

    @property
    def import_errors(self) -> ImportErrorRepository:
        """Get the import error repository."""
        if self._import_errors is None:
            self._import_errors = ImportErrorRepository(self.session)
        return self._import_errors

    # -------------------------------------------------------------------------
    # Transaction Methods
    # -------------------------------------------------------------------------

    async def commit(self) -> None:
        """
        Commit all changes made within this unit of work.

        All entity additions, updates, and deletions performed through
        the repositories will be persisted atomically.

        Raises:
            Exception: If commit fails, changes are automatically rolled back
        """
        try:
            await self.session.commit()
        except Exception:
            await self.rollback()
            raise

    async def rollback(self) -> None:
        """
        Rollback all uncommitted changes.

        Call this to discard all changes made within this unit of work.
        This is called automatically if an exception occurs.
        """
        await self.session.rollback()

    async def flush(self) -> None:
        """
        Flush pending changes to the database without committing.

        Use this when you need database-generated values (like IDs)
        but want to defer the final commit.
        """
        await self.session.flush()

    async def refresh(self, entity) -> None:
        """
        Refresh an entity from the database.

        Args:
            entity: The entity to refresh
        """
        await self.session.refresh(entity)


@asynccontextmanager
async def unit_of_work() -> AsyncGenerator[UnitOfWork, None]:
    """
    Context manager for creating a Unit of Work.

    Convenience function for creating and using a UnitOfWork.

    Example:
        async with unit_of_work() as uow:
            account = await uow.accounts.get_by_id(id)
            await uow.commit()
    """
    async with UnitOfWork() as uow:
        yield uow
