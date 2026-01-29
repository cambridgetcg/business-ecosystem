"""
REST API endpoints using FastAPI.

Routers:
- accounts: Chart of accounts management
- imports: Data import operations (journal entries, accounts)
- journal_entries: Journal entry management and posting
"""

from src.api.rest.accounts import router as accounts_router
from src.api.rest.imports import router as imports_router
from src.api.rest.journal_entries import router as journal_entries_router

__all__ = [
    "accounts_router",
    "imports_router",
    "journal_entries_router",
]
