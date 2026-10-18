"""
Trial Balance Service - generates trial balance reports.

The trial balance is the primary tool for verifying that the general ledger
is in balance (total debits = total credits).

Research Grounding: docs/research/08-financial-statement-presentation.md
AI Knowledge Gap (doc 11): Balance calculations are deterministic - AI can assist safely.
"""

from collections import defaultdict
from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.chart_of_accounts.models.account import Account, AccountType
from src.domain.general_ledger.models.journal_entry import JournalEntry
from src.domain.general_ledger.models.journal_entry_line import JournalEntryLine, EntryType
from src.domain.general_ledger.models.posting_status import PostingStatus
from src.domain.financial_reporting.models.trial_balance import (
    TrialBalance,
    TrialBalanceLine,
)


class TrialBalanceService:
    """
    Service for generating trial balance reports.

    The trial balance aggregates all posted journal entry lines by account
    to produce a list of accounts with their debit or credit balances.

    Features:
    - Point-in-time trial balance (as of a specific date)
    - Period-specific trial balance
    - Hierarchical account grouping (optional)
    - Include/exclude zero-balance accounts
    """

    def __init__(self, session: AsyncSession) -> None:
        """
        Initialize the service.

        Args:
            session: SQLAlchemy async session
        """
        self.session = session

    async def generate(
        self,
        as_of_date: date,
        fiscal_period_id: Optional[str] = None,
        include_zero_balances: bool = False,
        currency_code: str = "USD",
        generated_by: Optional[str] = None,
    ) -> TrialBalance:
        """
        Generate a trial balance as of a specific date.

        Args:
            as_of_date: Date for the trial balance
            fiscal_period_id: Optional filter to specific fiscal period
            include_zero_balances: Include accounts with zero balance
            currency_code: Currency filter
            generated_by: User/system that generated the report

        Returns:
            TrialBalance object with account balances
        """
        # Calculate account balances from posted journal entries
        account_balances = await self._calculate_account_balances(
            as_of_date=as_of_date,
            fiscal_period_id=fiscal_period_id,
            currency_code=currency_code,
        )

        # Get all accounts for the report
        accounts = await self._get_accounts(currency_code)

        # Build the trial balance
        trial_balance = TrialBalance(
            as_of_date=as_of_date,
            fiscal_period_id=fiscal_period_id,
            currency_code=currency_code,
            generated_by=generated_by,
        )

        # Add lines for each account
        for account in accounts:
            balance_data = account_balances.get(account.id, {
                "debits": Decimal("0"),
                "credits": Decimal("0"),
            })

            debit_balance = balance_data["debits"]
            credit_balance = balance_data["credits"]

            # Skip zero balances if not requested
            if not include_zero_balances:
                if debit_balance == Decimal("0") and credit_balance == Decimal("0"):
                    continue

            # Determine the net balance column based on account type
            # Assets and Expenses normally have debit balances
            # Liabilities, Equity, and Revenue normally have credit balances
            net_balance = debit_balance - credit_balance

            if account.account_type in (AccountType.ASSET, AccountType.EXPENSE):
                # Normal debit balance accounts
                if net_balance >= Decimal("0"):
                    final_debit = net_balance
                    final_credit = Decimal("0")
                else:
                    final_debit = Decimal("0")
                    final_credit = abs(net_balance)
            else:
                # Normal credit balance accounts
                if net_balance <= Decimal("0"):
                    final_debit = Decimal("0")
                    final_credit = abs(net_balance)
                else:
                    final_debit = net_balance
                    final_credit = Decimal("0")

            line = TrialBalanceLine(
                account_id=account.id,
                account_code=account.code,
                account_name=account.name,
                account_type=account.account_type,
                debit_balance=final_debit,
                credit_balance=final_credit,
                parent_account_id=account.parent_id,
                depth=await self._get_account_depth(account),
            )
            trial_balance.add_line(line)

        # Sort by account type, then code
        trial_balance.sort_by_account_type()

        return trial_balance

    async def _calculate_account_balances(
        self,
        as_of_date: date,
        fiscal_period_id: Optional[str],
        currency_code: str,
    ) -> dict[str, dict[str, Decimal]]:
        """
        Calculate running balances for all accounts from posted entries.

        Returns:
            Dict mapping account_id to {"debits": Decimal, "credits": Decimal}
        """
        # Query to aggregate debits and credits by account
        # Only include POSTED entries up to the as_of_date
        stmt = (
            select(
                JournalEntryLine.account_id,
                JournalEntryLine.entry_type,
                func.sum(JournalEntryLine.amount).label("total"),
            )
            .join(JournalEntry, JournalEntryLine.journal_entry_id == JournalEntry.id)
            .where(JournalEntry.status == PostingStatus.POSTED)
            .where(JournalEntry.entry_date <= as_of_date)
            .where(JournalEntry.currency_code == currency_code)
        )

        if fiscal_period_id:
            stmt = stmt.where(JournalEntry.fiscal_period_id == fiscal_period_id)

        stmt = stmt.group_by(JournalEntryLine.account_id, JournalEntryLine.entry_type)

        result = await self.session.execute(stmt)
        rows = result.all()

        # Build balance dictionary
        balances: dict[str, dict[str, Decimal]] = defaultdict(
            lambda: {"debits": Decimal("0"), "credits": Decimal("0")}
        )

        for row in rows:
            account_id = row.account_id
            entry_type = row.entry_type
            total = row.total or Decimal("0")

            if entry_type == EntryType.DEBIT:
                balances[account_id]["debits"] += total
            else:
                balances[account_id]["credits"] += total

        return dict(balances)

    async def _get_accounts(self, currency_code: str) -> list[Account]:
        """
        Get all active accounts for the currency.

        Returns accounts sorted by code for consistent ordering.
        """
        stmt = (
            select(Account)
            .where(Account.is_active == True)
            .where(Account.is_header == False)  # Exclude header/grouping accounts
            .where(Account.currency_code == currency_code)
            .where(Account.deleted_at.is_(None))
            .order_by(Account.code)
        )

        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def _get_account_depth(self, account: Account) -> int:
        """
        Calculate the depth of an account in the hierarchy.

        Returns 0 for top-level accounts, 1 for children, etc.
        """
        depth = 0
        current = account

        while current.parent_id:
            depth += 1
            # Get parent account
            stmt = select(Account).where(Account.id == current.parent_id)
            result = await self.session.execute(stmt)
            parent = result.scalar_one_or_none()
            if not parent:
                break
            current = parent

        return depth

    async def verify_balance(self, as_of_date: date) -> tuple[bool, Decimal]:
        """
        Verify that the general ledger is balanced.

        This is a quick check without generating the full trial balance.

        Args:
            as_of_date: Date to check

        Returns:
            Tuple of (is_balanced, difference)
        """
        # Sum all debits
        debit_stmt = (
            select(func.sum(JournalEntryLine.amount))
            .join(JournalEntry, JournalEntryLine.journal_entry_id == JournalEntry.id)
            .where(JournalEntry.status == PostingStatus.POSTED)
            .where(JournalEntry.entry_date <= as_of_date)
            .where(JournalEntryLine.entry_type == EntryType.DEBIT)
        )

        # Sum all credits
        credit_stmt = (
            select(func.sum(JournalEntryLine.amount))
            .join(JournalEntry, JournalEntryLine.journal_entry_id == JournalEntry.id)
            .where(JournalEntry.status == PostingStatus.POSTED)
            .where(JournalEntry.entry_date <= as_of_date)
            .where(JournalEntryLine.entry_type == EntryType.CREDIT)
        )

        debit_result = await self.session.execute(debit_stmt)
        credit_result = await self.session.execute(credit_stmt)

        total_debits = debit_result.scalar_one() or Decimal("0")
        total_credits = credit_result.scalar_one() or Decimal("0")

        difference = total_debits - total_credits
        is_balanced = abs(difference) < Decimal("0.01")

        return is_balanced, difference
