"""REST API endpoints for Accounts Payable management."""

from datetime import date
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.accounts_payable.models.vendor import Vendor, VendorStatus, PaymentTerms
from src.domain.accounts_payable.models.ap_invoice import APInvoice, APInvoiceStatus
from src.domain.accounts_payable.models.payment import Payment, PaymentMethod, PaymentStatus
from src.domain.accounts_payable.repositories.vendor_repository import VendorRepository
from src.domain.accounts_payable.repositories.ap_invoice_repository import APInvoiceRepository
from src.domain.accounts_payable.repositories.payment_repository import PaymentRepository
from src.domain.accounts_payable.services.ap_invoice_service import APInvoiceService
from src.domain.accounts_payable.services.payment_service import PaymentService
from src.infrastructure.persistence.database import get_session

router = APIRouter(prefix="/ap", tags=["Accounts Payable"])


# --- Pydantic Models ---

class VendorCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    display_name: str | None = Field(None, max_length=100)
    tax_id: str | None = Field(None, max_length=50)
    payment_terms: PaymentTerms = PaymentTerms.NET_30
    credit_limit: Decimal | None = None
    currency_code: str = Field("USD", min_length=3, max_length=3)
    contact_name: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state: str | None = None
    postal_code: str | None = None
    country: str = "US"
    notes: str | None = None


class VendorUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    display_name: str | None = None
    status: VendorStatus | None = None
    payment_terms: PaymentTerms | None = None
    credit_limit: Decimal | None = None


class VendorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    code: str
    name: str
    display_name: str | None
    status: VendorStatus
    tax_id: str | None
    payment_terms: PaymentTerms
    currency_code: str
    credit_limit: Decimal | None
    current_balance: Decimal
    contact_name: str | None
    contact_email: str | None
    created_at: str
    updated_at: str

    @classmethod
    def from_entity(cls, vendor: Vendor) -> "VendorResponse":
        return cls(
            id=vendor.id, code=vendor.code, name=vendor.name,
            display_name=vendor.display_name, status=vendor.status,
            tax_id=vendor.tax_id, payment_terms=vendor.payment_terms,
            currency_code=vendor.currency_code, credit_limit=vendor.credit_limit,
            current_balance=vendor.current_balance,
            contact_name=vendor.contact_name, contact_email=vendor.contact_email,
            created_at=vendor.created_at.isoformat(),
            updated_at=vendor.updated_at.isoformat(),
        )


class VendorListResponse(BaseModel):
    items: list[VendorResponse]
    total: int
    limit: int
    offset: int


class APInvoiceLineCreate(BaseModel):
    description: str = Field(..., min_length=1, max_length=500)
    quantity: Decimal = Field(default=Decimal("1"), ge=0)
    unit_price: Decimal = Field(..., ge=0)
    expense_account_id: str
    category: str | None = None
    project_id: str | None = None


class APInvoiceCreate(BaseModel):
    vendor_id: str
    invoice_date: date
    vendor_invoice_number: str | None = None
    description: str | None = None
    tax_amount: Decimal = Field(default=Decimal("0"), ge=0)
    currency_code: str = "USD"
    lines: list[APInvoiceLineCreate]


class APInvoiceLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    line_number: int
    description: str
    quantity: Decimal
    unit_price: Decimal
    amount: Decimal
    expense_account_id: str
    category: str | None


class APInvoiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    invoice_number: str
    vendor_invoice_number: str | None
    vendor_id: str
    invoice_date: date
    due_date: date
    status: APInvoiceStatus
    currency_code: str
    subtotal: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    amount_paid: Decimal
    amount_due: Decimal
    description: str | None
    lines: list[APInvoiceLineResponse]
    created_at: str
    updated_at: str

    @classmethod
    def from_entity(cls, invoice: APInvoice) -> "APInvoiceResponse":
        return cls(
            id=invoice.id, invoice_number=invoice.invoice_number,
            vendor_invoice_number=invoice.vendor_invoice_number,
            vendor_id=invoice.vendor_id, invoice_date=invoice.invoice_date,
            due_date=invoice.due_date, status=invoice.status,
            currency_code=invoice.currency_code, subtotal=invoice.subtotal,
            tax_amount=invoice.tax_amount, total_amount=invoice.total_amount,
            amount_paid=invoice.amount_paid, amount_due=invoice.amount_due,
            description=invoice.description,
            lines=[APInvoiceLineResponse(
                id=line.id, line_number=line.line_number,
                description=line.description, quantity=line.quantity,
                unit_price=line.unit_price, amount=line.amount,
                expense_account_id=line.expense_account_id, category=line.category,
            ) for line in invoice.lines],
            created_at=invoice.created_at.isoformat(),
            updated_at=invoice.updated_at.isoformat(),
        )


class APInvoiceListResponse(BaseModel):
    items: list[APInvoiceResponse]
    total: int
    limit: int
    offset: int


