"""
Journal Entry Mapper - converts validated import rows to JournalEntry entities.

Handles the complexity of grouping multiple rows into balanced journal entries
and creating the appropriate lines for each entry.

Design Principles:
1. Uses validated data - Expects input from BatchValidator
2. Groups by entry - Multiple rows may form a single journal entry
3. Creates complete entries - Entry + Lines ready for persistence
4. Reports mapping errors - Issues found during entity creation

Research Grounding: docs/gaps/data-ingestion-assessment.md
AI Knowledge Gap (doc 11): Mapping must be deterministic
"""

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import Any, Protocol, runtime_checkable

from src.domain.ingestion.validators.batch_validator import (
    BatchValidationResult,
    RowValidationResult,
)
from src.domain.general_ledger.models.journal_entry import JournalEntry
from src.domain.general_ledger.models.journal_entry_line import JournalEntryLine, EntryType
from src.domain.general_ledger.models.posting_status import PostingStatus


@dataclass(frozen=True)
class JournalEntryMappingError:
    """
    Error encountered during journal entry mapping.

    Attributes:
        row_numbers: Source row numbers involved in the error
        message: Human-readable error description
        error_code: Machine-readable error code
    """

    row_numbers: list[int]
    message: str
    error_code: str = "MAPPING_ERROR"


@dataclass
class JournalEntryMappingResult:
    """
    Result of mapping a single journal entry from validated rows.

    Attributes:
        entry: The created JournalEntry (None if mapping failed)
        source_rows: Row numbers that contributed to this entry
        is_valid: Whether mapping was successful
        errors: Any errors encountered during mapping
    """

    entry: JournalEntry | None = None
    source_rows: list[int] = field(default_factory=list)
    is_valid: bool = True
    errors: list[JournalEntryMappingError] = field(default_factory=list)

    @classmethod
    def success(cls, entry: JournalEntry, source_rows: list[int]) -> "JournalEntryMappingResult":
        """Create a successful mapping result."""
        return cls(entry=entry, source_rows=source_rows, is_valid=True)

    @classmethod
    def failure(
        cls,
        source_rows: list[int],
        message: str,
        error_code: str = "MAPPING_ERROR",
    ) -> "JournalEntryMappingResult":
        """Create a failed mapping result."""
        return cls(
            source_rows=source_rows,
            is_valid=False,
            errors=[JournalEntryMappingError(
                row_numbers=source_rows,
                message=message,
                error_code=error_code,
            )],
        )


@dataclass
class JournalEntryGroupResult:
    """
    Result of mapping a batch of rows to journal entries.

    Attributes:
        entries: Successfully mapped journal entries
        total_rows: Total rows processed
        successful_entries: Number of entries created
        failed_entries: Number of entries that failed mapping
        entry_results: Individual results for each entry
        errors: Errors not tied to specific entries
    """

    entries: list[JournalEntry] = field(default_factory=list)
    total_rows: int = 0
    successful_entries: int = 0
    failed_entries: int = 0
    entry_results: list[JournalEntryMappingResult] = field(default_factory=list)
    errors: list[JournalEntryMappingError] = field(default_factory=list)

    @property
    def is_valid(self) -> bool:
        """Return True if all entries mapped successfully."""
        return self.failed_entries == 0 and len(self.errors) == 0

    @property
    def has_errors(self) -> bool:
        """Return True if any entries failed mapping."""
        return self.failed_entries > 0 or len(self.errors) > 0

    def get_all_errors(self) -> list[JournalEntryMappingError]:
        """Return all errors from all entry results."""
        all_errors = list(self.errors)
        for result in self.entry_results:
            all_errors.extend(result.errors)
        return all_errors


@runtime_checkable
class IAccountResolver(Protocol):
    """
    Protocol for resolving account codes to account IDs.

    The import process uses account codes from the source file,
    but needs account IDs for creating journal entry lines.
    """

    def resolve_account_id(self, account_code: str) -> str | None:
        """
        Resolve an account code to its ID.

        Args:
            account_code: The account code from the import file

        Returns:
            Account ID if found, None if account doesn't exist
        """
        ...


