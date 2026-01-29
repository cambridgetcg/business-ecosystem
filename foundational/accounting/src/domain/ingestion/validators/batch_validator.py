"""
Batch Validator - validates batches of parsed rows before import.

Follows the BalanceValidator pattern: returns results rather than
raising exceptions, enabling complete validation of all rows.

Design Principles:
1. Complete validation - Validates all rows, collects all errors
2. Deterministic - Uses exact validation rules, no AI reasoning
3. Configurable - Accepts validation rules per import target
4. Result-oriented - Returns comprehensive results for error reporting

Research Grounding: docs/gaps/data-ingestion-assessment.md
AI Knowledge Gap (doc 11): Validation must be deterministic
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, Protocol, Sequence

from src.infrastructure.ingestion.parsers.base import ParsedRow, ParseResult
from src.domain.ingestion.validators.field_validators import (
    FieldValidationError,
    FieldValidationResult,
)


@dataclass
class RowValidationResult:
    """
    Result of validating a single row.

    Attributes:
        row_number: Original row number from source file
        is_valid: Whether all validations passed
        errors: List of field-level errors
        validated_data: Dictionary of validated and converted values
        warnings: Non-fatal issues (row can still be imported)
    """

    row_number: int
    is_valid: bool
    errors: list[FieldValidationError] = field(default_factory=list)
    validated_data: dict[str, Any] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)

    @property
    def error_count(self) -> int:
        """Return number of errors."""
        return len(self.errors)

    @property
    def has_warnings(self) -> bool:
        """Return True if row has warnings."""
        return len(self.warnings) > 0


@dataclass
class BatchValidationResult:
    """
    Result of validating a batch of rows.

    Attributes:
        total_rows: Total number of rows validated
        valid_rows: Number of rows that passed validation
        invalid_rows: Number of rows with errors
        row_results: Individual results for each row
        errors_by_field: Aggregated error counts by field name
        errors_by_code: Aggregated error counts by error code
        started_at: When validation started
        completed_at: When validation completed
    """

    total_rows: int = 0
    valid_rows: int = 0
    invalid_rows: int = 0
    row_results: list[RowValidationResult] = field(default_factory=list)
    errors_by_field: dict[str, int] = field(default_factory=dict)
    errors_by_code: dict[str, int] = field(default_factory=dict)
    started_at: datetime | None = None
    completed_at: datetime | None = None

    @property
    def is_valid(self) -> bool:
        """Return True if all rows are valid."""
        return self.invalid_rows == 0

    @property
    def has_errors(self) -> bool:
        """Return True if any rows have errors."""
        return self.invalid_rows > 0

    @property
    def success_rate(self) -> float:
        """Return percentage of valid rows."""
        if self.total_rows == 0:
            return 0.0
        return (self.valid_rows / self.total_rows) * 100

    @property
    def total_errors(self) -> int:
        """Return total number of errors across all rows."""
        return sum(r.error_count for r in self.row_results)

    @property
    def duration_seconds(self) -> float | None:
        """Return validation duration in seconds."""
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds()
        return None

    def get_valid_rows(self) -> list[RowValidationResult]:
        """Return only valid row results."""
        return [r for r in self.row_results if r.is_valid]

    def get_invalid_rows(self) -> list[RowValidationResult]:
        """Return only invalid row results."""
        return [r for r in self.row_results if not r.is_valid]

    def get_all_errors(self) -> list[tuple[int, FieldValidationError]]:
        """Return all errors as (row_number, error) tuples."""
        errors = []
        for result in self.row_results:
            for error in result.errors:
                errors.append((result.row_number, error))
        return errors


# Type for validation rule functions
ValidationRule = Callable[[ParsedRow], list[FieldValidationResult]]


@dataclass
class FieldSpec:
    """
    Specification for a field to validate.

    Attributes:
        source_column: Column name in the source data
        target_field: Field name in the target entity
        validator: Validation function to apply
        required: Whether the field is required
        default: Default value if not provided
    """

    source_column: str
    target_field: str
    validator: Callable[[Any, str], FieldValidationResult]
    required: bool = True
    default: Any = None


class BatchValidator:
    """
    Validates batches of parsed rows before import.

    This validator is configurable with field specifications that define
    how each column in the source data should be validated and mapped.

    Usage:
        validator = BatchValidator()
        validator.add_field(FieldSpec(
            source_column="entry_date",
            target_field="entry_date",
            validator=validate_date,
            required=True,
        ))

        result = validator.validate_batch(parse_result.rows)

        if result.is_valid:
            for row_result in result.get_valid_rows():
                process_row(row_result.validated_data)
    """

    def __init__(self) -> None:
        """Initialize the validator."""
        self._field_specs: list[FieldSpec] = []
        self._custom_validators: list[Callable[[ParsedRow, dict], list[str]]] = []

    def add_field(self, spec: FieldSpec) -> "BatchValidator":
        """
        Add a field specification.

        Args:
            spec: Field specification

        Returns:
            Self for method chaining
        """
        self._field_specs.append(spec)
        return self

    def add_custom_validator(
        self,
        validator: Callable[[ParsedRow, dict], list[str]],
    ) -> "BatchValidator":
        """
        Add a custom row-level validator.

        Custom validators receive the raw row and validated data,
        and return a list of error messages.

        Args:
            validator: Function taking (row, validated_data) and returning errors

        Returns:
            Self for method chaining
        """
        self._custom_validators.append(validator)
        return self

    def validate_batch(
        self,
        rows: Sequence[ParsedRow],
        stop_on_first_error: bool = False,
    ) -> BatchValidationResult:
        """
        Validate a batch of rows.

        Args:
            rows: Sequence of ParsedRow objects to validate
            stop_on_first_error: If True, stop after first invalid row

        Returns:
            BatchValidationResult with all validation results
        """
        result = BatchValidationResult(
            total_rows=len(rows),
            started_at=datetime.utcnow(),
        )

        for row in rows:
            row_result = self._validate_row(row)
            result.row_results.append(row_result)

            if row_result.is_valid:
                result.valid_rows += 1
            else:
                result.invalid_rows += 1

                # Aggregate errors
                for error in row_result.errors:
                    result.errors_by_field[error.field] = (
                        result.errors_by_field.get(error.field, 0) + 1
                    )
                    result.errors_by_code[error.error_code] = (
                        result.errors_by_code.get(error.error_code, 0) + 1
                    )

                if stop_on_first_error:
                    break

        result.completed_at = datetime.utcnow()
        return result

    def validate_parse_result(
        self,
        parse_result: ParseResult,
        stop_on_first_error: bool = False,
    ) -> BatchValidationResult:
        """
        Validate rows from a ParseResult.

        Convenience method that filters out rows with parse errors.

        Args:
            parse_result: ParseResult from file parsing
            stop_on_first_error: If True, stop after first invalid row

        Returns:
            BatchValidationResult with all validation results
        """
        # Only validate rows that were successfully parsed
        valid_parsed_rows = list(parse_result.get_valid_rows())
        return self.validate_batch(valid_parsed_rows, stop_on_first_error)

    def _validate_row(self, row: ParsedRow) -> RowValidationResult:
        """Validate a single row."""
        errors: list[FieldValidationError] = []
        validated_data: dict[str, Any] = {}
        warnings: list[str] = []

        # Validate each field spec
        for spec in self._field_specs:
            raw_value = row.get(spec.source_column)

            # Handle missing/empty values
            if raw_value is None or (isinstance(raw_value, str) and not raw_value.strip()):
                if spec.required:
                    errors.append(FieldValidationError(
                        field=spec.source_column,
                        message=f"Required field '{spec.source_column}' is missing",
                        error_code="REQUIRED_FIELD_MISSING",
                    ))
                elif spec.default is not None:
                    validated_data[spec.target_field] = spec.default
                continue

            # Apply validator
            validation_result = spec.validator(raw_value, spec.source_column)

            if validation_result.is_valid:
                validated_data[spec.target_field] = validation_result.value
            else:
                if validation_result.error:
                    errors.append(validation_result.error)

        # Run custom validators
        for custom_validator in self._custom_validators:
            custom_errors = custom_validator(row, validated_data)
            for error_msg in custom_errors:
                errors.append(FieldValidationError(
                    field="_custom",
                    message=error_msg,
                    error_code="CUSTOM_VALIDATION_ERROR",
                ))

        return RowValidationResult(
            row_number=row.row_number,
            is_valid=len(errors) == 0,
            errors=errors,
            validated_data=validated_data,
            warnings=warnings,
        )


# -------------------------------------------------------------------------
# Pre-configured Validators
# -------------------------------------------------------------------------


def create_journal_entry_validator() -> BatchValidator:
    """
    Create a pre-configured validator for journal entry imports.

    Expected columns:
    - entry_date: Date of the entry
    - description: Entry description
    - account_code: Account code for the line
    - entry_type: DEBIT or CREDIT
    - amount: Line amount

    Optional columns:
    - currency_code: Currency (defaults to USD)
    - line_description: Line-level description
    - source_document: Source document reference
    """
    from src.domain.ingestion.validators.field_validators import (
        validate_date,
        validate_decimal,
        validate_account_code,
        validate_entry_type,
        validate_string_length,
        validate_currency_code,
    )
    from decimal import Decimal

    validator = BatchValidator()

    # Required fields
    validator.add_field(FieldSpec(
        source_column="entry_date",
        target_field="entry_date",
        validator=validate_date,
        required=True,
    ))

    validator.add_field(FieldSpec(
        source_column="description",
        target_field="description",
        validator=lambda v, f: validate_string_length(v, f, min_length=1, max_length=1000, required=True),
        required=True,
    ))

    validator.add_field(FieldSpec(
        source_column="account_code",
        target_field="account_code",
        validator=validate_account_code,
        required=True,
    ))

    validator.add_field(FieldSpec(
        source_column="entry_type",
        target_field="entry_type",
        validator=validate_entry_type,
        required=True,
    ))

    validator.add_field(FieldSpec(
        source_column="amount",
        target_field="amount",
        validator=lambda v, f: validate_decimal(v, f, min_value=Decimal("0.0001")),
        required=True,
    ))

    # Optional fields
    validator.add_field(FieldSpec(
        source_column="currency_code",
        target_field="currency_code",
        validator=validate_currency_code,
        required=False,
        default="USD",
    ))

    validator.add_field(FieldSpec(
        source_column="line_description",
        target_field="line_description",
        validator=lambda v, f: validate_string_length(v, f, max_length=500, required=False),
        required=False,
    ))

    validator.add_field(FieldSpec(
        source_column="source_document",
        target_field="source_document",
        validator=lambda v, f: validate_string_length(v, f, max_length=200, required=False),
        required=False,
    ))

    return validator


def create_account_validator() -> BatchValidator:
    """
    Create a pre-configured validator for account imports.

    Expected columns:
    - code: Account code
    - name: Account name
    - account_type: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE

    Optional columns:
    - description: Account description
    - parent_code: Parent account code
    - currency_code: Default currency
    - is_header: Whether this is a header account
    """
    from src.domain.ingestion.validators.field_validators import (
        validate_account_code,
        validate_account_type,
        validate_string_length,
        validate_currency_code,
    )

    validator = BatchValidator()

    # Required fields
    validator.add_field(FieldSpec(
        source_column="code",
        target_field="code",
        validator=validate_account_code,
        required=True,
    ))

    validator.add_field(FieldSpec(
        source_column="name",
        target_field="name",
        validator=lambda v, f: validate_string_length(v, f, min_length=1, max_length=200, required=True),
        required=True,
    ))

    validator.add_field(FieldSpec(
        source_column="account_type",
        target_field="account_type",
        validator=validate_account_type,
        required=True,
    ))

    # Optional fields
    validator.add_field(FieldSpec(
        source_column="description",
        target_field="description",
        validator=lambda v, f: validate_string_length(v, f, max_length=1000, required=False),
        required=False,
    ))

    validator.add_field(FieldSpec(
        source_column="parent_code",
        target_field="parent_code",
        validator=validate_account_code,
        required=False,
    ))

    validator.add_field(FieldSpec(
        source_column="currency_code",
        target_field="currency_code",
        validator=validate_currency_code,
        required=False,
        default="USD",
    ))

    def validate_is_header(value: Any, field: str) -> FieldValidationResult[bool]:
        """Validate boolean is_header field."""
        if value is None:
            return FieldValidationResult.success(False)

        str_value = str(value).strip().upper()
        if str_value in ("TRUE", "YES", "Y", "1"):
            return FieldValidationResult.success(True)
        elif str_value in ("FALSE", "NO", "N", "0", ""):
            return FieldValidationResult.success(False)
        else:
            return FieldValidationResult.failure(
                field=field,
                message=f"Invalid boolean value '{str_value}'. Use TRUE/FALSE or YES/NO",
                value=str_value,
                error_code="INVALID_BOOLEAN",
            )

    validator.add_field(FieldSpec(
        source_column="is_header",
        target_field="is_header",
        validator=validate_is_header,
        required=False,
        default=False,
    ))

    return validator
