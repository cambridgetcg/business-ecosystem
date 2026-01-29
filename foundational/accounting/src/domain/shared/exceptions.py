"""
Domain exceptions for the accounting system.

These exceptions represent business rule violations and domain-specific errors.
They should be caught at the application layer and translated to appropriate responses.
"""


class DomainError(Exception):
    """Base exception for all domain errors."""

    def __init__(self, message: str, code: str | None = None) -> None:
        self.message = message
        self.code = code or self.__class__.__name__
        super().__init__(self.message)


class ValidationError(DomainError):
    """Raised when input validation fails."""

    def __init__(self, message: str, field: str | None = None) -> None:
        self.field = field
        super().__init__(message, code="VALIDATION_ERROR")


class InvariantViolationError(DomainError):
    """
    Raised when a domain invariant would be violated.

    Invariants are rules that must always be true:
    - Debits must equal credits in a journal entry
    - Account balances must not violate the accounting equation
    - Closed periods cannot accept new entries
    """

    def __init__(self, invariant: str, message: str) -> None:
        self.invariant = invariant
        super().__init__(message, code="INVARIANT_VIOLATION")


class EntityNotFoundError(DomainError):
    """Raised when a requested entity does not exist."""

    def __init__(self, entity_type: str, entity_id: str) -> None:
        self.entity_type = entity_type
        self.entity_id = entity_id
        super().__init__(
            f"{entity_type} with ID '{entity_id}' not found",
            code="ENTITY_NOT_FOUND",
        )


class DuplicateEntityError(DomainError):
    """Raised when attempting to create an entity that already exists."""

    def __init__(self, entity_type: str, identifier: str) -> None:
        self.entity_type = entity_type
        self.identifier = identifier
        super().__init__(
            f"{entity_type} with identifier '{identifier}' already exists",
            code="DUPLICATE_ENTITY",
        )


class PeriodClosedError(DomainError):
    """Raised when attempting to post to a closed fiscal period."""

    def __init__(self, period: str) -> None:
        self.period = period
        super().__init__(
            f"Cannot post entries to closed period: {period}",
            code="PERIOD_CLOSED",
        )


class UnbalancedEntryError(InvariantViolationError):
    """Raised when a journal entry's debits don't equal credits."""

    def __init__(self, debit_total: str, credit_total: str) -> None:
        self.debit_total = debit_total
        self.credit_total = credit_total
        super().__init__(
            invariant="DEBITS_EQUAL_CREDITS",
            message=f"Entry is unbalanced: debits={debit_total}, credits={credit_total}",
        )


class InsufficientBalanceError(DomainError):
    """Raised when an account has insufficient balance for an operation."""

    def __init__(self, account: str, required: str, available: str) -> None:
        self.account = account
        self.required = required
        self.available = available
        super().__init__(
            f"Insufficient balance in account {account}: "
            f"required={required}, available={available}",
            code="INSUFFICIENT_BALANCE",
        )


class CurrencyMismatchError(DomainError):
    """Raised when operations involve incompatible currencies."""

    def __init__(self, currency1: str, currency2: str) -> None:
        self.currency1 = currency1
        self.currency2 = currency2
        super().__init__(
            f"Currency mismatch: cannot operate on {currency1} and {currency2}",
            code="CURRENCY_MISMATCH",
        )


# -------------------------------------------------------------------------
# Ingestion Exceptions
# -------------------------------------------------------------------------


class ImportError(DomainError):
    """Base exception for import/ingestion errors."""

    def __init__(
        self,
        message: str,
        job_id: str | None = None,
        code: str = "IMPORT_ERROR",
    ) -> None:
        self.job_id = job_id
        super().__init__(message, code=code)


class FileParseError(ImportError):
    """Raised when a file cannot be parsed."""

    def __init__(
        self,
        message: str,
        file_name: str,
        row_number: int | None = None,
        column: str | None = None,
    ) -> None:
        self.file_name = file_name
        self.row_number = row_number
        self.column = column

        location = f"in file '{file_name}'"
        if row_number:
            location += f" at row {row_number}"
        if column:
            location += f", column '{column}'"

        super().__init__(
            f"Parse error {location}: {message}",
            code="FILE_PARSE_ERROR",
        )


class ImportValidationError(ImportError):
    """Raised when import data fails validation."""

    def __init__(
        self,
        message: str,
        row_number: int,
        column: str | None = None,
        value: str | None = None,
        job_id: str | None = None,
    ) -> None:
        self.row_number = row_number
        self.column = column
        self.value = value

        location = f"Row {row_number}"
        if column:
            location += f", column '{column}'"

        full_message = f"Validation error at {location}: {message}"
        if value:
            full_message += f" (value: {value[:50]})"

        super().__init__(full_message, job_id=job_id, code="IMPORT_VALIDATION_ERROR")


class ImportBatchError(ImportError):
    """Raised when a batch import fails with multiple errors."""

    def __init__(
        self,
        message: str,
        total_errors: int,
        error_summary: dict[str, int] | None = None,
        job_id: str | None = None,
    ) -> None:
        self.total_errors = total_errors
        self.error_summary = error_summary or {}
        super().__init__(
            f"{message} ({total_errors} errors)",
            job_id=job_id,
            code="IMPORT_BATCH_ERROR",
        )


class ImportJobNotFoundError(ImportError):
    """Raised when an import job cannot be found."""

    def __init__(self, job_id: str) -> None:
        super().__init__(
            f"Import job '{job_id}' not found",
            job_id=job_id,
            code="IMPORT_JOB_NOT_FOUND",
        )


class ImportJobStateError(ImportError):
    """Raised when an operation is invalid for the current job state."""

    def __init__(
        self,
        message: str,
        job_id: str,
        current_status: str,
        required_status: str | None = None,
    ) -> None:
        self.current_status = current_status
        self.required_status = required_status

        full_message = f"{message} (current status: {current_status})"
        if required_status:
            full_message += f" (requires: {required_status})"

        super().__init__(full_message, job_id=job_id, code="IMPORT_JOB_STATE_ERROR")


class UnsupportedFileFormatError(ImportError):
    """Raised when a file format is not supported for import."""

    def __init__(self, file_name: str, detected_format: str | None = None) -> None:
        self.file_name = file_name
        self.detected_format = detected_format

        message = f"Unsupported file format for '{file_name}'"
        if detected_format:
            message += f" (detected: {detected_format})"
        message += ". Supported formats: CSV, XLSX, JSON"

        super().__init__(message, code="UNSUPPORTED_FILE_FORMAT")
