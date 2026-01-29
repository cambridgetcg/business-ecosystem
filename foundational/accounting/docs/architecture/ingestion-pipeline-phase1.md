# Ingestion Pipeline - Phase 1: Foundation Layer

## Overview

Phase 1 establishes the infrastructure foundation for the accounting data ingestion pipeline.
This enables batch imports of journal entries, accounts, and source documents from various file formats.

**Status**: Complete
**Date**: 2026-01-28

---

## Components Created

### 1. File Parsers (`src/infrastructure/ingestion/parsers/`)

Format-agnostic file parsing infrastructure.

| File | Purpose |
|------|---------|
| `base.py` | Interfaces: `IFileParser`, `ParsedRow`, `ParseResult`, `FileFormat` |
| `csv_parser.py` | CSV parser with auto-dialect detection |
| `json_parser.py` | JSON and JSON Lines parser with nested object flattening |
| `excel_parser.py` | Excel XLSX parser using openpyxl |

**Key Abstractions:**
- `ParsedRow`: Format-agnostic row representation
- `ParseResult`: Complete parse result with errors and metadata
- `FileParseError`: Row-level error capture

**Usage:**
```python
from src.infrastructure.ingestion.parsers import CSVParser, ParseResult

parser = CSVParser()
result: ParseResult = parser.parse_file("journal_entries.csv")

for row in result.get_valid_rows():
    entry_date = row.get_string("entry_date")
    amount = row.get_decimal("amount")
```

### 2. File Storage (`src/infrastructure/storage/`)

S3-compatible file storage for source documents.

| File | Purpose |
|------|---------|
| `base.py` | Interface: `IFileStorage`, `StoredFile`, `FileMetadata` |
| `s3_adapter.py` | AWS S3 implementation using aioboto3 |

**Key Features:**
- SHA-256 integrity verification
- Pre-signed URLs for temporary access
- Async operations throughout
- Support for custom S3-compatible endpoints (MinIO)

**Usage:**
```python
from src.infrastructure.storage import S3StorageAdapter, UploadRequest

storage = S3StorageAdapter(bucket="source-documents")

request = UploadRequest(
    file=file_stream,
    filename="invoice-001.pdf",
    uploaded_by="user-123",
    folder="invoices",
)
stored = await storage.upload(request)
print(f"Stored at: {stored.key}")
```

### 3. Import Job Tracking (`src/domain/ingestion/`)

Domain entities for tracking batch import operations.

| File | Purpose |
|------|---------|
| `models/import_job.py` | `ImportJob` entity with status, progress, timing |
| `models/import_error.py` | `ImportError` entity for row-level errors |
| `repositories/import_job_repository.py` | Data access layer |

**Import Job Lifecycle:**
```
PENDING → VALIDATING → PROCESSING → COMPLETED
                    ↓
              COMPLETED_WITH_ERRORS
                    ↓
                  FAILED
                    ↓
                CANCELLED
```

**Key Features:**
- Job number generation (IMP-2026-00001)
- Progress tracking (processed/total rows)
- Error aggregation and summary
- Timing metrics

### 4. Event Publishing (`src/infrastructure/messaging/`)

Domain event infrastructure for ecosystem integration.

| File | Purpose |
|------|---------|
| `events.py` | `DomainEvent` base class, accounting events |
| `publisher.py` | `IEventPublisher` interface, implementations |

**Events Defined:**
- `JournalEntryPosted`
- `JournalEntryReversed`
- `FiscalPeriodClosed`
- `AccountCreated`
- `ImportJobCreated`
- `ImportJobCompleted`
- `ImportJobFailed`

**Publishers:**
- `InMemoryEventPublisher`: For testing
- `LoggingEventPublisher`: For debugging
- `CompositeEventPublisher`: For multiple destinations

### 5. Ingestion Exceptions (`src/domain/shared/exceptions.py`)

Extended with ingestion-specific exceptions:
- `ImportError`: Base import exception
- `FileParseError`: File parsing failures
- `ImportValidationError`: Row validation failures
- `ImportBatchError`: Multiple errors in batch
- `ImportJobNotFoundError`: Job not found
- `ImportJobStateError`: Invalid state transition
- `UnsupportedFileFormatError`: Unknown file format

---

## Directory Structure

```
src/
├── infrastructure/
│   ├── ingestion/
│   │   ├── __init__.py
│   │   └── parsers/
│   │       ├── __init__.py
│   │       ├── base.py
│   │       ├── csv_parser.py
│   │       ├── json_parser.py
│   │       └── excel_parser.py
│   ├── storage/
│   │   ├── __init__.py
│   │   ├── base.py
│   │   └── s3_adapter.py
│   └── messaging/
│       ├── __init__.py
│       ├── events.py
│       └── publisher.py
└── domain/
    └── ingestion/
        ├── __init__.py
        ├── models/
        │   ├── __init__.py
        │   ├── import_job.py
        │   └── import_error.py
        ├── repositories/
        │   ├── __init__.py
        │   └── import_job_repository.py
        └── services/
            └── __init__.py
```

---

## Dependencies

**Required (already in pyproject.toml):**
- `aioboto3`: Async S3 operations
- `pydantic`: Data validation
- `sqlalchemy[asyncio]`: Database ORM

**Optional (for Excel support):**
- `openpyxl`: Excel parsing (add to dependencies if needed)

---

## Next Phases

### Phase 2: Domain Services
- `BatchValidator`: Validate batches before import
- `ImportService`: Orchestrate import workflow
- `JournalEntryImportMapper`: Map parsed rows to domain entities

### Phase 3: Application Layer (CQRS)
- `ImportJournalEntriesCommand`
- `ImportAccountsCommand`
- `ImportJournalEntriesHandler`

### Phase 4: API Layer
- `POST /api/import/journal-entries`
- `POST /api/import/accounts`
- `GET /api/import/jobs/{id}`
- `GET /api/import/jobs/{id}/errors`

---

## Design Decisions

### Why Format-Agnostic Parsing?
All parsers produce `ParsedRow` objects, enabling:
- Single validation pipeline for all formats
- Easy addition of new formats
- Consistent error reporting

### Why Row-Level Error Capture?
Instead of failing on first error:
- All rows are processed
- Errors collected per row
- Users see complete picture
- Partial imports possible

### Why S3 for Storage?
- Industry standard for object storage
- Supports compliance (7-year retention)
- SHA-256 hashes verify integrity
- Pre-signed URLs for auditor access

### Why Domain Events?
- Decoupled ecosystem integration
- Audit trail for imports
- Enable real-time notifications
- Support for event-driven architecture

---

*This document describes Phase 1 of the ingestion pipeline implementation.*