@runtime_checkable
class IFiscalPeriodResolver(Protocol):
    """
    Protocol for resolving dates to fiscal period IDs.

    Journal entries must be associated with a fiscal period.
    """

    def resolve_fiscal_period_id(self, entry_date: date) -> str | None:
        """
        Resolve a date to its fiscal period ID.

        Args:
            entry_date: The date to find the period for

        Returns:
            Fiscal period ID if found, None if no period covers the date
        """
        ...


@runtime_checkable
class IEntryNumberGenerator(Protocol):
    """Protocol for generating sequential entry numbers."""

    def generate_entry_number(self, entry_date: date) -> str:
        """
        Generate a unique entry number.

        Args:
            entry_date: Date of the entry (for year-based numbering)

        Returns:
            Unique entry number (e.g., "JE-2026-00001")
        """
        ...


class JournalEntryMapper:
    """
    Maps validated import rows to JournalEntry entities.

    This mapper handles the complexity of:
    1. Grouping rows by entry (based on entry_date + description)
    2. Resolving account codes to account IDs
    3. Resolving dates to fiscal periods
    4. Creating balanced journal entries with lines
    5. Generating entry numbers

    Usage:
        mapper = JournalEntryMapper(
            account_resolver=account_repo,
            fiscal_period_resolver=period_service,
            entry_number_generator=sequence_service,
        )

        result = mapper.map_batch(validation_result)

        for entry in result.entries:
            await repository.add(entry)
    """

    def __init__(
        self,
        account_resolver: IAccountResolver,
        fiscal_period_resolver: IFiscalPeriodResolver,
        entry_number_generator: IEntryNumberGenerator,
    ) -> None:
        """
        Initialize the mapper with required dependencies.

        Args:
            account_resolver: Resolves account codes to IDs
            fiscal_period_resolver: Resolves dates to fiscal periods
            entry_number_generator: Generates entry numbers
        """
        self._account_resolver = account_resolver
        self._fiscal_period_resolver = fiscal_period_resolver
        self._entry_number_generator = entry_number_generator

    def map_batch(
        self,
        validation_result: BatchValidationResult,
        *,
        group_by_key: str | None = None,
        default_currency: str = "USD",
    ) -> JournalEntryGroupResult:
        """
        Map validated rows to journal entries.

        Rows are grouped into entries based on:
        - If group_by_key is provided: that field's value
        - Otherwise: combination of entry_date + description

        Each group must balance (debits = credits) to form a valid entry.

        Args:
            validation_result: Result from BatchValidator
            group_by_key: Optional field to group rows by
            default_currency: Currency for entries without explicit currency

        Returns:
            JournalEntryGroupResult with mapped entries and any errors
        """
        result = JournalEntryGroupResult(
            total_rows=len(validation_result.get_valid_rows()),
        )

        # Get only valid rows
        valid_rows = validation_result.get_valid_rows()
        if not valid_rows:
            return result

        # Group rows by entry
        groups = self._group_rows(valid_rows, group_by_key)

        # Map each group to a journal entry
        for group_key, rows in groups.items():
            entry_result = self._map_entry_group(
                rows=rows,
                group_key=group_key,
                default_currency=default_currency,
            )
            result.entry_results.append(entry_result)

            if entry_result.is_valid and entry_result.entry:
                result.entries.append(entry_result.entry)
                result.successful_entries += 1
            else:
                result.failed_entries += 1

        return result

    def _group_rows(
        self,
        rows: list[RowValidationResult],
        group_by_key: str | None,
    ) -> dict[str, list[RowValidationResult]]:
        """Group rows by entry key."""
        groups: dict[str, list[RowValidationResult]] = {}

        for row in rows:
            if group_by_key and group_by_key in row.validated_data:
                key = str(row.validated_data[group_by_key])
            else:
                # Default grouping: entry_date + description
                entry_date = row.validated_data.get("entry_date", "")
                description = row.validated_data.get("description", "")
                key = f"{entry_date}|{description}"

            if key not in groups:
                groups[key] = []
            groups[key].append(row)

        return groups

    def _map_entry_group(
        self,
        rows: list[RowValidationResult],
        group_key: str,
        default_currency: str,
    ) -> JournalEntryMappingResult:
        """Map a group of rows to a single journal entry."""
        source_rows = [r.row_number for r in rows]

        if not rows:
            return JournalEntryMappingResult.failure(
                source_rows=[],
                message="No rows to map",
                error_code="EMPTY_GROUP",
            )

        # Get entry-level data from first row
        first_row = rows[0].validated_data
        entry_date: date = first_row.get("entry_date")
        description: str = first_row.get("description", "")
        currency_code: str = first_row.get("currency_code", default_currency)
        source_document: str | None = first_row.get("source_document")

        # Validate entry date
        if not entry_date:
            return JournalEntryMappingResult.failure(
                source_rows=source_rows,
                message="Entry date is required",
                error_code="MISSING_ENTRY_DATE",
            )

        # Resolve fiscal period
        fiscal_period_id = self._fiscal_period_resolver.resolve_fiscal_period_id(entry_date)
        if not fiscal_period_id:
            return JournalEntryMappingResult.failure(
                source_rows=source_rows,
                message=f"No fiscal period found for date {entry_date}",
                error_code="NO_FISCAL_PERIOD",
            )

        # Create lines and validate accounts
        lines: list[JournalEntryLine] = []
        total_debits = Decimal("0")
        total_credits = Decimal("0")

        for i, row in enumerate(rows):
            data = row.validated_data
            account_code = data.get("account_code")

            # Resolve account
            account_id = self._account_resolver.resolve_account_id(account_code)
            if not account_id:
                return JournalEntryMappingResult.failure(
                    source_rows=source_rows,
                    message=f"Account '{account_code}' not found",
                    error_code="ACCOUNT_NOT_FOUND",
                )

            # Get line data
            entry_type: EntryType = data.get("entry_type")
            amount: Decimal = data.get("amount")
            line_description: str | None = data.get("line_description")

            # Create line
            line = JournalEntryLine(
                account_id=account_id,
                entry_type=entry_type,
                amount=amount,
                description=line_description,
                line_number=i + 1,
            )
            lines.append(line)

            # Track totals
            if entry_type == EntryType.DEBIT:
                total_debits += amount
            else:
                total_credits += amount

        # Validate balance
        tolerance = Decimal("0.0001")
        if abs(total_debits - total_credits) > tolerance:
            return JournalEntryMappingResult.failure(
                source_rows=source_rows,
                message=f"Entry is unbalanced: debits={total_debits}, credits={total_credits}",
                error_code="UNBALANCED_ENTRY",
            )

        # Generate entry number
        entry_number = self._entry_number_generator.generate_entry_number(entry_date)

        # Create the journal entry
        entry = JournalEntry(
            entry_number=entry_number,
            entry_date=entry_date,
            fiscal_period_id=fiscal_period_id,
            description=description,
            source_document=source_document,
            status=PostingStatus.DRAFT,
            total_debits=total_debits,
            total_credits=total_credits,
            currency_code=currency_code,
        )

        # Attach lines
        for line in lines:
            line.journal_entry = entry
        entry.lines = lines

        return JournalEntryMappingResult.success(entry, source_rows)

    def map_single_row(
        self,
        row: RowValidationResult,
        *,
        default_currency: str = "USD",
    ) -> JournalEntryMappingResult:
        """
        Map a single validated row to a journal entry line context.

        Note: This creates incomplete entries (single-sided) that must be
        combined with other rows to form balanced entries. Primarily used
        for testing or special import scenarios.

        Args:
            row: Single validated row
            default_currency: Currency if not specified

        Returns:
            JournalEntryMappingResult (may be incomplete)
        """
        return self._map_entry_group(
            rows=[row],
            group_key="single",
            default_currency=default_currency,
        )
