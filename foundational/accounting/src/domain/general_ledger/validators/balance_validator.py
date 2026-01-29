"""
Balance Validator - enforces the fundamental accounting equation.

This validator ensures:
1. Every journal entry has debits = credits
2. The trial balance always balances
3. Account balances are consistent with their type

CRITICAL: This validation is DETERMINISTIC. It uses exact Decimal arithmetic.
AI Knowledge Gap (doc 11): Multi-step reasoning can compound errors.
Financial validation MUST NOT use AI reasoning - only exact calculation.

Research Grounding: docs/research/01-double-entry-bookkeeping-standards.md
"""

from dataclasses import dataclass
from decimal import Decimal
from typing import Sequence

from src.domain.general_ledger.models.journal_entry import JournalEntry
from src.domain.general_ledger.models.journal_entry_line import JournalEntryLine, EntryType
from src.domain.shared.exceptions import (
    UnbalancedEntryError,
    InvariantViolationError,
    ValidationError,
)


# Tolerance for floating point comparison (4 decimal places)
# This handles minor rounding differences while catching real errors
BALANCE_TOLERANCE = Decimal("0.0001")


@dataclass(frozen=True)
class BalanceValidationResult:
    """Result of a balance validation check."""

    is_valid: bool
    total_debits: Decimal
    total_credits: Decimal
    difference: Decimal
    error_message: str | None = None

    @property
    def is_balanced(self) -> bool:
        """Alias for is_valid."""
        return self.is_valid


@dataclass(frozen=True)
class TrialBalanceResult:
    """Result of a trial balance calculation."""

    is_balanced: bool
    total_debit_balances: Decimal
    total_credit_balances: Decimal
    difference: Decimal
    account_count: int
    error_message: str | None = None


