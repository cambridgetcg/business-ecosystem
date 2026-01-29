# Ingestion Pipeline - Phase 2: Domain Services

## Overview

Phase 2 builds the domain services layer on top of the Phase 1 infrastructure.
This enables complete batch import workflows for journal entries and accounts.

**Status**: Complete
**Date**: 2026-01-28

---

## Components Created

### 1. Field Validators (`src/domain/ingestion/validators/field_validators.py`)

Deterministic field-level validation functions.

| Validator | Purpose |
|-----------|---------|
| `validate_required` | Ensures field has non-empty value |
| `validate_date` | Parses dates in multiple formats (ISO, US, EU) |
| `validate_decimal` | Parses currency/money values with symbol handling |
| `validate_account_code` | Validates account code format |
| `validate_entry_type` | Validates DEBIT/CREDIT (multiple representations) |
| `validate_account_type` | Validates ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE |
| `validate_currency_code` | Validates ISO 4217 currency codes |
| `validate_string_length` | Validates string with min/max length |

**Key Abstractions:**
- `FieldValidationResult[T]`: Either success with value or failure with error
- `FieldValidationError`: Structured error with field, message, code

**Usage:**
```python
from src.domain.ingestion.validators import validate_date, validate_decimal

result = validate_date("2026-01-28", "entry_date")
if result.is_valid:
    entry_date = result.value  # date object

result = validate_decimal("$1,234.56", "amount")
if result.is_valid:
    amount = result.value  # Decimal("1234.56")
```

### 2. Batch Validator (`src/domain/ingestion/validators/batch_validator.py`)

Configurable batch validation for import rows.

**Key Abstractions:**
- `FieldSpec`: Defines source→target mapping with validator
- `BatchValidator`: Configurable validator with field specs
- `RowValidationResult`: Result for single row
- `BatchValidationResult`: Aggregated results for batch

**Pre-configured Validators:**
- `create_journal_entry_validator()`: For journal entry imports
- `create_account_validator()`: For chart of accounts imports

**Usage:**
```python
from src.domain.ingestion.validators.batch_validator import (
    BatchValidator,
    FieldSpec,
    create_journal_entry_validator,
)
from src.domain.ingestion.validators.field_validators import validate_date

# Option 1: Use pre-configured
validator = create_journal_entry_validator()

# Option 2: Configure custom
validator = BatchValidator()
validator.add_field(FieldSpec(
    source_column="date",
    target_field="entry_date",
    validator=validate_date,
    required=True,
))

result = validator.validate_batch(parsed_rows)
for row in result.get_valid_rows():
    process(row.validated_data)
```

### 3. Import Mappers (`src/domain/ingestion/mappers/`)

Convert validated rows to domain entities.

| File | Purpose |
|------|---------|
| `journal_entry_mapper.py` | Maps rows to JournalEntry + JournalEntryLine |
| `account_mapper.py` | Maps rows to Account entities |

**Journal Entry Mapper:**
- Groups rows by entry_date + description (or custom key)
- Resolves account codes to IDs
- Resolves dates to fiscal periods
- Validates entries balance (debits = credits)
- Generates entry numbers

**Account Mapper:**
- Creates Account entities from validated rows
- Resolves parent_code to parent_id
- Supports hierarchical import (parents before children)
- Detects duplicate codes

**Usage:**
```python
from src.domain.ingestion.mappers import JournalEntryMapper

mapper = JournalEntryMapper(
    account_resolver=account_repository,
    fiscal_period_resolver=period_service,
    entry_number_generator=sequence_service,
)

result = mapper.map_batch(validation_result)

for entry in result.entries:
    await repository.add(entry)
```

### 4. Import Service (`src/domain/ingestion/services/import_service.py`)

Orchestrates complete import workflow.

**Responsibilities:**
1. Create ImportJob record (audit trail)
2. Parse source file (delegates to parsers)
3. Validate all rows (delegates to BatchValidator)
4. Map to entities (delegates to mappers)
5. Persist entities (delegates to repositories)
6. Record errors (ImportError entities)
7. Update job status

