"""
Field validators for import data.

Provides deterministic validation of individual field values from parsed rows.
Each validator returns a FieldValidationResult with either the converted value
or an error.

Design Principles:
1. Deterministic - No AI reasoning, exact validation rules
2. Error-capturing - Returns errors rather than raising exceptions
3. Type-converting - Converts strings to proper types when valid
4. Null-safe - Handles None and empty strings consistently

Research Grounding: docs/gaps/data-ingestion-assessment.md
AI Knowledge Gap (doc 11): Validation must be deterministic
"""

import re
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any, Generic, TypeVar

from src.domain.chart_of_accounts.models.account import AccountType
from src.domain.general_ledger.models.journal_entry_line import EntryType

T = TypeVar("T")


@dataclass(frozen=True)
class FieldValidationError:
    """
    Error from field validation.

    Attributes:
        field: Name of the field that failed validation
        message: Human-readable error message
        value: The invalid value (as string)
        error_code: Machine-readable error code
    """

    field: str
    message: str
    value: str | None = None
    error_code: str = "VALIDATION_ERROR"


@dataclass(frozen=True)
class FieldValidationResult(Generic[T]):
    """
    Result of validating a single field.

    Either contains a valid value or an error, never both.

    Attributes:
        value: The validated and converted value (if valid)
        error: Validation error (if invalid)
    """

    value: T | None = None
    error: FieldValidationError | None = None

    @property
    def is_valid(self) -> bool:
        """Return True if validation passed."""
        return self.error is None

    @property
    def is_invalid(self) -> bool:
        """Return True if validation failed."""
        return self.error is not None

    @classmethod
    def success(cls, value: T) -> "FieldValidationResult[T]":
        """Create a successful result."""
        return cls(value=value)

    @classmethod
    def failure(
        cls,
        field: str,
        message: str,
        value: str | None = None,
        error_code: str = "VALIDATION_ERROR",
    ) -> "FieldValidationResult[T]":
        """Create a failure result."""
        return cls(
            error=FieldValidationError(
                field=field,
                message=message,
                value=value,
                error_code=error_code,
            )
        )


def validate_required(
    value: Any,
    field: str,
) -> FieldValidationResult[str]:
    """
    Validate that a field has a non-empty value.

    Args:
        value: The value to check
        field: Field name for error reporting

    Returns:
        FieldValidationResult with string value or error
    """
    if value is None:
        return FieldValidationResult.failure(
            field=field,
            message=f"Required field '{field}' is missing",
            error_code="REQUIRED_FIELD_MISSING",
        )

    str_value = str(value).strip()
    if not str_value:
        return FieldValidationResult.failure(
            field=field,
            message=f"Required field '{field}' is empty",
            error_code="REQUIRED_FIELD_EMPTY",
        )

    return FieldValidationResult.success(str_value)


def validate_date(
    value: Any,
    field: str,
    formats: list[str] | None = None,
) -> FieldValidationResult[date]:
    """
    Validate and convert a date value.

    Supports multiple date formats and auto-detection.

    Args:
        value: The value to validate (string, date, or datetime)
        field: Field name for error reporting
        formats: List of strptime format strings to try

    Returns:
        FieldValidationResult with date value or error
    """
    if value is None:
        return FieldValidationResult.failure(
            field=field,
            message=f"Date field '{field}' is missing",
            error_code="REQUIRED_FIELD_MISSING",
        )

    # Already a date
    if isinstance(value, date) and not isinstance(value, datetime):
        return FieldValidationResult.success(value)

    # Datetime - extract date
    if isinstance(value, datetime):
        return FieldValidationResult.success(value.date())

    # String - parse
    str_value = str(value).strip()
    if not str_value:
        return FieldValidationResult.failure(
            field=field,
            message=f"Date field '{field}' is empty",
            error_code="REQUIRED_FIELD_EMPTY",
        )

    # Default formats to try
    if formats is None:
        formats = [
            "%Y-%m-%d",      # ISO format: 2026-01-28
            "%m/%d/%Y",      # US format: 01/28/2026
            "%d/%m/%Y",      # EU format: 28/01/2026
            "%Y/%m/%d",      # Alt ISO: 2026/01/28
            "%m-%d-%Y",      # US with dashes: 01-28-2026
            "%d-%m-%Y",      # EU with dashes: 28-01-2026
            "%Y%m%d",        # Compact: 20260128
        ]

    for fmt in formats:
        try:
            parsed = datetime.strptime(str_value, fmt)
            return FieldValidationResult.success(parsed.date())
        except ValueError:
            continue

    return FieldValidationResult.failure(
        field=field,
        message=f"Invalid date format for '{field}'. Expected formats: YYYY-MM-DD, MM/DD/YYYY, etc.",
        value=str_value,
        error_code="INVALID_DATE",
    )