class PaymentCreate(BaseModel):
    vendor_id: str
    amount: Decimal = Field(..., gt=0)
    payment_date: date
    payment_method: PaymentMethod
    bank_account_id: str
    invoice_id: str | None = None
    check_number: str | None = None
    reference: str | None = None
    memo: str | None = None


class PaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    payment_number: str
    vendor_id: str
    invoice_id: str | None
    payment_date: date
    payment_method: PaymentMethod
    status: PaymentStatus
    amount: Decimal
    currency_code: str
    check_number: str | None
    reference: str | None
    memo: str | None
    created_at: str
    updated_at: str

    @classmethod
    def from_entity(cls, payment: Payment) -> "PaymentResponse":
        return cls(
            id=payment.id, payment_number=payment.payment_number,
            vendor_id=payment.vendor_id, invoice_id=payment.invoice_id,
            payment_date=payment.payment_date, payment_method=payment.payment_method,
            status=payment.status, amount=payment.amount,
            currency_code=payment.currency_code, check_number=payment.check_number,
            reference=payment.reference, memo=payment.memo,
            created_at=payment.created_at.isoformat(),
            updated_at=payment.updated_at.isoformat(),
        )


class PaymentListResponse(BaseModel):
    items: list[PaymentResponse]
    total: int
    limit: int
    offset: int


class ApprovalRequest(BaseModel):
    ap_account_id: str
    approved_by: str


class PaymentApprovalRequest(BaseModel):
    approved_by: str


class AgingReportResponse(BaseModel):
    current: Decimal
    days_1_30: Decimal = Field(alias="1_30_days")
    days_31_60: Decimal = Field(alias="31_60_days")
    days_61_90: Decimal = Field(alias="61_90_days")
    over_90_days: Decimal
    total: Decimal


# --- Dependency Injection ---

