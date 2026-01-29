"""
Ingestion domain services - orchestrate import operations.

The ImportService coordinates the complete import workflow:
1. Create import job record (audit trail)
2. Parse the source file
3. Validate all rows
4. Map to domain entities
5. Persist entities
6. Record errors
"""

from src.domain.ingestion.services.import_service import (
    ImportService,
    ImportResult,
    ImportOptions,
)
from src.domain.ingestion.services.adapters import (
    FiscalPeriodResolverAdapter,
    EntryNumberGeneratorAdapter,
    AccountResolverAdapter,
)

__all__ = [
    "ImportService",
    "ImportResult",
    "ImportOptions",
    "FiscalPeriodResolverAdapter",
    "EntryNumberGeneratorAdapter",
    "AccountResolverAdapter",
]