def validate_decimal(
    value: Any,
    field: str,
    min_value: Decimal | None = None,
    max_value: Decimal | None = None,
    allow_negative: bool = False,
    precision: int = 4,
) -> FieldValidationResult[Decimal]:
    """
    Validate and convert a decimal/money value.

    Handles currency symbols, thousand separators, and parentheses for negatives.

    Args:
        value: The value to validate
        field: Field name for error reporting
        min_value: Minimum allowed value (inclusive)
        max_value: Maximum allowed value (inclusive)
        allow_negative: Whether negative values are allowed
        precision: Number of decimal places to round to

    Returns:
        FieldValidationResult with Decimal value or error
    """
    if value is None:
        return FieldValidationResult.failure(
            field=field,
            message=f"Decimal field '{field}' is missing",
            error_code="REQUIRED_FIELD_MISSING",
        )

    # Already a Decimal
    if isinstance(value, Decimal):
        decimal_value = value
    elif isinstance(value, (int, float)):
        decimal_value = Decimal(str(value))
    else:
        # String - clean and parse
        str_value = str(value).strip()
        if not str_value:
            return FieldValidationResult.failure(
                field=field,
                message=f"Decimal field '{field}' is empty",
                error_code="REQUIRED_FIELD_EMPTY",
            )

        # Clean the string
        cleaned = str_value

        # Remove currency symbols
        for symbol in ["$", "€", "£", "¥", "₹"]:
            cleaned = cleaned.replace(symbol, "")

        # Remove thousand separators (commas and spaces)
        cleaned = cleaned.replace(",", "").replace(" ", "")

        # Handle parentheses for negative: (100) -> -100
        if cleaned.startswith("(") and cleaned.endswith(")"):
            cleaned = "-" + cleaned[1:-1]

        # Handle trailing minus: 100- -> -100
        if cleaned.endswith("-"):
            cleaned = "-" + cleaned[:-1]

        try:
            decimal_value = Decimal(cleaned)
        except InvalidOperation:
            return FieldValidationResult.failure(
                field=field,
                message=f"Invalid number format for '{field}'",
                value=str_value,
                error_code="INVALID_NUMBER",
            )

    # Round to precision
    decimal_value = round(decimal_value, precision)

    # Check negative
    if not allow_negative and decimal_value < 0:
        return FieldValidationResult.failure(
            field=field,
            message=f"Field '{field}' must not be negative",
            value=str(decimal_value),
            error_code="NEGATIVE_NOT_ALLOWED",
        )

    # Check min
    if min_value is not None and decimal_value < min_value:
        return FieldValidationResult.failure(
            field=field,
            message=f"Field '{field}' must be at least {min_value}",
            value=str(decimal_value),
            error_code="VALUE_TOO_SMALL",
        )

    # Check max
    if max_value is not None and decimal_value > max_value:
        return FieldValidationResult.failure(
            field=field,
            message=f"Field '{field}' must be at most {max_value}",
            value=str(decimal_value),
            error_code="VALUE_TOO_LARGE",
        )

    return FieldValidationResult.success(decimal_value)


