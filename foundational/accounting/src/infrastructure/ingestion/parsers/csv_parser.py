"""
CSV file parser implementation.

Uses Python's built-in csv module for reliable parsing of CSV files.
Handles various CSV dialects and encoding issues gracefully.
"""

import csv
from io import StringIO, TextIOWrapper
from typing import Any, BinaryIO, TextIO

from src.infrastructure.ingestion.parsers.base import (
    BaseFileParser,
    FileFormat,
    FileParseError,
    ParsedRow,
    ParseResult,
)


class CSVParser(BaseFileParser):
    """
    Parser for CSV (Comma-Separated Values) files.

    Features:
    - Automatic dialect detection (comma, semicolon, tab delimiters)
    - Handles quoted fields and escaped characters
    - Graceful handling of encoding issues
    - Row-level error capture without failing entire file
    """

    @property
    def supported_format(self) -> FileFormat:
        return FileFormat.CSV

    @property
    def supported_extensions(self) -> list[str]:
        return [".csv", ".tsv", ".txt"]

    def _get_file_mode(self) -> str:
        return "r"

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
        """Parse CSV file stream."""
        # Ensure we have a text stream
        if hasattr(file, "mode") and "b" in getattr(file, "mode", ""):
            text_file = TextIOWrapper(file, encoding=encoding, errors="replace")
        else:
            text_file = file

        # Read a sample to detect dialect
        sample = text_file.read(8192)
        text_file.seek(0)

        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
        except csv.Error:
            # Fall back to default comma dialect
            dialect = csv.excel

        reader = csv.reader(text_file, dialect)

        # Extract headers
        headers: list[str] = []
        if has_header:
            try:
                header_row = next(reader)
                headers = [self._clean_header(h) for h in header_row]
                result.headers = headers
            except StopIteration:
                result.errors.append(
                    FileParseError(
                        row_number=0,
                        column=None,
                        message="File is empty or contains no header row",
                        error_code="EMPTY_FILE",
                    )
                )
                return

        # Skip additional rows if requested
        for _ in range(skip_rows):
            try:
                next(reader)
            except StopIteration:
                break

        # Parse data rows
        row_number = 1 + (1 if has_header else 0) + skip_rows
        rows_parsed = 0

        for raw_row in reader:
            if max_rows is not None and rows_parsed >= max_rows:
                break

            parsed_row = self._parse_row(
                raw_row=raw_row,
                row_number=row_number,
                headers=headers,
                column_mapping=column_mapping,
            )

            result.rows.append(parsed_row)
            rows_parsed += 1
            row_number += 1

        result.metadata["dialect"] = {
            "delimiter": dialect.delimiter,
            "quotechar": dialect.quotechar,
        }

    def _parse_row(
        self,
        raw_row: list[str],
        row_number: int,
        headers: list[str],
        column_mapping: dict[str, str] | None,
    ) -> ParsedRow:
        """Parse a single CSV row into a ParsedRow."""
        errors: list[FileParseError] = []
        data: dict[str, Any] = {}

        # If we have headers, map by header name
        if headers:
            for i, value in enumerate(raw_row):
                if i < len(headers):
                    col_name = headers[i]
                    data[col_name] = value.strip() if value else None
                else:
                    # Extra column without header
                    data[f"_column_{i}"] = value.strip() if value else None
                    errors.append(
                        FileParseError(
                            row_number=row_number,
                            column=f"_column_{i}",
                            message=f"Extra column {i} has no header",
                            raw_value=value,
                            error_code="EXTRA_COLUMN",
                        )
                    )

            # Check for missing columns
            for i, header in enumerate(headers):
                if i >= len(raw_row):
                    data[header] = None
                    errors.append(
                        FileParseError(
                            row_number=row_number,
                            column=header,
                            message=f"Missing value for column '{header}'",
                            error_code="MISSING_COLUMN",
                        )
                    )
        else:
            # No headers - use column indices
            for i, value in enumerate(raw_row):
                data[f"column_{i}"] = value.strip() if value else None

        # Apply column mapping
        data = self._apply_column_mapping(data, column_mapping)

        return ParsedRow(
            row_number=row_number,
            data=data,
            raw_line=",".join(raw_row),
            errors=errors,
        )

    def _clean_header(self, header: str) -> str:
        """Clean and normalize a header value."""
        # Strip whitespace
        cleaned = header.strip()

        # Remove BOM if present (common in Excel exports)
        if cleaned.startswith("\ufeff"):
            cleaned = cleaned[1:]

        # Replace spaces and special chars with underscores for consistency
        # but preserve original for display
        return cleaned
