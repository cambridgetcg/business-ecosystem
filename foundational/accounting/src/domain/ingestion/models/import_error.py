"""
Import Error - records errors encountered during batch imports.

Each error captures:
- Where the error occurred (row, column)
- What went wrong (error type, message)
- The problematic value
- Severity level

Research Grounding: docs/gaps/data-ingestion-assessment.md
"""

from enum import Enum

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.infrastructure.persistence.base import BaseEntity


class ImportErrorSeverity(str, Enum):
    """Severity level of import errors."""

    # Informational - row processed but with notes
    INFO = "INFO"

    # Warning - row processed but with potential issues
    WARNING = "WARNING"

    # Error - row could not be processed
    ERROR = "ERROR"

    # Critical - affects entire import
    CRITICAL = "CRITICAL"


class ImportErrorCode(str, Enum):
    """Standardized error codes for import errors."""

    # Parsing errors
    PARSE_ERROR = "PARSE_ERROR"
    INVALID_FORMAT = "INVALID_FORMAT"
    ENCODING_ERROR = "ENCODING_ERROR"

    # Validation errors
    REQUIRED_FIELD_MISSING = "REQUIRED_FIELD_MISSING"
    INVALID_VALUE = "INVALID_VALUE"
    INVALID_DATE = "INVALID_DATE"
    INVALID_NUMBER = "INVALID_NUMBER"
    INVALID_ACCOUNT_CODE = "INVALID_ACCOUNT_CODE"
    INVALID_CURRENCY = "INVALID_CURRENCY"

    # Business rule violations
    UNBALANCED_ENTRY = "UNBALANCED_ENTRY"
    PERIOD_CLOSED = "PERIOD_CLOSED"
    DUPLICATE_ENTRY = "DUPLICATE_ENTRY"
    ACCOUNT_NOT_FOUND = "ACCOUNT_NOT_FOUND"
    ENTITY_NOT_FOUND = "ENTITY_NOT_FOUND"

    # System errors
    DATABASE_ERROR = "DATABASE_ERROR"
    STORAGE_ERROR = "STORAGE_ERROR"
    UNKNOWN_ERROR = "UNKNOWN_ERROR"


class ImportError(BaseEntity):
    """
    Import Error - records a single error from a batch import.

    This entity captures detailed information about each error
    encountered during an import, enabling:
    - Detailed error reports for users
    - Error pattern analysis
    - Retry logic for recoverable errors
    - Audit trail for failed records

    Attributes:
        import_job_id: Reference to the parent import job
        row_number: 1-based row number where error occurred
        column_name: Column name where error occurred (if applicable)
        error_code: Machine-readable error code
        error_message: Human-readable error description
        raw_value: The problematic value that caused the error
        severity: Error severity level
        suggested_fix: Optional suggestion for how to fix the error
    """

    __tablename__ = "import_errors"

    # Parent job reference
    import_job_id: Mapped[str] = mapped_column(
        String(26),
        ForeignKey("import_jobs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Reference to the parent import job",
    )

    # Error location
    row_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        index=True,
        comment="1-based row number where error occurred",
    )

    column_name: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Column name where error occurred",
    )

    # Error details
    error_code: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        comment="Machine-readable error code",
    )

    error_message: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Human-readable error description",
    )

    raw_value: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="The problematic value that caused the error",
    )

    severity: Mapped[ImportErrorSeverity] = mapped_column(
        SQLEnum(ImportErrorSeverity, native_enum=False),
        nullable=False,
        default=ImportErrorSeverity.ERROR,
        index=True,
        comment="Error severity level",
    )

    suggested_fix: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Optional suggestion for how to fix the error",
    )

    # Additional context (JSON)
    context: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="JSON: Additional error context and metadata",
    )

    # Relationships
    import_job: Mapped["ImportJob"] = relationship(
        "ImportJob",
        back_populates="errors",
    )

    def __repr__(self) -> str:
        return (
            f"<ImportError("
            f"job={self.import_job_id[:8]}..., "
            f"row={self.row_number}, "
            f"code={self.error_code})>"
        )

    @classmethod
    def validation_error(
        cls,
        import_job_id: str,
        row_number: int,
        column_name: str,
        message: str,
        raw_value: str | None = None,
        suggested_fix: str | None = None,
    ) -> "ImportError":
        """Create a validation error."""
        return cls(
            import_job_id=import_job_id,
            row_number=row_number,
            column_name=column_name,
            error_code=ImportErrorCode.INVALID_VALUE.value,
            error_message=message,
            raw_value=raw_value,
            severity=ImportErrorSeverity.ERROR,
            suggested_fix=suggested_fix,
        )

    @classmethod
    def required_field_error(
        cls,
        import_job_id: str,
        row_number: int,
        column_name: str,
    ) -> "ImportError":
        """Create a required field missing error."""
        return cls(
            import_job_id=import_job_id,
            row_number=row_number,
            column_name=column_name,
            error_code=ImportErrorCode.REQUIRED_FIELD_MISSING.value,
            error_message=f"Required field '{column_name}' is missing or empty",
            severity=ImportErrorSeverity.ERROR,
            suggested_fix=f"Provide a value for the '{column_name}' column",
        )

    @classmethod
    def business_rule_error(
        cls,
        import_job_id: str,
        row_number: int,
        error_code: ImportErrorCode,
        message: str,
        raw_value: str | None = None,
    ) -> "ImportError":
        """Create a business rule violation error."""
        return cls(
            import_job_id=import_job_id,
            row_number=row_number,
            column_name=None,
            error_code=error_code.value,
            error_message=message,
            raw_value=raw_value,
            severity=ImportErrorSeverity.ERROR,
        )


# Import at bottom to avoid circular imports
from src.domain.ingestion.models.import_job import ImportJob
