"""
Financial Reporting Domain - Phase 3 of Implementation Plan.

This module provides financial statement generation:
- Trial Balance: Verification that debits equal credits
- Balance Sheet: Assets = Liabilities + Equity
- Income Statement: Revenue - Expenses = Net Income
- Cash Flow Statement: Operating/Investing/Financing activities

Research Grounding: docs/research/08-financial-statement-presentation.md
AI Knowledge Gap (doc 12): Statement presentation varies by jurisdiction (GAAP vs IFRS).
System is configurable for jurisdiction - AI should not assume "universal" standards.
"""

from src.domain.financial_reporting.models.trial_balance import (
    TrialBalance,
    TrialBalanceLine,
)
from src.domain.financial_reporting.models.balance_sheet import (
    BalanceSheet,
    BalanceSheetSection,
    BalanceSheetLine,
)
from src.domain.financial_reporting.models.income_statement import (
    IncomeStatement,
    IncomeStatementSection,
    IncomeStatementLine,
)

__all__ = [
    "TrialBalance",
    "TrialBalanceLine",
    "BalanceSheet",
    "BalanceSheetSection",
    "BalanceSheetLine",
    "IncomeStatement",
    "IncomeStatementSection",
    "IncomeStatementLine",
]
