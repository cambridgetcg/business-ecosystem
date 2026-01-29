"""
Application layer - use cases, commands, queries, handlers, and DTOs.

This layer coordinates the application's use cases by:
1. Receiving commands/queries from the API layer
2. Executing business logic via domain services
3. Returning DTOs to the API layer

CQRS Pattern:
- Commands: Write operations (import journal entries, import accounts)
- Queries: Read operations (get job, list jobs, get errors)
- Handlers: Execute commands/queries using domain services
- DTOs: Serialize domain entities for API responses

Research Grounding: docs/architecture/ingestion-pipeline-phase1.md
"""

# Commands
from src.application.commands import (
    ImportJournalEntriesCommand,
    ImportAccountsCommand,
    CancelImportJobCommand,
)

# Queries
from src.application.queries import (
    GetImportJobQuery,
    GetImportJobByNumberQuery,
    GetImportJobsQuery,
    GetImportErrorsQuery,
    GetImportStatisticsQuery,
    ImportJobSortField,
    SortDirection,
)

# Handlers
from src.application.handlers import (
    ImportJournalEntriesHandler,
    ImportAccountsHandler,
    CancelImportJobHandler,
    GetImportJobHandler,
    GetImportJobsHandler,
    GetImportErrorsHandler,
    GetImportStatisticsHandler,
)

# DTOs
from src.application.dtos import (
    ImportJobDTO,
    ImportErrorDTO,
    ImportResultDTO,
    ImportJobListDTO,
    ImportErrorListDTO,
    ImportStatisticsDTO,
    PaginationDTO,
)

__all__ = [
    # Commands
    "ImportJournalEntriesCommand",
    "ImportAccountsCommand",
    "CancelImportJobCommand",
    # Queries
    "GetImportJobQuery",
    "GetImportJobByNumberQuery",
    "GetImportJobsQuery",
    "GetImportErrorsQuery",
    "GetImportStatisticsQuery",
    "ImportJobSortField",
    "SortDirection",
    # Handlers
    "ImportJournalEntriesHandler",
    "ImportAccountsHandler",
    "CancelImportJobHandler",
    "GetImportJobHandler",
    "GetImportJobsHandler",
    "GetImportErrorsHandler",
    "GetImportStatisticsHandler",
    # DTOs
    "ImportJobDTO",
    "ImportErrorDTO",
    "ImportResultDTO",
    "ImportJobListDTO",
    "ImportErrorListDTO",
    "ImportStatisticsDTO",
    "PaginationDTO",
]
