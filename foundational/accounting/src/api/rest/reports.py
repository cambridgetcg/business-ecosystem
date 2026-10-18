"""REST API endpoints for Financial Reports."""

from datetime import date
from decimal import Decimal
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.financial_reporting.services.trial_balance_service import TrialBalanceService
from src.domain.financial_reporting.services.balance_sheet_service import BalanceSheetService
from src.domain.financial_reporting.services.income_statement_service import IncomeStatementService
from src.domain.financial_reporting.models.balance_sheet import BalanceSheetFormat
from src.domain.financial_reporting.models.income_statement import IncomeStatementFormat
from src.infrastructure.persistence.database import get_session
from src.api.rest.auth import get_current_user

router = APIRouter(prefix="/reports", tags=["Financial Reports"])


# -----------------------------------------------------------------------------
# Response Models
# -----------------------------------------------------------------------------

class TrialBalanceLineResponse(BaseModel):
    """Response model for a trial balance line."""

    account_id: str
    account_code: str
    account_name: str
    account_type: str
    debit_balance: str
    credit_balance: str
    depth: int = 0


class TrialBalanceResponse(BaseModel):
    """Response model for trial balance report."""

    as_of_date: str
    currency_code: str
    fiscal_period_id: Optional[str] = None
    generated_at: str
    generated_by: Optional[str] = None
    total_debits: str
    total_credits: str
    is_balanced: bool
    difference: str
    account_count: int
    lines: list[TrialBalanceLineResponse]


class BalanceSheetSectionLineResponse(BaseModel):
    """Response model for a balance sheet line."""

    account_id: Optional[str]
    account_code: Optional[str]
    account_name: str
    amount: str
    depth: int = 0
    is_subtotal: bool = False
    is_total: bool = False


class BalanceSheetSectionResponse(BaseModel):
    """Response model for a balance sheet section."""

    name: str
    lines: list[BalanceSheetSectionLineResponse]
    subtotal: str


class BalanceSheetResponse(BaseModel):
    """Response model for balance sheet report."""

    as_of_date: str
    currency_code: str
    format: str
    generated_at: str
    generated_by: Optional[str] = None
    is_balanced: bool
    difference: str
    assets: dict
    liabilities: dict
    equity: dict
    total_liabilities_and_equity: str
    ratios: dict


class IncomeStatementResponse(BaseModel):
    """Response model for income statement report."""

    period_start: str
    period_end: str
    currency_code: str
    format: str
    generated_at: str
    generated_by: Optional[str] = None
    summary: dict
    ratios: dict
    sections: dict


class BalanceVerificationResponse(BaseModel):
    """Response model for balance verification."""

    as_of_date: str
    is_balanced: bool
    difference: str
    message: str


# -----------------------------------------------------------------------------
# Dependencies
# -----------------------------------------------------------------------------

async def get_trial_balance_service(
    session: AsyncSession = Depends(get_session),
) -> TrialBalanceService:
    """Get trial balance service instance."""
    return TrialBalanceService(session)


async def get_balance_sheet_service(
    session: AsyncSession = Depends(get_session),
) -> BalanceSheetService:
    """Get balance sheet service instance."""
    return BalanceSheetService(session)


async def get_income_statement_service(
    session: AsyncSession = Depends(get_session),
) -> IncomeStatementService:
    """Get income statement service instance."""
    return IncomeStatementService(session)


# -----------------------------------------------------------------------------
# Trial Balance Endpoints
# -----------------------------------------------------------------------------

