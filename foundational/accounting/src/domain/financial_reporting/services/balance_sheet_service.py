"""
Balance Sheet Service - generates balance sheet reports.

The balance sheet shows the financial position at a point in time,
demonstrating the accounting equation: Assets = Liabilities + Equity.

Research Grounding: docs/research/08-financial-statement-presentation.md
AI Knowledge Gap (doc 12): Presentation varies by jurisdiction.
"""

from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.chart_of_accounts.models.account import AccountType
from src.domain.financial_reporting.models.trial_balance import TrialBalance, TrialBalanceLine
from src.domain.financial_reporting.models.balance_sheet import (
    BalanceSheet,
    BalanceSheetSection,
    BalanceSheetLine,
    BalanceSheetFormat,
)
from src.domain.financial_reporting.services.trial_balance_service import TrialBalanceService


class BalanceSheetService:
    """
    Service for generating balance sheet reports.

    The balance sheet is derived from the trial balance by:
    1. Selecting only balance sheet accounts (Assets, Liabilities, Equity)
    2. Grouping into current/non-current categories
    3. Adding net income from income statement accounts

    Features:
    - Point-in-time balance sheet
    - Current/non-current classification
    - Automatic net income calculation from Revenue/Expense
    - Financial ratios (current ratio, working capital, debt-to-equity)
    """

    # Account code prefixes for classification (configurable)
    CURRENT_ASSET_PREFIXES = ("10", "11", "12", "13")  # e.g., 1000-1399
    CURRENT_LIABILITY_PREFIXES = ("20", "21", "22")    # e.g., 2000-2299

    def __init__(self, session: AsyncSession) -> None:
        """
        Initialize the service.

        Args:
            session: SQLAlchemy async session
        """
        self.session = session
        self.trial_balance_service = TrialBalanceService(session)

    async def generate(
        self,
        as_of_date: date,
        currency_code: str = "USD",
        format: BalanceSheetFormat = BalanceSheetFormat.REPORT_FORMAT,
        generated_by: Optional[str] = None,
    ) -> BalanceSheet:
        """
        Generate a balance sheet as of a specific date.

        Args:
            as_of_date: Date for the balance sheet
            currency_code: Reporting currency
            format: Presentation format
            generated_by: User/system generating the report

        Returns:
            BalanceSheet object
        """
        # Generate trial balance first
        trial_balance = await self.trial_balance_service.generate(
            as_of_date=as_of_date,
            include_zero_balances=False,
            currency_code=currency_code,
        )

        # Create balance sheet
        balance_sheet = BalanceSheet(
            as_of_date=as_of_date,
            currency_code=currency_code,
            format=format,
            generated_by=generated_by,
        )

        # Process balance sheet accounts
        for line in trial_balance.lines:
            if line.account_type == AccountType.ASSET:
                self._add_asset_line(balance_sheet, line)
            elif line.account_type == AccountType.LIABILITY:
                self._add_liability_line(balance_sheet, line)
            elif line.account_type == AccountType.EQUITY:
                self._add_equity_line(balance_sheet, line)

        # Calculate net income from Revenue and Expense accounts
        net_income = self._calculate_net_income(trial_balance)
        if net_income != Decimal("0"):
            # Add retained earnings / net income line to equity
            balance_sheet.equity.add_line(
                BalanceSheetLine(
                    account_id=None,
                    account_code=None,
                    account_name="Net Income (Current Period)",
                    amount=net_income,
                    depth=1,
                )
            )

        return balance_sheet

    def _add_asset_line(
        self,
        balance_sheet: BalanceSheet,
        line: TrialBalanceLine,
    ) -> None:
        """Add an asset account to the appropriate section."""
        # Determine balance (assets have debit balances)
        amount = line.debit_balance - line.credit_balance

        bs_line = BalanceSheetLine(
            account_id=line.account_id,
            account_code=line.account_code,
            account_name=line.account_name,
            amount=amount,
            depth=line.depth,
        )

        # Classify as current or non-current based on account code
        if self._is_current_asset(line.account_code):
            balance_sheet.current_assets.add_line(bs_line)
        else:
            balance_sheet.non_current_assets.add_line(bs_line)

    def _add_liability_line(
        self,
        balance_sheet: BalanceSheet,
        line: TrialBalanceLine,
    ) -> None:
        """Add a liability account to the appropriate section."""
        # Determine balance (liabilities have credit balances)
        amount = line.credit_balance - line.debit_balance

        bs_line = BalanceSheetLine(
            account_id=line.account_id,
            account_code=line.account_code,
            account_name=line.account_name,
            amount=amount,
            depth=line.depth,
        )

        # Classify as current or non-current based on account code
        if self._is_current_liability(line.account_code):
            balance_sheet.current_liabilities.add_line(bs_line)
        else:
            balance_sheet.non_current_liabilities.add_line(bs_line)

    def _add_equity_line(
        self,
        balance_sheet: BalanceSheet,
        line: TrialBalanceLine,
    ) -> None:
        """Add an equity account to the equity section."""
        # Determine balance (equity has credit balance)
        amount = line.credit_balance - line.debit_balance

        bs_line = BalanceSheetLine(
            account_id=line.account_id,
            account_code=line.account_code,
            account_name=line.account_name,
            amount=amount,
            depth=line.depth,
        )

        balance_sheet.equity.add_line(bs_line)

    def _calculate_net_income(self, trial_balance: TrialBalance) -> Decimal:
        """
        Calculate net income from Revenue and Expense accounts.

        Net Income = Total Revenue - Total Expenses

        This is added to equity (retained earnings) on the balance sheet.
        """
        total_revenue = Decimal("0")
        total_expenses = Decimal("0")

        for line in trial_balance.lines:
            if line.account_type == AccountType.REVENUE:
                # Revenue has credit balance
                total_revenue += line.credit_balance - line.debit_balance
            elif line.account_type == AccountType.EXPENSE:
                # Expense has debit balance
                total_expenses += line.debit_balance - line.credit_balance

        return total_revenue - total_expenses

    def _is_current_asset(self, account_code: str) -> bool:
        """
        Determine if an asset is current based on account code.

        Current assets are typically:
        - Cash and cash equivalents
        - Accounts receivable
        - Inventory
        - Prepaid expenses
        - Other assets expected to be converted to cash within 12 months
        """
        return account_code.startswith(self.CURRENT_ASSET_PREFIXES)

    def _is_current_liability(self, account_code: str) -> bool:
        """
        Determine if a liability is current based on account code.

        Current liabilities are typically:
        - Accounts payable
        - Accrued expenses
        - Short-term debt
        - Current portion of long-term debt
        - Other obligations due within 12 months
        """
        return account_code.startswith(self.CURRENT_LIABILITY_PREFIXES)

    async def verify_equation(self, as_of_date: date) -> tuple[bool, Decimal]:
        """
        Verify the accounting equation: Assets = Liabilities + Equity.

        Args:
            as_of_date: Date to verify

        Returns:
            Tuple of (is_balanced, difference)
        """
        balance_sheet = await self.generate(as_of_date)
        return balance_sheet.is_balanced, balance_sheet.difference
