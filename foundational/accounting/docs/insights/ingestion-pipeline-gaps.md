# Ingestion Pipeline - Gap Analysis & Insights

**Date**: 2026-01-28
**Status**: Review Complete
**Scope**: All 4 Phases of Ingestion Pipeline

---

## Executive Summary

The ingestion pipeline has a well-designed architecture but contains **critical implementation gaps** that prevent production deployment. The issues span across all layers with the most severe problems in:

1. **Protocol/Interface Mismatches** - Code will crash at runtime
2. **Missing Security Controls** - No authentication, no rate limiting
3. **Incomplete Error Handling** - Silent failures, lost error context
4. **Broken Repository Contracts** - API calls methods that don't exist

**Overall Completion**: ~70% structurally, ~40% functionally

---

## Critical Issues by Severity

### CRITICAL (Will Crash at Runtime)

| Issue | Location | Impact | Status |
|-------|----------|--------|--------|
| `field` vs `column_name` mismatch | `import_service.py:664,681` | AttributeError when recording validation errors | **FIXED** |
| Variable name collision in sort | `account_mapper.py:393-394` | AttributeError in hierarchical import | **FIXED** |
| Missing `list_all()` method | `imports.py:358` calls method not in `ImportJobRepository` | GET /import/jobs crashes | **FIXED** |
| Missing `count()` method | `imports.py:367` calls method not in `ImportJobRepository` | Pagination breaks | **FIXED** |
| Protocol mismatch | `import_service.py:379` passes `AccountRepository` as `IAccountResolver` | Method not found | **FIXED** |
| get_import_service() | `imports.py:151-156` | POST endpoints return 501 | Pending (needs full wiring) |

### HIGH (Security/Data Integrity)

| Issue | Location | Impact | Status |
|-------|----------|--------|--------|
| No authentication | `imports.py:211,295,476` | Anyone can upload/view/cancel jobs | Pending |
| No file size limits | `imports.py:231` | DOS via large file uploads | Pending |
| No rate limiting | `app.py` | Abuse via spam requests | Pending |
| Job number not atomic | `import_job_repository.py:135-147` | Race condition on concurrent imports | Pending |
| No transaction management | `import_service.py:391-404` | Partial imports without rollback | Pending |
| Errors not recorded | `account_mapper.py:189-191` | Silent failures in batch mapping | **FIXED** |

### MEDIUM (Quality/Reliability)

| Issue | Location | Impact |
|-------|----------|--------|
| Timezone inconsistency | `import_job.py:332`, `repository.py:270` | Duration calculation errors |
| Statistics handler stub | `import_query_handlers.py:291-315` | Returns hardcoded zeros |
| Cascading failures | `journal_entry_mapper.py:355` | One bad account fails entire entry |
| Decimal rounding silent | `field_validators.py:273` | Precision loss without warning |
| No circular dependency check | `account_mapper.py:352-406` | Infinite loop possible |

---

## Phase-by-Phase Analysis

### Phase 1: Foundation Infrastructure

**Completion**: 70%

**What Works**:
- ImportJob model with state machine (PENDING → COMPLETED)
- ImportError tracking with severity levels
- File parsers (CSV, JSON, Excel)
- Repository base structure

**Critical Gaps**:

1. **ImportJob State Transitions Unsafe** (`import_job.py:318-376`)
   - Methods like `start_processing()` don't validate current state
   - Can transition from PENDING directly to COMPLETED
   - Fix: Add state guards

2. **Job Number Race Condition** (`import_job_repository.py:135-147`)
   ```python
   # Current: SELECT MAX() then increment - not atomic
   max_number = result.scalar_one_or_none()
   seq = int(max_number.split("-")[-1]) + 1
   ```
   - Fix: Use database sequence or SELECT FOR UPDATE

3. **Error Recording Broken** (`import_service.py:664`)
   ```python
   # Bug: ImportError has 'column_name', not 'field'
   error = ImportErrorEntity(field=field, ...)  # Wrong!
   ```
   - Fix: Change `field=field` to `column_name=field`

**Integration Issues**:
- `resolve_account_id()` vs `get_account_id_by_code()` - inconsistent naming
- Parsing errors not recorded in database (only returned in memory)

