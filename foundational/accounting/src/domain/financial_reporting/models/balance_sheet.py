"""
Balance Sheet - statement of financial position.

The balance sheet shows the accounting equation: Assets = Liabilities + Equity
at a specific point in time.

Also known as:
- Statement of Financial Position (IFRS preferred term)
- Statement of Financial Condition

Research Grounding: docs/research/08-financial-statement-presentation.md
AI Knowledge Gap (doc 12): Presentation varies by jurisdiction (GAAP vs IFRS).
"""

from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Optional


class BalanceSheetFormat(str, Enum):
    """
    Balance sheet presentation format.

    ACCOUNT_FORMAT: Assets on left, Liabilities + Equity on right
    REPORT_FORMAT: Assets on top, Liabilities + Equity below (vertical)
    """

    ACCOUNT_FORMAT = "ACCOUNT"
    REPORT_FORMAT = "REPORT"


@dataclass(frozen=True)
class BalanceSheetLine:
    """
    A single line in the balance sheet.

    Attributes:
        account_id: Account identifier
        account_code: Account code for reference
        account_name: Account name for display
        amount: Balance amount
        depth: Nesting level (0 = top level)
        is_subtotal: True if this is a subtotal line
        is_total: True if this is a section total
    """

    account_id: Optional[str]
    account_code: Optional[str]
    account_name: str
    amount: Decimal
    depth: int = 0
    is_subtotal: bool = False
    is_total: bool = False


@dataclass
class BalanceSheetSection:
    """
    A section of the balance sheet (e.g., Current Assets, Fixed Assets).

    Attributes:
        name: Section name
        lines: Individual account lines
        subtotal: Calculated section subtotal
    """

    name: str
    lines: list[BalanceSheetLine] = field(default_factory=list)

    @property
    def subtotal(self) -> Decimal:
        """Calculate section subtotal from lines."""
        return sum(
            (line.amount for line in self.lines if not line.is_subtotal and not line.is_total),
            Decimal("0"),
        )

    def add_line(self, line: BalanceSheetLine) -> None:
        """Add a line to the section."""
        self.lines.append(line)


