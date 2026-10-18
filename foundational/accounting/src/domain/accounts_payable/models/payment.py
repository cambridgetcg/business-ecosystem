"""
Payment - a disbursement to settle an AP invoice.

Payments record cash outflows to vendors. When posted, they create:
    Dr. Accounts Payable
    Cr. Cash/Bank Account
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
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.infrastructure.persistence.base import (
    BaseEntity,
    MONEY_PRECISION,
    MONEY_SCALE,
)

if TYPE_CHECKING:
    from src.domain.accounts_payable.models.vendor import Vendor
    from src.domain.accounts_payable.models.ap_invoice import APInvoice


class PaymentMethod(str, Enum):
    """Payment method types."""

    CHECK = "CHECK"
    ACH = "ACH"                # Electronic bank transfer
    WIRE = "WIRE"
    CREDIT_CARD = "CREDIT_CARD"
    CASH = "CASH"
    OTHER = "OTHER"


class PaymentStatus(str, Enum):
    """Payment lifecycle status."""

    DRAFT = "DRAFT"            # Being prepared
    PENDING = "PENDING"        # Awaiting approval
    APPROVED = "APPROVED"      # Approved, ready to send
    SENT = "SENT"              # Payment has been sent/issued
    CLEARED = "CLEARED"        # Confirmed cleared by bank
    CANCELLED = "CANCELLED"    # Cancelled/voided
    FAILED = "FAILED"          # Failed to process


class Payment(BaseEntity):
    """
    Payment - a disbursement to a vendor.

    Attributes:
        payment_number: Unique payment reference (e.g., PAY-2026-00001)
        vendor_id: Reference to the vendor
        invoice_id: Reference to the AP invoice being paid
        payment_date: Date of the payment
        payment_method: How the payment is made
        status: Payment lifecycle status
        amount: Payment amount
        currency_code: Payment currency
        check_number: Check number (if applicable)
        reference: External reference (ACH trace, wire ref, etc.)
        bank_account_id: Account used for payment
        journal_entry_id: Reference to GL entry when posted
        memo: Payment memo/description
    """

    __tablename__ = "payments"

    # Identity
    payment_number: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
        comment="Unique payment number (e.g., PAY-2026-00001)",
    )

    # References
    vendor_id: Mapped[str] = mapped_column(
        String(26),
        ForeignKey("vendors.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    invoice_id: Mapped[str | None] = mapped_column(
        String(26),
        ForeignKey("ap_invoices.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
        comment="Invoice being paid (null for prepayment)",
    )

    # Payment Details
    payment_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
    )
    payment_method: Mapped[PaymentMethod] = mapped_column(
        SQLEnum(PaymentMethod, native_enum=False),
        nullable=False,
        default=PaymentMethod.ACH,
    )
    status: Mapped[PaymentStatus] = mapped_column(
        SQLEnum(PaymentStatus, native_enum=False),
        nullable=False,
        default=PaymentStatus.DRAFT,
        index=True,
    )

    # Amount
    amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=MONEY_PRECISION, scale=MONEY_SCALE),
        nullable=False,
    )
    currency_code: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        default="USD",
    )

    # Method-specific details
    check_number: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="Check number (if payment_method=CHECK)",
    )
    reference: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="External reference (ACH trace, wire ref, etc.)",
    )

    # Accounting
    bank_account_id: Mapped[str | None] = mapped_column(
        String(26),
        ForeignKey("accounts.id", ondelete="RESTRICT"),
        nullable=True,
        comment="Cash/bank account to credit",
    )
    journal_entry_id: Mapped[str | None] = mapped_column(
        String(26),
        ForeignKey("journal_entries.id", ondelete="SET NULL"),
        nullable=True,
        comment="Journal entry created when posted",
    )

    # Memo
    memo: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Approval/Processing
    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    approved_by: Mapped[str | None] = mapped_column(
        String(36),
        nullable=True,
    )
    sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when payment was sent",
    )
    cleared_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when payment cleared",
    )

    # Relationships
    vendor: Mapped["Vendor"] = relationship(
        "Vendor",
        lazy="joined",
    )
    invoice: Mapped["APInvoice | None"] = relationship(
        "APInvoice",
        back_populates="payments",
        lazy="joined",
    )

    def __repr__(self) -> str:
        return (
            f"<Payment("
            f"number={self.payment_number}, "
            f"amount={self.amount}, "
            f"status={self.status.value})>"
        )

    @property
    def is_editable(self) -> bool:
        """Return True if payment can be modified."""
        return self.status in (PaymentStatus.DRAFT, PaymentStatus.PENDING)

    @property
    def can_be_sent(self) -> bool:
        """Return True if payment can be sent."""
        return self.status == PaymentStatus.APPROVED

    @property
    def is_complete(self) -> bool:
        """Return True if payment is complete."""
        return self.status in (PaymentStatus.SENT, PaymentStatus.CLEARED)

    def approve(self, user_id: str) -> None:
        """Approve the payment."""
        if self.status != PaymentStatus.PENDING:
            raise ValueError(f"Cannot approve payment with status {self.status.value}")
        self.status = PaymentStatus.APPROVED
        self.approved_at = datetime.utcnow()
        self.approved_by = user_id

    def mark_sent(self) -> None:
        """Mark payment as sent."""
        if self.status != PaymentStatus.APPROVED:
            raise ValueError(f"Cannot send payment with status {self.status.value}")
        self.status = PaymentStatus.SENT
        self.sent_at = datetime.utcnow()

    def mark_cleared(self) -> None:
        """Mark payment as cleared by bank."""
        if self.status != PaymentStatus.SENT:
            raise ValueError(f"Cannot clear payment with status {self.status.value}")
        self.status = PaymentStatus.CLEARED
        self.cleared_at = datetime.utcnow()

    def cancel(self) -> None:
        """Cancel the payment."""
        if self.status in (PaymentStatus.CLEARED,):
            raise ValueError("Cannot cancel a cleared payment")
        self.status = PaymentStatus.CANCELLED
