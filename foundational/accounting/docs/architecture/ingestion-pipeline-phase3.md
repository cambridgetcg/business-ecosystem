# Ingestion Pipeline - Phase 3: Application Layer (CQRS)

## Overview

Phase 3 implements the CQRS (Command Query Responsibility Segregation) application layer
that bridges the API layer with domain services.

**Status**: Complete
**Date**: 2026-01-28

---

## Components Created

### 1. Commands (`src/application/commands/`)

Immutable data containers for write operations.

| Command | Purpose |
|---------|---------|
| `ImportJournalEntriesCommand` | Import journal entries from a file |
| `ImportAccountsCommand` | Import chart of accounts from a file |
| `CancelImportJobCommand` | Cancel a running import job |

**Key Design:**
- Frozen dataclasses (immutable)
- Serializable (bytes instead of file handles)
- Self-validating (`__post_init__` validation)
- Column mapping as tuples (frozen-friendly)

**Usage:**
```python
from src.application.commands import ImportJournalEntriesCommand

command = ImportJournalEntriesCommand(
    file_content=file_bytes,
    file_name="journal_entries.csv",
    initiated_by="user-123",
    validate_only=False,
    default_currency="USD",
)
```

### 2. Queries (`src/application/queries/`)

Immutable data containers for read operations.

| Query | Purpose |
|-------|---------|
| `GetImportJobQuery` | Get single job by ID |
| `GetImportJobByNumberQuery` | Get single job by job number |
| `GetImportJobsQuery` | List jobs with filtering/pagination |
| `GetImportErrorsQuery` | List errors for a job |
| `GetImportStatisticsQuery` | Aggregated import statistics |

**Key Design:**
- Pagination support (page, page_size, offset)
- Filter parameters (status, date range, user)
- Sort options (field, direction)
- Frozen dataclasses

**Usage:**
```python
from src.application.queries import GetImportJobsQuery, ImportJobSortField

query = GetImportJobsQuery(
    target="JOURNAL_ENTRIES",
    status="COMPLETED",
    page=1,
    page_size=20,
    sort_by=ImportJobSortField.CREATED_AT,
)
```

### 3. DTOs (`src/application/dtos/`)

Data Transfer Objects for API responses.

| DTO | Purpose |
|-----|---------|
| `ImportJobDTO` | Serialized import job |
| `ImportErrorDTO` | Serialized import error |
| `ImportResultDTO` | Result of import command |
| `ImportJobListDTO` | Paginated job list |
| `ImportErrorListDTO` | Paginated error list |
| `ImportStatisticsDTO` | Aggregated statistics |
| `PaginationDTO` | Pagination metadata |

**Key Design:**
- Factory methods from domain entities
- ISO format for dates
- Truncation for long values
- Computed fields (progress, success rate)

**Usage:**
```python
from src.application.dtos import ImportJobDTO

# Convert domain entity to DTO
dto = ImportJobDTO.from_entity(import_job, include_errors=True)

# DTO is JSON-serializable
response_data = {
    "id": dto.id,
    "job_number": dto.job_number,
    "status": dto.status,
    # ...
}
```

### 4. Handlers (`src/application/handlers/`)

Execute commands/queries using domain services.

| Handler | Command/Query |
|---------|---------------|
| `ImportJournalEntriesHandler` | `ImportJournalEntriesCommand` |
| `ImportAccountsHandler` | `ImportAccountsCommand` |
| `CancelImportJobHandler` | `CancelImportJobCommand` |
| `GetImportJobHandler` | `GetImportJobQuery`, `GetImportJobByNumberQuery` |
| `GetImportJobsHandler` | `GetImportJobsQuery` |
| `GetImportErrorsHandler` | `GetImportErrorsQuery` |
| `GetImportStatisticsHandler` | `GetImportStatisticsQuery` |

**Key Design:**
- Protocol-based dependencies (testable)
- Single responsibility (one handler per command)
- DTO returns (never expose domain entities)
- Async execution

**Usage:**
```python
from src.application.handlers import ImportJournalEntriesHandler
from src.application.commands import ImportJournalEntriesCommand

# Create handler with dependencies
handler = ImportJournalEntriesHandler(import_service=import_service)

# Execute command
result = await handler.execute(command)

# Result is a DTO
print(f"Job ID: {result.job.id}")
print(f"Imported: {result.job.successful_rows}")
```

---

## Directory Structure

```
src/application/
├── __init__.py           # Exports all components
├── commands/
│   ├── __init__.py
│   └── import_commands.py
├── queries/
│   ├── __init__.py
│   └── import_queries.py
├── handlers/
│   ├── __init__.py
│   ├── import_command_handlers.py
│   └── import_query_handlers.py
└── dtos/
    ├── __init__.py
    └── import_dtos.py
```

---

## CQRS Pattern

### Command Flow

```
API Request
    │
    ▼
┌─────────────────┐
│    Command      │  ← Immutable input data
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Handler      │  ← Executes business logic
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Domain Service  │  ← ImportService
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Repository    │  ← Persistence
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│      DTO        │  ← Serializable response
└─────────────────┘
```

### Query Flow

```
API Request
    │
    ▼
┌─────────────────┐
│     Query       │  ← Filter/pagination params
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Handler      │  ← Retrieves data
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Repository    │  ← Read-only access
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│      DTO        │  ← Serializable response
└─────────────────┘
```

---

## Dependency Injection

Handlers use Protocol-based dependencies for testability:

```python
# Protocol defines the interface
class IImportService(Protocol):
    async def import_journal_entries(
        self, file, file_name: str, initiated_by: str, *, options=None
    ) -> ImportResult: ...

# Handler depends on protocol, not implementation
class ImportJournalEntriesHandler:
    def __init__(self, import_service: IImportService) -> None:
        self._import_service = import_service

# In production: inject real service
handler = ImportJournalEntriesHandler(import_service=ImportService(...))

# In tests: inject mock
handler = ImportJournalEntriesHandler(import_service=MockImportService())
```

---

## API Integration Example

```python
# FastAPI endpoint example
from fastapi import APIRouter, UploadFile, Depends
from src.application import (
    ImportJournalEntriesCommand,
    ImportJournalEntriesHandler,
    ImportResultDTO,
)

router = APIRouter()

@router.post("/import/journal-entries", response_model=ImportResultDTO)
async def import_journal_entries(
    file: UploadFile,
    handler: ImportJournalEntriesHandler = Depends(get_handler),
    current_user: str = Depends(get_current_user),
):
    # Create command from request
    command = ImportJournalEntriesCommand(
        file_content=await file.read(),
        file_name=file.filename,
        initiated_by=current_user,
    )

    # Execute via handler
    result = await handler.execute(command)

    # Return DTO (automatically serialized)
    return result
```

---

## Next Phase

### Phase 4: API Layer

REST endpoints using FastAPI:
- `POST /api/import/journal-entries`
- `POST /api/import/accounts`
- `GET /api/import/jobs`
- `GET /api/import/jobs/{id}`
- `GET /api/import/jobs/{id}/errors`
- `DELETE /api/import/jobs/{id}` (cancel)

---

*This document describes Phase 3 of the ingestion pipeline implementation.*
