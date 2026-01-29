"""
File parser interfaces and base types for data ingestion.

This module defines the contract that all file parsers must implement,
enabling format-agnostic batch import operations.

Design Principles:
1. Format agnostic - All parsers produce the same ParsedRow output
2. Streaming capable - Can handle large files without loading all into memory
3. Error tolerant - Captures row-level errors without failing entire file
4. Metadata rich - Preserves source information for audit trail

Research Grounding: docs/gaps/data-ingestion-assessment.md
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from io import IOBase
from pathlib import Path
from typing import Any, BinaryIO, Iterator, Protocol, TextIO, runtime_checkable


class FileFormat(str, Enum):
    """Supported file formats for data ingestion."""

    CSV = "csv"
    EXCEL = "xlsx"
    JSON = "json"
    # Future formats
    # OFX = "ofx"  # Bank statements
    # QFX = "qfx"  # Quicken format
    # XML = "xml"  # Generic XML


@dataclass(frozen=True)
class FileParseError:
    """
    Represents an error encountered while parsing a specific row.

    Attributes:
        row_number: 1-based row number where error occurred
        column: Column name or index where error occurred (if applicable)
        message: Human-readable error description
        raw_value: The problematic value that caused the error
        error_code: Machine-readable error code for categorization
    """

    row_number: int
    column: str | None
    message: str
    raw_value: str | None = None
    error_code: str = "PARSE_ERROR"

    def __str__(self) -> str:
        location = f"Row {self.row_number}"
        if self.column:
            location += f", Column '{self.column}'"
        return f"{location}: {self.message}"


@dataclass
class ParsedRow:
    """
    A single row of data parsed from a file.

    This is the format-agnostic representation of a data row.
    All parsers must convert their native format to this structure.

    Attributes:
        row_number: 1-based row number in the source file
        data: Dictionary of column_name -> value (all values as strings initially)
        raw_line: Original line/row for debugging (optional)
        errors: Any parsing errors for this specific row
        metadata: Additional parser-specific metadata
    """

    row_number: int
    data: dict[str, Any]
    raw_line: str | None = None
    errors: list[FileParseError] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def is_valid(self) -> bool:
        """Return True if row has no parsing errors."""
        return len(self.errors) == 0

    @property
    def has_errors(self) -> bool:
        """Return True if row has parsing errors."""
        return len(self.errors) > 0

    def get(self, column: str, default: Any = None) -> Any:
        """Get value by column name with optional default."""
        return self.data.get(column, default)

    def get_string(self, column: str, default: str = "") -> str:
        """Get value as string, with default for missing/None values."""
        value = self.data.get(column)
        if value is None:
            return default
        return str(value).strip()

    def get_decimal(self, column: str) -> str | None:
        """
        Get value prepared for Decimal conversion.

        Strips whitespace, removes currency symbols and thousand separators.
        Returns None if column is missing or empty.
        """
        value = self.data.get(column)
        if value is None:
            return None

        str_value = str(value).strip()
        if not str_value:
            return None

        # Remove common currency symbols and thousand separators
        for char in ["$", "€", "£", "¥", ",", " "]:
            str_value = str_value.replace(char, "")

        # Handle parentheses for negative numbers: (100) -> -100
        if str_value.startswith("(") and str_value.endswith(")"):
            str_value = "-" + str_value[1:-1]

        return str_value


@dataclass
class ParseResult:
    """
    Complete result of parsing a file.

    Attributes:
        file_name: Original file name
        file_format: Detected or specified format
        total_rows: Total number of data rows (excluding headers)
        successful_rows: Number of rows parsed without errors
        failed_rows: Number of rows with parsing errors
        rows: Iterator or list of ParsedRow objects
        headers: Column headers if available
        errors: File-level errors (not row-specific)
        started_at: When parsing began
        completed_at: When parsing finished
        metadata: Additional file-level metadata
    """

    file_name: str
    file_format: FileFormat
    total_rows: int = 0
    successful_rows: int = 0
    failed_rows: int = 0
    rows: list[ParsedRow] = field(default_factory=list)
    headers: list[str] = field(default_factory=list)
    errors: list[FileParseError] = field(default_factory=list)
    started_at: datetime | None = None
    completed_at: datetime | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def is_successful(self) -> bool:
        """Return True if file was parsed without file-level errors."""
        return len(self.errors) == 0

    @property
    def has_row_errors(self) -> bool:
        """Return True if any rows had parsing errors."""
        return self.failed_rows > 0

    @property
    def success_rate(self) -> float:
        """Return percentage of successfully parsed rows."""
        if self.total_rows == 0:
            return 0.0
        return (self.successful_rows / self.total_rows) * 100

    @property
    def duration_seconds(self) -> float | None:
        """Return parsing duration in seconds."""
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds()
        return None

    def get_valid_rows(self) -> Iterator[ParsedRow]:
        """Yield only rows without parsing errors."""
        for row in self.rows:
            if row.is_valid:
                yield row

    def get_error_rows(self) -> Iterator[ParsedRow]:
        """Yield only rows with parsing errors."""
        for row in self.rows:
            if row.has_errors:
                yield row

    def all_errors(self) -> list[FileParseError]:
        """Get all errors (file-level and row-level) in a flat list."""
        all_errs = list(self.errors)
        for row in self.rows:
            all_errs.extend(row.errors)
        return all_errs


@runtime_checkable
class IFileParser(Protocol):
    """
    Protocol defining the interface for file parsers.

    All file format parsers must implement this interface to ensure
    consistent behavior across the ingestion pipeline.

    Usage:
        parser = CSVParser()
        result = parser.parse(file_stream, "transactions.csv")
        for row in result.get_valid_rows():
            process_row(row)
    """

    @property
    def supported_format(self) -> FileFormat:
        """Return the file format this parser handles."""
        ...

    @property
    def supported_extensions(self) -> list[str]:
        """Return list of file extensions this parser handles (e.g., ['.csv'])."""
        ...

    def can_parse(self, file_name: str) -> bool:
        """
        Check if this parser can handle the given file.

        Args:
            file_name: Name of the file to check

        Returns:
            True if this parser can handle the file format
        """
        ...

    def parse(
        self,
        file: BinaryIO | TextIO,
        file_name: str,
        *,
        encoding: str = "utf-8",
        has_header: bool = True,
        skip_rows: int = 0,
        max_rows: int | None = None,
        column_mapping: dict[str, str] | None = None,
    ) -> ParseResult:
        """
        Parse a file and return structured data.

        Args:
            file: File-like object to parse (binary or text mode)
            file_name: Original file name (for metadata and error reporting)
            encoding: Character encoding (default UTF-8)
            has_header: Whether first row contains column headers
            skip_rows: Number of rows to skip before parsing (after header)
            max_rows: Maximum rows to parse (None for all)
            column_mapping: Optional mapping of source columns to target columns

        Returns:
            ParseResult containing all parsed rows and metadata

        Raises:
            FileParseError: For unrecoverable file-level errors
        """
        ...

    def parse_file(
        self,
        file_path: str | Path,
        **kwargs: Any,
    ) -> ParseResult:
        """
        Parse a file from the filesystem.

        Convenience method that opens the file and calls parse().

        Args:
            file_path: Path to the file to parse
            **kwargs: Additional arguments passed to parse()

        Returns:
            ParseResult containing all parsed rows and metadata
        """
        ...


class BaseFileParser(ABC):
    """
    Abstract base class for file parsers.

    Provides common functionality for all parser implementations.
    Subclasses must implement _parse_stream() for format-specific parsing.
    """

    @property
    @abstractmethod
    def supported_format(self) -> FileFormat:
        """Return the file format this parser handles."""
        ...

    @property
    @abstractmethod
    def supported_extensions(self) -> list[str]:
        """Return list of file extensions this parser handles."""
        ...

    def can_parse(self, file_name: str) -> bool:
        """Check if this parser can handle the given file."""
        ext = Path(file_name).suffix.lower()
        return ext in self.supported_extensions

    def parse(
        self,
        file: BinaryIO | TextIO,
        file_name: str,
        *,
        encoding: str = "utf-8",
        has_header: bool = True,
        skip_rows: int = 0,
        max_rows: int | None = None,
        column_mapping: dict[str, str] | None = None,
    ) -> ParseResult:
        """Parse a file and return structured data."""
        started_at = datetime.utcnow()

        result = ParseResult(
            file_name=file_name,
            file_format=self.supported_format,
            started_at=started_at,
        )

        try:
            self._parse_stream(
                file=file,
                result=result,
                encoding=encoding,
                has_header=has_header,
                skip_rows=skip_rows,
                max_rows=max_rows,
                column_mapping=column_mapping,
            )
        except Exception as e:
            result.errors.append(
                FileParseError(
                    row_number=0,
                    column=None,
                    message=f"Failed to parse file: {str(e)}",
                    error_code="FILE_PARSE_ERROR",
                )
            )

        result.completed_at = datetime.utcnow()
        result.total_rows = len(result.rows)
        result.successful_rows = sum(1 for row in result.rows if row.is_valid)
        result.failed_rows = result.total_rows - result.successful_rows

        return result

    def parse_file(
        self,
        file_path: str | Path,
        **kwargs: Any,
    ) -> ParseResult:
        """Parse a file from the filesystem."""
        path = Path(file_path)
        mode = self._get_file_mode()

        with open(path, mode) as f:
            return self.parse(f, path.name, **kwargs)

    def _get_file_mode(self) -> str:
        """Return the file open mode ('r' for text, 'rb' for binary)."""
        return "r"

    @abstractmethod
    def _parse_stream(
        self,
        file: BinaryIO | TextIO,
        result: ParseResult,
        encoding: str,
        has_header: bool,
        skip_rows: int,
        max_rows: int | None,
        column_mapping: dict[str, str] | None,
    ) -> None:
        """
        Format-specific parsing implementation.

        Subclasses must implement this to parse their specific format.
        Results should be appended to result.rows and result.headers.

        Args:
            file: File stream to parse
            result: ParseResult to populate
            encoding: Character encoding
            has_header: Whether first row is headers
            skip_rows: Rows to skip after header
            max_rows: Maximum rows to parse
            column_mapping: Column name remapping
        """
        ...

    def _apply_column_mapping(
        self,
        data: dict[str, Any],
        mapping: dict[str, str] | None,
    ) -> dict[str, Any]:
        """Apply column mapping to rename columns."""
        if not mapping:
            return data

        return {mapping.get(k, k): v for k, v in data.items()}
