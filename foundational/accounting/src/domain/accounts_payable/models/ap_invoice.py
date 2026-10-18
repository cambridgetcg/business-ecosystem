"""
AP Invoice - a bill received from a vendor.

AP Invoices represent obligations to pay vendors for goods/services received.
They flow through a lifecycle: DRAFT -> PENDING -> APPROVED -> PAID/CANCELLED.

When approved and posted, the invoice creates a journal entry:
    Dr. Expense Account (or Asset if inventory)
    Cr. Accounts Payable
"""

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import (
    Date,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.infrastructure.persistence.base import (
    BaseEntity,
    Base,
    MONEY_PRECISION,
    MONEY_SCALE,
    generate_ulid,
)

if TYPE_CHECKING:
    from src.domain.accounts_payable.models.vendor import Vendor
    from src.domain.accounts_payable.models.payment import Payment


class APInvoiceStatus(str, Enum):
    """AP Invoice lifecycle status."""

    DRAFT = "DRAFT"            # Being created, not yet submitted
    PENDING = "PENDING"        # Submitted, awaiting approval
    APPROVED = "APPROVED"      # Approved for payment
    PARTIALLY_PAID = "PARTIALLY_PAID"  # Some payments applied
    PAID = "PAID"              # Fully paid
    CANCELLED = "CANCELLED"    # Cancelled/voided
    ON_HOLD = "ON_HOLD"        # Disputed or held for review


class APInvoice(BaseEntity):
    """
    AP Invoice - a bill from a vendor.

    Attributes:
        invoice_number: Our internal reference number
        vendor_invoice_number: Vendor's invoice number
        vendor_id: Reference to the vendor
        invoice_date: Date on the invoice
        due_date: Payment due date
        received_date: Date we received the invoice
        status: Invoice lifecycle status
        currency_code: Invoice currency
        subtotal: Sum of line amounts before tax
        tax_amount: Total tax amount
        total_amount: Grand total (subtotal + tax)
        amount_paid: Amount already paid
        amount_due: Remaining balance
        description: Invoice description/memo
        journal_entry_id: Reference to GL entry when posted
        ap_account_id: AP account to credit
    """

    __tablename__ = "ap_invoices"

    # Identity
    invoice_number: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
        comment="Internal invoice number (e.g., AP-2026-00001)",
    )
    vendor_invoice_number: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True,
        comment="Vendor's invoice number",
    )

    # Vendor Reference
    vendor_id: Mapped[str] = mapped_column(
        String(26),
        ForeignKey("vendors.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Dates
    invoice_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
        comment="Date on the invoice",
    )
    due_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
        comment="Payment due date",
    )
    received_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
        comment="Date invoice was received",
    )

    # Status
    status: Mapped[APInvoiceStatus] = mapped_column(
        SQLEnum(APInvoiceStatus, native_enum=False),
        nullable=False,
        default=APInvoiceStatus.DRAFT,
        index=True,
    )

    # Amounts
    currency_code: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        default="USD",
    )
    subtotal: Mapped[Decimal] = mapped_column(
        Numeric(precision=MONEY_PRECISION, scale=MONEY_SCALE),
        nullable=False,
        default=Decimal("0"),
        comment="Sum of line amounts",
    )
    tax_amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=MONEY_PRECISION, scale=MONEY_SCALE),
        nullable=False,
        default=Decimal("0"),
    )
    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=MONEY_PRECISION, scale=MONEY_SCALE),
        nullable=False,
        default=Decimal("0"),
        comment="Grand total (subtotal + tax)",
    )
    amount_paid: Mapped[Decimal] = mapped_column(
        Numeric(precision=MONEY_PRECISION, scale=MONEY_SCALE),
        nullable=False,
        default=Decimal("0"),
        comment="Amount already paid",
    )

    # Description
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # GL Integration
    journal_entry_id: Mapped[str | None] = mapped_column(
        String(26),
        ForeignKey("journal_entries.id", ondelete="SET NULL"),
        nullable=True,
        comment="Journal entry created when posted",
    )
    ap_account_id: Mapped[str | None] = mapped_column(
        String(26),
        ForeignKey("accounts.id", ondelete="RESTRICT"),
        nullable=True,
        comment="AP account to credit",
    )

    # Approval
    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    approved_by: Mapped[str | None] = mapped_column(
        String(36),
        nullable=True,
    )

    # Source Document
    source_document_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="URL to scanned invoice or PDF",
    )

    # Relationships
    vendor: Mapped["Vendor"] = relationship(
        "Vendor",
        back_populates="invoices",
        lazy="joined",
    )
    lines: Mapped[list["APInvoiceLine"]] = relationship(
        "APInvoiceLine",
        back_populates="invoice",
        cascade="all, delete-orphan",
        order_by="APInvoiceLine.line_number",
        lazy="selectin",
    )
    payments: Mapped[list["Payment"]] = relationship(
        "Payment",
        back_populates="invoice",
        lazy="dynamic",
    )

    def __repr__(self) -> str:
        return (
            f"<APInvoice("
            f"number={self.invoice_number}, "
            f"vendor={self.vendor_id}, "
            f"total={self.total_amount}, "
            f"status={self.status.value})>"
        )

    @property
    def amount_due(self) -> Decimal:
        """Calculate remaining amount due."""
        return self.total_amount - self.amount_paid

    @property
    def is_paid(self) -> bool:
        """Return True if invoice is fully paid."""
        return self.amount_due <= Decimal("0.01")

    @property
    def is_overdue(self) -> bool:
        """Return True if invoice is past due date."""
        if self.status in (APInvoiceStatus.PAID, APInvoiceStatus.CANCELLED):
            return False
        return date.today() > self.due_date

    @property
    def days_overdue(self) -> int:
        """Return number of days past due (0 if not overdue)."""
        if not self.is_overdue:
            return 0
        return (date.today() - self.due_date).days

    @property
    def is_editable(self) -> bool:
        """Return True if invoice can be modified."""
        return self.status in (APInvoiceStatus.DRAFT, APInvoiceStatus.PENDING)

    @property
    def can_be_approved(self) -> bool:
        """Return True if invoice can be approved."""
        return self.status == APInvoiceStatus.PENDING

    @property
    def can_be_paid(self) -> bool:
        """Return True if invoice can receive payment."""
        return self.status in (
            APInvoiceStatus.APPROVED,
            APInvoiceStatus.PARTIALLY_PAID,
        )

    def calculate_totals(self) -> None:
        """Recalculate totals from lines."""
        self.subtotal = sum(
            (line.amount for line in self.lines),
            Decimal("0"),
        )
        self.total_amount = self.subtotal + self.tax_amount

    def apply_payment(self, amount: Decimal) -> None:
        """Apply a payment amount to this invoice."""
        self.amount_paid += amount
        if self.is_paid:
            self.status = APInvoiceStatus.PAID
        elif self.amount_paid > Decimal("0"):
            self.status = APInvoiceStatus.PARTIALLY_PAID


