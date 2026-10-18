"""REST API endpoints for Accounts Receivable management."""

from datetime import date
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.accounts_receivable.models.customer import Customer, CustomerStatus, CustomerType
from src.domain.accounts_receivable.models.ar_invoice import ARInvoice, ARInvoiceStatus
from src.domain.accounts_receivable.models.receipt import Receipt, PaymentType, ReceiptStatus
from src.domain.accounts_receivable.repositories.customer_repository import CustomerRepository
from src.domain.accounts_receivable.repositories.ar_invoice_repository import ARInvoiceRepository
from src.domain.accounts_receivable.repositories.receipt_repository import ReceiptRepository
from src.domain.accounts_receivable.services.ar_invoice_service import ARInvoiceService
from src.domain.accounts_receivable.services.receipt_service import ReceiptService
from src.infrastructure.persistence.database import get_session

router = APIRouter(prefix="/ar", tags=["Accounts Receivable"])


# --- Pydantic Models ---

class CustomerCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    display_name: str | None = Field(None, max_length=100)
    customer_type: CustomerType = CustomerType.BUSINESS
    tax_id: str | None = Field(None, max_length=50)
    tax_exempt: bool = False
    payment_terms_days: int = Field(default=30, ge=0, le=365)
    default_revenue_account_id: str | None = None
    currency_code: str = Field("USD", min_length=3, max_length=3)
    credit_limit: Decimal | None = None
    contact_name: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    website: str | None = None
    billing_address_line1: str | None = None
    billing_address_line2: str | None = None
    billing_city: str | None = None
    billing_state: str | None = None
    billing_postal_code: str | None = None
    billing_country: str = "US"
    notes: str | None = None


class CustomerUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    display_name: str | None = None
    status: CustomerStatus | None = None
    payment_terms_days: int | None = Field(None, ge=0, le=365)
    credit_limit: Decimal | None = None


class CustomerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    code: str
    name: str
    display_name: str | None
    customer_type: CustomerType
    status: CustomerStatus
    tax_id: str | None
    tax_exempt: bool
    payment_terms_days: int
    currency_code: str
    credit_limit: Decimal | None
    current_balance: Decimal
    available_credit: Decimal | None
    contact_name: str | None
    contact_email: str | None
    created_at: str
    updated_at: str

    @classmethod
    def from_entity(cls, customer: Customer) -> "CustomerResponse":
        return cls(
            id=customer.id, code=customer.code, name=customer.name,
            display_name=customer.display_name, customer_type=customer.customer_type,
            status=customer.status, tax_id=customer.tax_id, tax_exempt=customer.tax_exempt,
            payment_terms_days=customer.payment_terms_days,
            currency_code=customer.currency_code, credit_limit=customer.credit_limit,
            current_balance=customer.current_balance,
            available_credit=customer.available_credit,
            contact_name=customer.contact_name, contact_email=customer.contact_email,
            created_at=customer.created_at.isoformat(),
            updated_at=customer.updated_at.isoformat(),
        )


class CustomerListResponse(BaseModel):
    items: list[CustomerResponse]
    total: int
    limit: int
    offset: int


class ARInvoiceLineCreate(BaseModel):
    description: str = Field(..., min_length=1, max_length=500)
    quantity: Decimal = Field(default=Decimal("1"), ge=0)
    unit_price: Decimal = Field(..., ge=0)
    revenue_account_id: str


class ARInvoiceCreate(BaseModel):
    customer_id: str
    invoice_date: date
    description: str | None = None
    tax_amount: Decimal = Field(default=Decimal("0"), ge=0)
    po_number: str | None = None
    terms: str | None = None
    notes: str | None = None
    currency_code: str = "USD"
    lines: list[ARInvoiceLineCreate]


class ARInvoiceLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    line_number: int
    description: str
    quantity: Decimal
    unit_price: Decimal
    amount: Decimal
    revenue_account_id: str


class ARInvoiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    invoice_number: str
    customer_id: str
    invoice_date: date
    due_date: date
    sent_date: date | None
    status: ARInvoiceStatus
    currency_code: str
    subtotal: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    amount_received: Decimal
    amount_due: Decimal
    is_overdue: bool
    days_overdue: int
    description: str | None
    po_number: str | None
    lines: list[ARInvoiceLineResponse]
    created_at: str
    updated_at: str

    @classmethod
    def from_entity(cls, invoice: ARInvoice) -> "ARInvoiceResponse":
        return cls(
            id=invoice.id, invoice_number=invoice.invoice_number,
            customer_id=invoice.customer_id, invoice_date=invoice.invoice_date,
            due_date=invoice.due_date, sent_date=invoice.sent_date,
            status=invoice.status, currency_code=invoice.currency_code,
            subtotal=invoice.subtotal, tax_amount=invoice.tax_amount,
            total_amount=invoice.total_amount, amount_received=invoice.amount_received,
            amount_due=invoice.amount_due, is_overdue=invoice.is_overdue,
            days_overdue=invoice.days_overdue, description=invoice.description,
            po_number=invoice.po_number,
            lines=[ARInvoiceLineResponse(
                id=line.id, line_number=line.line_number,
                description=line.description, quantity=line.quantity,
                unit_price=line.unit_price, amount=line.amount,
                revenue_account_id=line.revenue_account_id,
            ) for line in invoice.lines],
            created_at=invoice.created_at.isoformat(),
            updated_at=invoice.updated_at.isoformat(),
        )


class ARInvoiceListResponse(BaseModel):
    items: list[ARInvoiceResponse]
    total: int
    limit: int
    offset: int


class ReceiptCreate(BaseModel):
    customer_id: str
    amount: Decimal = Field(..., gt=0)
    receipt_date: date
    payment_type: PaymentType
    bank_account_id: str
    invoice_id: str | None = None
    reference: str | None = None
    memo: str | None = None
    currency_code: str = "USD"


class ReceiptResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    receipt_number: str
    customer_id: str
    invoice_id: str | None
    receipt_date: date
    payment_type: PaymentType
    status: ReceiptStatus
    amount: Decimal
    currency_code: str
    reference: str | None
    memo: str | None
    created_at: str
    updated_at: str

    @classmethod
    def from_entity(cls, receipt: Receipt) -> "ReceiptResponse":
        return cls(
            id=receipt.id, receipt_number=receipt.receipt_number,
            customer_id=receipt.customer_id, invoice_id=receipt.invoice_id,
            receipt_date=receipt.receipt_date, payment_type=receipt.payment_type,
            status=receipt.status, amount=receipt.amount,
            currency_code=receipt.currency_code, reference=receipt.reference,
            memo=receipt.memo, created_at=receipt.created_at.isoformat(),
            updated_at=receipt.updated_at.isoformat(),
        )


class ReceiptListResponse(BaseModel):
    items: list[ReceiptResponse]
    total: int
    limit: int
    offset: int


class SendInvoiceRequest(BaseModel):
    ar_account_id: str
    sent_by: str


class ProcessReceiptRequest(BaseModel):
    processed_by: str


class WriteOffRequest(BaseModel):
    bad_debt_account_id: str
    written_off_by: str
    reason: str


class AgingReportResponse(BaseModel):
    current: Decimal
    days_1_30: Decimal = Field(alias="1_30_days")
    days_31_60: Decimal = Field(alias="31_60_days")
    days_61_90: Decimal = Field(alias="61_90_days")
    over_90_days: Decimal
    total: Decimal


# --- Dependency Injection ---

