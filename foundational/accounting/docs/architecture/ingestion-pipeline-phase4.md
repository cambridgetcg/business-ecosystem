# Ingestion Pipeline - Phase 4: API Layer

## Overview

Phase 4 implements the REST API endpoints using FastAPI for the ingestion pipeline.
These endpoints expose the CQRS commands and queries from Phase 3 to external clients.

**Status**: Complete
**Date**: 2026-01-28

---

## Endpoints Implemented

### Import Operations

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| POST | `/api/import/journal-entries` | Upload and import journal entries | 202 Accepted |
| POST | `/api/import/accounts` | Upload and import chart of accounts | 202 Accepted |
| GET | `/api/import/jobs` | List import jobs with filtering | 200 OK |
| GET | `/api/import/jobs/{id}` | Get import job details | 200 OK |
| GET | `/api/import/jobs/{id}/errors` | Get errors for an import job | 200 OK |
| DELETE | `/api/import/jobs/{id}` | Cancel a running import job | 204 No Content |

---

## API Details

### POST /api/import/journal-entries

Upload a file to import journal entries.

**Request:**
- Content-Type: `multipart/form-data`
- Body:
  - `file`: CSV, Excel, or JSON file (required)
  - `skip_rows`: Number of rows to skip after header (default: 0)
  - `validate_only`: Validate without importing (default: false)
  - `default_currency`: Default currency code (default: "USD")

**Response (202 Accepted):**
```json
{
  "success": true,
  "job": {
    "id": "01HQ...",
    "job_number": "IMP-2026-00001",
    "target": "JOURNAL_ENTRIES",
    "status": "PROCESSING",
    "file_name": "journal_entries.csv",
    "total_rows": 100,
    "processed_rows": 0,
    "successful_rows": 0,
    "failed_rows": 0,
    "progress_percent": 0.0
  },
  "message": "Import started"
}
```

**Required CSV Columns:**
- `entry_date`: Date (YYYY-MM-DD, MM/DD/YYYY, etc.)
- `description`: Entry description
- `account_code`: Account code
- `entry_type`: DEBIT or CREDIT (or D/C, DR/CR)
- `amount`: Decimal amount

**Optional Columns:**
- `currency_code`: ISO 4217 currency code
- `line_description`: Line-level description
- `source_document`: Reference to source document

### POST /api/import/accounts

Upload a file to import chart of accounts.

**Request:**
- Same structure as journal entries

**Required CSV Columns:**
- `code`: Unique account code
- `name`: Account name
- `account_type`: ASSET, LIABILITY, EQUITY, REVENUE, or EXPENSE

**Optional Columns:**
- `description`: Account description
- `parent_code`: Parent account code for hierarchy
- `currency_code`: Default currency
- `is_header`: TRUE/FALSE for header accounts

### GET /api/import/jobs

List import jobs with filtering and pagination.

**Query Parameters:**
- `target`: Filter by JOURNAL_ENTRIES or ACCOUNTS
- `status`: Filter by PENDING, PROCESSING, COMPLETED, FAILED
- `initiated_by`: Filter by user ID
- `page`: Page number (default: 1)
- `page_size`: Items per page (default: 20, max: 100)

**Response:**
```json
{
  "jobs": [...],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total_items": 42,
    "total_pages": 3,
    "has_next": true,
    "has_previous": false
  }
}
```

### GET /api/import/jobs/{id}

Get details of a specific import job.

**Query Parameters:**
- `include_errors`: Include error details (default: false)

**Response:**
```json
{
  "id": "01HQ...",
  "job_number": "IMP-2026-00001",
  "target": "JOURNAL_ENTRIES",
  "status": "COMPLETED_WITH_ERRORS",
  "file_name": "entries.csv",
  "total_rows": 100,
  "processed_rows": 100,
  "successful_rows": 95,
  "failed_rows": 5,
  "progress_percent": 100.0,
  "success_rate": 95.0,
  "started_at": "2026-01-28T10:00:00Z",
  "completed_at": "2026-01-28T10:00:15Z",
  "duration_seconds": 15.0,
  "result_message": "Completed with 95 successful, 5 failed rows",
  "errors": []
}
```

