"""REST API endpoints for Journal Entry management."""

from datetime import date
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.general_ledger.models.journal_entry import JournalEntry
from src.domain.general_ledger.models.journal_entry_line import EntryType
from src.domain.general_ledger.models.posting_status import PostingStatus
from src.domain.general_ledger.repositories.journal_entry_repository import JournalEntryRepository
from src.domain.general_ledger.repositories.fiscal_period_repository import FiscalPeriodRepository
from src.domain.chart_of_accounts.repositories.account_repository import AccountRepository
from src.domain.general_ledger.services.posting_service import PostingService
from src.infrastructure.persistence.database import get_session
from src.api.rest.auth import get_current_user

router = APIRouter(prefix="/journal-entries", tags=["Journal Entries"])


# -----------------------------------------------------------------------------
# Request/Response Models
# -----------------------------------------------------------------------------

class JournalEntryLineCreate(BaseModel):
    """Request model for creating a journal entry line."""

    account_code: str = Field(..., min_length=1, max_length=50)
    entry_type: EntryType
    amount: Decimal = Field(..., gt=0, decimal_places=4)
    description: str | None = Field(None, max_length=500)


class JournalEntryCreate(BaseModel):
    """Request model for creating a journal entry."""

    entry_date: date
    description: str = Field(..., min_length=1, max_length=1000)
    lines: list[JournalEntryLineCreate] = Field(..., min_length=2)
    source_document: str | None = Field(None, max_length=200)
    currency_code: str = Field("USD", min_length=3, max_length=3)

    @field_validator('lines')
    @classmethod
    def validate_balance(cls, lines: list[JournalEntryLineCreate]) -> list[JournalEntryLineCreate]:
        """Ensure debits equal credits."""
        total_debits = sum(
            line.amount for line in lines if line.entry_type == EntryType.DEBIT
        )
        total_credits = sum(
            line.amount for line in lines if line.entry_type == EntryType.CREDIT
        )
        if total_debits != total_credits:
            raise ValueError(
                f"Entry must balance. Debits: {total_debits}, Credits: {total_credits}"
            )
        return lines


class JournalEntryLineResponse(BaseModel):
    """Response model for a journal entry line."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    account_id: str
    account_code: str | None = None
    entry_type: EntryType
    amount: Decimal
    description: str | None


class JournalEntryResponse(BaseModel):
    """Response model for a journal entry."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    entry_number: str
    entry_date: str
    description: str
    status: PostingStatus
    currency_code: str
    total_debits: Decimal
    total_credits: Decimal
    lines: list[JournalEntryLineResponse]
    source_document: str | None
    fiscal_period_id: str | None
    created_at: str
    posted_at: str | None
    created_by: str | None

    @classmethod
    def from_entity(cls, entry: JournalEntry) -> "JournalEntryResponse":
        """Create response from domain entity."""
        return cls(
            id=entry.id,
            entry_number=entry.entry_number,
            entry_date=entry.entry_date.isoformat(),
            description=entry.description,
            status=entry.status,
            currency_code=entry.currency_code,
            total_debits=entry.total_debits,
            total_credits=entry.total_credits,
            lines=[
                JournalEntryLineResponse(
                    id=line.id,
                    account_id=line.account_id,
                    account_code=line.account.code if line.account else None,
                    entry_type=line.entry_type,
                    amount=line.amount,
                    description=line.description,
                )
                for line in entry.lines
            ],
            source_document=entry.source_document,
            fiscal_period_id=entry.fiscal_period_id,
            created_at=entry.created_at.isoformat() if entry.created_at else "",
            posted_at=entry.posted_at.isoformat() if entry.posted_at else None,
            created_by=entry.created_by,
        )


class JournalEntryListResponse(BaseModel):
    """Response model for a list of journal entries."""

    items: list[JournalEntryResponse]
    total: int
    limit: int
    offset: int


class PostEntryRequest(BaseModel):
    """Request model for posting a journal entry."""

    posted_by: str | None = None


class PostEntryResponse(BaseModel):
    """Response model for posting result."""

    success: bool
    entry: JournalEntryResponse
    message: str


# -----------------------------------------------------------------------------
# Dependencies
# -----------------------------------------------------------------------------