async def get_customer_repository(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> CustomerRepository:
    return CustomerRepository(session)


async def get_invoice_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ARInvoiceService:
    return ARInvoiceService(session)


async def get_receipt_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ReceiptService:
    return ReceiptService(session)


# --- Customer Endpoints ---

@router.get("/customers", response_model=CustomerListResponse)
async def list_customers(
    repo: Annotated[CustomerRepository, Depends(get_customer_repository)],
    status: CustomerStatus | None = None,
    search: str | None = None,
    limit: Annotated[int, Query(ge=1, le=1000)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> CustomerListResponse:
    customers = await repo.list_customers(
        status=status, search=search, limit=limit, offset=offset,
    )
    total = await repo.count_customers(status=status)
    return CustomerListResponse(
        items=[CustomerResponse.from_entity(c) for c in customers],
        total=total, limit=limit, offset=offset,
    )


@router.get("/customers/{customer_id}", response_model=CustomerResponse)
async def get_customer(
    customer_id: str,
    repo: Annotated[CustomerRepository, Depends(get_customer_repository)],
) -> CustomerResponse:
    customer = await repo.get_by_id(customer_id)
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer with ID '{customer_id}' not found",
        )
    return CustomerResponse.from_entity(customer)


@router.post("/customers", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
async def create_customer(
    data: CustomerCreate,
    repo: Annotated[CustomerRepository, Depends(get_customer_repository)],
) -> CustomerResponse:
    code = await repo.get_next_code()
    customer = Customer(
        code=code, name=data.name, display_name=data.display_name,
        customer_type=data.customer_type, tax_id=data.tax_id,
        tax_exempt=data.tax_exempt, payment_terms_days=data.payment_terms_days,
        default_revenue_account_id=data.default_revenue_account_id,
        currency_code=data.currency_code.upper(), credit_limit=data.credit_limit,
        contact_name=data.contact_name, contact_email=data.contact_email,
        contact_phone=data.contact_phone, website=data.website,
        billing_address_line1=data.billing_address_line1,
        billing_address_line2=data.billing_address_line2,
        billing_city=data.billing_city, billing_state=data.billing_state,
        billing_postal_code=data.billing_postal_code,
        billing_country=data.billing_country, notes=data.notes,
    )
    await repo.add(customer)
    return CustomerResponse.from_entity(customer)


@router.get("/customers/with-balance", response_model=list[CustomerResponse])
async def get_customers_with_balance(
    repo: Annotated[CustomerRepository, Depends(get_customer_repository)],
) -> list[CustomerResponse]:
    customers = await repo.get_customers_with_balance()
    return [CustomerResponse.from_entity(c) for c in customers]


# --- AR Invoice Endpoints ---

@router.get("/invoices", response_model=ARInvoiceListResponse)
async def list_ar_invoices(
    service: Annotated[ARInvoiceService, Depends(get_invoice_service)],
    customer_id: str | None = None,
    status: ARInvoiceStatus | None = None,
    overdue_only: bool = False,
    limit: Annotated[int, Query(ge=1, le=1000)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ARInvoiceListResponse:
    invoices = await service.invoice_repo.list_invoices(
        customer_id=customer_id, status=status, overdue_only=overdue_only,
        limit=limit, offset=offset,
    )
    return ARInvoiceListResponse(
        items=[ARInvoiceResponse.from_entity(i) for i in invoices],
        total=len(invoices), limit=limit, offset=offset,
    )


@router.get("/invoices/{invoice_id}", response_model=ARInvoiceResponse)
async def get_ar_invoice(
    invoice_id: str,
    service: Annotated[ARInvoiceService, Depends(get_invoice_service)],
) -> ARInvoiceResponse:
    invoice = await service.invoice_repo.get_by_id(invoice_id)
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"AR Invoice with ID '{invoice_id}' not found",
        )
    return ARInvoiceResponse.from_entity(invoice)


@router.post("/invoices", response_model=ARInvoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_ar_invoice(
    data: ARInvoiceCreate,
    service: Annotated[ARInvoiceService, Depends(get_invoice_service)],
) -> ARInvoiceResponse:
    lines = [line.model_dump() for line in data.lines]
    invoice = await service.create_invoice(
        customer_id=data.customer_id,
        invoice_date=data.invoice_date,
        lines=lines,
        description=data.description,
        tax_amount=data.tax_amount,
        po_number=data.po_number,
        terms=data.terms,
        notes=data.notes,
        currency_code=data.currency_code,
    )
    return ARInvoiceResponse.from_entity(invoice)


@router.post("/invoices/{invoice_id}/send", response_model=ARInvoiceResponse)
async def send_ar_invoice(
    invoice_id: str,
    data: SendInvoiceRequest,
    service: Annotated[ARInvoiceService, Depends(get_invoice_service)],
) -> ARInvoiceResponse:
    invoice = await service.send_invoice(
        invoice_id=invoice_id,
        ar_account_id=data.ar_account_id,
        sent_by=data.sent_by,
    )
    return ARInvoiceResponse.from_entity(invoice)


@router.post("/invoices/{invoice_id}/write-off", response_model=ARInvoiceResponse)
async def write_off_ar_invoice(
    invoice_id: str,
    data: WriteOffRequest,
    service: Annotated[ARInvoiceService, Depends(get_invoice_service)],
) -> ARInvoiceResponse:
    invoice = await service.write_off_invoice(
        invoice_id=invoice_id,
        bad_debt_account_id=data.bad_debt_account_id,
        written_off_by=data.written_off_by,
        reason=data.reason,
    )
    return ARInvoiceResponse.from_entity(invoice)


@router.get("/aging", response_model=AgingReportResponse)
async def get_ar_aging_report(
    service: Annotated[ARInvoiceService, Depends(get_invoice_service)],
    customer_id: str | None = None,
) -> AgingReportResponse:
    aging = await service.get_aging_report(customer_id=customer_id)
    return AgingReportResponse(
        current=aging["current"],
        **{"1_30_days": aging["1_30_days"]},
        **{"31_60_days": aging["31_60_days"]},
        **{"61_90_days": aging["61_90_days"]},
        over_90_days=aging["over_90_days"],
        total=aging["total"],
    )


# --- Receipt Endpoints ---

@router.get("/receipts", response_model=ReceiptListResponse)
async def list_receipts(
    service: Annotated[ReceiptService, Depends(get_receipt_service)],
    customer_id: str | None = None,
    invoice_id: str | None = None,
    status: ReceiptStatus | None = None,
    limit: Annotated[int, Query(ge=1, le=1000)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ReceiptListResponse:
    receipts = await service.receipt_repo.list_receipts(
        customer_id=customer_id, invoice_id=invoice_id, status=status,
        limit=limit, offset=offset,
    )
    return ReceiptListResponse(
        items=[ReceiptResponse.from_entity(r) for r in receipts],
        total=len(receipts), limit=limit, offset=offset,
    )


@router.get("/receipts/{receipt_id}", response_model=ReceiptResponse)
async def get_receipt(
    receipt_id: str,
    service: Annotated[ReceiptService, Depends(get_receipt_service)],
) -> ReceiptResponse:
    receipt = await service.receipt_repo.get_by_id(receipt_id)
    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Receipt with ID '{receipt_id}' not found",
        )
    return ReceiptResponse.from_entity(receipt)


@router.post("/receipts", response_model=ReceiptResponse, status_code=status.HTTP_201_CREATED)
async def create_receipt(
    data: ReceiptCreate,
    service: Annotated[ReceiptService, Depends(get_receipt_service)],
) -> ReceiptResponse:
    receipt = await service.create_receipt(
        customer_id=data.customer_id,
        amount=data.amount,
        receipt_date=data.receipt_date,
        payment_type=data.payment_type,
        bank_account_id=data.bank_account_id,
        invoice_id=data.invoice_id,
        reference=data.reference,
        memo=data.memo,
        currency_code=data.currency_code,
    )
    return ReceiptResponse.from_entity(receipt)


@router.post("/receipts/{receipt_id}/deposit", response_model=ReceiptResponse)
async def deposit_receipt(
    receipt_id: str,
    data: ProcessReceiptRequest,
    service: Annotated[ReceiptService, Depends(get_receipt_service)],
) -> ReceiptResponse:
    receipt = await service.deposit_receipt(
        receipt_id=receipt_id,
        deposited_by=data.processed_by,
    )
    return ReceiptResponse.from_entity(receipt)


@router.post("/receipts/{receipt_id}/process", response_model=ReceiptResponse)
async def process_receipt(
    receipt_id: str,
    data: ProcessReceiptRequest,
    service: Annotated[ReceiptService, Depends(get_receipt_service)],
) -> ReceiptResponse:
    receipt = await service.process_receipt(
        receipt_id=receipt_id,
        processed_by=data.processed_by,
    )
    return ReceiptResponse.from_entity(receipt)


@router.post("/receipts/{receipt_id}/clear", response_model=ReceiptResponse)
async def clear_receipt(
    receipt_id: str,
    service: Annotated[ReceiptService, Depends(get_receipt_service)],
) -> ReceiptResponse:
    receipt = await service.mark_cleared(receipt_id)
    return ReceiptResponse.from_entity(receipt)


@router.get("/receipts/pending-deposits", response_model=list[ReceiptResponse])
async def get_pending_deposits(
    service: Annotated[ReceiptService, Depends(get_receipt_service)],
) -> list[ReceiptResponse]:
    receipts = await service.receipt_repo.get_pending_deposits()
    return [ReceiptResponse.from_entity(r) for r in receipts]