### GET /api/import/jobs/{id}/errors

Get errors for an import job with filtering and pagination.

**Query Parameters:**
- `severity`: Filter by INFO, WARNING, ERROR, CRITICAL
- `error_code`: Filter by error code
- `page`: Page number (default: 1)
- `page_size`: Items per page (default: 50, max: 500)

**Response:**
```json
{
  "job_id": "01HQ...",
  "errors": [
    {
      "id": "01HQ...",
      "row_number": 15,
      "column_name": "amount",
      "error_code": "INVALID_NUMBER",
      "error_message": "Invalid number format for 'amount'",
      "raw_value": "abc",
      "severity": "ERROR",
      "suggested_fix": null
    }
  ],
  "pagination": {...}
}
```

### DELETE /api/import/jobs/{id}

Cancel a running import job.

**Query Parameters:**
- `reason`: Optional cancellation reason

**Response:** 204 No Content

**Error Responses:**
- 404: Job not found
- 409: Job cannot be cancelled (already completed/failed)

---

## File Structure

```
src/api/rest/
├── __init__.py     # Exports routers
├── app.py          # FastAPI app factory (updated)
├── accounts.py     # Account endpoints (existing)
└── imports.py      # Import endpoints (NEW)
```

---

## Pydantic Models

### Response Models

| Model | Purpose |
|-------|---------|
| `ImportJobResponse` | Full import job details |
| `ImportErrorResponse` | Import error details |
| `ImportResultResponse` | Result of import command |
| `ImportJobListResponse` | Paginated job list |
| `ImportErrorListResponse` | Paginated error list |
| `PaginationResponse` | Pagination metadata |

### Request Models

| Model | Purpose |
|-------|---------|
| `ImportOptionsRequest` | Optional import parameters |

---

## Error Handling

| HTTP Status | Condition |
|-------------|-----------|
| 400 Bad Request | Invalid file, missing filename, unsupported format |
| 404 Not Found | Job not found |
| 409 Conflict | Cannot cancel completed/failed job |
| 422 Unprocessable Entity | Domain validation error |
| 501 Not Implemented | Service not yet wired (temporary) |

---

## Integration Notes

### Current State

The API layer is complete but the import service dependency injection is **not yet wired**.
The POST endpoints return 501 until the following are implemented:

1. `ImportJobRepository` persistence methods
2. `ImportErrorRepository` persistence methods
3. `JournalEntryRepository.add_batch()`
4. `AccountRepository.add_batch()`
5. `FiscalPeriodResolver` implementation
6. `EntryNumberGenerator` implementation

### Wiring Example

```python
# In a real implementation, the dependency would be:
async def get_import_service(
    session: AsyncSession = Depends(get_session),
) -> ImportService:
    return ImportService(
        job_repository=ImportJobRepository(session),
        error_repository=ImportErrorRepository(session),
        journal_entry_repository=JournalEntryRepository(session),
        account_repository=AccountRepository(session),
        fiscal_period_resolver=FiscalPeriodService(session),
        entry_number_generator=SequenceService(session),
    )
```

### Query Endpoints

The GET and DELETE endpoints **are functional** as they only require:
- `ImportJobRepository.get_by_id()`
- `ImportJobRepository.list_all()`
- `ImportJobRepository.count()`
- `ImportJobRepository.save()`

These methods are defined in the repository from Phase 1.

---

## OpenAPI Documentation

With the app running, documentation is available at:
- Swagger UI: `/api/docs`
- ReDoc: `/api/redoc`
- OpenAPI JSON: `/api/openapi.json`

---

## Next Steps

### To Complete Import Functionality:

1. **Implement repository persistence** for ImportJob and ImportError
2. **Wire up ImportService** with all dependencies
3. **Add authentication** (currently `current_user` is commented out)
4. **Add rate limiting** for import endpoints
5. **Add file size limits** (currently unlimited)
6. **Add async job processing** (background tasks for large files)

### Future Enhancements:

- WebSocket endpoint for real-time progress updates
- Batch import with multiple files
- Import templates/presets
- Import history and analytics

---

*This document describes Phase 4 of the ingestion pipeline implementation.*
