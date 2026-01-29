"""REST API endpoints for Account management."""

from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.chart_of_accounts.models.account import Account, AccountType
from src.domain.chart_of_accounts.repositories.account_repository import AccountRepository
from src.infrastructure.persistence.database import get_session

router = APIRouter(prefix="/accounts", tags=["Accounts"])

class AccountCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=50, examples=["1000"])
    name: str = Field(..., min_length=1, max_length=200, examples=["Cash"])
    description: str | None = Field(None, max_length=1000)
    account_type: AccountType
    parent_id: str | None = None
    is_header: bool = False
    currency_code: str = Field("USD", min_length=3, max_length=3)

class AccountUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    is_active: bool | None = None
    is_header: bool | None = None

class AccountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    code: str
    name: str
    description: str | None
    account_type: AccountType
    parent_id: str | None
    is_active: bool
    is_header: bool
    currency_code: str
    current_balance: Decimal
    created_at: str
    updated_at: str

    @classmethod
    def from_entity(cls, account: Account) -> "AccountResponse":
        return cls(
            id=account.id, code=account.code, name=account.name,
            description=account.description, account_type=account.account_type,
            parent_id=account.parent_id, is_active=account.is_active,
            is_header=account.is_header, currency_code=account.currency_code,
            current_balance=account.current_balance,
            created_at=account.created_at.isoformat(),
            updated_at=account.updated_at.isoformat(),
        )

class AccountListResponse(BaseModel):
    items: list[AccountResponse]
    total: int
    limit: int
    offset: int

async def get_account_repository(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> AccountRepository:
    return AccountRepository(session)

@router.get("", response_model=AccountListResponse)
async def list_accounts(
    repo: Annotated[AccountRepository, Depends(get_account_repository)],
    account_type: AccountType | None = None,
    is_active: bool | None = None,
    parent_id: str | None = None,
    limit: Annotated[int, Query(ge=1, le=1000)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> AccountListResponse:
    accounts = await repo.list_all(
        account_type=account_type, is_active=is_active,
        parent_id=parent_id, limit=limit, offset=offset,
    )
    total = await repo.count(account_type=account_type, is_active=is_active)
    return AccountListResponse(
        items=[AccountResponse.from_entity(a) for a in accounts],
        total=total, limit=limit, offset=offset,
    )

@router.get("/{account_id}", response_model=AccountResponse)
async def get_account(
    account_id: str,
    repo: Annotated[AccountRepository, Depends(get_account_repository)],
) -> AccountResponse:
    account = await repo.get_by_id(account_id)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Account with ID '{account_id}' not found")
    return AccountResponse.from_entity(account)

@router.post("", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
async def create_account(
    data: AccountCreate,
    repo: Annotated[AccountRepository, Depends(get_account_repository)],
) -> AccountResponse:
    if await repo.exists_by_code(data.code):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
            detail=f"Account with code '{data.code}' already exists")
    if data.parent_id:
        parent = await repo.get_by_id(data.parent_id)
        if not parent:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Parent account with ID '{data.parent_id}' not found")
    account = Account(
        code=data.code, name=data.name, description=data.description,
        account_type=data.account_type, parent_id=data.parent_id,
        is_header=data.is_header, currency_code=data.currency_code.upper(),
    )
    await repo.add(account)
    return AccountResponse.from_entity(account)

@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    account_id: str,
    repo: Annotated[AccountRepository, Depends(get_account_repository)],
) -> None:
    account = await repo.get_by_id(account_id)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Account with ID '{account_id}' not found")
    await repo.delete(account)
