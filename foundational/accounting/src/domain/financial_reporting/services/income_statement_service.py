"""
Income Statement Service - generates income statement reports.

The income statement shows the results of operations over a period:
Revenue - Expenses = Net Income

Research Grounding: docs/research/08-financial-statement-presentation.md
AI Knowledge Gap (doc 12): Presentation varies by jurisdiction.
"""

from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.chart_of_accounts.models.account import Account, AccountType
from src.domain.general_ledger.models.journal_entry import JournalEntry
from src.domain.general_ledger.models.journal_entry_line import JournalEntryLine, EntryType
from src.domain.general_ledger.models.posting_status import PostingStatus
from src.domain.financial_reporting.models.income_statement import (
    IncomeStatement,
    IncomeStatementSection,
    IncomeStatementLine,
    IncomeStatementFormat,
)


class IncomeStatementService:
    """
    Service for generating income statement reports.

    The income statement aggregates Revenue and Expense accounts
    for a specific period to show profitability.

    Features:
    - Period-based income statement
    - Single-step or multi-step format
    - Gross profit and operating income calculations
    - Profit margin ratios
    """

    # Account code prefixes for classification
    COGS_PREFIXES = ("50", "51")        # Cost of Goods Sold: 5000-5199
    OPERATING_EXPENSE_PREFIXES = ("52", "53", "54", "55", "56", "57", "58")  # 5200-5899
    OTHER_EXPENSE_PREFIXES = ("59",)     # Other expenses: 5900-5999
    TAX_EXPENSE_PREFIXES = ("60",)       # Tax expense: 6000-6099
    OTHER_INCOME_PREFIXES = ("48", "49") # Other income: 4800-4999

    def __init__(self, session: AsyncSession) -> None:
        """
        Initialize the service.

        Args:
            session: SQLAlchemy async session
        """
        self.session = session

    async def generate(
        self,
        period_start: date,
        period_end: date,
        currency_code: str = "USD",
        format: IncomeStatementFormat = IncomeStatementFormat.MULTI_STEP,
        generated_by: Optional[str] = None,
    ) -> IncomeStatement:
        """
        Generate an income statement for a period.

        Args:
            period_start: Start of the reporting period
            period_end: End of the reporting period
            currency_code: Reporting currency
            format: Presentation format
            generated_by: User/system generating the report

        Returns:
            IncomeStatement object
        """
        # Calculate account balances for the period
        account_balances = await self._calculate_period_balances(
            period_start=period_start,
            period_end=period_end,
            currency_code=currency_code,
        )

        # Get accounts
        accounts = await self._get_income_statement_accounts(currency_code)

        # Create income statement
        income_statement = IncomeStatement(
            period_start=period_start,
            period_end=period_end,
            currency_code=currency_code,
            format=format,
            generated_by=generated_by,
        )

        # Classify and add accounts to appropriate sections
        for account in accounts:
            balance_data = account_balances.get(account.id)
            if not balance_data:
                continue

            debits = balance_data["debits"]
            credits = balance_data["credits"]

            if account.account_type == AccountType.REVENUE:
                # Revenue has credit balance
                amount = credits - debits
                if amount != Decimal("0"):
                    self._add_revenue_line(income_statement, account, amount)
            elif account.account_type == AccountType.EXPENSE:
                # Expense has debit balance
                amount = debits - credits
                if amount != Decimal("0"):
                    self._add_expense_line(income_statement, account, amount)

        return income_statement

    async def _calculate_period_balances(
        self,
        period_start: date,
        period_end: date,
        currency_code: str,
    ) -> dict[str, dict[str, Decimal]]:
        """
        Calculate account balances for a specific period.

        Only includes Revenue and Expense accounts.

        Returns:
            Dict mapping account_id to {"debits": Decimal, "credits": Decimal}
        """
        # Query aggregated debits and credits for the period
        stmt = (
            select(
                JournalEntryLine.account_id,
                JournalEntryLine.entry_type,
                func.sum(JournalEntryLine.amount).label("total"),
            )
            .join(JournalEntry, JournalEntryLine.journal_entry_id == JournalEntry.id)
            .join(Account, JournalEntryLine.account_id == Account.id)
            .where(JournalEntry.status == PostingStatus.POSTED)
            .where(JournalEntry.entry_date >= period_start)
            .where(JournalEntry.entry_date <= period_end)
            .where(JournalEntry.currency_code == currency_code)
            .where(Account.account_type.in_([AccountType.REVENUE, AccountType.EXPENSE]))
            .group_by(JournalEntryLine.account_id, JournalEntryLine.entry_type)
        )

        result = await self.session.execute(stmt)
        rows = result.all()

        # Build balance dictionary
        balances: dict[str, dict[str, Decimal]] = {}
        for row in rows:
            account_id = row.account_id
            if account_id not in balances:
                balances[account_id] = {"debits": Decimal("0"), "credits": Decimal("0")}

            if row.entry_type == EntryType.DEBIT:
                balances[account_id]["debits"] += row.total or Decimal("0")
            else:
                balances[account_id]["credits"] += row.total or Decimal("0")

        return balances

    async def _get_income_statement_accounts(self, currency_code: str) -> list[Account]:
        """
        Get all Revenue and Expense accounts.
        """
        stmt = (
            select(Account)
            .where(Account.is_active == True)
            .where(Account.is_header == False)
            .where(Account.currency_code == currency_code)
            .where(Account.deleted_at.is_(None))
            .where(Account.account_type.in_([AccountType.REVENUE, AccountType.EXPENSE]))
            .order_by(Account.code)
        )

        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    def _add_revenue_line(
        self,
        income_statement: IncomeStatement,
        account: Account,
        amount: Decimal,
    ) -> None:
        """Add a revenue account to the appropriate section."""
        line = IncomeStatementLine(
            account_id=account.id,
            account_code=account.code,
            account_name=account.name,
            amount=amount,
        )

        # Classify as regular revenue or other income
        if account.code.startswith(self.OTHER_INCOME_PREFIXES):
            income_statement.other_income.add_line(line)
        else:
            income_statement.revenue.add_line(line)

    def _add_expense_line(
        self,
        income_statement: IncomeStatement,
        account: Account,
        amount: Decimal,
    ) -> None:
        """Add an expense account to the appropriate section."""
        line = IncomeStatementLine(
            account_id=account.id,
            account_code=account.code,
            account_name=account.name,
            amount=amount,
        )

        # Classify expense type based on account code
        code = account.code
        if code.startswith(self.COGS_PREFIXES):
            income_statement.cost_of_goods_sold.add_line(line)
        elif code.startswith(self.TAX_EXPENSE_PREFIXES):
            income_statement.income_tax_expense.add_line(line)
        elif code.startswith(self.OTHER_EXPENSE_PREFIXES):
            income_statement.other_expenses.add_line(line)
        else:
            # Default to operating expenses
            income_statement.operating_expenses.add_line(line)

    async def calculate_net_income(
        self,
        period_start: date,
        period_end: date,
        currency_code: str = "USD",
    ) -> Decimal:
        """
        Quick calculation of net income for a period.

        Args:
            period_start: Start of period
            period_end: End of period
            currency_code: Currency

        Returns:
            Net income (positive) or net loss (negative)
        """
        # Sum all revenue credits minus debits
        revenue_stmt = (
            select(
                func.coalesce(
                    func.sum(
                        func.case(
                            (JournalEntryLine.entry_type == EntryType.CREDIT, JournalEntryLine.amount),
                            else_=-JournalEntryLine.amount,
                        )
                    ),
                    Decimal("0"),
                )
            )
            .join(JournalEntry, JournalEntryLine.journal_entry_id == JournalEntry.id)
            .join(Account, JournalEntryLine.account_id == Account.id)
            .where(JournalEntry.status == PostingStatus.POSTED)
            .where(JournalEntry.entry_date >= period_start)
            .where(JournalEntry.entry_date <= period_end)
            .where(JournalEntry.currency_code == currency_code)
            .where(Account.account_type == AccountType.REVENUE)
        )

        # Sum all expense debits minus credits
        expense_stmt = (
            select(
                func.coalesce(
                    func.sum(
                        func.case(
                            (JournalEntryLine.entry_type == EntryType.DEBIT, JournalEntryLine.amount),
                            else_=-JournalEntryLine.amount,
                        )
                    ),
                    Decimal("0"),
                )
            )
            .join(JournalEntry, JournalEntryLine.journal_entry_id == JournalEntry.id)
            .join(Account, JournalEntryLine.account_id == Account.id)
            .where(JournalEntry.status == PostingStatus.POSTED)
            .where(JournalEntry.entry_date >= period_start)
            .where(JournalEntry.entry_date <= period_end)
            .where(JournalEntry.currency_code == currency_code)
            .where(Account.account_type == AccountType.EXPENSE)
        )

        revenue_result = await self.session.execute(revenue_stmt)
        expense_result = await self.session.execute(expense_stmt)

        total_revenue = revenue_result.scalar_one() or Decimal("0")
        total_expenses = expense_result.scalar_one() or Decimal("0")

        return total_revenue - total_expenses
