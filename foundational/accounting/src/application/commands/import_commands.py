"""
Import commands - write operations for data ingestion.

Commands encapsulate all data needed to perform an import operation.
They are immutable and serializable for potential async processing.

Design Principles:
1. Immutable - frozen dataclasses
2. Complete - contain all required parameters
3. Serializable - use primitive types (bytes, str) not file handles
4. Validated - basic validation at creation time

Research Grounding: docs/architecture/ingestion-pipeline-phase1.md
"""

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class ImportJournalEntriesCommand:
    """
    Command to import journal entries from a file.

    The file should contain rows with:
    - entry_date: Date of the entry
    - description: Entry description
    - account_code: Account code for the line
    - entry_type: DEBIT or CREDIT
    - amount: Line amount
    - currency_code: (optional) Currency code
    - line_description: (optional) Line description
    - source_document: (optional) Source document reference

    Multiple rows with the same entry_date + description are grouped
    into a single journal entry.

    Attributes:
        file_content: Raw file bytes
        file_name: Original filename (used for format detection)
        initiated_by: User ID initiating the import
        column_mapping: Optional mapping of source to target columns
        skip_rows: Number of rows to skip after header
        stop_on_error: If True, stop on first validation error
        validate_only: If True, validate without persisting
        default_currency: Currency for entries without explicit currency
    """

    file_content: bytes
    file_name: str
    initiated_by: str
    column_mapping: tuple[tuple[str, str], ...] | None = None
    skip_rows: int = 0
    stop_on_error: bool = False
    validate_only: bool = False
    default_currency: str = "USD"

    def __post_init__(self) -> None:
        """Validate command parameters."""
        if not self.file_content:
            raise ValueError("file_content cannot be empty")
        if not self.file_name:
            raise ValueError("file_name is required")
        if not self.initiated_by:
            raise ValueError("initiated_by is required")

    def get_column_mapping_dict(self) -> dict[str, str] | None:
        """Convert frozen column mapping to dict for service."""
        if self.column_mapping is None:
            return None
        return dict(self.column_mapping)


@dataclass(frozen=True)
class ImportAccountsCommand:
    """
    Command to import chart of accounts from a file.

    The file should contain rows with:
    - code: Account code (unique)
    - name: Account name
    - account_type: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
    - description: (optional) Account description
    - parent_code: (optional) Parent account code
    - currency_code: (optional) Default currency
    - is_header: (optional) Whether this is a header account

    Attributes:
        file_content: Raw file bytes
        file_name: Original filename (used for format detection)
        initiated_by: User ID initiating the import
        column_mapping: Optional mapping of source to target columns
        skip_rows: Number of rows to skip after header
        stop_on_error: If True, stop on first validation error
        validate_only: If True, validate without persisting
        default_currency: Currency for accounts without explicit currency
    """

    file_content: bytes
    file_name: str
    initiated_by: str
    column_mapping: tuple[tuple[str, str], ...] | None = None
    skip_rows: int = 0
    stop_on_error: bool = False
    validate_only: bool = False
    default_currency: str = "USD"

    def __post_init__(self) -> None:
        """Validate command parameters."""
        if not self.file_content:
            raise ValueError("file_content cannot be empty")
        if not self.file_name:
            raise ValueError("file_name is required")
        if not self.initiated_by:
            raise ValueError("initiated_by is required")

    def get_column_mapping_dict(self) -> dict[str, str] | None:
        """Convert frozen column mapping to dict for service."""
        if self.column_mapping is None:
            return None
        return dict(self.column_mapping)


@dataclass(frozen=True)
class CancelImportJobCommand:
    """
    Command to cancel a running import job.

    Attributes:
        job_id: ID of the import job to cancel
        cancelled_by: User ID cancelling the import
        reason: Optional reason for cancellation
    """

    job_id: str
    cancelled_by: str
    reason: str | None = None

    def __post_init__(self) -> None:
        """Validate command parameters."""
        if not self.job_id:
            raise ValueError("job_id is required")
        if not self.cancelled_by:
            raise ValueError("cancelled_by is required")
