"""
Source Document - external evidence supporting journal entries.

Every journal entry should be traceable to a source document that
provides evidence of the transaction (invoice, receipt, contract, etc.).

Research Grounding: docs/gaps/03-traceability-meaning.md
Audit Requirement: SOX requires drill-down from statements to source
"""

from datetime import date, datetime
from enum import Enum

from sqlalchemy import Date, DateTime, String, Text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column

from src.infrastructure.persistence.base import BaseEntity, SoftDeleteMixin


class SourceDocumentType(str, Enum):
    """Types of source documents that support journal entries."""

    # External documents
    INVOICE = "INVOICE"  # Vendor invoice (AP)
    CUSTOMER_INVOICE = "CUSTOMER_INVOICE"  # Customer invoice (AR)
    RECEIPT = "RECEIPT"  # Payment receipt
    CONTRACT = "CONTRACT"  # Legal agreement
    BANK_STATEMENT = "BANK_STATEMENT"  # Bank records
    CREDIT_MEMO = "CREDIT_MEMO"  # Credit adjustment

    # Internal documents
    JOURNAL_VOUCHER = "JOURNAL_VOUCHER"  # Internal authorization
    PAYROLL_REGISTER = "PAYROLL_REGISTER"  # Payroll documentation
    DEPRECIATION_SCHEDULE = "DEPRECIATION_SCHEDULE"  # Asset depreciation
    ALLOCATION_WORKSHEET = "ALLOCATION_WORKSHEET"  # Cost allocation

    # System-generated
    SYSTEM_GENERATED = "SYSTEM_GENERATED"  # Automated entries (accruals, etc.)
    REVERSAL = "REVERSAL"  # Reversal of prior entry
    CLOSING_ENTRY = "CLOSING_ENTRY"  # Period close entries


class SourceDocumentStatus(str, Enum):
    """Lifecycle status of source documents."""

    RECEIVED = "RECEIVED"  # Document received but not verified
    VERIFIED = "VERIFIED"  # Document verified and ready for posting
    POSTED = "POSTED"  # Document has been used in posted entry
    REJECTED = "REJECTED"  # Document rejected (invalid, duplicate, etc.)
    ARCHIVED = "ARCHIVED"  # Document archived after retention period


class SourceDocument(BaseEntity, SoftDeleteMixin):
    """
    Source Document - external evidence supporting financial transactions.

    This entity provides the audit trail endpoint. Every posted journal entry
    should reference a source document that proves the transaction occurred.

    SOX Requirements (Section 404):
    - Complete audit trail from statements to source
    - 7-year retention of financial records
    - Tamper-proof storage
    - Readily available for auditor review

    Attributes:
        document_type: Classification of the document
        document_number: External reference number (invoice #, etc.)
        document_date: Date on the source document
        received_date: When document was received in the system
        vendor_customer_name: Related party name (if applicable)
        vendor_customer_id: Related party ID (if applicable)
        description: Document description
        amount: Total amount on the document (for reference)
        currency_code: Currency of the document
        file_reference: Path/URL to stored document image
        status: Document lifecycle status
        verified_by: User who verified the document
        verified_at: When document was verified
        rejection_reason: If rejected, why
    """

    __tablename__ = "source_documents"

    # Document identification
    document_type: Mapped[SourceDocumentType] = mapped_column(
        SQLEnum(SourceDocumentType, native_enum=False),
        nullable=False,
        index=True,
        comment="Classification of the source document",
    )

    document_number: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
        comment="External reference number (invoice #, receipt #, etc.)",
    )

    document_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
        comment="Date shown on the source document",
    )

    received_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        comment="Date document was received in the system",
    )

    # Related party (vendor or customer)
    vendor_customer_name: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
        comment="Name of vendor or customer",
    )

    vendor_customer_id: Mapped[str | None] = mapped_column(
        String(36),
        nullable=True,
        index=True,
        comment="ID of vendor or customer entity",
    )

    # Description
    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Description of the document contents",
    )

    # Amount reference (for validation)
    amount: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="Total amount on document (stored as string for flexibility)",
    )

    currency_code: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        default="USD",
        comment="Currency of the document (ISO 4217)",
    )

    # File storage reference
    file_reference: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="Path or URL to stored document image/PDF",
    )

    file_hash: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
        comment="SHA-256 hash of stored file for integrity verification",
    )

    # Status and verification
    status: Mapped[SourceDocumentStatus] = mapped_column(
        SQLEnum(SourceDocumentStatus, native_enum=False),
        nullable=False,
        default=SourceDocumentStatus.RECEIVED,
        index=True,
        comment="Document lifecycle status",
    )

    verified_by: Mapped[str | None] = mapped_column(
        String(36),
        nullable=True,
        comment="User ID who verified this document",
    )

    verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when document was verified",
    )

    rejection_reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="If rejected, explanation why",
    )

    # Additional metadata
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Additional notes about the document",
    )

    def __repr__(self) -> str:
        return (
            f"<SourceDocument("
            f"type={self.document_type.value}, "
            f"number={self.document_number}, "
            f"status={self.status.value})>"
        )

    # -------------------------------------------------------------------------
    # Computed Properties
    # -------------------------------------------------------------------------

    @property
    def is_verified(self) -> bool:
        """Return True if document has been verified."""
        return self.status in (
            SourceDocumentStatus.VERIFIED,
            SourceDocumentStatus.POSTED,
            SourceDocumentStatus.ARCHIVED,
        )

    @property
    def can_be_used_for_posting(self) -> bool:
        """Return True if document can support a journal entry posting."""
        return self.status == SourceDocumentStatus.VERIFIED

    @property
    def is_posted(self) -> bool:
        """Return True if document has been used in a posted entry."""
        return self.status == SourceDocumentStatus.POSTED

    # -------------------------------------------------------------------------
    # Business Methods
    # -------------------------------------------------------------------------

    def verify(self, verified_by: str) -> None:
        """
        Mark document as verified and ready for posting.

        Args:
            verified_by: User ID performing verification
        """
        if self.status != SourceDocumentStatus.RECEIVED:
            raise ValueError(f"Cannot verify document with status {self.status.value}")

        self.status = SourceDocumentStatus.VERIFIED
        self.verified_by = verified_by
        self.verified_at = datetime.utcnow()

    def mark_posted(self) -> None:
        """Mark document as used in a posted entry."""
        if self.status != SourceDocumentStatus.VERIFIED:
            raise ValueError(f"Cannot post document with status {self.status.value}")

        self.status = SourceDocumentStatus.POSTED

    def reject(self, reason: str, rejected_by: str) -> None:
        """
        Reject the document.

        Args:
            reason: Explanation for rejection
            rejected_by: User ID performing rejection
        """
        if self.status == SourceDocumentStatus.POSTED:
            raise ValueError("Cannot reject a posted document")

        self.status = SourceDocumentStatus.REJECTED
        self.rejection_reason = reason
        self.updated_by = rejected_by