class BalanceValidator:
    """
    Validator for accounting balance invariants.

    This class provides deterministic validation of:
    - Individual journal entry balance (debits = credits)
    - Trial balance totals
    - Account balance consistency

    All methods use exact Decimal arithmetic to ensure
    reliable validation without floating point errors.
    """

    def __init__(self, tolerance: Decimal = BALANCE_TOLERANCE) -> None:
        """
        Initialize the validator.

        Args:
            tolerance: Maximum allowed difference for balance checks.
                      Default is 0.0001 (4 decimal places).
        """
        self.tolerance = tolerance

    def validate_entry_balance(self, entry: JournalEntry) -> BalanceValidationResult:
        """
        Validate that a journal entry's debits equal credits.

        Args:
            entry: The journal entry to validate

        Returns:
            BalanceValidationResult with validation outcome

        Note: This method does NOT raise exceptions. Call validate_entry_balance_strict
              if you want exceptions raised on failure.
        """
        total_debits, total_credits = self._calculate_entry_totals(entry.lines)
        difference = abs(total_debits - total_credits)
        is_valid = difference < self.tolerance

        error_message = None
        if not is_valid:
            error_message = (
                f"Entry is unbalanced: debits={total_debits}, "
                f"credits={total_credits}, difference={difference}"
            )

        return BalanceValidationResult(
            is_valid=is_valid,
            total_debits=total_debits,
            total_credits=total_credits,
            difference=difference,
            error_message=error_message,
        )

    def validate_entry_balance_strict(self, entry: JournalEntry) -> None:
        """
        Validate that a journal entry's debits equal credits.

        Args:
            entry: The journal entry to validate

        Raises:
            UnbalancedEntryError: If debits don't equal credits
        """
        result = self.validate_entry_balance(entry)
        if not result.is_valid:
            raise UnbalancedEntryError(
                debit_total=str(result.total_debits),
                credit_total=str(result.total_credits),
            )

    def validate_lines_balance(
        self, lines: Sequence[JournalEntryLine]
    ) -> BalanceValidationResult:
        """
        Validate that a set of lines balances.

        Useful for validating before the lines are attached to an entry.

        Args:
            lines: Sequence of journal entry lines

        Returns:
            BalanceValidationResult with validation outcome
        """
        total_debits, total_credits = self._calculate_entry_totals(lines)
        difference = abs(total_debits - total_credits)
        is_valid = difference < self.tolerance

        error_message = None
        if not is_valid:
            error_message = (
                f"Lines are unbalanced: debits={total_debits}, "
                f"credits={total_credits}, difference={difference}"
            )

        return BalanceValidationResult(
            is_valid=is_valid,
            total_debits=total_debits,
            total_credits=total_credits,
            difference=difference,
            error_message=error_message,
        )

    def validate_entry_minimum_lines(self, entry: JournalEntry) -> None:
        """
        Validate that an entry has the minimum required lines.

        Args:
            entry: The journal entry to validate

        Raises:
            InvariantViolationError: If entry doesn't meet requirements
        """
        if not entry.lines or len(entry.lines) < 2:
            raise InvariantViolationError(
                invariant="MINIMUM_LINES",
                message="Journal entry must have at least 2 lines",
            )

        # Must have at least one debit and one credit
        has_debit = any(line.is_debit for line in entry.lines)
        has_credit = any(line.is_credit for line in entry.lines)

        if not has_debit:
            raise InvariantViolationError(
                invariant="DEBIT_REQUIRED",
                message="Journal entry must have at least one debit line",
            )

        if not has_credit:
            raise InvariantViolationError(
                invariant="CREDIT_REQUIRED",
                message="Journal entry must have at least one credit line",
            )

    def validate_positive_amounts(self, entry: JournalEntry) -> None:
        """
        Validate that all line amounts are positive.

        In double-entry, the entry_type (DEBIT/CREDIT) determines direction,
        so amounts should always be positive.

        Args:
            entry: The journal entry to validate

        Raises:
            ValidationError: If any amount is not positive
        """
        for i, line in enumerate(entry.lines):
            if line.amount <= Decimal("0"):
                raise ValidationError(
                    message=f"Line {i + 1} amount must be positive, got {line.amount}",
                    field=f"lines[{i}].amount",
                )

    def validate_entry_complete(self, entry: JournalEntry) -> None:
        """
        Run all validations on an entry.

        This is the primary validation method to call before posting.

        Args:
            entry: The journal entry to validate

        Raises:
            UnbalancedEntryError: If debits don't equal credits
            InvariantViolationError: If structural invariants are violated
            ValidationError: If field validation fails
        """
        self.validate_entry_minimum_lines(entry)
        self.validate_positive_amounts(entry)
        self.validate_entry_balance_strict(entry)

    def calculate_trial_balance(
        self,
        account_balances: dict[str, tuple[Decimal, str]],  # account_id -> (balance, normal_side)
    ) -> TrialBalanceResult:
        """
        Calculate and validate trial balance from account balances.

        A trial balance lists all accounts with their balances,
        organized by whether they normally have debit or credit balances.
        The sum of debit balances MUST equal the sum of credit balances.

        Args:
            account_balances: Dict mapping account_id to (balance, normal_side)
                             where normal_side is "DEBIT" or "CREDIT"

        Returns:
            TrialBalanceResult with calculation results
        """
        total_debit_balances = Decimal("0")
        total_credit_balances = Decimal("0")

        for account_id, (balance, normal_side) in account_balances.items():
            if normal_side == "DEBIT":
                # Debit-normal accounts: positive balance goes to debit column
                if balance >= 0:
                    total_debit_balances += balance
                else:
                    total_credit_balances += abs(balance)
            else:
                # Credit-normal accounts: positive balance goes to credit column
                if balance >= 0:
                    total_credit_balances += balance
                else:
                    total_debit_balances += abs(balance)

        difference = abs(total_debit_balances - total_credit_balances)
        is_balanced = difference < self.tolerance

        error_message = None
        if not is_balanced:
            error_message = (
                f"Trial balance is out of balance: "
                f"total_debits={total_debit_balances}, "
                f"total_credits={total_credit_balances}, "
                f"difference={difference}"
            )

        return TrialBalanceResult(
            is_balanced=is_balanced,
            total_debit_balances=total_debit_balances,
            total_credit_balances=total_credit_balances,
            difference=difference,
            account_count=len(account_balances),
            error_message=error_message,
        )

    # -------------------------------------------------------------------------
    # Private Methods
    # -------------------------------------------------------------------------

    def _calculate_entry_totals(
        self, lines: Sequence[JournalEntryLine]
    ) -> tuple[Decimal, Decimal]:
        """
        Calculate total debits and credits from lines.

        Uses exact Decimal arithmetic for precision.

        Args:
            lines: Sequence of journal entry lines

        Returns:
            Tuple of (total_debits, total_credits)
        """
        total_debits = Decimal("0")
        total_credits = Decimal("0")

        for line in lines:
            if line.entry_type == EntryType.DEBIT:
                total_debits += line.amount
            else:
                total_credits += line.amount

        return total_debits, total_credits
