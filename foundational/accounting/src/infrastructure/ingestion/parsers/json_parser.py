"""
JSON file parser implementation.

Parses JSON files containing arrays of objects, where each object
represents a row of data to import.

Supported formats:
1. Array of objects: [{"col1": "val1"}, {"col1": "val2"}]
2. Object with data array: {"data": [...], "metadata": {...}}
3. JSON Lines (JSONL): One JSON object per line
"""

import json
from typing import Any, BinaryIO, TextIO

from src.infrastructure.ingestion.parsers.base import (
    BaseFileParser,
    FileFormat,
    FileParseError,
    ParsedRow,
    ParseResult,
)


class JSONParser(BaseFileParser):
    """
    Parser for JSON and JSON Lines files.

    Features:
    - Supports standard JSON arrays
    - Supports JSON Lines format (one object per line)
    - Handles nested objects by flattening with dot notation
    - Preserves data types (numbers, booleans) in metadata
    """

    @property
    def supported_format(self) -> FileFormat:
        return FileFormat.JSON

    @property
    def supported_extensions(self) -> list[str]:
        return [".json", ".jsonl", ".ndjson"]

    def _get_file_mode(self) -> str:
        return "r"

    def _parse_stream(
        self,
        file: BinaryIO | TextIO,
        result: ParseResult,
        encoding: str,
        has_header: bool,  # Ignored for JSON - structure defines columns
        skip_rows: int,
        max_rows: int | None,
        column_mapping: dict[str, str] | None,
    ) -> None:
        """Parse JSON file stream."""
        content = file.read()

        # Try to detect format: JSON array vs JSON Lines
        if isinstance(content, bytes):
            content = content.decode(encoding, errors="replace")

        content = content.strip()

        if content.startswith("[") or content.startswith("{"):
            # Standard JSON
            self._parse_json(content, result, skip_rows, max_rows, column_mapping)
        else:
            # Try JSON Lines
            self._parse_jsonl(content, result, skip_rows, max_rows, column_mapping)

    def _parse_json(
        self,
        content: str,
        result: ParseResult,
        skip_rows: int,
        max_rows: int | None,
        column_mapping: dict[str, str] | None,
    ) -> None:
        """Parse standard JSON format."""
        try:
            data = json.loads(content)
        except json.JSONDecodeError as e:
            result.errors.append(
                FileParseError(
                    row_number=0,
                    column=None,
                    message=f"Invalid JSON: {str(e)}",
                    error_code="INVALID_JSON",
                )
            )
            return

        # Handle different JSON structures
        rows_data: list[dict[str, Any]] = []

        if isinstance(data, list):
            # Array of objects
            rows_data = data
            result.metadata["json_format"] = "array"
        elif isinstance(data, dict):
            # Object with data array - look for common keys
            for key in ["data", "rows", "records", "items", "entries"]:
                if key in data and isinstance(data[key], list):
                    rows_data = data[key]
                    result.metadata["json_format"] = f"object.{key}"
                    result.metadata["root_metadata"] = {
                        k: v for k, v in data.items() if k != key
                    }
                    break
            else:
                # Single object - treat as one row
                rows_data = [data]
                result.metadata["json_format"] = "single_object"
        else:
            result.errors.append(
                FileParseError(
                    row_number=0,
                    column=None,
                    message="JSON must be an array or object",
                    error_code="INVALID_JSON_STRUCTURE",
                )
            )
            return

        # Extract headers from first row
        if rows_data:
            first_row = rows_data[0]
            if isinstance(first_row, dict):
                result.headers = list(self._flatten_dict(first_row).keys())

        # Parse rows
        self._process_rows(rows_data, result, skip_rows, max_rows, column_mapping)

    def _parse_jsonl(
        self,
        content: str,
        result: ParseResult,
        skip_rows: int,
        max_rows: int | None,
        column_mapping: dict[str, str] | None,
    ) -> None:
        """Parse JSON Lines format (one JSON object per line)."""
        result.metadata["json_format"] = "jsonl"

        lines = content.split("\n")
        rows_data: list[dict[str, Any]] = []

        for line_num, line in enumerate(lines, start=1):
            line = line.strip()
            if not line:
                continue

            try:
                obj = json.loads(line)
                if isinstance(obj, dict):
                    rows_data.append(obj)
                else:
                    result.errors.append(
                        FileParseError(
                            row_number=line_num,
                            column=None,
                            message="JSONL line must be a JSON object",
                            raw_value=line[:100],
                            error_code="INVALID_JSONL_LINE",
                        )
                    )
            except json.JSONDecodeError as e:
                result.errors.append(
                    FileParseError(
                        row_number=line_num,
                        column=None,
                        message=f"Invalid JSON on line: {str(e)}",
                        raw_value=line[:100],
                        error_code="INVALID_JSON_LINE",
                    )
                )

        # Extract headers from first valid row
        if rows_data:
            result.headers = list(self._flatten_dict(rows_data[0]).keys())

        self._process_rows(rows_data, result, skip_rows, max_rows, column_mapping)

    def _process_rows(
        self,
        rows_data: list[dict[str, Any]],
        result: ParseResult,
        skip_rows: int,
        max_rows: int | None,
        column_mapping: dict[str, str] | None,
    ) -> None:
        """Process a list of row dictionaries into ParsedRows."""
        rows_parsed = 0

        for idx, row_data in enumerate(rows_data):
            if idx < skip_rows:
                continue

            if max_rows is not None and rows_parsed >= max_rows:
                break

            row_number = idx + 1

            if not isinstance(row_data, dict):
                result.rows.append(
                    ParsedRow(
                        row_number=row_number,
                        data={},
                        errors=[
                            FileParseError(
                                row_number=row_number,
                                column=None,
                                message="Row must be a JSON object",
                                raw_value=str(row_data)[:100],
                                error_code="INVALID_ROW_TYPE",
                            )
                        ],
                    )
                )
                rows_parsed += 1
                continue

            # Flatten nested objects
            flat_data = self._flatten_dict(row_data)

            # Store original types in metadata
            type_info = {k: type(v).__name__ for k, v in flat_data.items()}

            # Convert all values to strings for consistency
            string_data = {
                k: str(v) if v is not None else None
                for k, v in flat_data.items()
            }

            # Apply column mapping
            string_data = self._apply_column_mapping(string_data, column_mapping)

            parsed_row = ParsedRow(
                row_number=row_number,
                data=string_data,
                raw_line=json.dumps(row_data),
                metadata={"original_types": type_info},
            )

            result.rows.append(parsed_row)
            rows_parsed += 1

    def _flatten_dict(
        self,
        d: dict[str, Any],
        parent_key: str = "",
        sep: str = ".",
    ) -> dict[str, Any]:
        """
        Flatten a nested dictionary using dot notation.

        Example:
            {"a": {"b": 1}} -> {"a.b": 1}
        """
        items: list[tuple[str, Any]] = []

        for k, v in d.items():
            new_key = f"{parent_key}{sep}{k}" if parent_key else k

            if isinstance(v, dict):
                items.extend(self._flatten_dict(v, new_key, sep).items())
            elif isinstance(v, list):
                # For lists, store as JSON string
                items.append((new_key, json.dumps(v)))
            else:
                items.append((new_key, v))

        return dict(items)
