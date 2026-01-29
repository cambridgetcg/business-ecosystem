"""
Journal Entry Line - individual debit or credit within a journal entry.

Each line represents a single debit or credit to one account.
A complete journal entry must have lines that sum to zero (debits = credits).

Research Grounding: docs/research/01-double-entry-bookkeeping-standards.md
"""

from decimal import Decimal
from enum import Enum

from sqlalchemy import ForeignKey, Numeric, String, Text, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.infrastructure.persistence.base import (
    Base,
    MONEY_PRECISION,
    MONEY_SCALE,
    generate_ulid,
)


class EntryType(str, Enum):
    """
    Type of journal entry line: DEBIT or CREDIT.

    In double-entry bookkeeping:
    - DEBIT increases Assets and Expenses
    - DEBIT decreases Liabilities, Equity, and Revenue
    - CREDIT increases Liabilities, Equity, and Revenue
    - CREDIT decreases Assets and Expenses
    """

    DEBIT = "DEBIT"
    CREDIT = "CREDIT"

    @property
    def opposite(self) -> "EntryType":
        """Return the opposite entry type."""
        return EntryType.CREDIT if self == EntryType.DEBIT else EntryType.DEBIT


class JournalEntryLine(Base):
    """
    A single debit or credit line within a journal entry.

    Each line records:
    - Which account is affected
    - Whether it's a debit or credit
    - The amount
    - Optional description/memo

    Lines are immutable once the parent entry is posted.
    They do not have their own audit fields - they inherit from the parent entry.

    Attributes:
        id: Unique identifier (ULID)
        journal_entry_id: Reference to parent JournalEntry
        account_id: Reference to the affected Account
        entry_type: DEBIT or CREDIT
        amount: Positive decimal amount (always positive, type determines direction)
        description: Optional line-level description
        line_number: Order within the entry (for display consistency)
    """

    __tablename__ = "journal_entry_lines"

    id: Mapped[str] = mapped_column(
        String(26),
        primary_key=True,
        default=generate_ulid,
    )

    # Parent reference
    journal_entry_id: Mapped[str] = mapped_column(
        String(26),
        ForeignKey("journal_entries.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Account reference
    account_id: Mapped[str] = mapped_column(
        String(26),
        ForeignKey("accounts.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="The account affected by this line",
    )

    # Entry details
    entry_type: Mapped[EntryType] = mapped_column(
        SQLEnum(EntryType, native_enum=False),
        nullable=False,
        comment="DEBIT or CREDIT",
    )

    amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=MONEY_PRECISION, scale=MONEY_SCALE),
        nullable=False,
        comment="Positive amount (entry_type determines direction)",
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Optional line-level description",
    )

    line_number: Mapped[int] = mapped_column(
        nullable=False,
        default=0,
        comment="Order within the entry",
    )

    # Relationships
    journal_entry: Mapped["JournalEntry"] = relationship(
        "JournalEntry",
        back_populates="lines",
    )

    account: Mapped["Account"] = relationship(
        "Account",
        lazy="joined",
    )

    def __repr__(self) -> str:
        return (
            f"<JournalEntryLine("
            f"account_id={self.account_id}, "
            f"type={self.entry_type.value}, "
            f"amount={self.amount})>"
        )

    @property
    def signed_amount(self) -> Decimal:
        """
        Return the amount with sign based on entry type.

        Debits are positive, Credits are negative.
        This allows simple summation to check balance: sum should be 0.
        """
        if self.entry_type == EntryType.DEBIT:
            return self.amount
        return -self.amount

    @property
    def is_debit(self) -> bool:
        """Return True if this is a debit entry."""
        return self.entry_type == EntryType.DEBIT

    @property
    def is_credit(self) -> bool:
        """Return True if this is a credit entry."""
        return self.entry_type == EntryType.CREDIT


# Import at bottom to avoid circular imports
from src.domain.general_ledger.models.journal_entry import JournalEntry
from src.domain.chart_of_accounts.models.account import Account