def validate_account_code(
    value: Any,
    field: str,
    pattern: str | None = None,
) -> FieldValidationResult[str]:
    """
    Validate an account code.

    Args:
        value: The value to validate
        field: Field name for error reporting
        pattern: Optional regex pattern for account codes

    Returns:
        FieldValidationResult with validated code or error
    """
    if value is None:
        return FieldValidationResult.failure(
            field=field,
            message=f"Account code field '{field}' is missing",
            error_code="REQUIRED_FIELD_MISSING",
        )

    str_value = str(value).strip()
    if not str_value:
        return FieldValidationResult.failure(
            field=field,
            message=f"Account code field '{field}' is empty",
            error_code="REQUIRED_FIELD_EMPTY",
        )

    # Length check
    if len(str_value) > 50:
        return FieldValidationResult.failure(
            field=field,
            message=f"Account code too long (max 50 characters)",
            value=str_value[:50] + "...",
            error_code="ACCOUNT_CODE_TOO_LONG",
        )

    # Pattern check
    if pattern:
        if not re.match(pattern, str_value):
            return FieldValidationResult.failure(
                field=field,
                message=f"Account code '{str_value}' does not match expected pattern",
                value=str_value,
                error_code="INVALID_ACCOUNT_CODE_FORMAT",
            )

    return FieldValidationResult.success(str_value)


def validate_entry_type(
    value: Any,
    field: str,
) -> FieldValidationResult[EntryType]:
    """
    Validate a debit/credit entry type.

    Accepts various formats: DEBIT/CREDIT, D/C, DR/CR, 1/2, etc.

    Args:
        value: The value to validate
        field: Field name for error reporting

    Returns:
        FieldValidationResult with EntryType value or error
    """
    if value is None:
        return FieldValidationResult.failure(
            field=field,
            message=f"Entry type field '{field}' is missing",
            error_code="REQUIRED_FIELD_MISSING",
        )

    str_value = str(value).strip().upper()
    if not str_value:
        return FieldValidationResult.failure(
            field=field,
            message=f"Entry type field '{field}' is empty",
            error_code="REQUIRED_FIELD_EMPTY",
        )

    # Map various representations to EntryType
    debit_values = {"DEBIT", "D", "DR", "1", "DB"}
    credit_values = {"CREDIT", "C", "CR", "2", "CD"}

    if str_value in debit_values:
        return FieldValidationResult.success(EntryType.DEBIT)
    elif str_value in credit_values:
        return FieldValidationResult.success(EntryType.CREDIT)
    else:
        return FieldValidationResult.failure(
            field=field,
            message=f"Invalid entry type '{str_value}'. Use DEBIT/CREDIT or D/C",
            value=str_value,
            error_code="INVALID_ENTRY_TYPE",
        )


def validate_account_type(
    value: Any,
    field: str,
) -> FieldValidationResult[AccountType]:
    """
    Validate an account type.

    Accepts various formats: ASSET, A, ASSETS, etc.

    Args:
        value: The value to validate
        field: Field name for error reporting

    Returns:
        FieldValidationResult with AccountType value or error
    """
    if value is None:
        return FieldValidationResult.failure(
            field=field,
            message=f"Account type field '{field}' is missing",
            error_code="REQUIRED_FIELD_MISSING",
        )

    str_value = str(value).strip().upper()
    if not str_value:
        return FieldValidationResult.failure(
            field=field,
            message=f"Account type field '{field}' is empty",
            error_code="REQUIRED_FIELD_EMPTY",
        )

    # Map various representations
    type_map = {
        "ASSET": AccountType.ASSET,
        "ASSETS": AccountType.ASSET,
        "A": AccountType.ASSET,
        "LIABILITY": AccountType.LIABILITY,
        "LIABILITIES": AccountType.LIABILITY,
        "L": AccountType.LIABILITY,
        "EQUITY": AccountType.EQUITY,
        "E": AccountType.EQUITY,
        "OE": AccountType.EQUITY,  # Owner's Equity
        "REVENUE": AccountType.REVENUE,
        "REVENUES": AccountType.REVENUE,
        "INCOME": AccountType.REVENUE,
        "R": AccountType.REVENUE,
        "EXPENSE": AccountType.EXPENSE,
        "EXPENSES": AccountType.EXPENSE,
        "X": AccountType.EXPENSE,
    }

    if str_value in type_map:
        return FieldValidationResult.success(type_map[str_value])
    else:
        valid_types = "ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE"
        return FieldValidationResult.failure(
            field=field,
            message=f"Invalid account type '{str_value}'. Valid types: {valid_types}",
            value=str_value,
            error_code="INVALID_ACCOUNT_TYPE",
        )


