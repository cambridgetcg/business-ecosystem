"""
Accounting Invariants - mathematical truths that must always hold.

Accounting has built-in validation through invariants:
- Debits = Credits (conservation of value within entry)
- Assets = Liabilities + Equity (balance sheet equation)
- Prior Balance + Activity = Current Balance (continuity)

These invariants provide early warning when something is wrong.

Research Grounding: docs/gaps/11-understanding-validation.md
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from decimal import Decimal
from enum import Enum
from typing import Any, Generic, TypeVar

from src.domain.general_ledger.models.journal_entry import JournalEntry


# =============================================================================
# Invariant Result Types
# =============================================================================


class InvariantStatus(str, Enum):
    """Status of an invariant check."""

    HOLDS = "HOLDS"  # Invariant is satisfied
    VIOLATED = "VIOLATED"  # Invariant is broken
    INCONCLUSIVE = "INCONCLUSIVE"  # Cannot determine (missing data)


@dataclass
class InvariantResult:
    """Result of checking an accounting invariant."""

    invariant_name: str
    status: InvariantStatus
    description: str
    expected: str | None = None
    actual: str | None = None
    difference: str | None = None
    context: dict[str, Any] | None = None

    @property
    def holds(self) -> bool:
        """Return True if invariant is satisfied."""
        return self.status == InvariantStatus.HOLDS

    @property
    def violated(self) -> bool:
        """Return True if invariant is broken."""
        return self.status == InvariantStatus.VIOLATED


# =============================================================================
# Abstract Invariant Base
# =============================================================================

T = TypeVar("T")


class AccountingInvariant(ABC, Generic[T]):
    """
    Base class for accounting invariants.

    An invariant is a mathematical truth that must always hold.
    When an invariant is violated, it signals a fundamental error
    in the data or our understanding.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable name of the invariant."""
        pass

    @property
    @abstractmethod
    def description(self) -> str:
        """Explanation of what this invariant checks."""
        pass

    @abstractmethod
    def check(self, context: T) -> InvariantResult:
        """
        Check if the invariant holds for the given context.

        Args:
            context: The data to check against

        Returns:
            InvariantResult with status and details
        """
        pass


# =============================================================================
# Entry-Level Invariants
# =============================================================================


# Tolerance for decimal comparisons (handles rounding)
BALANCE_TOLERANCE = Decimal("0.0001")


class DebitsEqualCreditsInvariant(AccountingInvariant[JournalEntry]):
    """
    Invariant: Total debits must equal total credits in a journal entry.

    This is the fundamental principle of double-entry bookkeeping.
    Every transaction affects at least two accounts, and the total
    debits must always equal total credits (conservation of value).
    """

    @property
    def name(self) -> str:
        return "Debits Equal Credits"

    @property
    def description(self) -> str:
        return "Total debits must equal total credits in every journal entry"

    def check(self, entry: JournalEntry) -> InvariantResult:
        """Check that debits equal credits for this entry."""
        total_debits = entry.total_debits
        total_credits = entry.total_credits
        difference = abs(total_debits - total_credits)

        if difference <= BALANCE_TOLERANCE:
            return InvariantResult(
                invariant_name=self.name,
                status=InvariantStatus.HOLDS,
                description=f"Entry {entry.entry_number} is balanced",
                expected=str(total_debits),
                actual=str(total_credits),
                difference=str(difference),
            )
        else:
            return InvariantResult(
                invariant_name=self.name,
                status=InvariantStatus.VIOLATED,
                description=f"Entry {entry.entry_number} is NOT balanced",
                expected=str(total_debits),
                actual=str(total_credits),
                difference=str(difference),
                context={
                    "entry_id": entry.id,
                    "entry_number": entry.entry_number,
                },
            )


# =============================================================================
# Trial Balance Invariants
# =============================================================================


@dataclass
class TrialBalanceData:
    """Data needed for trial balance invariant checks."""

    total_debits: Decimal
    total_credits: Decimal
    accounts: list[dict[str, Any]] | None = None


class TrialBalanceInvariant(AccountingInvariant[TrialBalanceData]):
    """
    Invariant: Trial balance must balance (total debits = total credits).

    The trial balance is the sum of all account balances. If the accounting
    equation holds, total debit balances must equal total credit balances.
    """

    @property
    def name(self) -> str:
        return "Trial Balance"

    @property
    def description(self) -> str:
        return "Sum of all debit balances must equal sum of all credit balances"

    def check(self, data: TrialBalanceData) -> InvariantResult:
        """Check that trial balance is in balance."""
        difference = abs(data.total_debits - data.total_credits)

        if difference <= BALANCE_TOLERANCE:
            return InvariantResult(
                invariant_name=self.name,
                status=InvariantStatus.HOLDS,
                description="Trial balance is in balance",
                expected=str(data.total_debits),
                actual=str(data.total_credits),
                difference=str(difference),
            )
        else:
            return InvariantResult(
                invariant_name=self.name,
                status=InvariantStatus.VIOLATED,
                description="Trial balance is OUT OF BALANCE",
                expected=str(data.total_debits),
                actual=str(data.total_credits),
                difference=str(difference),
            )


# =============================================================================
# Accounting Equation Invariant
# =============================================================================


@dataclass
class BalanceSheetData:
    """Data needed for accounting equation check."""

    total_assets: Decimal
    total_liabilities: Decimal
    total_equity: Decimal


class AccountingEquationInvariant(AccountingInvariant[BalanceSheetData]):
    """
    Invariant: Assets = Liabilities + Equity

    This is the fundamental accounting equation. It represents the fact
    that everything the company owns (assets) is financed either by
    borrowing (liabilities) or by owners' investment (equity).

    This is not an arbitrary convention - it's a conservation law.
    Value cannot appear or disappear; it can only move between accounts.
    """

    @property
    def name(self) -> str:
        return "Accounting Equation"

    @property
    def description(self) -> str:
        return "Assets must equal Liabilities plus Equity (A = L + E)"

    def check(self, data: BalanceSheetData) -> InvariantResult:
        """Check that accounting equation holds."""
        left_side = data.total_assets
        right_side = data.total_liabilities + data.total_equity
        difference = abs(left_side - right_side)

        if difference <= BALANCE_TOLERANCE:
            return InvariantResult(
                invariant_name=self.name,
                status=InvariantStatus.HOLDS,
                description="Accounting equation is satisfied",
                expected=str(left_side),
                actual=str(right_side),
                difference=str(difference),
                context={
                    "assets": str(data.total_assets),
                    "liabilities": str(data.total_liabilities),
                    "equity": str(data.total_equity),
                },
            )
        else:
            return InvariantResult(
                invariant_name=self.name,
                status=InvariantStatus.VIOLATED,
                description="Accounting equation is VIOLATED",
                expected=str(left_side),
                actual=str(right_side),
                difference=str(difference),
                context={
                    "assets": str(data.total_assets),
                    "liabilities": str(data.total_liabilities),
                    "equity": str(data.total_equity),
                    "violation_explanation": (
                        f"Value of {difference} has appeared or disappeared "
                        "without explanation"
                    ),
                },
            )


# =============================================================================
# Period Continuity Invariant
# =============================================================================


@dataclass
class PeriodContinuityData:
    """Data needed for period continuity check."""

    account_id: str
    prior_period_ending_balance: Decimal
    current_period_activity: Decimal  # Net of debits and credits
    current_period_ending_balance: Decimal


class PeriodContinuityInvariant(AccountingInvariant[PeriodContinuityData]):
    """
    Invariant: Prior Ending Balance + Activity = Current Ending Balance

    For any account, the balance must flow continuously from period to period.
    The ending balance of the prior period, plus net activity in the current
    period, must equal the ending balance of the current period.
    """

    @property
    def name(self) -> str:
        return "Period Continuity"

    @property
    def description(self) -> str:
        return "Prior ending balance + activity = current ending balance"

    def check(self, data: PeriodContinuityData) -> InvariantResult:
        """Check that balances flow continuously."""
        expected_balance = (
            data.prior_period_ending_balance + data.current_period_activity
        )
        actual_balance = data.current_period_ending_balance
        difference = abs(expected_balance - actual_balance)

        if difference <= BALANCE_TOLERANCE:
            return InvariantResult(
                invariant_name=self.name,
                status=InvariantStatus.HOLDS,
                description=f"Account {data.account_id} balances are continuous",
                expected=str(expected_balance),
                actual=str(actual_balance),
                difference=str(difference),
            )
        else:
            return InvariantResult(
                invariant_name=self.name,
                status=InvariantStatus.VIOLATED,
                description=f"Account {data.account_id} has DISCONTINUOUS balance",
                expected=str(expected_balance),
                actual=str(actual_balance),
                difference=str(difference),
                context={
                    "account_id": data.account_id,
                    "prior_balance": str(data.prior_period_ending_balance),
                    "activity": str(data.current_period_activity),
                    "expected_current": str(expected_balance),
                    "actual_current": str(actual_balance),
                },
            )


# =============================================================================
# Invariant Registry
# =============================================================================


class InvariantRegistry:
    """Registry of all accounting invariants."""

    def __init__(self) -> None:
        self._invariants: dict[str, AccountingInvariant] = {}
        self._register_defaults()

    def _register_defaults(self) -> None:
        """Register the standard accounting invariants."""
        self.register(DebitsEqualCreditsInvariant())
        self.register(TrialBalanceInvariant())
        self.register(AccountingEquationInvariant())
        self.register(PeriodContinuityInvariant())

    def register(self, invariant: AccountingInvariant) -> None:
        """Add an invariant to the registry."""
        self._invariants[invariant.name] = invariant

    def get(self, name: str) -> AccountingInvariant | None:
        """Get an invariant by name."""
        return self._invariants.get(name)

    def all(self) -> list[AccountingInvariant]:
        """Get all registered invariants."""
        return list(self._invariants.values())

    def check_entry(self, entry: JournalEntry) -> list[InvariantResult]:
        """Run all entry-level invariants against an entry."""
        results = []
        invariant = self.get("Debits Equal Credits")
        if invariant:
            results.append(invariant.check(entry))
        return results


# Global registry instance
invariant_registry = InvariantRegistry()