async def get_journal_entry_repository(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> JournalEntryRepository:
    """Get journal entry repository."""
    return JournalEntryRepository(session)


async def get_account_repository(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> AccountRepository:
    """Get account repository."""
    return AccountRepository(session)


async def get_fiscal_period_repository(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> FiscalPeriodRepository:
    """Get fiscal period repository."""
    return FiscalPeriodRepository(session)


# -----------------------------------------------------------------------------
# Endpoints
# -----------------------------------------------------------------------------

@router.get("", response_model=JournalEntryListResponse)
async def list_journal_entries(
    repo: Annotated[JournalEntryRepository, Depends(get_journal_entry_repository)],
    entry_status: Annotated[PostingStatus | None, Query(alias="status")] = None,
    fiscal_period_id: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: Annotated[int, Query(ge=1, le=1000)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> JournalEntryListResponse:
    """List journal entries with filtering."""
    entries = await repo.list_entries(
        status=entry_status,
        fiscal_period_id=fiscal_period_id,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
        offset=offset,
    )
    total = await repo.count_entries(
        status=entry_status,
        fiscal_period_id=fiscal_period_id,
        date_from=date_from,
        date_to=date_to,
    )
    return JournalEntryListResponse(
        items=[JournalEntryResponse.from_entity(e) for e in entries],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{entry_id}", response_model=JournalEntryResponse)
async def get_journal_entry(
    entry_id: str,
    repo: Annotated[JournalEntryRepository, Depends(get_journal_entry_repository)],
) -> JournalEntryResponse:
    """Get a journal entry by ID."""
    entry = await repo.get_by_id(entry_id)
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Journal entry with ID '{entry_id}' not found",
        )
    return JournalEntryResponse.from_entity(entry)


@router.get("/by-number/{entry_number}", response_model=JournalEntryResponse)
async def get_journal_entry_by_number(
    entry_number: str,
    repo: Annotated[JournalEntryRepository, Depends(get_journal_entry_repository)],
) -> JournalEntryResponse:
    """Get a journal entry by entry number."""
    entry = await repo.get_by_entry_number(entry_number)
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Journal entry with number '{entry_number}' not found",
        )
    return JournalEntryResponse.from_entity(entry)


@router.post("", response_model=JournalEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_journal_entry(
    data: JournalEntryCreate,
    je_repo: Annotated[JournalEntryRepository, Depends(get_journal_entry_repository)],
    account_repo: Annotated[AccountRepository, Depends(get_account_repository)],
    period_repo: Annotated[FiscalPeriodRepository, Depends(get_fiscal_period_repository)],
    current_user: Annotated[str, Depends(get_current_user)],
) -> JournalEntryResponse:
    """Create a new journal entry (draft status)."""
    # Resolve account codes to IDs
    account_ids: dict[str, str] = {}
    for line in data.lines:
        if line.account_code not in account_ids:
            account_id = await account_repo.get_account_id_by_code(line.account_code)
            if not account_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Account with code '{line.account_code}' not found",
                )
            account_ids[line.account_code] = account_id

    # Resolve fiscal period
    period = await period_repo.get_for_date(data.entry_date)
    if not period:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No fiscal period found for date {data.entry_date}",
        )

    # Generate entry number
    entry_number = await je_repo.get_next_entry_number(data.entry_date.year)

    # Create journal entry
    entry = JournalEntry(
        entry_number=entry_number,
        entry_date=data.entry_date,
        description=data.description,
        status=PostingStatus.DRAFT,
        currency_code=data.currency_code.upper(),
        source_document=data.source_document,
        fiscal_period_id=period.id,
        created_by=current_user,
    )

    # Add lines
    for line in data.lines:
        entry.add_line(
            account_id=account_ids[line.account_code],
            entry_type=line.entry_type,
            amount=line.amount,
            description=line.description,
        )

    await je_repo.add(entry)
    return JournalEntryResponse.from_entity(entry)


@router.post("/{entry_id}/post", response_model=PostEntryResponse)
async def post_journal_entry(
    entry_id: str,
    data: PostEntryRequest,
    je_repo: Annotated[JournalEntryRepository, Depends(get_journal_entry_repository)],
    account_repo: Annotated[AccountRepository, Depends(get_account_repository)],
    period_repo: Annotated[FiscalPeriodRepository, Depends(get_fiscal_period_repository)],
    current_user: Annotated[str, Depends(get_current_user)],
) -> PostEntryResponse:
    """Post a draft journal entry to the ledger."""
    entry = await je_repo.get_by_id(entry_id)
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Journal entry with ID '{entry_id}' not found",
        )

    if entry.status != PostingStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot post entry with status '{entry.status.value}'",
        )

    # Create posting service
    posting_service = PostingService(
        journal_entry_repository=je_repo,
        fiscal_period_repository=period_repo,
        account_repository=account_repo,
    )

    # Post the entry
    posted_by = data.posted_by or current_user
    result = await posting_service.post_entry(entry, posted_by=posted_by)

    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.error_message or "Failed to post entry",
        )

    return PostEntryResponse(
        success=True,
        entry=JournalEntryResponse.from_entity(result.entry),
        message=f"Entry {entry.entry_number} posted successfully",
    )


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def void_journal_entry(
    entry_id: str,
    repo: Annotated[JournalEntryRepository, Depends(get_journal_entry_repository)],
    current_user: Annotated[str, Depends(get_current_user)],
) -> None:
    """Void a journal entry (only draft entries can be deleted)."""
    entry = await repo.get_by_id(entry_id)
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Journal entry with ID '{entry_id}' not found",
        )

    if entry.status != PostingStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only draft entries can be voided. Posted entries must be reversed.",
        )

    await repo.delete(entry)