def validate_currency_code(
    value: Any,
    field: str,
    allowed_codes: list[str] | None = None,
) -> FieldValidationResult[str]:
    """
    Validate an ISO 4217 currency code.

    Args:
        value: The value to validate
        field: Field name for error reporting
        allowed_codes: Optional list of allowed currency codes

    Returns:
        FieldValidationResult with validated code or error
    """
    if value is None:
        return FieldValidationResult.failure(
            field=field,
            message=f"Currency code field '{field}' is missing",
            error_code="REQUIRED_FIELD_MISSING",
        )

    str_value = str(value).strip().upper()
    if not str_value:
        return FieldValidationResult.failure(
            field=field,
            message=f"Currency code field '{field}' is empty",
            error_code="REQUIRED_FIELD_EMPTY",
        )

    # Must be exactly 3 characters
    if len(str_value) != 3:
        return FieldValidationResult.failure(
            field=field,
            message=f"Currency code must be 3 characters (ISO 4217)",
            value=str_value,
            error_code="INVALID_CURRENCY_CODE",
        )

    # Must be alphabetic
    if not str_value.isalpha():
        return FieldValidationResult.failure(
            field=field,
            message=f"Currency code must be alphabetic (ISO 4217)",
            value=str_value,
            error_code="INVALID_CURRENCY_CODE",
        )

    # Check against allowed list
    if allowed_codes and str_value not in allowed_codes:
        return FieldValidationResult.failure(
            field=field,
            message=f"Currency '{str_value}' is not in allowed list",
            value=str_value,
            error_code="CURRENCY_NOT_ALLOWED",
        )

    return FieldValidationResult.success(str_value)


def validate_string_length(
    value: Any,
    field: str,
    min_length: int = 0,
    max_length: int = 1000,
    required: bool = False,
) -> FieldValidationResult[str]:
    """
    Validate a string field with length constraints.

    Args:
        value: The value to validate
        field: Field name for error reporting
        min_length: Minimum length (inclusive)
        max_length: Maximum length (inclusive)
        required: Whether the field is required

    Returns:
        FieldValidationResult with validated string or error
    """
    if value is None:
        if required:
            return FieldValidationResult.failure(
                field=field,
                message=f"Required field '{field}' is missing",
                error_code="REQUIRED_FIELD_MISSING",
            )
        return FieldValidationResult.success("")

    str_value = str(value).strip()

    if not str_value and required:
        return FieldValidationResult.failure(
            field=field,
            message=f"Required field '{field}' is empty",
            error_code="REQUIRED_FIELD_EMPTY",
        )

    if len(str_value) < min_length:
        return FieldValidationResult.failure(
            field=field,
            message=f"Field '{field}' must be at least {min_length} characters",
            value=str_value,
            error_code="STRING_TOO_SHORT",
        )

    if len(str_value) > max_length:
        return FieldValidationResult.failure(
            field=field,
            message=f"Field '{field}' must be at most {max_length} characters",
            value=str_value[:50] + "...",
            error_code="STRING_TOO_LONG",
        )

    return FieldValidationResult.success(str_value)
