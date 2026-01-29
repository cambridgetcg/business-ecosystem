"""
Core value objects for the accounting domain.

Value objects are immutable and compared by value, not identity.
They encapsulate domain concepts and enforce invariants.
"""

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from typing import Self


@dataclass(frozen=True, slots=True)
class Currency:
    """
    ISO 4217 currency code.

    Immutable value object representing a currency.
    """

    code: str

    def __post_init__(self) -> None:
        if not self.code or len(self.code) != 3:
            raise ValueError(f"Currency code must be 3 characters: {self.code}")
        # Ensure uppercase
        object.__setattr__(self, "code", self.code.upper())

    def __str__(self) -> str:
        return self.code

    @classmethod
    def usd(cls) -> Self:
        return cls("USD")

    @classmethod
    def eur(cls) -> Self:
        return cls("EUR")

    @classmethod
    def gbp(cls) -> Self:
        return cls("GBP")


@dataclass(frozen=True, slots=True)
class Money:
    """
    Monetary amount with currency.

    Immutable value object that ensures:
    - Amounts are stored as Decimal with 4 decimal places
    - Currency is always specified
    - Arithmetic operations preserve precision
    - Cannot mix currencies without explicit conversion

    Example:
        price = Money(Decimal("100.00"), Currency.usd())
        tax = price * Decimal("0.08")  # Returns Money
        total = price + tax  # Returns Money
    """

    amount: Decimal
    currency: Currency

    def __post_init__(self) -> None:
        if not isinstance(self.amount, Decimal):
            object.__setattr__(self, "amount", Decimal(str(self.amount)))
        # Normalize to 4 decimal places
        normalized = self.amount.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        object.__setattr__(self, "amount", normalized)

    def __str__(self) -> str:
        return f"{self.currency.code} {self.amount:,.4f}"

    def __add__(self, other: "Money") -> "Money":
        self._ensure_same_currency(other)
        return Money(self.amount + other.amount, self.currency)

    def __sub__(self, other: "Money") -> "Money":
        self._ensure_same_currency(other)
        return Money(self.amount - other.amount, self.currency)

    def __mul__(self, factor: Decimal | int | float) -> "Money":
        return Money(self.amount * Decimal(str(factor)), self.currency)

    def __rmul__(self, factor: Decimal | int | float) -> "Money":
        return self.__mul__(factor)

    def __neg__(self) -> "Money":
        return Money(-self.amount, self.currency)

    def __abs__(self) -> "Money":
        return Money(abs(self.amount), self.currency)

    def __bool__(self) -> bool:
        return self.amount != Decimal("0")

    def _ensure_same_currency(self, other: "Money") -> None:
        if self.currency != other.currency:
            raise ValueError(
                f"Cannot perform operation with different currencies: "
                f"{self.currency} and {other.currency}"
            )

    @property
    def is_zero(self) -> bool:
        return self.amount == Decimal("0")

    @property
    def is_positive(self) -> bool:
        return self.amount > Decimal("0")

    @property
    def is_negative(self) -> bool:
        return self.amount < Decimal("0")

    @classmethod
    def zero(cls, currency: Currency) -> Self:
        return cls(Decimal("0"), currency)

    @classmethod
    def from_cents(cls, cents: int, currency: Currency) -> Self:
        """Create Money from cents/minor units."""
        return cls(Decimal(cents) / Decimal("100"), currency)


@dataclass(frozen=True, slots=True)
class AccountCode:
    """
    Chart of Accounts code.

    Typically follows a numeric pattern like:
    - 1xxx: Assets
    - 2xxx: Liabilities
    - 3xxx: Equity
    - 4xxx: Revenue
    - 5xxx: Expenses

    The code can be hierarchical (e.g., 1000.100.001).
    """

    code: str

    def __post_init__(self) -> None:
        if not self.code or not self.code.strip():
            raise ValueError("Account code cannot be empty")
        # Normalize: remove extra spaces, uppercase
        object.__setattr__(self, "code", self.code.strip().upper())

    def __str__(self) -> str:
        return self.code

    @property
    def account_type(self) -> str:
        """Determine account type from first digit."""
        first_char = self.code[0]
        if first_char.isdigit():
            first_digit = int(first_char)
            types = {
                1: "ASSET",
                2: "LIABILITY",
                3: "EQUITY",
                4: "REVENUE",
                5: "EXPENSE",
            }
            return types.get(first_digit, "UNKNOWN")
        return "UNKNOWN"

    @property
    def is_debit_normal(self) -> bool:
        """Assets and Expenses have normal debit balances."""
        return self.account_type in ("ASSET", "EXPENSE")

    @property
    def is_credit_normal(self) -> bool:
        """Liabilities, Equity, and Revenue have normal credit balances."""
        return self.account_type in ("LIABILITY", "EQUITY", "REVENUE")


@dataclass(frozen=True, slots=True)
class FiscalPeriod:
    """
    Fiscal period identifier.

    Represents a specific accounting period (month) within a fiscal year.
    """

    year: int
    period: int  # 1-12 for months, or 13+ for adjusting periods

    def __post_init__(self) -> None:
        if self.year < 1900 or self.year > 2100:
            raise ValueError(f"Year must be between 1900 and 2100: {self.year}")
        if self.period < 1 or self.period > 15:  # Allow adjusting periods
            raise ValueError(f"Period must be between 1 and 15: {self.period}")

    def __str__(self) -> str:
        return f"{self.year}-P{self.period:02d}"

    @property
    def is_adjusting_period(self) -> bool:
        """Periods 13+ are typically adjusting/closing periods."""
        return self.period > 12

    def next_period(self) -> "FiscalPeriod":
        """Get the next fiscal period."""
        if self.period >= 12:
            return FiscalPeriod(self.year + 1, 1)
        return FiscalPeriod(self.year, self.period + 1)

    def previous_period(self) -> "FiscalPeriod":
        """Get the previous fiscal period."""
        if self.period <= 1:
            return FiscalPeriod(self.year - 1, 12)
        return FiscalPeriod(self.year, self.period - 1)

    @classmethod
    def from_date(cls, year: int, month: int) -> Self:
        """Create fiscal period from year and month."""
        return cls(year, month)
