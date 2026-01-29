"""
Journal Entry - the fundamental unit of financial recording.

A journal entry records a complete financial transaction with:
- Multiple lines (debits and credits that must balance)
- Reference to fiscal period
- Source document reference
- Audit trail information

Once POSTED, journal entries are IMMUTABLE.
Corrections are made via reversing entries only.

Research Grounding: docs/research/02-journal-entry-immutability.md
AI Knowledge Gap: doc 11 - Use deterministic validation, not AI reasoning
"""

from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    Date,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from src.infrastructure.persistence.base import (
    ImmutableEntity,
    MONEY_PRECISION,
    MONEY_SCALE,
)
from src.domain.general_ledger.models.posting_status import PostingStatus
from src.domain.general_ledger.models.journal_entry_line import (
    JournalEntryLine,
    EntryType,
)
from src.domain.shared.exceptions import UnbalancedEntryError, InvariantViolationError

if TYPE_CHECKING:
    from src.domain.general_ledger.models.fiscal_period_entity import FiscalPeriodEntity


class JournalEntry(ImmutableEntity):
    """
    Journal Entry - immutable record of a financial transaction.

    This entity uses ImmutableEntity as its base because posted entries
    MUST NOT be modified. This is a regulatory requirement (SOX, PCAOB).

    Lifecycle:
        1. Create entry with DRAFT status
        2. Add lines (debits and credits)
        3. Validate: debits must equal credits
        4. Post: status changes to POSTED, entry becomes immutable
        5. If error found: create reversing entry, never modify original

    Attributes:
        entry_number: Sequential number for reference (e.g., JE-2026-00001)
        entry_date: The business date of the transaction
        fiscal_period_id: Reference to the fiscal period
        description: Narrative description of the transaction
        source_document: Reference to originating document
        status: DRAFT, PENDING, POSTED, or VOID
        posted_at: Timestamp when entry was posted
        posted_by: User who posted the entry
        reversal_of_id: If this reverses another entry, reference to original
        reversed_by_id: If this entry was reversed, reference to reversing entry
        total_debits: Sum of all debit lines (denormalized for performance)
        total_credits: Sum of all credit lines (denormalized for performance)

    Invariants:
        - total_debits MUST equal total_credits (enforced at validation/posting)
        - Status transitions: DRAFT → PENDING → POSTED (one-way)
        - POSTED entries cannot be modified (enforced by ImmutableEntity)
    """

    __tablename__ = "journal_entries"

    # Entry identification
    entry_number: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
        comment="Sequential entry number (e.g., JE-2026-00001)",
    )

    entry_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
        comment="Business date of the transaction",
    )

    # Period reference
    fiscal_period_id: Mapped[str] = mapped_column(
        String(26),
        ForeignKey("fiscal_periods.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="Fiscal period this entry belongs to",
    )

    # Description and source
    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Narrative description of the transaction",
    )

    source_document: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
        comment="Reference to originating document (invoice, receipt, etc.)",
    )

    source_document_type: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="Type of source document (INVOICE, RECEIPT, ADJUSTMENT, etc.)",
    )

    # Status and lifecycle
    status: Mapped[PostingStatus] = mapped_column(
        SQLEnum(PostingStatus, native_enum=False),
        nullable=False,
        default=PostingStatus.DRAFT,
        index=True,
        comment="Entry lifecycle status",
    )

    posted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when entry was posted (immutable after this)",
    )

    posted_by: Mapped[str | None] = mapped_column(
        String(36),
        nullable=True,
        comment="User ID who posted this entry",
    )

    # Reversal tracking
    reversal_of_id: Mapped[str | None] = mapped_column(
        String(26),
        ForeignKey("journal_entries.id", ondelete="RESTRICT"),
        nullable=True,
        comment="If this is a reversing entry, reference to the original",
    )

    reversed_by_id: Mapped[str | None] = mapped_column(
        String(26),
        ForeignKey("journal_entries.id", ondelete="RESTRICT"),
        nullable=True,
        comment="If this entry was reversed, reference to the reversing entry",
    )

    # Denormalized totals for query performance and integrity
    total_debits: Mapped[Decimal] = mapped_column(
        Numeric(precision=MONEY_PRECISION, scale=MONEY_SCALE),
        nullable=False,
        default=Decimal("0"),
        comment="Sum of all debit lines",
    )

    total_credits: Mapped[Decimal] = mapped_column(
        Numeric(precision=MONEY_PRECISION, scale=MONEY_SCALE),
        nullable=False,
        default=Decimal("0"),
        comment="Sum of all credit lines",
    )

    # Currency (all lines must be same currency)
    currency_code: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        default="USD",
        comment="Currency of entry (ISO 4217)",
    )

    # Relationships
    lines: Mapped[list[JournalEntryLine]] = relationship(
        "JournalEntryLine",
        back_populates="journal_entry",
        cascade="all, delete-orphan",
        order_by="JournalEntryLine.line_number",
        lazy="selectin",
    )

    fiscal_period: Mapped["FiscalPeriodEntity"] = relationship(
        "FiscalPeriodEntity",
        lazy="joined",
    )

    reversal_of: Mapped["JournalEntry | None"] = relationship(
        "JournalEntry",
        foreign_keys=[reversal_of_id],
        remote_side="JournalEntry.id",
        post_update=True,
    )

    reversed_by: Mapped["JournalEntry | None"] = relationship(
        "JournalEntry",
        foreign_keys=[reversed_by_id],
        remote_side="JournalEntry.id",
        post_update=True,
    )

    def __repr__(self) -> str:
        return (
            f"<JournalEntry("
            f"number={self.entry_number}, "
            f"date={self.entry_date}, "
            f"status={self.status.value})>"
        )

    # -------------------------------------------------------------------------
    # Computed Properties
    # -------------------------------------------------------------------------

    @property
    def is_balanced(self) -> bool:
        """
        Check if debits equal credits.

        Uses Decimal comparison with small tolerance for rounding.
        AI Knowledge Gap (doc 11): This MUST be deterministic, not AI reasoning.
        """
        tolerance = Decimal("0.0001")
        return abs(self.total_debits - self.total_credits) < tolerance

    @property
    def is_posted(self) -> bool:
        """Return True if entry has been posted."""
        return self.status == PostingStatus.POSTED

    @property
    def is_void(self) -> bool:
        """Return True if entry has been voided."""
        return self.status == PostingStatus.VOID

    @property
    def is_editable(self) -> bool:
        """Return True if entry can still be modified."""
        return self.status.is_editable

    @property
    def is_reversible(self) -> bool:
        """Return True if entry can be reversed."""
        return self.is_posted and self.reversed_by_id is None

    @property
    def is_reversal(self) -> bool:
        """Return True if this is a reversing entry."""
        return self.reversal_of_id is not None

    @property
    def line_count(self) -> int:
        """Return the number of lines in this entry."""
        return len(self.lines) if self.lines else 0

    @property
    def debit_lines(self) -> list[JournalEntryLine]:
        """Return only debit lines."""
        return [line for line in self.lines if line.is_debit]

    @property
    def credit_lines(self) -> list[JournalEntryLine]:
        """Return only credit lines."""
        return [line for line in self.lines if line.is_credit]

    # -------------------------------------------------------------------------
    # Business Methods
    # -------------------------------------------------------------------------

    def calculate_totals(self) -> tuple[Decimal, Decimal]:
        """
        Calculate total debits and credits from lines.

        Returns:
            Tuple of (total_debits, total_credits)
        """
        total_debits = Decimal("0")
        total_credits = Decimal("0")

        for line in self.lines:
            if line.entry_type == EntryType.DEBIT:
                total_debits += line.amount
            else:
                total_credits += line.amount

        return total_debits, total_credits

    def update_totals(self) -> None:
        """
        Recalculate and update the denormalized totals.

        Should be called after adding/removing lines (before posting).
        """
        self.total_debits, self.total_credits = self.calculate_totals()

    def validate_balance(self) -> None:
        """
        Validate that debits equal credits.

        Raises:
            UnbalancedEntryError: If debits don't equal credits
        """
        self.update_totals()
        if not self.is_balanced:
            raise UnbalancedEntryError(
                debit_total=str(self.total_debits),
                credit_total=str(self.total_credits),
            )

    def validate_for_posting(self) -> None:
        """
        Validate all requirements for posting.

        Raises:
            InvariantViolationError: If any validation fails
            UnbalancedEntryError: If debits don't equal credits
        """
        # Must have lines
        if not self.lines or len(self.lines) < 2:
            raise InvariantViolationError(
                invariant="MINIMUM_LINES",
                message="Journal entry must have at least 2 lines (one debit, one credit)",
            )

        # Must have at least one debit and one credit
        has_debit = any(line.is_debit for line in self.lines)
        has_credit = any(line.is_credit for line in self.lines)
        if not (has_debit and has_credit):
            raise InvariantViolationError(
                invariant="DEBIT_AND_CREDIT_REQUIRED",
                message="Journal entry must have at least one debit and one credit line",
            )

        # Must balance
        self.validate_balance()

        # All amounts must be positive
        for line in self.lines:
            if line.amount <= Decimal("0"):
                raise InvariantViolationError(
                    invariant="POSITIVE_AMOUNTS",
                    message=f"Line amounts must be positive, got {line.amount}",
                )

        # Must have description
        if not self.description or not self.description.strip():
            raise InvariantViolationError(
                invariant="DESCRIPTION_REQUIRED",
                message="Journal entry must have a description",
            )

        # Status must allow posting
        if not self.status.can_transition_to_posted:
            raise InvariantViolationError(
                invariant="VALID_STATUS_FOR_POSTING",
                message=f"Cannot post entry with status {self.status.value}",
            )

    def add_line(
        self,
        account_id: str,
        entry_type: EntryType,
        amount: Decimal,
        description: str | None = None,
    ) -> JournalEntryLine:
        """
        Add a line to this journal entry.

        Args:
            account_id: The account to affect
            entry_type: DEBIT or CREDIT
            amount: Positive amount
            description: Optional line description

        Returns:
            The created line

        Raises:
            InvariantViolationError: If entry is not editable
        """
        if not self.is_editable:
            raise InvariantViolationError(
                invariant="ENTRY_EDITABLE",
                message=f"Cannot add lines to entry with status {self.status.value}",
            )

        line_number = len(self.lines)
        line = JournalEntryLine(
            journal_entry_id=self.id,
            account_id=account_id,
            entry_type=entry_type,
            amount=amount,
            description=description,
            line_number=line_number,
        )
        self.lines.append(line)
        self.update_totals()
        return line