@dataclass
class BalanceSheet:
    """
    Balance Sheet (Statement of Financial Position).

    The fundamental accounting equation: Assets = Liabilities + Equity

    This invariant MUST always hold. If it doesn't, there is an error
    in the general ledger that requires investigation.

    Attributes:
        as_of_date: Date of the balance sheet
        currency_code: Reporting currency
        format: Presentation format
        current_assets: Current assets section
        non_current_assets: Non-current/fixed assets section
        current_liabilities: Current liabilities section
        non_current_liabilities: Non-current/long-term liabilities section
        equity: Shareholders' equity section
        generated_at: Report generation timestamp
        generated_by: Who generated the report
    """

    as_of_date: date
    currency_code: str = "USD"
    format: BalanceSheetFormat = BalanceSheetFormat.REPORT_FORMAT

    # Asset sections
    current_assets: BalanceSheetSection = field(
        default_factory=lambda: BalanceSheetSection("Current Assets")
    )
    non_current_assets: BalanceSheetSection = field(
        default_factory=lambda: BalanceSheetSection("Non-Current Assets")
    )

    # Liability sections
    current_liabilities: BalanceSheetSection = field(
        default_factory=lambda: BalanceSheetSection("Current Liabilities")
    )
    non_current_liabilities: BalanceSheetSection = field(
        default_factory=lambda: BalanceSheetSection("Non-Current Liabilities")
    )

    # Equity section
    equity: BalanceSheetSection = field(
        default_factory=lambda: BalanceSheetSection("Shareholders' Equity")
    )

    # Metadata
    generated_at: datetime = field(default_factory=datetime.utcnow)
    generated_by: Optional[str] = None

    # -------------------------------------------------------------------------
    # Calculated Properties
    # -------------------------------------------------------------------------

    @property
    def total_current_assets(self) -> Decimal:
        """Total current assets."""
        return self.current_assets.subtotal

    @property
    def total_non_current_assets(self) -> Decimal:
        """Total non-current assets."""
        return self.non_current_assets.subtotal

    @property
    def total_assets(self) -> Decimal:
        """Total assets (current + non-current)."""
        return self.total_current_assets + self.total_non_current_assets

    @property
    def total_current_liabilities(self) -> Decimal:
        """Total current liabilities."""
        return self.current_liabilities.subtotal

    @property
    def total_non_current_liabilities(self) -> Decimal:
        """Total non-current liabilities."""
        return self.non_current_liabilities.subtotal

    @property
    def total_liabilities(self) -> Decimal:
        """Total liabilities (current + non-current)."""
        return self.total_current_liabilities + self.total_non_current_liabilities

    @property
    def total_equity(self) -> Decimal:
        """Total shareholders' equity."""
        return self.equity.subtotal

    @property
    def total_liabilities_and_equity(self) -> Decimal:
        """Total liabilities plus equity."""
        return self.total_liabilities + self.total_equity

    @property
    def is_balanced(self) -> bool:
        """
        Verify the accounting equation: Assets = Liabilities + Equity.

        This MUST be true. If false, there is an error in the general ledger.
        """
        tolerance = Decimal("0.01")
        return abs(self.total_assets - self.total_liabilities_and_equity) < tolerance

    @property
    def difference(self) -> Decimal:
        """Difference between assets and liabilities + equity."""
        return self.total_assets - self.total_liabilities_and_equity

    @property
    def working_capital(self) -> Decimal:
        """Working capital = Current Assets - Current Liabilities."""
        return self.total_current_assets - self.total_current_liabilities

    @property
    def current_ratio(self) -> Optional[Decimal]:
        """Current ratio = Current Assets / Current Liabilities."""
        if self.total_current_liabilities == Decimal("0"):
            return None
        return self.total_current_assets / self.total_current_liabilities

    @property
    def debt_to_equity_ratio(self) -> Optional[Decimal]:
        """Debt to equity ratio = Total Liabilities / Total Equity."""
        if self.total_equity == Decimal("0"):
            return None
        return self.total_liabilities / self.total_equity

    # -------------------------------------------------------------------------
    # Serialization
    # -------------------------------------------------------------------------

    def to_dict(self) -> dict:
        """Convert to dictionary for API response."""
        return {
            "as_of_date": self.as_of_date.isoformat(),
            "currency_code": self.currency_code,
            "format": self.format.value,
            "generated_at": self.generated_at.isoformat(),
            "generated_by": self.generated_by,
            "is_balanced": self.is_balanced,
            "difference": str(self.difference),
            "assets": {
                "current_assets": {
                    "name": self.current_assets.name,
                    "lines": self._section_lines_to_dict(self.current_assets),
                    "subtotal": str(self.total_current_assets),
                },
                "non_current_assets": {
                    "name": self.non_current_assets.name,
                    "lines": self._section_lines_to_dict(self.non_current_assets),
                    "subtotal": str(self.total_non_current_assets),
                },
                "total_assets": str(self.total_assets),
            },
            "liabilities": {
                "current_liabilities": {
                    "name": self.current_liabilities.name,
                    "lines": self._section_lines_to_dict(self.current_liabilities),
                    "subtotal": str(self.total_current_liabilities),
                },
                "non_current_liabilities": {
                    "name": self.non_current_liabilities.name,
                    "lines": self._section_lines_to_dict(self.non_current_liabilities),
                    "subtotal": str(self.total_non_current_liabilities),
                },
                "total_liabilities": str(self.total_liabilities),
            },
            "equity": {
                "name": self.equity.name,
                "lines": self._section_lines_to_dict(self.equity),
                "total_equity": str(self.total_equity),
            },
            "total_liabilities_and_equity": str(self.total_liabilities_and_equity),
            "ratios": {
                "working_capital": str(self.working_capital),
                "current_ratio": str(self.current_ratio) if self.current_ratio else None,
                "debt_to_equity_ratio": (
                    str(self.debt_to_equity_ratio) if self.debt_to_equity_ratio else None
                ),
            },
        }

    def _section_lines_to_dict(self, section: BalanceSheetSection) -> list[dict]:
        """Convert section lines to list of dicts."""
        return [
            {
                "account_id": line.account_id,
                "account_code": line.account_code,
                "account_name": line.account_name,
                "amount": str(line.amount),
                "depth": line.depth,
                "is_subtotal": line.is_subtotal,
                "is_total": line.is_total,
            }
            for line in section.lines
        ]
