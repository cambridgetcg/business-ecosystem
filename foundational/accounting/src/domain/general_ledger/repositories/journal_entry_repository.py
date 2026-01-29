"""
Journal Entry Repository - data access for journal entries.

Follows the repository pattern from chart_of_accounts.
"""

from datetime import date
from typing import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.domain.general_ledger.models.journal_entry import JournalEntry
from src.domain.general_ledger.models.journal_entry_line import JournalEntryLine
from src.domain.general_ledger.models.posting_status import PostingStatus


class JournalEntryRepository:
    """
    Repository for JournalEntry entities.

    Provides CRUD operations and queries for journal entries.
    Note: Posted entries are immutable - update operations will fail for posted entries.
    """

    def __init__(self, session: AsyncSession) -> None:
        """
        Initialize the repository.

        Args:
            session: SQLAlchemy async session
        """
        self.session = session

    async def get_by_id(self, entry_id: str) -> JournalEntry | None:
        """
        Get a journal entry by ID.

        Args:
            entry_id: The entry ID

        Returns:
            The entry if found, None otherwise
        """
        stmt = (
            select(JournalEntry)
            .options(selectinload(JournalEntry.lines))
            .where(JournalEntry.id == entry_id)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_entry_number(self, entry_number: str) -> JournalEntry | None:
        """
        Get a journal entry by entry number.

        Args:
            entry_number: The entry number (e.g., "JE-2026-00001")

        Returns:
            The entry if found, None otherwise
        """
        stmt = (
            select(JournalEntry)
            .options(selectinload(JournalEntry.lines))
            .where(JournalEntry.entry_number == entry_number)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def add(self, entry: JournalEntry) -> JournalEntry:
        """
        Add a new journal entry.

        Args:
            entry: The entry to add

        Returns:
            The added entry with generated ID
        """
        self.session.add(entry)
        await self.session.flush()
        await self.session.refresh(entry)
        return entry

    async def add_batch(self, entries: list[JournalEntry]) -> list[JournalEntry]:
        """
        Add multiple journal entries efficiently.

        Args:
            entries: List of entries to add

        Returns:
            List of added entries with generated IDs
        """
        if not entries:
            return []

        self.session.add_all(entries)
        await self.session.flush()

        for entry in entries:
            await self.session.refresh(entry)

        return entries

    async def save(self, entry: JournalEntry) -> JournalEntry:
        """
        Save a journal entry.

        For new entries, this creates them.
        For existing draft entries, this updates them.
        For posted entries, this will fail (they are immutable).

        Args:
            entry: The entry to save

        Returns:
            The saved entry
        """
        self.session.add(entry)
        await self.session.flush()
        await self.session.refresh(entry)
        return entry

    async def delete(self, entry: JournalEntry) -> None:
        """
        Delete a journal entry.

        Only DRAFT entries can be deleted.

        Args:
            entry: The entry to delete

        Raises:
            ValueError: If entry is not in DRAFT status
        """
        if entry.status != PostingStatus.DRAFT:
            raise ValueError(f"Cannot delete entry with status {entry.status.value}")

        await self.session.delete(entry)
        await self.session.flush()

    async def get_next_entry_number(self, year: int) -> str:
        """
        Generate the next entry number for the year.

        Format: JE-YYYY-NNNNN (e.g., JE-2026-00001)

        Args:
            year: The fiscal year

        Returns:
            The next available entry number
        """
        # Get the max entry number for this year
        prefix = f"JE-{year}-"
        stmt = select(func.max(JournalEntry.entry_number)).where(
            JournalEntry.entry_number.like(f"{prefix}%")
        )
        result = await self.session.execute(stmt)
        max_number = result.scalar_one_or_none()

        if max_number:
            # Extract the sequence number and increment
            seq = int(max_number.split("-")[-1]) + 1
        else:
            seq = 1

        return f"{prefix}{seq:05d}"

    async def get_by_period(
        self,
        fiscal_period_id: str,
        status: PostingStatus | None = None,
    ) -> Sequence[JournalEntry]:
        """
        Get all entries for a fiscal period.

        Args:
            fiscal_period_id: The fiscal period ID
            status: Optional status filter

        Returns:
            List of entries for the period
        """
        stmt = (
            select(JournalEntry)
            .options(selectinload(JournalEntry.lines))
            .where(JournalEntry.fiscal_period_id == fiscal_period_id)
        )

        if status:
            stmt = stmt.where(JournalEntry.status == status)

        stmt = stmt.order_by(JournalEntry.entry_date, JournalEntry.entry_number)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_by_date_range(
        self,
        start_date: date,
        end_date: date,
        status: PostingStatus | None = None,
    ) -> Sequence[JournalEntry]:
        """
        Get entries within a date range.

        Args:
            start_date: Start of date range (inclusive)
            end_date: End of date range (inclusive)
            status: Optional status filter

        Returns:
            List of entries in the date range
        """
        stmt = (
            select(JournalEntry)
            .options(selectinload(JournalEntry.lines))
            .where(JournalEntry.entry_date >= start_date)
            .where(JournalEntry.entry_date <= end_date)
        )

        if status:
            stmt = stmt.where(JournalEntry.status == status)

        stmt = stmt.order_by(JournalEntry.entry_date, JournalEntry.entry_number)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_by_account(
        self,
        account_id: str,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> Sequence[JournalEntry]:
        """
        Get entries affecting a specific account.

        Args:
            account_id: The account ID
            start_date: Optional start of date range
            end_date: Optional end of date range

        Returns:
            List of entries affecting the account
        """
        stmt = (
            select(JournalEntry)
            .options(selectinload(JournalEntry.lines))
            .join(JournalEntryLine)
            .where(JournalEntryLine.account_id == account_id)
            .where(JournalEntry.status == PostingStatus.POSTED)
        )

        if start_date:
            stmt = stmt.where(JournalEntry.entry_date >= start_date)
        if end_date:
            stmt = stmt.where(JournalEntry.entry_date <= end_date)

        stmt = stmt.order_by(JournalEntry.entry_date, JournalEntry.entry_number)
        result = await self.session.execute(stmt)
        return result.scalars().unique().all()

    async def get_draft_entries(self) -> Sequence[JournalEntry]:
        """
        Get all entries in DRAFT status.

        Returns:
            List of draft entries
        """
        return await self.get_by_period("", PostingStatus.DRAFT)

    async def count_by_period(self, fiscal_period_id: str) -> int:
        """
        Count entries for a fiscal period.

        Args:
            fiscal_period_id: The fiscal period ID

        Returns:
            Count of entries
        """
        stmt = (
            select(func.count(JournalEntry.id))
            .where(JournalEntry.fiscal_period_id == fiscal_period_id)
            .where(JournalEntry.status == PostingStatus.POSTED)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one()

    async def list_entries(
        self,
        status: PostingStatus | None = None,
        fiscal_period_id: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Sequence[JournalEntry]:
        """
        List journal entries with filtering and pagination.

        Args:
            status: Optional status filter
            fiscal_period_id: Optional fiscal period filter
            date_from: Optional start date filter
            date_to: Optional end date filter
            limit: Maximum entries to return
            offset: Number of entries to skip

        Returns:
            List of matching entries
        """
        stmt = select(JournalEntry).options(selectinload(JournalEntry.lines))

        if status is not None:
            stmt = stmt.where(JournalEntry.status == status)
        if fiscal_period_id is not None:
            stmt = stmt.where(JournalEntry.fiscal_period_id == fiscal_period_id)
        if date_from is not None:
            stmt = stmt.where(JournalEntry.entry_date >= date_from)
        if date_to is not None:
            stmt = stmt.where(JournalEntry.entry_date <= date_to)

        stmt = (
            stmt
            .order_by(JournalEntry.entry_date.desc(), JournalEntry.entry_number.desc())
            .limit(limit)
            .offset(offset)
        )

        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def count_entries(
        self,
        status: PostingStatus | None = None,
        fiscal_period_id: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> int:
        """
        Count journal entries with filtering.

        Args:
            status: Optional status filter
            fiscal_period_id: Optional fiscal period filter
            date_from: Optional start date filter
            date_to: Optional end date filter

        Returns:
            Count of matching entries
        """
        stmt = select(func.count(JournalEntry.id))

        if status is not None:
            stmt = stmt.where(JournalEntry.status == status)
        if fiscal_period_id is not None:
            stmt = stmt.where(JournalEntry.fiscal_period_id == fiscal_period_id)
        if date_from is not None:
            stmt = stmt.where(JournalEntry.entry_date >= date_from)
        if date_to is not None:
            stmt = stmt.where(JournalEntry.entry_date <= date_to)

        result = await self.session.execute(stmt)
        return result.scalar_one()
