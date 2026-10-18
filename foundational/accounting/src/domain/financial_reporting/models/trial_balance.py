"""
Trial Balance - verification that total debits equal total credits.

The trial balance is a fundamental accounting control that verifies
the mathematical accuracy of the double-entry bookkeeping system.
It lists all accounts with their debit or credit balances.

If total debits != total credits, there is an error in the general ledger
that MUST be investigated and corrected.

Research Grounding: docs/research/08-financial-statement-presentation.md
"""

from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from src.domain.chart_of_accounts.models.account import AccountType


@dataclass(frozen=True)
class TrialBalanceLine:
    """
    A single line in the trial balance representing one account.

    Attributes:
        account_id: Account identifier
        account_code: Account code for display
        account_name: Account name for display
        account_type: Classification (Asset, Liability, etc.)
        debit_balance: Balance if account has debit balance
        credit_balance: Balance if account has credit balance
        parent_account_id: For hierarchical display
        depth: Nesting level in hierarchy (0 = top level)
    """

    account_id: str
    account_code: str
    account_name: str
    account_type: AccountType
    debit_balance: Decimal
    credit_balance: Decimal
    parent_account_id: Optional[str] = None
    depth: int = 0

    @property
    def balance(self) -> Decimal:
        """Net balance (debit positive, credit negative)."""
        return self.debit_balance - self.credit_balance

    @property
    def has_balance(self) -> bool:
        """Return True if account has any balance."""
        return self.debit_balance != Decimal("0") or self.credit_balance != Decimal("0")

    @property
    def is_debit_balance(self) -> bool:
        """Return True if account has a debit balance."""
        return self.debit_balance > Decimal("0") and self.credit_balance == Decimal("0")

    @property
    def is_credit_balance(self) -> bool:
        """Return True if account has a credit balance."""
        return self.credit_balance > Decimal("0") and self.debit_balance == Decimal("0")


@dataclass
class TrialBalance:
    """
    Trial Balance report at a specific point in time.

    The trial balance proves that debits = credits in the general ledger.
    If they don't balance, the difference indicates an error.

    Attributes:
        as_of_date: The date this trial balance represents
        fiscal_period_id: Optional fiscal period filter
        currency_code: Currency of the balances
        lines: Individual account lines
        generated_at: When this report was generated
        generated_by: Who/what generated this report
    """

    as_of_date: date
    currency_code: str = "USD"
    fiscal_period_id: Optional[str] = None
    lines: list[TrialBalanceLine] = field(default_factory=list)
    generated_at: datetime = field(default_factory=datetime.utcnow)
    generated_by: Optional[str] = None

    @property
    def total_debits(self) -> Decimal:
        """Sum of all debit balances."""
        return sum((line.debit_balance for line in self.lines), Decimal("0"))

    @property
    def total_credits(self) -> Decimal:
        """Sum of all credit balances."""
        return sum((line.credit_balance for line in self.lines), Decimal("0"))

    @property
    def is_balanced(self) -> bool:
        """
        Return True if total debits equal total credits.

        This is the fundamental check of double-entry integrity.
        If False, there is an error in the general ledger.
        """
        tolerance = Decimal("0.01")  # Allow for minor rounding
        return abs(self.total_debits - self.total_credits) < tolerance

    @property
    def difference(self) -> Decimal:
        """
        Difference between debits and credits.

        Should be zero (or near-zero) if books are balanced.
        Positive = debits exceed credits
        Negative = credits exceed debits
        """
        return self.total_debits - self.total_credits

    @property
    def account_count(self) -> int:
        """Number of accounts with balances."""
        return len([line for line in self.lines if line.has_balance])

    @property
    def total_account_count(self) -> int:
        """Total number of accounts in trial balance."""
        return len(self.lines)

    def get_lines_by_type(self, account_type: AccountType) -> list[TrialBalanceLine]:
        """Get all lines for a specific account type."""
        return [line for line in self.lines if line.account_type == account_type]

    def get_subtotal_by_type(self, account_type: AccountType) -> tuple[Decimal, Decimal]:
        """
        Get subtotal debits and credits for an account type.

        Returns:
            Tuple of (total_debits, total_credits) for the account type
        """
        lines = self.get_lines_by_type(account_type)
        total_debits = sum((line.debit_balance for line in lines), Decimal("0"))
        total_credits = sum((line.credit_balance for line in lines), Decimal("0"))
        return total_debits, total_credits

    def add_line(self, line: TrialBalanceLine) -> None:
        """Add a line to the trial balance."""
        self.lines.append(line)

    def sort_by_account_code(self) -> None:
        """Sort lines by account code."""
        self.lines.sort(key=lambda x: x.account_code)

    def sort_by_account_type(self) -> None:
        """Sort lines by account type, then by code."""
        type_order = {
            AccountType.ASSET: 1,
            AccountType.LIABILITY: 2,
            AccountType.EQUITY: 3,
            AccountType.REVENUE: 4,
            AccountType.EXPENSE: 5,
        }
        self.lines.sort(key=lambda x: (type_order.get(x.account_type, 99), x.account_code))

    def to_dict(self) -> dict:
        """Convert to dictionary for API response."""
        return {
            "as_of_date": self.as_of_date.isoformat(),
            "currency_code": self.currency_code,
            "fiscal_period_id": self.fiscal_period_id,
            "generated_at": self.generated_at.isoformat(),
            "generated_by": self.generated_by,
            "total_debits": str(self.total_debits),
            "total_credits": str(self.total_credits),
            "is_balanced": self.is_balanced,
            "difference": str(self.difference),
            "account_count": self.account_count,
            "lines": [
                {
                    "account_id": line.account_id,
                    "account_code": line.account_code,
                    "account_name": line.account_name,
                    "account_type": line.account_type.value,
                    "debit_balance": str(line.debit_balance),
                    "credit_balance": str(line.credit_balance),
                    "depth": line.depth,
                }
                for line in self.lines
                if line.has_balance  # Only include accounts with balances
            ],
        }