---

### Phase 2: Domain Services

**Completion**: 75%

**What Works**:
- Field validators with good format support
- BatchValidator with field specifications
- JournalEntryMapper grouping logic
- AccountMapper hierarchy sorting

**Critical Gaps**:

1. **AccountMapper Variable Collision** (`account_mapper.py:393-394`)
   ```python
   for row in rows:
       c = code.validated_data.get("code", "")  # 'code' is undefined!
   ```
   - Should be `row.validated_data`
   - Fix: Rename loop variable

2. **Silent Error Swallowing** (`account_mapper.py:189-191`)
   ```python
   if mapping_result:
       result.accounts.append(mapping_result)
   else:
       result.failed += 1  # Error NOT added to result.errors!
   ```
   - Duplicates/failures return None but errors aren't recorded
   - Fix: Add error to result.errors when returning None

3. **Protocol Not Implemented** (`import_service.py:379`)
   ```python
   # Passes AccountRepository but mapper expects IAccountResolver
   account_resolver=self._account_repo  # Type mismatch!
   ```
   - AccountRepository missing `resolve_account_id()` method
   - Fix: Add method or create adapter

4. **No Transaction Boundaries** (`import_service.py:391-404`)
   ```python
   for entry in mapping_result.entries:
       await self._je_repo.add(entry)  # Each entry separate commit
   ```
   - If 10th entry fails, first 9 already committed
   - Fix: Wrap in transaction context

