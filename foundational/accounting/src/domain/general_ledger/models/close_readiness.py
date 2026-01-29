"""
Close Readiness Check - validates period is ready for closing.

Period closing has temporal dependencies that must be satisfied in order:
1. Transaction cutoff enforced
2. All expected accruals recorded
3. All adjusting entries posted
4. Reconciliations completed
5. Trial balance verified

Research Grounding: docs/gaps/02-temporal-dependencies.md
"""

from datetime import datetime
from enum import Enum

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.infrastructure.persistence.base import BaseEntity


class CloseCheckType(str, Enum):
    """Types of checks required before period close."""

    # Transaction cutoff
    CUTOFF_ENFORCED = "CUTOFF_ENFORCED"  # No backdated transactions

    # Accruals
    ACCRUALS_REVIEWED = "ACCRUALS_REVIEWED"  # Expected accruals recorded
    RECURRING_ENTRIES_POSTED = "RECURRING_ENTRIES_POSTED"  # All recurring entries done

    # Adjustments
    ADJUSTING_ENTRIES_POSTED = "ADJUSTING_ENTRIES_POSTED"  # Period-end adjustments
    DEPRECIATION_RECORDED = "DEPRECIATION_RECORDED"  # Asset depreciation
    AMORTIZATION_RECORDED = "AMORTIZATION_RECORDED"  # Intangible amortization

    # Reconciliations
    BANK_RECONCILED = "BANK_RECONCILED"  # Bank accounts reconciled
    AR_RECONCILED = "AR_RECONCILED"  # Accounts receivable reconciled
    AP_RECONCILED = "AP_RECONCILED"  # Accounts payable reconciled
    INVENTORY_RECONCILED = "INVENTORY_RECONCILED"  # Inventory reconciled
    INTERCOMPANY_RECONCILED = "INTERCOMPANY_RECONCILED"  # Intercompany cleared

    # Verification
    TRIAL_BALANCE_VERIFIED = "TRIAL_BALANCE_VERIFIED"  # TB in balance
    SUBLEDGER_RECONCILED = "SUBLEDGER_RECONCILED"  # Subledgers match GL

    # Approval
    MANAGER_APPROVED = "MANAGER_APPROVED"  # Management sign-off
    CONTROLLER_APPROVED = "CONTROLLER_APPROVED"  # Controller sign-off


class CloseReadinessCheck(BaseEntity):
    """
    A single readiness check for period closing.

    Each check represents one requirement that must be satisfied
    before a period can be closed. Checks can be marked as:
    - Required (blocking) or Optional (advisory)
    - Automated (system verifies) or Manual (human verifies)

    Attributes:
        fiscal_period_id: Period this check applies to
        check_type: Type of check
        description: Human-readable description
        is_required: If True, must pass to close
        is_automated: If True, system performs check
        is_satisfied: Whether check has passed
        satisfied_at: When check was satisfied
        satisfied_by: User/system that satisfied check
        evidence: Documentation of satisfaction
        notes: Additional notes
    """

    __tablename__ = "close_readiness_checks"

    # Period reference
    fiscal_period_id: Mapped[str] = mapped_column(
        String(26),
        ForeignKey("fiscal_periods.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Fiscal period this check applies to",
    )

    # Check definition
    check_type: Mapped[CloseCheckType] = mapped_column(
        SQLEnum(CloseCheckType, native_enum=False),
        nullable=False,
        index=True,
        comment="Type of readiness check",
    )

    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Human-readable description of what this check verifies",
    )

    # Check requirements
    is_required: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        comment="If True, must pass before close",
    )

    is_automated: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="If True, system performs this check automatically",
    )

    # Check status
    is_satisfied: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        index=True,
        comment="Whether this check has passed",
    )

    satisfied_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When check was satisfied",
    )

    satisfied_by: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="User ID or 'SYSTEM' that satisfied check",
    )

    # Evidence
    evidence: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Documentation of how check was satisfied",
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Additional notes about this check",
    )

    def __repr__(self) -> str:
        status = "SATISFIED" if self.is_satisfied else "PENDING"
        return (
            f"<CloseReadinessCheck("
            f"type={self.check_type.value}, "
            f"status={status})>"
        )

    # -------------------------------------------------------------------------
    # Business Methods
    # -------------------------------------------------------------------------

    def satisfy(
        self,
        satisfied_by: str,
        evidence: str | None = None,
        notes: str | None = None,
    ) -> None:
        """
        Mark this check as satisfied.

        Args:
            satisfied_by: User ID or 'SYSTEM' performing the check
            evidence: Optional documentation
            notes: Optional notes
        """
        self.is_satisfied = True
        self.satisfied_at = datetime.utcnow()
        self.satisfied_by = satisfied_by
        if evidence:
            self.evidence = evidence
        if notes:
            self.notes = notes

    def reset(self) -> None:
        """Reset check to unsatisfied state."""
        self.is_satisfied = False
        self.satisfied_at = None
        self.satisfied_by = None
        self.evidence = None


class CloseReadinessResult:
    """
    Aggregated result of all close readiness checks for a period.

    This is a value object (not persisted) that summarizes readiness.
    """

    def __init__(self, checks: list[CloseReadinessCheck]):
        self.checks = checks
        self.total_checks = len(checks)
        self.satisfied_checks = sum(1 for c in checks if c.is_satisfied)
        self.required_checks = [c for c in checks if c.is_required]
        self.unsatisfied_required = [
            c for c in self.required_checks if not c.is_satisfied
        ]

    @property
    def all_required_satisfied(self) -> bool:
        """Return True if all required checks are satisfied."""
        return len(self.unsatisfied_required) == 0

    @property
    def can_close(self) -> bool:
        """Return True if period can be closed."""
        return self.all_required_satisfied

    @property
    def completion_percentage(self) -> float:
        """Return percentage of checks completed."""
        if self.total_checks == 0:
            return 100.0
        return (self.satisfied_checks / self.total_checks) * 100

    def get_blocking_checks(self) -> list[CloseReadinessCheck]:
        """Return list of checks blocking close."""
        return self.unsatisfied_required


# Standard checks to create for each period
STANDARD_CLOSE_CHECKS: list[dict] = [
    {
        "check_type": CloseCheckType.CUTOFF_ENFORCED,
        "description": "Verify no transactions are backdated to this period after cutoff",
        "is_required": True,
        "is_automated": True,
    },
    {
        "check_type": CloseCheckType.ACCRUALS_REVIEWED,
        "description": "Review and record all expected accruals for the period",
        "is_required": True,
        "is_automated": False,
    },
    {
        "check_type": CloseCheckType.ADJUSTING_ENTRIES_POSTED,
        "description": "Post all period-end adjusting entries",
        "is_required": True,
        "is_automated": False,
    },
    {
        "check_type": CloseCheckType.BANK_RECONCILED,
        "description": "Complete bank reconciliation for all cash accounts",
        "is_required": True,
        "is_automated": False,
    },
    {
        "check_type": CloseCheckType.TRIAL_BALANCE_VERIFIED,
        "description": "Verify trial balance is in balance (debits = credits)",
        "is_required": True,
        "is_automated": True,
    },
    {
        "check_type": CloseCheckType.MANAGER_APPROVED,
        "description": "Obtain management approval for period close",
        "is_required": True,
        "is_automated": False,
    },
]
