"""
Ingestion domain - batch import tracking and management.

This bounded context handles:
- Import job lifecycle management
- Batch validation (field + row level)
- Entity mapping (parsed rows to domain entities)
- Import orchestration service
- Error aggregation and reporting
- Import audit trail

Research Grounding: docs/gaps/data-ingestion-assessment.md

Phase 2 Components:
- Validators: Field-level and batch validation
- Mappers: Convert validated rows to JournalEntry/Account entities
- Services: ImportService orchestrates the complete workflow
"""

# Models
from src.domain.ingestion.models.import_job import (
    ImportJob,
    ImportJobStatus,
    ImportTarget,
)
from src.domain.ingestion.models.import_error import (
    ImportError,
    ImportErrorSeverity,
)

# Validators
from src.domain.ingestion.validators import (
    FieldValidationError,
    FieldValidationResult,
    BatchValidationResult,
    BatchValidator,
    RowValidationResult,
    validate_date,
    validate_decimal,
    validate_account_code,
    validate_entry_type,
    validate_required,
    validate_currency_code,
    validate_string_length,
)

# Mappers
from src.domain.ingestion.mappers import (
    JournalEntryMapper,
    JournalEntryMappingResult,
    JournalEntryGroupResult,
    AccountMapper,
    AccountMappingResult,
)

# Services
from src.domain.ingestion.services import (
    ImportService,
    ImportResult,
    ImportOptions,
)

__all__ = [
    # Models
    "ImportError",
    "ImportErrorSeverity",
    "ImportJob",
    "ImportJobStatus",
    "ImportTarget",
    # Validators
    "FieldValidationError",
    "FieldValidationResult",
    "BatchValidationResult",
    "BatchValidator",
    "RowValidationResult",
    "validate_date",
    "validate_decimal",
    "validate_account_code",
    "validate_entry_type",
    "validate_required",
    "validate_currency_code",
    "validate_string_length",
    # Mappers
    "JournalEntryMapper",
    "JournalEntryMappingResult",
    "JournalEntryGroupResult",
    "AccountMapper",
    "AccountMappingResult",
    # Services
    "ImportService",
    "ImportResult",
    "ImportOptions",
]
