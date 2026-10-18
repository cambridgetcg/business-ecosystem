"""
DepreciationSchedule - Planned depreciation entries for a fixed asset.

This entity represents individual depreciation entries in the schedule,
tracking both planned and actual depreciation for each period.
"""

from datetime import date, datetime
from decimal import Decimal
from enum import Enum

from sqlalchemy import (
    Date,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.infrastructure.persistence.base import Base, generate_ulid


class DepreciationEntryStatus(str, Enum):
    """Status of a depreciation schedule entry."""

    SCHEDULED = "SCHEDULED"  # Planned but not yet posted
    POSTED = "POSTED"  # Depreciation recorded in GL
    SKIPPED = "SKIPPED"  # Skipped (e.g., asset disposed early)


class DepreciationSchedule(Base):
    """
    A single depreciation entry in an asset's depreciation schedule.

    Each fixed asset has multiple DepreciationSchedule entries, one
    for each period (typically monthly) over its useful life.

    Attributes:
        id: Unique identifier (ULID)
        asset_id: Reference to the fixed asset
        period_number: Sequence number (1, 2, 3, ... n)
        period_start_date: Start of the depreciation period
        period_end_date: End of the depreciation period

        scheduled_amount: Planned depreciation amount
        actual_amount: Actual amount posted (may differ)
        cumulative_depreciation: Running total after this period

        status: Whether posted, scheduled, or skipped
        journal_entry_id: Reference to GL entry when posted
        posted_at: When the entry was posted
        posted_by: User who posted the entry
    """

    __tablename__ = "depreciation_schedules"

    # Primary key
    id: Mapped[str] = mapped_column(
        String(26),
        primary_key=True,
        default=generate_ulid,
    )

    # Asset reference
    asset_id: Mapped[str] = mapped_column(
        String(26),
        ForeignKey("fixed_assets.id"),
        nullable=False,
        index=True,
        comment="Reference to the fixed asset",
    )

    # Period identification
    period_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Sequence number in the schedule (1, 2, 3...)",
    )
    period_start_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        comment="Start of the depreciation period",
    )
    period_end_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        comment="End of the depreciation period",
    )

    # Amounts
    scheduled_amount: Mapped[Decimal] = mapped_column(
        Numeric(19, 4),
        nullable=False,
        comment="Planned depreciation amount for this period",
    )
    actual_amount: Mapped[Decimal | None] = mapped_column(
        Numeric(19, 4),
        nullable=True,
        comment="Actual amount posted (may differ from scheduled)",
    )
    cumulative_depreciation: Mapped[Decimal] = mapped_column(
        Numeric(19, 4),
        nullable=False,
        comment="Running total of depreciation through this period",
    )
    remaining_book_value: Mapped[Decimal] = mapped_column(
        Numeric(19, 4),
        nullable=False,
        comment="Book value after this period's depreciation",
    )

    # Status and posting
    status: Mapped[DepreciationEntryStatus] = mapped_column(
        SQLEnum(DepreciationEntryStatus, native_enum=False),
        nullable=False,
        default=DepreciationEntryStatus.SCHEDULED,
        comment="Whether posted, scheduled, or skipped",
    )
    journal_entry_id: Mapped[str | None] = mapped_column(
        String(26),
        ForeignKey("journal_entries.id"),
        nullable=True,
        comment="Reference to GL entry when posted",
    )
    posted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When the entry was posted",
    )
    posted_by: Mapped[str | None] = mapped_column(
        String(36),
        nullable=True,
        comment="User who posted the entry",
    )

    # Audit fields
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return (
            f"<DepreciationSchedule("
            f"asset_id={self.asset_id}, "
            f"period={self.period_number}, "
            f"amount={self.scheduled_amount}, "
            f"status={self.status.value})>"
        )

    @property
    def is_posted(self) -> bool:
        """Check if this entry has been posted."""
        return self.status == DepreciationEntryStatus.POSTED

    @property
    def is_pending(self) -> bool:
        """Check if this entry is pending posting."""
        return self.status == DepreciationEntryStatus.SCHEDULED

    def mark_posted(
        self,
        actual_amount: Decimal,
        journal_entry_id: str,
        posted_by: str,
    ) -> None:
        """
        Mark this entry as posted.

        Args:
            actual_amount: Actual depreciation amount posted
            journal_entry_id: Reference to the GL entry
            posted_by: User who posted
        """
        if self.is_posted:
            raise ValueError("Entry is already posted")

        self.actual_amount = actual_amount
        self.journal_entry_id = journal_entry_id
        self.posted_by = posted_by
        self.posted_at = datetime.now()
        self.status = DepreciationEntryStatus.POSTED

    def skip(self, reason: str | None = None) -> None:
        """
        Skip this depreciation entry.

        Args:
            reason: Optional reason for skipping
        """
        if self.is_posted:
            raise ValueError("Cannot skip a posted entry")

        self.status = DepreciationEntryStatus.SKIPPED