async def get_vendor_repository(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> VendorRepository:
    return VendorRepository(session)


async def get_invoice_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> APInvoiceService:
    return APInvoiceService(session)


async def get_payment_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> PaymentService:
    return PaymentService(session)


# --- Vendor Endpoints ---

@router.get("/vendors", response_model=VendorListResponse)
async def list_vendors(
    repo: Annotated[VendorRepository, Depends(get_vendor_repository)],
    status: VendorStatus | None = None,
    search: str | None = None,
    limit: Annotated[int, Query(ge=1, le=1000)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> VendorListResponse:
    vendors = await repo.list_vendors(
        status=status, search=search, limit=limit, offset=offset,
    )
    total = await repo.count_vendors(status=status)
    return VendorListResponse(
        items=[VendorResponse.from_entity(v) for v in vendors],
        total=total, limit=limit, offset=offset,
    )


@router.get("/vendors/{vendor_id}", response_model=VendorResponse)
async def get_vendor(
    vendor_id: str,
    repo: Annotated[VendorRepository, Depends(get_vendor_repository)],
) -> VendorResponse:
    vendor = await repo.get_by_id(vendor_id)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vendor with ID '{vendor_id}' not found",
        )
    return VendorResponse.from_entity(vendor)


@router.post("/vendors", response_model=VendorResponse, status_code=status.HTTP_201_CREATED)
async def create_vendor(
    data: VendorCreate,
    repo: Annotated[VendorRepository, Depends(get_vendor_repository)],
) -> VendorResponse:
    code = await repo.get_next_code()
    vendor = Vendor(
        code=code, name=data.name, display_name=data.display_name,
        tax_id=data.tax_id, payment_terms=data.payment_terms,
        credit_limit=data.credit_limit, currency_code=data.currency_code.upper(),
        contact_name=data.contact_name, contact_email=data.contact_email,
        contact_phone=data.contact_phone, address_line1=data.address_line1,
        address_line2=data.address_line2, city=data.city, state=data.state,
        postal_code=data.postal_code, country=data.country, notes=data.notes,
    )
    await repo.add(vendor)
    return VendorResponse.from_entity(vendor)


# --- AP Invoice Endpoints ---

@router.get("/invoices", response_model=APInvoiceListResponse)
async def list_ap_invoices(
    service: Annotated[APInvoiceService, Depends(get_invoice_service)],
    vendor_id: str | None = None,
    status: APInvoiceStatus | None = None,
    overdue_only: bool = False,
    limit: Annotated[int, Query(ge=1, le=1000)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> APInvoiceListResponse:
    invoices = await service.invoice_repo.list_invoices(
        vendor_id=vendor_id, status=status, overdue_only=overdue_only,
        limit=limit, offset=offset,
    )
    return APInvoiceListResponse(
        items=[APInvoiceResponse.from_entity(i) for i in invoices],
        total=len(invoices), limit=limit, offset=offset,
    )


@router.get("/invoices/{invoice_id}", response_model=APInvoiceResponse)
async def get_ap_invoice(
    invoice_id: str,
    service: Annotated[APInvoiceService, Depends(get_invoice_service)],
) -> APInvoiceResponse:
    invoice = await service.invoice_repo.get_by_id(invoice_id)
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"AP Invoice with ID '{invoice_id}' not found",
        )
    return APInvoiceResponse.from_entity(invoice)


@router.post("/invoices", response_model=APInvoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_ap_invoice(
    data: APInvoiceCreate,
    service: Annotated[APInvoiceService, Depends(get_invoice_service)],
) -> APInvoiceResponse:
    lines = [line.model_dump() for line in data.lines]
    invoice = await service.create_invoice(
        vendor_id=data.vendor_id,
        invoice_date=data.invoice_date,
        lines=lines,
        vendor_invoice_number=data.vendor_invoice_number,
        description=data.description,
        tax_amount=data.tax_amount,
        currency_code=data.currency_code,
    )
    return APInvoiceResponse.from_entity(invoice)


@router.post("/invoices/{invoice_id}/submit", response_model=APInvoiceResponse)
async def submit_ap_invoice(
    invoice_id: str,
    service: Annotated[APInvoiceService, Depends(get_invoice_service)],
) -> APInvoiceResponse:
    invoice = await service.submit_for_approval(invoice_id)
    return APInvoiceResponse.from_entity(invoice)


@router.post("/invoices/{invoice_id}/approve", response_model=APInvoiceResponse)
async def approve_ap_invoice(
    invoice_id: str,
    data: ApprovalRequest,
    service: Annotated[APInvoiceService, Depends(get_invoice_service)],
) -> APInvoiceResponse:
    invoice = await service.approve_invoice(
        invoice_id=invoice_id,
        ap_account_id=data.ap_account_id,
        approved_by=data.approved_by,
    )
    return APInvoiceResponse.from_entity(invoice)


@router.get("/aging", response_model=AgingReportResponse)
async def get_ap_aging_report(
    service: Annotated[APInvoiceService, Depends(get_invoice_service)],
) -> AgingReportResponse:
    aging = await service.get_aging_report()
    return AgingReportResponse(
        current=aging["current"],
        **{"1_30_days": aging["1_30_days"]},
        **{"31_60_days": aging["31_60_days"]},
        **{"61_90_days": aging["61_90_days"]},
        over_90_days=aging["over_90_days"],
        total=aging["total"],
    )


# --- Payment Endpoints ---

@router.get("/payments", response_model=PaymentListResponse)
async def list_payments(
    service: Annotated[PaymentService, Depends(get_payment_service)],
    vendor_id: str | None = None,
    status: PaymentStatus | None = None,
    limit: Annotated[int, Query(ge=1, le=1000)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaymentListResponse:
    payments = await service.payment_repo.list_payments(
        vendor_id=vendor_id, status=status, limit=limit, offset=offset,
    )
    return PaymentListResponse(
        items=[PaymentResponse.from_entity(p) for p in payments],
        total=len(payments), limit=limit, offset=offset,
    )


@router.get("/payments/{payment_id}", response_model=PaymentResponse)
async def get_payment(
    payment_id: str,
    service: Annotated[PaymentService, Depends(get_payment_service)],
) -> PaymentResponse:
    payment = await service.payment_repo.get_by_id(payment_id)
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payment with ID '{payment_id}' not found",
        )
    return PaymentResponse.from_entity(payment)


@router.post("/payments", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
async def create_payment(
    data: PaymentCreate,
    service: Annotated[PaymentService, Depends(get_payment_service)],
) -> PaymentResponse:
    payment = await service.create_payment(
        vendor_id=data.vendor_id,
        amount=data.amount,
        payment_date=data.payment_date,
        payment_method=data.payment_method,
        bank_account_id=data.bank_account_id,
        invoice_id=data.invoice_id,
        check_number=data.check_number,
        reference=data.reference,
        memo=data.memo,
    )
    return PaymentResponse.from_entity(payment)


@router.post("/payments/{payment_id}/submit", response_model=PaymentResponse)
async def submit_payment(
    payment_id: str,
    service: Annotated[PaymentService, Depends(get_payment_service)],
) -> PaymentResponse:
    payment = await service.submit_for_approval(payment_id)
    return PaymentResponse.from_entity(payment)


@router.post("/payments/{payment_id}/approve", response_model=PaymentResponse)
async def approve_payment(
    payment_id: str,
    data: PaymentApprovalRequest,
    service: Annotated[PaymentService, Depends(get_payment_service)],
) -> PaymentResponse:
    payment = await service.approve_payment(
        payment_id=payment_id,
        approved_by=data.approved_by,
    )
    return PaymentResponse.from_entity(payment)


@router.post("/payments/{payment_id}/process", response_model=PaymentResponse)
async def process_payment(
    payment_id: str,
    data: PaymentApprovalRequest,
    service: Annotated[PaymentService, Depends(get_payment_service)],
) -> PaymentResponse:
    payment = await service.process_payment(
        payment_id=payment_id,
        processed_by=data.approved_by,
    )
    return PaymentResponse.from_entity(payment)
