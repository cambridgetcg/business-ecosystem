"""
File parsers for data ingestion.

Provides format-agnostic parsing interfaces and concrete implementations
for CSV, Excel, and JSON file formats.
"""

from src.infrastructure.ingestion.parsers.base import (
    BaseFileParser,
    FileFormat,
    FileParseError,
    IFileParser,
    ParsedRow,
    ParseResult,
)
from src.infrastructure.ingestion.parsers.csv_parser import CSVParser
from src.infrastructure.ingestion.parsers.excel_parser import ExcelParser
from src.infrastructure.ingestion.parsers.json_parser import JSONParser

__all__ = [
    # Interfaces and base types
    "BaseFileParser",
    "FileFormat",
    "FileParseError",
    "IFileParser",
    "ParsedRow",
    "ParseResult",
    # Implementations
    "CSVParser",
    "ExcelParser",
    "JSONParser",
]
