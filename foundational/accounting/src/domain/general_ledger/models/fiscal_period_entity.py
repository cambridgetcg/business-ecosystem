"""
Fiscal Period Entity - database model for accounting periods.

Fiscal periods control when journal entries can be posted.
Once a period is CLOSED, no new entries can be posted to it.
This is a regulatory requirement for period-end reporting accuracy.

Research Grounding: docs/research/03-fiscal-period-management.md
AI Knowledge Gap (doc 09): Period dates are TIME-SENSITIVE - use system time, not AI
"""

from datetime import date, datetime
from decimal import Decimal
from enum import Enum

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum as SQLEnum,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.infrastructure.persistence.base import (
    BaseEntity,
    MONEY_PRECISION,
    MONEY_SCALE,
    SoftDeleteMixin,
)


class PeriodStatus(str, Enum):
    """
    Status of a fiscal period.

    Lifecycle:
        FUTURE  → Period not yet active (cannot post)
        OPEN    → Period is active (can post entries)
        CLOSING → Period is being closed (restricted posting)
        CLOSED  → Period is closed (no posting allowed) - IRREVERSIBLE

    Note: Once a period reaches CLOSED status, it cannot be reopened.
    This is a regulatory requirement for financial reporting integrity.
    """

    FUTURE = "FUTURE"
    OPEN = "OPEN"
    CLOSING = "CLOSING"
    CLOSED = "CLOSED"

    @property
    def allows_posting(self) -> bool:
        """Return True if entries can be posted to this period."""
        return self == PeriodStatus.OPEN

    @property
    def allows_adjustments(self) -> bool:
        """Return True if adjustment entries can be posted."""
        return self in (PeriodStatus.OPEN, PeriodStatus.CLOSING)

    @property
    def is_final(self) -> bool:
        """Return True if period status cannot be changed."""
        return self == PeriodStatus.CLOSED


class FiscalPeriodEntity(BaseEntity, SoftDeleteMixin):
    """
    Fiscal Period - represents a specific accounting period.

    Each period has:
    - A year and period number (1-12 for months, 13-15 for adjusting periods)
    - Start and end dates
    - Open/closed status
    - Audit trail for when it was closed and by whom

    Invariants:
        - Period numbers 1-12 are regular months
        - Period numbers 13-15 are for adjusting/closing entries
        - Once CLOSED, a period cannot be reopened
        - A period cannot be closed until all prior periods are closed

    Attributes:
        year: Fiscal year (e.g., 2026)
        period_number: Period within year (1-15)
        name: Display name (e.g., "January 2026")
        start_date: First day of the period
        end_date: Last day of the period
        status: FUTURE, OPEN, CLOSING, or CLOSED
        closed_at: When the period was closed
        closed_by: Who closed the period
        is_adjusting: Whether this is an adjusting period (13-15)
    """

    __tablename__ = "fiscal_periods"

    # Period identification
    year: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        index=True,
        comment="Fiscal year",
    )

    period_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        index=True,
        comment="Period within year (1-12 regular, 13-15 adjusting)",
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="Display name (e.g., 'January 2026')",
    )

    # Date range
    start_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
        comment="First day of the period",
    )

    end_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
        comment="Last day of the period",
    )

    # Status
    status: Mapped[PeriodStatus] = mapped_column(
        SQLEnum(PeriodStatus, native_enum=False),
        nullable=False,
        default=PeriodStatus.FUTURE,
        index=True,
        comment="Period lifecycle status",
    )

    # Closing audit trail
    closed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when period was closed",
    )

    closed_by: Mapped[str | None] = mapped_column(
        String(36),
        nullable=True,
        comment="User ID who closed this period",
    )

    closing_notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Notes from period closing process",
    )

    # Period type
    is_adjusting: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="True if this is an adjusting/closing period (13-15)",
    )

    # Denormalized balances (optional, for quick reporting)
    total_debits: Mapped[Decimal] = mapped_column(
        Numeric(precision=MONEY_PRECISION, scale=MONEY_SCALE),
        nullable=False,
        default=Decimal("0"),
        comment="Sum of all debits posted to this period",
    )

    total_credits: Mapped[Decimal] = mapped_column(
        Numeric(precision=MONEY_PRECISION, scale=MONEY_SCALE),
        nullable=False,
        default=Decimal("0"),
        comment="Sum of all credits posted to this period",
    )

    entry_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Number of entries posted to this period",
    )

    # Table constraints
    __table_args__ = (
        UniqueConstraint("year", "period_number", name="uq_fiscal_period_year_number"),
        CheckConstraint("period_number >= 1 AND period_number <= 15", name="ck_period_number_range"),
        CheckConstraint("start_date <= end_date", name="ck_date_range_valid"),
        Index("ix_fiscal_period_date_range", "start_date", "end_date"),
    )

    def __repr__(self) -> str:
        return (
            f"<FiscalPeriod("
            f"year={self.year}, "
            f"period={self.period_number}, "
            f"status={self.status.value})>"
        )

    # -------------------------------------------------------------------------
    # Computed Properties
    # -------------------------------------------------------------------------

    @property
    def period_key(self) -> str:
        """Return the period key (e.g., '2026-P01')."""
        return f"{self.year}-P{self.period_number:02d}"

    @property
    def is_open(self) -> bool:
        """Return True if period is open for posting."""
        return self.status == PeriodStatus.OPEN

    @property
    def is_closed(self) -> bool:
        """Return True if period is closed."""
        return self.status == PeriodStatus.CLOSED

    @property
    def allows_posting(self) -> bool:
        """Return True if regular entries can be posted."""
        return self.status.allows_posting

    @property
    def allows_adjustments(self) -> bool:
        """Return True if adjustment entries can be posted."""
        return self.status.allows_adjustments

    @property
    def is_current(self) -> bool:
        """
        Return True if current date falls within this period.

        AI Knowledge Gap (doc 09): Uses system date, not AI inference.
        """
        today = date.today()
        return self.start_date <= today <= self.end_date

    @property
    def is_year_end(self) -> bool:
        """Return True if this is the last regular period of the year."""
        return self.period_number == 12

    # -------------------------------------------------------------------------
    # Business Methods
    # -------------------------------------------------------------------------

    def can_accept_entry(self, entry_date: date, is_adjustment: bool = False) -> bool:
        """
        Check if an entry with the given date can be posted to this period.

        Args:
            entry_date: The date of the journal entry
            is_adjustment: True if this is an adjusting entry

        Returns:
            True if the entry can be posted to this period
        """
        # Check date falls within period
        if not (self.start_date <= entry_date <= self.end_date):
            return False

        # Check status allows posting
        if is_adjustment:
            return self.allows_adjustments
        return self.allows_posting

    def validate_for_closing(self) -> list[str]:
        """
        Validate that the period can be closed.

        Returns:
            List of validation error messages (empty if valid)
        """
        errors = []

        if self.is_closed:
            errors.append("Period is already closed")

        if self.status == PeriodStatus.FUTURE:
            errors.append("Cannot close a period that has not been opened")

        # Check balance (debits should equal credits for the period)
        tolerance = Decimal("0.0001")
        if abs(self.total_debits - self.total_credits) > tolerance:
            errors.append(
                f"Period totals are unbalanced: debits={self.total_debits}, credits={self.total_credits}"
            )

        return errors

    @classmethod
    def period_name_for(cls, year: int, period_number: int) -> str:
        """Generate a display name for a period."""
        if period_number <= 12:
            month_names = [
                "January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"
            ]
            return f"{month_names[period_number - 1]} {year}"
        else:
            return f"Adjusting Period {period_number - 12} - {year}"