**Key Features:**
- Protocol-based dependencies (testable, loosely coupled)
- Supports validate-only mode
- Configurable options (column mapping, batch size, etc.)
- Full error tracking

**Usage:**
```python
from src.domain.ingestion.services import ImportService, ImportOptions

service = ImportService(
    job_repository=import_job_repo,
    error_repository=import_error_repo,
    journal_entry_repository=je_repo,
    account_repository=account_repo,
    fiscal_period_resolver=period_service,
    entry_number_generator=sequence_service,
)

# Import journal entries
result = await service.import_journal_entries(
    file=csv_file,
    file_name="journal_entries.csv",
    initiated_by="user-123",
    options=ImportOptions(
        validate_only=False,
        default_currency="USD",
    ),
)

if result.success:
    print(f"Imported {result.imported_rows} entries")
else:
    print(f"Failed: {result.errors}")
```

---

## Directory Structure

```
src/domain/ingestion/
├── __init__.py           # Exports all components
├── models/
│   ├── __init__.py
│   ├── import_job.py     # (Phase 1)
│   └── import_error.py   # (Phase 1)
├── repositories/
│   ├── __init__.py
│   └── import_job_repository.py  # (Phase 1)
├── validators/           # NEW in Phase 2
│   ├── __init__.py
│   ├── field_validators.py
│   └── batch_validator.py
├── mappers/              # NEW in Phase 2
│   ├── __init__.py
│   ├── journal_entry_mapper.py
│   └── account_mapper.py
└── services/             # NEW in Phase 2
    ├── __init__.py
    └── import_service.py
```

---

## Import File Formats

### Journal Entry CSV

```csv
entry_date,description,account_code,entry_type,amount,currency_code,line_description,source_document
2026-01-15,Rent Payment,5100,DEBIT,2500.00,USD,January rent,INV-001
2026-01-15,Rent Payment,1000,CREDIT,2500.00,USD,Cash payment,INV-001
```

Required columns: `entry_date`, `description`, `account_code`, `entry_type`, `amount`
Optional: `currency_code`, `line_description`, `source_document`

### Account CSV

```csv
code,name,account_type,description,parent_code,currency_code,is_header
1000,Assets,ASSET,All assets,,USD,TRUE
1100,Current Assets,ASSET,Current assets,1000,USD,TRUE
1110,Cash,ASSET,Cash on hand,1100,USD,FALSE
```

Required columns: `code`, `name`, `account_type`
Optional: `description`, `parent_code`, `currency_code`, `is_header`

---

## Design Decisions

### Why Return Results Instead of Raising Exceptions?

Following the BalanceValidator pattern:
- Enables complete validation of all rows
- Collects all errors for user review
- Allows partial imports (valid rows only)
- Better error reporting

### Why Protocol-Based Dependencies?

Following the PostingService pattern:
- Easy to mock in tests
- Supports dependency injection
- Loose coupling between layers
- Clear interface contracts

### Why Two-Phase Account Import?

Accounts have parent-child relationships:
1. First pass: Import parent accounts
2. Second pass: Import child accounts

The `map_with_hierarchy` method handles this automatically by sorting rows.

### Why Group Journal Entry Rows?

A single journal entry has multiple lines. Import files have one row per line:
- Rows with same `entry_date` + `description` = one entry
- Custom grouping via `group_by_key` option
- Each group must balance (debits = credits)

---

## Next Phases

### Phase 3: Application Layer (CQRS)

Commands and handlers for import operations:
- `ImportJournalEntriesCommand`
- `ImportAccountsCommand`
- `GetImportJobQuery`

### Phase 4: API Layer

REST endpoints:
- `POST /api/import/journal-entries`
- `POST /api/import/accounts`
- `GET /api/import/jobs/{id}`
- `GET /api/import/jobs/{id}/errors`

---

*This document describes Phase 2 of the ingestion pipeline implementation.*
