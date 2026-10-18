"""
Income Statement - statement of operations / profit and loss.

The income statement shows the results of operations over a period of time:
Revenue - Expenses = Net Income (or Net Loss)

Also known as:
- Statement of Operations
- Profit and Loss Statement (P&L)
- Statement of Earnings
- Statement of Income

Research Grounding: docs/research/08-financial-statement-presentation.md
"""

from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Optional


class IncomeStatementFormat(str, Enum):
    """
    Income statement presentation format.

    SINGLE_STEP: Revenue - All Expenses = Net Income
    MULTI_STEP: Shows gross profit, operating income, etc.
    """

    SINGLE_STEP = "SINGLE_STEP"
    MULTI_STEP = "MULTI_STEP"


@dataclass(frozen=True)
class IncomeStatementLine:
    """
    A single line in the income statement.

    Attributes:
        account_id: Account identifier
        account_code: Account code for reference
        account_name: Account name for display
        amount: Balance amount (positive for revenue, positive for expenses)
        depth: Nesting level
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
class IncomeStatementSection:
    """
    A section of the income statement.

    Attributes:
        name: Section name (e.g., "Operating Revenue", "Cost of Goods Sold")
        lines: Individual account lines
    """

    name: str
    lines: list[IncomeStatementLine] = field(default_factory=list)

    @property
    def subtotal(self) -> Decimal:
        """Calculate section subtotal from lines."""
        return sum(
            (line.amount for line in self.lines if not line.is_subtotal and not line.is_total),
            Decimal("0"),
        )

    def add_line(self, line: IncomeStatementLine) -> None:
        """Add a line to the section."""
        self.lines.append(line)


@dataclass
class IncomeStatement:
    """
    Income Statement (Statement of Operations).

    Shows the formula: Revenue - Expenses = Net Income

    For multi-step format:
    - Gross Profit = Revenue - Cost of Goods Sold
    - Operating Income = Gross Profit - Operating Expenses
    - Net Income = Operating Income + Other Income - Other Expenses - Taxes

    Attributes:
        period_start: Start of the reporting period
        period_end: End of the reporting period
        currency_code: Reporting currency
        format: Presentation format (single-step or multi-step)
        revenue: Revenue section
        cost_of_goods_sold: COGS section (for multi-step)
        operating_expenses: Operating expenses section
        other_income: Other income section
        other_expenses: Other expenses section
        income_tax_expense: Tax expense section
        generated_at: Report generation timestamp
        generated_by: Who generated the report
    """

    period_start: date
    period_end: date
    currency_code: str = "USD"
    format: IncomeStatementFormat = IncomeStatementFormat.MULTI_STEP

    # Revenue
    revenue: IncomeStatementSection = field(
        default_factory=lambda: IncomeStatementSection("Revenue")
    )

    # Cost of Goods Sold (for multi-step)
    cost_of_goods_sold: IncomeStatementSection = field(
        default_factory=lambda: IncomeStatementSection("Cost of Goods Sold")
    )

    # Operating Expenses
    operating_expenses: IncomeStatementSection = field(
        default_factory=lambda: IncomeStatementSection("Operating Expenses")
    )

    # Other Income/Expenses
    other_income: IncomeStatementSection = field(
        default_factory=lambda: IncomeStatementSection("Other Income")
    )
    other_expenses: IncomeStatementSection = field(
        default_factory=lambda: IncomeStatementSection("Other Expenses")
    )

    # Income Tax
    income_tax_expense: IncomeStatementSection = field(
        default_factory=lambda: IncomeStatementSection("Income Tax Expense")
    )

    # Metadata
    generated_at: datetime = field(default_factory=datetime.utcnow)
    generated_by: Optional[str] = None

    # -------------------------------------------------------------------------
    # Calculated Properties
    # -------------------------------------------------------------------------

    @property
    def total_revenue(self) -> Decimal:
        """Total revenue."""
        return self.revenue.subtotal

    @property
    def total_cogs(self) -> Decimal:
        """Total cost of goods sold."""
        return self.cost_of_goods_sold.subtotal

    @property
    def gross_profit(self) -> Decimal:
        """Gross profit = Revenue - COGS."""
        return self.total_revenue - self.total_cogs

    @property
    def gross_profit_margin(self) -> Optional[Decimal]:
        """Gross profit margin = Gross Profit / Revenue."""
        if self.total_revenue == Decimal("0"):
            return None
        return (self.gross_profit / self.total_revenue) * Decimal("100")

    @property
    def total_operating_expenses(self) -> Decimal:
        """Total operating expenses."""
        return self.operating_expenses.subtotal

    @property
    def operating_income(self) -> Decimal:
        """Operating income = Gross Profit - Operating Expenses."""
        return self.gross_profit - self.total_operating_expenses

    @property
    def operating_margin(self) -> Optional[Decimal]:
        """Operating margin = Operating Income / Revenue."""
        if self.total_revenue == Decimal("0"):
            return None
        return (self.operating_income / self.total_revenue) * Decimal("100")

    @property
    def total_other_income(self) -> Decimal:
        """Total other income."""
        return self.other_income.subtotal

    @property
    def total_other_expenses(self) -> Decimal:
        """Total other expenses."""
        return self.other_expenses.subtotal

    @property
    def income_before_tax(self) -> Decimal:
        """Income before tax = Operating Income + Other Income - Other Expenses."""
        return self.operating_income + self.total_other_income - self.total_other_expenses

    @property
    def total_tax_expense(self) -> Decimal:
        """Total income tax expense."""
        return self.income_tax_expense.subtotal

    @property
    def net_income(self) -> Decimal:
        """Net income = Income Before Tax - Tax Expense."""
        return self.income_before_tax - self.total_tax_expense

    @property
    def net_profit_margin(self) -> Optional[Decimal]:
        """Net profit margin = Net Income / Revenue."""
        if self.total_revenue == Decimal("0"):
            return None
        return (self.net_income / self.total_revenue) * Decimal("100")

    @property
    def is_profitable(self) -> bool:
        """Return True if net income is positive."""
        return self.net_income > Decimal("0")

    @property
    def total_expenses(self) -> Decimal:
        """Total of all expenses (for single-step format)."""
        return (
            self.total_cogs
            + self.total_operating_expenses
            + self.total_other_expenses
            + self.total_tax_expense
        )

    # -------------------------------------------------------------------------
    # Serialization
    # -------------------------------------------------------------------------

    def to_dict(self) -> dict:
        """Convert to dictionary for API response."""
        result = {
            "period_start": self.period_start.isoformat(),
            "period_end": self.period_end.isoformat(),
            "currency_code": self.currency_code,
            "format": self.format.value,
            "generated_at": self.generated_at.isoformat(),
            "generated_by": self.generated_by,
            "summary": {
                "total_revenue": str(self.total_revenue),
                "gross_profit": str(self.gross_profit),
                "operating_income": str(self.operating_income),
                "income_before_tax": str(self.income_before_tax),
                "net_income": str(self.net_income),
                "is_profitable": self.is_profitable,
            },
            "ratios": {
                "gross_profit_margin": (
                    f"{self.gross_profit_margin:.2f}%" if self.gross_profit_margin else None
                ),
                "operating_margin": (
                    f"{self.operating_margin:.2f}%" if self.operating_margin else None
                ),
                "net_profit_margin": (
                    f"{self.net_profit_margin:.2f}%" if self.net_profit_margin else None
                ),
            },
        }

        if self.format == IncomeStatementFormat.MULTI_STEP:
            result["sections"] = {
                "revenue": self._section_to_dict(self.revenue),
                "cost_of_goods_sold": self._section_to_dict(self.cost_of_goods_sold),
                "gross_profit": str(self.gross_profit),
                "operating_expenses": self._section_to_dict(self.operating_expenses),
                "operating_income": str(self.operating_income),
                "other_income": self._section_to_dict(self.other_income),
                "other_expenses": self._section_to_dict(self.other_expenses),
                "income_before_tax": str(self.income_before_tax),
                "income_tax_expense": self._section_to_dict(self.income_tax_expense),
                "net_income": str(self.net_income),
            }
        else:
            # Single-step format
            result["sections"] = {
                "revenue": self._section_to_dict(self.revenue),
                "total_revenue": str(self.total_revenue),
                "expenses": {
                    "cost_of_goods_sold": self._section_to_dict(self.cost_of_goods_sold),
                    "operating_expenses": self._section_to_dict(self.operating_expenses),
                    "other_expenses": self._section_to_dict(self.other_expenses),
                    "income_tax": self._section_to_dict(self.income_tax_expense),
                },
                "total_expenses": str(self.total_expenses),
                "net_income": str(self.net_income),
            }

        return result

    def _section_to_dict(self, section: IncomeStatementSection) -> dict:
        """Convert a section to dictionary."""
        return {
            "name": section.name,
            "lines": [
                {
                    "account_id": line.account_id,
                    "account_code": line.account_code,
                    "account_name": line.account_name,
                    "amount": str(line.amount),
                    "depth": line.depth,
                    "is_subtotal": line.is_subtotal,
                }
                for line in section.lines
            ],
            "subtotal": str(section.subtotal),
        }
