"""
Ingestion infrastructure - file parsing, validation, and batch processing.

This module provides the technical foundation for data ingestion:
- File parsers (CSV, Excel, JSON)
- Import job tracking
- Validation pipelines
- Error handling and reporting

Research Grounding: docs/gaps/data-ingestion-assessment.md
"""

from src.infrastructure.ingestion.parsers import (
    FileFormat,
    FileParseError,
    IFileParser,
    ParsedRow,
    ParseResult,
)

__all__ = [
    "FileFormat",
    "FileParseError",
    "IFileParser",
    "ParsedRow",
    "ParseResult",
]
