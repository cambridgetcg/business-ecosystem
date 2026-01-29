"""
Import Job - tracks batch import operations.

This entity provides full traceability for data imports:
- Who initiated the import
- What file was imported
- When it was processed
- What succeeded and what failed
- Complete error log

Research Grounding: docs/gaps/data-ingestion-assessment.md
Audit Requirement: Every import must be traceable for SOX compliance
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import (
    DateTime,
    Enum as SQLEnum,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.infrastructure.persistence.base import BaseEntity


class ImportJobStatus(str, Enum):
    """Lifecycle status of an import job."""

    # Initial states
    PENDING = "PENDING"  # Job created, not yet started
    VALIDATING = "VALIDATING"  # Validating file contents

    # Processing states
    PROCESSING = "PROCESSING"  # Actively importing records
    PAUSED = "PAUSED"  # Temporarily paused (can resume)

    # Terminal states
    COMPLETED = "COMPLETED"  # All records imported successfully
    COMPLETED_WITH_ERRORS = "COMPLETED_WITH_ERRORS"  # Some records failed
    FAILED = "FAILED"  # Import failed entirely
    CANCELLED = "CANCELLED"  # User cancelled the import

    @property
    def is_terminal(self) -> bool:
        """Return True if this is a terminal state."""
        return self in (
            ImportJobStatus.COMPLETED,
            ImportJobStatus.COMPLETED_WITH_ERRORS,
            ImportJobStatus.FAILED,
            ImportJobStatus.CANCELLED,
        )

    @property
    def is_active(self) -> bool:
        """Return True if job is actively processing."""
        return self in (
            ImportJobStatus.VALIDATING,
            ImportJobStatus.PROCESSING,
        )

    @property
    def can_cancel(self) -> bool:
        """Return True if job can be cancelled."""
        return self in (
            ImportJobStatus.PENDING,
            ImportJobStatus.VALIDATING,
            ImportJobStatus.PROCESSING,
            ImportJobStatus.PAUSED,
        )


class ImportTarget(str, Enum):
    """Target entity type for import."""

    JOURNAL_ENTRIES = "JOURNAL_ENTRIES"
    ACCOUNTS = "ACCOUNTS"
    SOURCE_DOCUMENTS = "SOURCE_DOCUMENTS"
    FISCAL_PERIODS = "FISCAL_PERIODS"
    # Future targets
    # VENDORS = "VENDORS"
    # CUSTOMERS = "CUSTOMERS"


class ImportJob(BaseEntity):
    """
    Import Job - tracks a batch import operation.

    This entity is the central record for every batch import, providing:
    - Complete audit trail of the import operation
    - Progress tracking for long-running imports
    - Error aggregation for failed records
    - Traceability to the source file

    Lifecycle:
        PENDING -> VALIDATING -> PROCESSING -> COMPLETED/FAILED
        (Can be CANCELLED or PAUSED at any non-terminal state)

    Attributes:
        job_number: Human-readable identifier (e.g., IMP-2026-00001)
        target: What entity type is being imported
        file_name: Original name of the imported file
        file_storage_key: Key to retrieve file from storage
        file_format: Format of the source file (csv, xlsx, json)
        file_hash: SHA-256 hash of the source file
        status: Current job status
        initiated_by: User who started the import

        # Progress tracking
        total_rows: Total rows in the file
        processed_rows: Number of rows processed so far
        successful_rows: Number of rows imported successfully
        failed_rows: Number of rows that failed

        # Timing
        started_at: When processing actually began
        completed_at: When processing finished

        # Results
        error_summary: Aggregated error summary
        result_message: Final result message
    """

    __tablename__ = "import_jobs"

    # Job identification
    job_number: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
        comment="Human-readable job number (e.g., IMP-2026-00001)",
    )

    target: Mapped[ImportTarget] = mapped_column(
        SQLEnum(ImportTarget, native_enum=False),
        nullable=False,
        index=True,
        comment="Target entity type for this import",
    )

    # Source file information
    file_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Original filename of the imported file",
    )

    file_storage_key: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="Storage key to retrieve the original file",
    )

    file_format: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        comment="File format (csv, xlsx, json)",
    )

    file_hash: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
        comment="SHA-256 hash of the source file",
    )

    file_size_bytes: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="Size of the source file in bytes",
    )

    # Status and lifecycle
    status: Mapped[ImportJobStatus] = mapped_column(
        SQLEnum(ImportJobStatus, native_enum=False),
        nullable=False,
        default=ImportJobStatus.PENDING,
        index=True,
        comment="Current job status",
    )

    initiated_by: Mapped[str] = mapped_column(
        String(36),
        nullable=False,
        index=True,
        comment="User ID who initiated this import",
    )

    # Progress tracking
    total_rows: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Total number of data rows in the file",
    )

    processed_rows: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Number of rows processed so far",
    )

    successful_rows: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Number of rows imported successfully",
    )

    failed_rows: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Number of rows that failed validation or import",
    )

    # Timing
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When processing actually began",
    )

    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When processing finished (success or failure)",
    )

    # Results
    error_summary: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="JSON: Aggregated error summary by type",
    )

    result_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Final human-readable result message",
    )

    # Import options (stored as JSON string)
    options: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="JSON: Import options (column mapping, validation rules, etc.)",
    )

    # Relationships
    errors: Mapped[list["ImportError"]] = relationship(
        "ImportError",
        back_populates="import_job",
        cascade="all, delete-orphan",
        order_by="ImportError.row_number",
    )

    def __repr__(self) -> str:
        return (
            f"<ImportJob("
            f"number={self.job_number}, "
            f"target={self.target.value}, "
            f"status={self.status.value})>"
        )

    # -------------------------------------------------------------------------
    # Computed Properties
    # -------------------------------------------------------------------------

    @property
    def progress_percent(self) -> float:
        """Return progress as percentage (0-100)."""
        if self.total_rows == 0:
            return 0.0
        return (self.processed_rows / self.total_rows) * 100

    @property
    def success_rate(self) -> float:
        """Return success rate as percentage (0-100)."""
        if self.processed_rows == 0:
            return 0.0
        return (self.successful_rows / self.processed_rows) * 100

    @property
    def duration_seconds(self) -> float | None:
        """Return processing duration in seconds."""
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds()
        return None

    @property
    def is_complete(self) -> bool:
        """Return True if job has reached a terminal state."""
        return self.status.is_terminal

    @property
    def is_successful(self) -> bool:
        """Return True if job completed successfully (no failures)."""
        return self.status == ImportJobStatus.COMPLETED

    @property
    def has_errors(self) -> bool:
        """Return True if any rows failed."""
        return self.failed_rows > 0

    # -------------------------------------------------------------------------
    # Business Methods
    # -------------------------------------------------------------------------

    def start_validation(self) -> None:
        """Mark job as starting validation phase."""
        if self.status != ImportJobStatus.PENDING:
            raise ValueError(f"Cannot start validation from status {self.status.value}")
        self.status = ImportJobStatus.VALIDATING

    def start_processing(self, total_rows: int) -> None:
        """Mark job as starting processing phase."""
        if self.status not in (ImportJobStatus.VALIDATING, ImportJobStatus.PAUSED):
            raise ValueError(f"Cannot start processing from status {self.status.value}")

        self.status = ImportJobStatus.PROCESSING
        self.total_rows = total_rows

        if not self.started_at:
            self.started_at = datetime.utcnow()

    def record_progress(self, successful: int = 0, failed: int = 0) -> None:
        """Record processing progress."""
        self.processed_rows += successful + failed
        self.successful_rows += successful
        self.failed_rows += failed

    def complete(self, message: str | None = None) -> None:
        """Mark job as completed."""
        self.completed_at = datetime.utcnow()

        if self.failed_rows > 0:
            self.status = ImportJobStatus.COMPLETED_WITH_ERRORS
            self.result_message = message or (
                f"Completed with {self.successful_rows} successful, "
                f"{self.failed_rows} failed rows"
            )
        else:
            self.status = ImportJobStatus.COMPLETED
            self.result_message = message or (
                f"Successfully imported {self.successful_rows} rows"
            )

    def fail(self, message: str) -> None:
        """Mark job as failed."""
        self.status = ImportJobStatus.FAILED
        self.completed_at = datetime.utcnow()
        self.result_message = message

    def cancel(self, message: str | None = None) -> None:
        """Cancel the import job."""
        if not self.status.can_cancel:
            raise ValueError(f"Cannot cancel job with status {self.status.value}")

        self.status = ImportJobStatus.CANCELLED
        self.completed_at = datetime.utcnow()
        self.result_message = message or "Import cancelled by user"

    def pause(self) -> None:
        """Pause the import job."""
        if self.status != ImportJobStatus.PROCESSING:
            raise ValueError(f"Cannot pause job with status {self.status.value}")
        self.status = ImportJobStatus.PAUSED


# Import at bottom to avoid circular imports
if TYPE_CHECKING:
    from src.domain.ingestion.models.import_error import ImportError
