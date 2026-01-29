"""
Import Service - orchestrates batch import operations.

This service coordinates the complete import workflow:
1. Create import job record
2. Parse the source file
3. Validate all rows
4. Map to domain entities
5. Persist entities
6. Update job status and record errors

Design follows PostingService pattern:
- Protocol-based dependencies
- Result objects for outcomes
- Clear separation of concerns

Research Grounding: docs/gaps/data-ingestion-assessment.md
AI Knowledge Gap (doc 11): Import logic must be deterministic
AI Knowledge Gap (doc 15): Audit trail maintained throughout
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Any, BinaryIO, Protocol, TypeVar

from src.domain.ingestion.models.import_job import (
    ImportJob,
    ImportJobStatus,
    ImportTarget,
)
from src.domain.ingestion.models.import_error import ImportError as ImportErrorEntity
from src.domain.ingestion.validators.batch_validator import (
    BatchValidationResult,
    BatchValidator,
    create_journal_entry_validator,
    create_account_validator,
)
from src.domain.ingestion.mappers.journal_entry_mapper import (
    JournalEntryMapper,
    JournalEntryGroupResult,
    IAccountResolver,
    IFiscalPeriodResolver,
    IEntryNumberGenerator,
)
from src.domain.ingestion.mappers.account_mapper import (
    AccountMapper,
    AccountMappingResult,
    IAccountCodeResolver,
)
from src.infrastructure.ingestion.parsers.base import (
    IFileParser,
    ParseResult,
    FileFormat,
)
from src.domain.general_ledger.models.journal_entry import JournalEntry
from src.domain.chart_of_accounts.models.account import Account


T = TypeVar("T")


# -------------------------------------------------------------------------
# Repository Protocols
# -------------------------------------------------------------------------


class ImportJobRepository(Protocol):
    """Protocol for import job repository."""

    async def add(self, job: ImportJob) -> ImportJob:
        """Add a new import job."""
        ...

    async def get_by_id(self, job_id: str) -> ImportJob | None:
        """Get job by ID."""
        ...

    async def save(self, job: ImportJob) -> ImportJob:
        """Save changes to a job."""
        ...

    async def get_next_job_number(self, year: int) -> str:
        """Generate next job number for the year."""
        ...


class ImportErrorRepository(Protocol):
    """Protocol for import error repository."""

    async def add(self, error: ImportErrorEntity) -> ImportErrorEntity:
        """Add an import error."""
        ...

    async def add_batch(self, errors: list[ImportErrorEntity]) -> None:
        """Add multiple errors efficiently."""
        ...


class JournalEntryRepository(Protocol):
    """Protocol for journal entry persistence."""

    async def add(self, entry: JournalEntry) -> JournalEntry:
        """Add a journal entry."""
        ...

    async def add_batch(self, entries: list[JournalEntry]) -> list[JournalEntry]:
        """Add multiple entries efficiently."""
        ...


class AccountRepository(Protocol):
    """Protocol for account persistence."""

    async def add(self, account: Account) -> Account:
        """Add an account."""
        ...

    async def add_batch(self, accounts: list[Account]) -> list[Account]:
        """Add multiple accounts efficiently."""
        ...

    def account_exists(self, code: str) -> bool:
        """Check if account code exists."""
        ...

    def get_account_id_by_code(self, code: str) -> str | None:
        """Get account ID by code."""
        ...

    def resolve_account_id(self, account_code: str) -> str | None:
        """Alias for get_account_id_by_code for protocol compatibility."""
        ...


# -------------------------------------------------------------------------
# Result Types
# -------------------------------------------------------------------------


@dataclass
class ImportResult:
    """
    Result of an import operation.

    Attributes:
        success: Whether the import completed (may have row errors)
        job: The import job record
        total_rows: Total rows in the source file
        imported_rows: Number of successfully imported rows
        failed_rows: Number of rows that failed
        errors: Summary of errors encountered
    """

    success: bool
    job: ImportJob
    total_rows: int = 0
    imported_rows: int = 0
    failed_rows: int = 0
    errors: list[str] = field(default_factory=list)

    @property
    def has_errors(self) -> bool:
        """Return True if any rows failed."""
        return self.failed_rows > 0 or len(self.errors) > 0


@dataclass
class ImportOptions:
    """
    Options for configuring an import.

    Attributes:
        column_mapping: Map source columns to expected columns
        skip_rows: Number of rows to skip after header
        stop_on_error: If True, stop on first error
        validate_only: If True, validate but don't persist
        default_currency: Currency for entries without explicit currency
        batch_size: Number of records to persist per batch
    """

    column_mapping: dict[str, str] | None = None
    skip_rows: int = 0
    stop_on_error: bool = False
    validate_only: bool = False
    default_currency: str = "USD"
    batch_size: int = 100


# -------------------------------------------------------------------------
# Import Service
# -------------------------------------------------------------------------


class ImportService:
    """
    Orchestrates batch import operations.

    This service coordinates the complete import workflow for:
    - Journal entries
    - Accounts
    - Other supported import targets

    The workflow:
    1. Create ImportJob record (audit trail)
    2. Parse the source file (CSV, Excel, JSON)
    3. Validate all rows (deterministic validation)
    4. Map valid rows to domain entities
    5. Persist entities in batches
    6. Record errors for failed rows
    7. Update job status

    Usage:
        service = ImportService(
            job_repository=import_job_repo,
            error_repository=import_error_repo,
            journal_entry_repository=je_repo,
            account_repository=account_repo,
            fiscal_period_resolver=period_service,
            entry_number_generator=sequence_service,
        )

        result = await service.import_journal_entries(
            file=csv_file,
            file_name="journal_entries.csv",
            initiated_by="user-123",
        )

        if result.success:
            print(f"Imported {result.imported_rows} entries")
        else:
            print(f"Import failed: {result.errors}")
    """

    def __init__(
        self,
        job_repository: ImportJobRepository,
        error_repository: ImportErrorRepository,
        journal_entry_repository: JournalEntryRepository | None = None,
        account_repository: AccountRepository | None = None,
        fiscal_period_resolver: IFiscalPeriodResolver | None = None,
        entry_number_generator: IEntryNumberGenerator | None = None,
        parsers: dict[FileFormat, IFileParser] | None = None,
    ) -> None:
        """
        Initialize the import service.

        Args:
            job_repository: Repository for import jobs
            error_repository: Repository for import errors
            journal_entry_repository: Repository for journal entries
            account_repository: Repository for accounts
            fiscal_period_resolver: Resolves dates to fiscal periods
            entry_number_generator: Generates entry numbers
            parsers: Map of file format to parser (auto-detected if None)
        """
        self._job_repo = job_repository
        self._error_repo = error_repository
        self._je_repo = journal_entry_repository
        self._account_repo = account_repository
        self._fiscal_period_resolver = fiscal_period_resolver
        self._entry_number_generator = entry_number_generator
        self._parsers = parsers or self._default_parsers()

    def _default_parsers(self) -> dict[FileFormat, IFileParser]:
        """Create default parsers for supported formats."""
        from src.infrastructure.ingestion.parsers import CSVParser, JSONParser

        # Import Excel parser only if openpyxl is available
        parsers: dict[FileFormat, IFileParser] = {
            FileFormat.CSV: CSVParser(),
            FileFormat.JSON: JSONParser(),
        }

        try:
            from src.infrastructure.ingestion.parsers import ExcelParser
            parsers[FileFormat.EXCEL] = ExcelParser()
        except ImportError:
            pass  # Excel support optional

        return parsers

    # -------------------------------------------------------------------------
    # Journal Entry Import
    # -------------------------------------------------------------------------

    async def import_journal_entries(
        self,
        file: BinaryIO,
        file_name: str,
        initiated_by: str,
        *,
        options: ImportOptions | None = None,
    ) -> ImportResult:
        """
        Import journal entries from a file.

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

        Args:
            file: File stream to import
            file_name: Original file name
            initiated_by: User ID initiating the import
            options: Import configuration options

        Returns:
            ImportResult with job record and statistics
        """
        if not self._je_repo:
            raise ValueError("Journal entry repository not configured")
        if not self._fiscal_period_resolver:
            raise ValueError("Fiscal period resolver not configured")
        if not self._entry_number_generator:
            raise ValueError("Entry number generator not configured")
        if not self._account_repo:
            raise ValueError("Account repository not configured")

        options = options or ImportOptions()

        # Step 1: Create import job
        job = await self._create_job(
            target=ImportTarget.JOURNAL_ENTRIES,
            file_name=file_name,
            initiated_by=initiated_by,
        )

        try:
            # Step 2: Parse file
            job.start_validation()
            await self._job_repo.save(job)

            parse_result = self._parse_file(file, file_name, options)

            if not parse_result.is_successful:
                job.fail(f"File parsing failed: {parse_result.errors[0].message}")
                await self._job_repo.save(job)
                return ImportResult(
                    success=False,
                    job=job,
                    errors=[str(e) for e in parse_result.errors],
                )

            # Step 3: Validate
            validator = create_journal_entry_validator()
            validation_result = validator.validate_parse_result(
                parse_result,
                stop_on_first_error=options.stop_on_error,
            )

            # Step 4: Start processing
            job.start_processing(validation_result.total_rows)
            await self._job_repo.save(job)

            if options.validate_only:
                job.complete("Validation only - no data imported")
                await self._job_repo.save(job)
                return ImportResult(
                    success=True,
                    job=job,
                    total_rows=validation_result.total_rows,
                    imported_rows=0,
                    failed_rows=validation_result.invalid_rows,
                )

            # Step 5: Map to entities
            mapper = JournalEntryMapper(
                account_resolver=self._account_repo,
                fiscal_period_resolver=self._fiscal_period_resolver,
                entry_number_generator=self._entry_number_generator,
            )

            mapping_result = mapper.map_batch(
                validation_result,
                default_currency=options.default_currency,
            )

            # Step 6: Persist entries
            persisted_count = 0
            for entry in mapping_result.entries:
                try:
                    await self._je_repo.add(entry)
                    persisted_count += 1
                except Exception as e:
                    # Record persistence error
                    await self._record_error(
                        job=job,
                        row_number=0,  # Entry-level error
                        column_name=None,
                        message=f"Failed to save entry: {str(e)}",
                        error_code="PERSISTENCE_ERROR",
                    )

            # Step 7: Record validation errors
            await self._record_validation_errors(job, validation_result)

            # Step 8: Record mapping errors
            for mapping_error in mapping_result.get_all_errors():
                await self._record_error(
                    job=job,
                    row_number=mapping_error.row_numbers[0] if mapping_error.row_numbers else 0,
                    column_name=None,
                    message=mapping_error.message,
                    error_code=mapping_error.error_code,
                )

            # Step 9: Complete job
            job.record_progress(
                successful=persisted_count,
                failed=validation_result.invalid_rows + mapping_result.failed_entries,
            )
            job.complete()
            await self._job_repo.save(job)

            return ImportResult(
                success=True,
                job=job,
                total_rows=validation_result.total_rows,
                imported_rows=persisted_count,
                failed_rows=job.failed_rows,
            )

        except Exception as e:
            job.fail(f"Import failed: {str(e)}")
            await self._job_repo.save(job)
            return ImportResult(
                success=False,
                job=job,
                errors=[str(e)],
            )

    # -------------------------------------------------------------------------
    # Account Import
    # -------------------------------------------------------------------------

    async def import_accounts(
        self,
        file: BinaryIO,
        file_name: str,
        initiated_by: str,
        *,
        options: ImportOptions | None = None,
    ) -> ImportResult:
        """
        Import chart of accounts from a file.

        The file should contain rows with:
        - code: Account code (unique)
        - name: Account name
        - account_type: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
        - description: (optional) Account description
        - parent_code: (optional) Parent account code
        - currency_code: (optional) Default currency
        - is_header: (optional) Whether this is a header account

        Args:
            file: File stream to import
            file_name: Original file name
            initiated_by: User ID initiating the import
            options: Import configuration options

        Returns:
            ImportResult with job record and statistics
        """
        if not self._account_repo:
            raise ValueError("Account repository not configured")

        options = options or ImportOptions()

        # Step 1: Create import job
        job = await self._create_job(
            target=ImportTarget.ACCOUNTS,
            file_name=file_name,
            initiated_by=initiated_by,
        )

        try:
            # Step 2: Parse file
            job.start_validation()
            await self._job_repo.save(job)

            parse_result = self._parse_file(file, file_name, options)

            if not parse_result.is_successful:
                job.fail(f"File parsing failed: {parse_result.errors[0].message}")
                await self._job_repo.save(job)
                return ImportResult(
                    success=False,
                    job=job,
                    errors=[str(e) for e in parse_result.errors],
                )

            # Step 3: Validate
            validator = create_account_validator()
            validation_result = validator.validate_parse_result(
                parse_result,
                stop_on_first_error=options.stop_on_error,
            )

            # Step 4: Start processing
            job.start_processing(validation_result.total_rows)
            await self._job_repo.save(job)

            if options.validate_only:
                job.complete("Validation only - no data imported")
                await self._job_repo.save(job)
                return ImportResult(
                    success=True,
                    job=job,
                    total_rows=validation_result.total_rows,
                    imported_rows=0,
                    failed_rows=validation_result.invalid_rows,
                )

            # Step 5: Map to entities (with hierarchy support)
            mapper = AccountMapper(
                account_resolver=self._account_repo,
                check_duplicates=True,
                allow_missing_parents=False,
            )

            mapping_result = mapper.map_with_hierarchy(
                validation_result,
                default_currency=options.default_currency,
            )

            # Step 6: Persist accounts
            persisted_count = 0
            for account in mapping_result.accounts:
                try:
                    await self._account_repo.add(account)
                    persisted_count += 1
                except Exception as e:
                    await self._record_error(
                        job=job,
                        row_number=0,
                        column_name=None,
                        message=f"Failed to save account {account.code}: {str(e)}",
                        error_code="PERSISTENCE_ERROR",
                    )

            # Step 7: Record validation errors
            await self._record_validation_errors(job, validation_result)

            # Step 8: Record mapping errors
            for mapping_error in mapping_result.errors:
                await self._record_error(
                    job=job,
                    row_number=mapping_error.row_number,
                    column_name=None,
                    message=mapping_error.message,
                    error_code=mapping_error.error_code,
                )

            # Step 9: Complete job
            job.record_progress(
                successful=persisted_count,
                failed=validation_result.invalid_rows + mapping_result.failed,
            )
            job.complete()
            await self._job_repo.save(job)

            return ImportResult(
                success=True,
                job=job,
                total_rows=validation_result.total_rows,
                imported_rows=persisted_count,
                failed_rows=job.failed_rows,
            )

        except Exception as e:
            job.fail(f"Import failed: {str(e)}")
            await self._job_repo.save(job)
            return ImportResult(
                success=False,
                job=job,
                errors=[str(e)],
            )

    # -------------------------------------------------------------------------
    # Private Methods
    # -------------------------------------------------------------------------

    async def _create_job(
        self,
        target: ImportTarget,
        file_name: str,
        initiated_by: str,
    ) -> ImportJob:
        """Create and persist a new import job."""
        year = datetime.now(timezone.utc).year
        job_number = await self._job_repo.get_next_job_number(year)

        # Detect file format
        file_format = self._detect_format(file_name)

        job = ImportJob(
            job_number=job_number,
            target=target,
            file_name=file_name,
            file_format=file_format.value,
            status=ImportJobStatus.PENDING,
            initiated_by=initiated_by,
        )

        return await self._job_repo.add(job)

    def _detect_format(self, file_name: str) -> FileFormat:
        """Detect file format from extension."""
        ext = Path(file_name).suffix.lower()
        format_map = {
            ".csv": FileFormat.CSV,
            ".xlsx": FileFormat.EXCEL,
            ".xls": FileFormat.EXCEL,
            ".json": FileFormat.JSON,
            ".jsonl": FileFormat.JSON,
        }
        return format_map.get(ext, FileFormat.CSV)

    def _parse_file(
        self,
        file: BinaryIO,
        file_name: str,
        options: ImportOptions,
    ) -> ParseResult:
        """Parse file using appropriate parser."""
        file_format = self._detect_format(file_name)

        parser = self._parsers.get(file_format)
        if not parser:
            raise ValueError(f"No parser available for format: {file_format.value}")

        return parser.parse(
            file=file,
            file_name=file_name,
            skip_rows=options.skip_rows,
            column_mapping=options.column_mapping,
        )

    async def _record_error(
        self,
        job: ImportJob,
        row_number: int,
        column_name: str | None,
        message: str,
        error_code: str,
        raw_value: str | None = None,
    ) -> None:
        """Record an import error."""
        error = ImportErrorEntity(
            import_job_id=job.id,
            row_number=row_number,
            column_name=column_name,
            error_message=message,
            error_code=error_code,
            raw_value=raw_value,
        )
        await self._error_repo.add(error)

    async def _record_validation_errors(
        self,
        job: ImportJob,
        validation_result: BatchValidationResult,
    ) -> None:
        """Record all validation errors from a batch result."""
        for row_num, error in validation_result.get_all_errors():
            await self._record_error(
                job=job,
                row_number=row_num,
                column_name=error.field,
                message=error.message,
                error_code=error.error_code,
                raw_value=error.value,
            )