class APInvoiceLine(Base):
    """
    A line item on an AP Invoice.

    Each line represents a specific expense or item being purchased.
    """

    __tablename__ = "ap_invoice_lines"

    id: Mapped[str] = mapped_column(
        String(26),
        primary_key=True,
        default=generate_ulid,
    )

    # Parent Reference
    invoice_id: Mapped[str] = mapped_column(
        String(26),
        ForeignKey("ap_invoices.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Line Details
    line_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    description: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )
    quantity: Mapped[Decimal] = mapped_column(
        Numeric(precision=12, scale=4),
        nullable=False,
        default=Decimal("1"),
    )
    unit_price: Mapped[Decimal] = mapped_column(
        Numeric(precision=MONEY_PRECISION, scale=MONEY_SCALE),
        nullable=False,
    )
    amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=MONEY_PRECISION, scale=MONEY_SCALE),
        nullable=False,
        comment="quantity * unit_price",
    )

    # Accounting
    expense_account_id: Mapped[str] = mapped_column(
        String(26),
        ForeignKey("accounts.id", ondelete="RESTRICT"),
        nullable=False,
        comment="Expense or asset account to debit",
    )

    # Optional categorization
    category: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    project_id: Mapped[str | None] = mapped_column(
        String(26),
        nullable=True,
        comment="Optional project reference",
    )

    # Relationships
    invoice: Mapped[APInvoice] = relationship(
        "APInvoice",
        back_populates="lines",
    )

    def __repr__(self) -> str:
        return f"<APInvoiceLine(description={self.description}, amount={self.amount})>"

    def calculate_amount(self) -> None:
        """Calculate amount from quantity and unit price."""
        self.amount = self.quantity * self.unit_price
