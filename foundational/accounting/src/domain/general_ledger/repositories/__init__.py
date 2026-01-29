"""
General Ledger repositories.

Repositories provide data access for domain entities.
They abstract the persistence layer from the domain.
"""

from src.domain.general_ledger.repositories.journal_entry_repository import (
    JournalEntryRepository,
)
from src.domain.general_ledger.repositories.fiscal_period_repository import (
    FiscalPeriodRepository,
)

__all__ = ["JournalEntryRepository", "FiscalPeriodRepository"]