**Edge Cases Not Handled**:
- Multi-currency entries (first row's currency used for all)
- Circular parent references in account hierarchy
- Date ambiguity (01/02/2026 - is it Jan 2 or Feb 1?)

---

### Phase 3: Application Layer (CQRS)

**Completion**: 93%

**What Works**:
- Frozen dataclasses for immutability
- Self-validating commands/queries
- DTO factory methods from entities
- Protocol-based handler dependencies
- Pagination support

**Critical Gaps**:

1. **Statistics Handler Stub** (`import_query_handlers.py:291-315`)
   ```python
   async def execute(self, query: GetImportStatisticsQuery) -> ImportStatisticsDTO:
       # TODO: Implement actual statistics aggregation
       return ImportStatisticsDTO(
           total_jobs=0,  # Hardcoded!
           ...
       )
   ```
   - Returns zeros instead of actual data
   - Fix: Implement repository aggregation

2. **Missing Repository Protocol Method**
   - `IImportJobQueryRepository` doesn't define `get_statistics()`
   - Handler expects method that doesn't exist
   - Fix: Add to protocol and implement

3. **No Factory for ImportStatisticsDTO** (`import_dtos.py:295-323`)
   - Other DTOs have `from_entity()` factory
   - ImportStatisticsDTO has no factory method
   - Fix: Add `from_statistics()` class method

4. **Generic Exception Handling** (`import_command_handlers.py:128-131`)
   ```python
   except Exception as e:
       raise  # No logging, no context
   ```
   - Fix: Log error, wrap in domain exception

**Minor Issues**:
- Inconsistent null handling in DTOs (`created_at` returns "" vs None)
- No error response DTOs for failed commands

---

### Phase 4: API Layer

**Completion**: 30% functional

**What Works**:
- Endpoint structure defined
- Pydantic response models
- OpenAPI documentation
- Error handlers for domain exceptions

**Critical Gaps**:

1. **POST Endpoints Non-Functional** (`imports.py:240-243`)
   ```python
   # get_import_service() raises NotImplementedError
   raise HTTPException(status_code=501, detail="...")
   ```
   - Service dependencies not wired
   - Fix: Implement dependency injection

2. **Missing Repository Methods** (`imports.py:358,367`)
   ```python
   jobs = await repo.list_all(...)  # Method doesn't exist!
   total = await repo.count(...)    # Method doesn't exist!
   ```
   - ImportJobRepository has no `list_all()` or `count()`
   - Fix: Add methods to repository

3. **No Authentication** (`imports.py:211`)
   ```python
   # current_user: str = Depends(get_current_user),  # TODO
   ```
   - All endpoints publicly accessible
   - Fix: Implement auth dependency

4. **No File Size Limits** (`imports.py:231`)
   ```python
   file_content = await file.read()  # Unlimited!
   ```
   - Can upload GB-sized files
   - Fix: Add size validation before read

5. **No Rate Limiting** (`app.py`)
   - No middleware for request throttling
   - Fix: Add SlowAPI or similar

---

## Repository Method Gaps

### ImportJobRepository Needs:

| Method | Status | Called By |
|--------|--------|-----------|
| `get_by_id(id)` | ✅ Exists | API, Handlers |
| `save(job)` | ✅ Exists | Service |
| `add_error(error)` | ✅ Exists | Service |
| `list_all(target, status, user, limit, offset)` | ❌ MISSING | API (line 358) |
| `count(target, status, user)` | ❌ MISSING | API (line 367) |
| `get_statistics(date_range, target)` | ❌ MISSING | Statistics Handler |

### Missing Repositories:

| Repository | Status | Needed For |
|------------|--------|------------|
| `ImportErrorRepository` | ❌ MISSING | Service error persistence |
| `FiscalPeriodResolver` | ❌ MISSING | Date→Period mapping |
| `EntryNumberGenerator` | ❌ MISSING | Unique entry numbers |

---

## Protocol Compliance Issues

```
IAccountResolver (defined in journal_entry_mapper.py:127)
    └── resolve_account_id(code: str) -> str | None

AccountRepository (defined in chart_of_accounts/)
    └── get_account_id_by_code(code: str) -> str | None  ← Different method name!
    └── exists_by_code(code: str) -> bool

ImportService passes AccountRepository where IAccountResolver expected
    └── Will fail: AccountRepository.resolve_account_id() doesn't exist
```

**Fix Options**:
1. Add `resolve_account_id()` as alias in AccountRepository
2. Create adapter that wraps AccountRepository
3. Rename protocol method to match existing implementation

---

## Security Gaps Summary

| Control | Status | Risk | Recommendation |
|---------|--------|------|----------------|
| Authentication | ❌ None | CRITICAL | Implement JWT/OAuth |
| Authorization | ❌ None | CRITICAL | Add user→job ownership |
| File Size Limit | ❌ None | HIGH | Max 100MB default |
| Rate Limiting | ❌ None | HIGH | 100 req/min per user |
| CORS | ⚠️ Permissive | MEDIUM | Restrict to known origins |
| HTTPS Redirect | ❌ None | MEDIUM | Add in production |
| File Validation | ⚠️ Extension only | MEDIUM | Validate content type |

---

## Recommended Fix Priority

### Immediate (Blocking)

1. Fix `field` → `column_name` in error recording
2. Fix variable collision in account_mapper.py:393
3. Add `list_all()` and `count()` to ImportJobRepository
4. Wire ImportService dependencies

### Before Testing

5. Add `resolve_account_id()` to AccountRepository
6. Add transaction boundaries in import_service
7. Record errors in account_mapper.map_batch()
8. Complete statistics handler implementation

### Before Production

9. Implement authentication
10. Add file size limits
11. Add rate limiting
12. Fix timezone handling
13. Add atomic job number generation

---

## Patterns to Preserve

These patterns are well-implemented and should be maintained:

1. **Frozen Dataclasses** - Commands/Queries/DTOs are immutable
2. **Protocol Dependencies** - Handlers use protocols, not implementations
3. **DTO Factory Methods** - `from_entity()` pattern for serialization
4. **Result Objects** - `FieldValidationResult[T]` instead of exceptions
5. **Self-Validation** - `__post_init__` validation in commands
6. **Pagination Abstraction** - Consistent page/page_size/offset pattern

---

## Test Coverage Gaps

No tests found for:
- Field validators
- Batch validator
- Journal entry mapper
- Account mapper
- Import service
- CQRS handlers
- API endpoints

**Recommendation**: Start with integration tests for happy path, then add unit tests for edge cases.

---

---

## Established Patterns to Follow

Based on analysis of `posting_service.py`, the following patterns should be applied to fix the ingestion pipeline:

### PostingService Pattern (Reference)

Location: `src/domain/general_ledger/services/posting_service.py`

**Protocol-Based Dependencies**:
```python
# PostingService uses protocol dependencies in constructor
def __init__(
    self,
    journal_entry_repository: JournalEntryRepository,  # Protocol
    fiscal_period_repository: FiscalPeriodRepository,   # Protocol
    account_repository: AccountRepository,              # Protocol
    balance_validator: BalanceValidator | None = None,
) -> None:
```

**Result Objects**:
```python
@dataclass
class PostingResult:
    success: bool
    entry: JournalEntry
    posted_at: datetime | None = None
    error_message: str | None = None
```

**Step-by-Step Validation**:
1. Validate input (balance check)
2. Verify fiscal period exists and allows posting
3. Verify all accounts exist
4. Update state (entry.status = POSTED)
5. Save entry
6. Update related data (balances, period stats)
7. Return result

**Domain Exception Usage**:
- `EntityNotFoundError` for missing entities
- `PeriodClosedError` for closed periods
- `InvariantViolationError` for business rule violations

### Apply to ImportService

The ImportService should follow this same pattern:

1. **Validate dependencies in constructor** (not at import time)
2. **Return ImportResult consistently** (not raise + catch internally)
3. **Step-by-step workflow with clear failure points**
4. **Use domain exceptions, not generic ValueError**

---

## Missing Repository Methods (Specific Fix)

### ImportJobRepository Needs These Methods

```python
# Add to import_job_repository.py

async def list_all(
    self,
    target: ImportTarget | None = None,
    status: ImportJobStatus | None = None,
    initiated_by: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> Sequence[ImportJob]:
    """List jobs with optional filtering."""
    stmt = select(ImportJob)

    if target:
        stmt = stmt.where(ImportJob.target == target)
    if status:
        stmt = stmt.where(ImportJob.status == status)
    if initiated_by:
        stmt = stmt.where(ImportJob.initiated_by == initiated_by)

    stmt = (
        stmt
        .order_by(ImportJob.created_at.desc())
        .limit(limit)
        .offset(offset)
    )

    result = await self.session.execute(stmt)
    return result.scalars().all()

async def count(
    self,
    target: ImportTarget | None = None,
    status: ImportJobStatus | None = None,
    initiated_by: str | None = None,
) -> int:
    """Count jobs with optional filtering."""
    stmt = select(func.count(ImportJob.id))

    if target:
        stmt = stmt.where(ImportJob.target == target)
    if status:
        stmt = stmt.where(ImportJob.status == status)
    if initiated_by:
        stmt = stmt.where(ImportJob.initiated_by == initiated_by)

    result = await self.session.execute(stmt)
    return result.scalar_one()
```

### AccountRepository Needs Protocol Compliance

Add to existing AccountRepository to satisfy `IAccountResolver`:

```python
async def resolve_account_id(self, code: str) -> str | None:
    """Resolve account code to account ID (alias for get_account_id_by_code)."""
    return await self.get_account_id_by_code(code)
```

---

## Fix Summary (Code Changes Applied)

### File: `src/domain/ingestion/services/import_service.py` - **FIXED**

- Changed `field=field` to `column_name=field` in `_record_error()`
- Changed `message=message` to `error_message=message`
- Updated all call sites to use new parameter names

### File: `src/domain/ingestion/mappers/account_mapper.py` - **FIXED**

- Fixed variable collision: `code.validated_data` → `row.validated_data`
- Refactored `_map_single_account()` to return `tuple[Account | None, AccountMappingError | None]`
- Added error recording for duplicate accounts (existing and in-batch)
- Added error recording for parent resolution failures
- Updated `map_single_row()` return type to match
- Updated `map_with_hierarchy()` to record all errors properly

### File: `src/domain/ingestion/repositories/import_job_repository.py` - **FIXED**

- Added `list_all()` method with optional filtering (target, status, initiated_by) and pagination
- Added `count()` method with same filtering options

### File: `src/domain/chart_of_accounts/repositories/account_repository.py` - **FIXED**

- Added `account_exists()` method (alias for `exists_by_code()`)
- Added `get_account_id_by_code()` method for ID-only lookup
- Added `resolve_account_id()` method (alias for protocol compliance)

## Remaining Work

### File: `src/api/rest/imports.py`

**Line 151-156**: Wire actual service dependencies (requires infrastructure work)

---

*This document should be updated as gaps are addressed.*
