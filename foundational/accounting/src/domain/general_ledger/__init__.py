"""
General Ledger bounded context.

The General Ledger is the core accounting domain responsible for:
- Recording journal entries (immutable once posted)
- Managing fiscal periods (open/closed status)
- Enforcing the fundamental accounting equation: Assets = Liabilities + Equity
- Maintaining the invariant: Debits = Credits for every entry

Key Invariants:
1. Posted journal entries are IMMUTABLE - corrections via reversing entries only
2. All entries must balance: sum(debits) == sum(credits)
3. Entries cannot be posted to closed periods
4. Every entry must have an audit trail (who, what, when, why)
"""

from src.domain.general_ledger.models.posting_status import PostingStatus
from src.domain.general_ledger.models.journal_entry import JournalEntry
from src.domain.general_ledger.models.journal_entry_line import JournalEntryLine
from src.domain.general_ledger.models.fiscal_period_entity import (
    FiscalPeriodEntity,
    PeriodStatus,
)

__all__ = [
    "PostingStatus",
    "JournalEntry",
    "JournalEntryLine",
    "FiscalPeriodEntity",
    "PeriodStatus",
]