@router.get("/trial-balance", response_model=TrialBalanceResponse)
async def get_trial_balance(
    as_of_date: date = Query(..., description="Date for the trial balance"),
    fiscal_period_id: Optional[str] = Query(None, description="Optional fiscal period filter"),
    include_zero_balances: bool = Query(False, description="Include accounts with zero balance"),
    currency_code: str = Query("USD", description="Currency code"),
    service: TrialBalanceService = Depends(get_trial_balance_service),
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    Generate a trial balance report.

    The trial balance shows all accounts with their debit or credit balances.
    Total debits should equal total credits if the books are balanced.

    Args:
        as_of_date: Date for the trial balance (point-in-time)
        fiscal_period_id: Optional filter to a specific fiscal period
        include_zero_balances: Include accounts with zero balance
        currency_code: Currency filter (default: USD)

    Returns:
        Trial balance with all account balances
    """
    trial_balance = await service.generate(
        as_of_date=as_of_date,
        fiscal_period_id=fiscal_period_id,
        include_zero_balances=include_zero_balances,
        currency_code=currency_code,
        generated_by=current_user.get("user_id"),
    )

    return trial_balance.to_dict()


@router.get("/trial-balance/verify", response_model=BalanceVerificationResponse)
async def verify_trial_balance(
    as_of_date: date = Query(..., description="Date to verify"),
    service: TrialBalanceService = Depends(get_trial_balance_service),
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    Quick verification that the general ledger is balanced.

    This is a lightweight check without generating the full trial balance.

    Returns:
        Verification result with balance status
    """
    is_balanced, difference = await service.verify_balance(as_of_date)

    if is_balanced:
        message = "General ledger is balanced. Total debits equal total credits."
    else:
        message = f"WARNING: General ledger is out of balance by {difference}. Investigation required."

    return {
        "as_of_date": as_of_date.isoformat(),
        "is_balanced": is_balanced,
        "difference": str(difference),
        "message": message,
    }


# -----------------------------------------------------------------------------
# Balance Sheet Endpoints
# -----------------------------------------------------------------------------

@router.get("/balance-sheet", response_model=BalanceSheetResponse)
async def get_balance_sheet(
    as_of_date: date = Query(..., description="Date for the balance sheet"),
    currency_code: str = Query("USD", description="Currency code"),
    format: str = Query("REPORT", description="Format: REPORT or ACCOUNT"),
    service: BalanceSheetService = Depends(get_balance_sheet_service),
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    Generate a balance sheet (statement of financial position).

    The balance sheet shows the accounting equation: Assets = Liabilities + Equity

    Args:
        as_of_date: Date for the balance sheet (point-in-time)
        currency_code: Currency filter (default: USD)
        format: Presentation format (REPORT = vertical, ACCOUNT = horizontal)

    Returns:
        Balance sheet with assets, liabilities, and equity sections
    """
    bs_format = (
        BalanceSheetFormat.ACCOUNT_FORMAT
        if format.upper() == "ACCOUNT"
        else BalanceSheetFormat.REPORT_FORMAT
    )

    balance_sheet = await service.generate(
        as_of_date=as_of_date,
        currency_code=currency_code,
        format=bs_format,
        generated_by=current_user.get("user_id"),
    )

    return balance_sheet.to_dict()


@router.get("/balance-sheet/verify", response_model=BalanceVerificationResponse)
async def verify_accounting_equation(
    as_of_date: date = Query(..., description="Date to verify"),
    service: BalanceSheetService = Depends(get_balance_sheet_service),
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    Verify the accounting equation: Assets = Liabilities + Equity.

    Returns:
        Verification result
    """
    is_balanced, difference = await service.verify_equation(as_of_date)

    if is_balanced:
        message = "Accounting equation verified. Assets = Liabilities + Equity."
    else:
        message = f"WARNING: Accounting equation violated by {difference}. Investigation required."

    return {
        "as_of_date": as_of_date.isoformat(),
        "is_balanced": is_balanced,
        "difference": str(difference),
        "message": message,
    }


# -----------------------------------------------------------------------------
# Income Statement Endpoints
# -----------------------------------------------------------------------------

@router.get("/income-statement", response_model=IncomeStatementResponse)
async def get_income_statement(
    period_start: date = Query(..., description="Start of the reporting period"),
    period_end: date = Query(..., description="End of the reporting period"),
    currency_code: str = Query("USD", description="Currency code"),
    format: str = Query("MULTI_STEP", description="Format: SINGLE_STEP or MULTI_STEP"),
    service: IncomeStatementService = Depends(get_income_statement_service),
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    Generate an income statement (profit and loss statement).

    Shows: Revenue - Expenses = Net Income

    For multi-step format, also shows:
    - Gross Profit = Revenue - Cost of Goods Sold
    - Operating Income = Gross Profit - Operating Expenses

    Args:
        period_start: Start of the reporting period
        period_end: End of the reporting period
        currency_code: Currency filter (default: USD)
        format: Presentation format (SINGLE_STEP or MULTI_STEP)

    Returns:
        Income statement with revenue, expenses, and net income
    """
    is_format = (
        IncomeStatementFormat.SINGLE_STEP
        if format.upper() == "SINGLE_STEP"
        else IncomeStatementFormat.MULTI_STEP
    )

    income_statement = await service.generate(
        period_start=period_start,
        period_end=period_end,
        currency_code=currency_code,
        format=is_format,
        generated_by=current_user.get("user_id"),
    )

    return income_statement.to_dict()


@router.get("/income-statement/net-income")
async def get_net_income(
    period_start: date = Query(..., description="Start of the period"),
    period_end: date = Query(..., description="End of the period"),
    currency_code: str = Query("USD", description="Currency code"),
    service: IncomeStatementService = Depends(get_income_statement_service),
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    Quick calculation of net income for a period.

    Returns:
        Net income (or loss) for the period
    """
    net_income = await service.calculate_net_income(
        period_start=period_start,
        period_end=period_end,
        currency_code=currency_code,
    )

    return {
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "currency_code": currency_code,
        "net_income": str(net_income),
        "is_profitable": net_income > 0,
    }
