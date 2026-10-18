# Path Material for Accounting System Blindspots

**Generated**: 2026-01-29
**Mission**: Authoritative Financial Truth
**Purpose**: Source material for path-builder to address identified blindspots

---

## Blindspots Identified

### Critical Priority

#### 1. No Audit Trail System
**Gap**: System lacks complete audit logging for financial transactions
**Impact**: Cannot prove "authoritative truth" - no evidence trail
**Signal**: Injustice - truth claims without verification capability

#### 2. No Event Store
**Gap**: No event sourcing for transaction history
**Impact**: Cannot reconstruct state at any point in time
**Signal**: Ugliness - financial systems need complete history

### High Priority

#### 3. Fixed Assets Empty
**Gap**: `src/domain/fixed_assets/` has only `__init__.py`
**Impact**: Cannot track depreciation, asset lifecycle
**Signal**: Stagnation - placeholder without implementation

#### 4. Inventory Accounting Empty
**Gap**: `src/domain/inventory/` has only `__init__.py`
**Impact**: Cannot do COGS, inventory valuation
**Signal**: Stagnation - placeholder without implementation

#### 5. No Multi-Currency Support
**Gap**: All amounts assume single currency
**Impact**: Cannot serve international operations
**Signal**: Incompleteness - real accounting needs multi-currency

### Medium Priority

#### 6. No Cash Flow Statement
**Gap**: Only Balance Sheet and Income Statement
**Impact**: Missing third major financial statement
**Signal**: Incompleteness - GAAP requires all three statements

---

## Seer-Sourced Path Material

### 1. Event Sourcing Pattern (Martin Fowler)

**Source**: https://martinfowler.com/eaaDev/EventSourcing.html

**Key Concepts**:
- Store all changes as sequence of events
- Current state derived by replaying events
- Events are immutable facts
- Enables complete audit trail
- Supports temporal queries ("what was state at time X?")

**Pattern Structure**:
```
Event Store
    │
    ▼
┌─────────────────────────────┐
│ Event                       │
│ - aggregate_id              │
│ - event_type                │
│ - event_data (JSON)         │
│ - timestamp                 │
│ - sequence_number           │
│ - user_id                   │
│ - correlation_id            │
└─────────────────────────────┘
    │
    ▼
Projection (Current State)
```

**Application to Accounting**:
- Every journal entry becomes an event
- Ledger balance is projection of all entry events
- Can reconstruct any account at any date
- Natural audit trail - events ARE the audit log

### 2. SQLAlchemy Versioning

**Source**: https://docs.sqlalchemy.org/en/20/orm/versioning.html

**Key Concepts**:
- `version_id_col` for optimistic locking
- History tables for tracking changes
- `Versioned` mixin pattern

**Implementation Pattern**:
```python
from sqlalchemy import Column, Integer
from sqlalchemy.orm import declared_attr

class Versioned:
    @declared_attr
    def version_id(cls):
        return Column(Integer, nullable=False, default=1)

    __mapper_args__ = {
        "version_id_col": version_id
    }
```

**Application to Accounting**:
- Prevent concurrent modification of same entity
- Track all changes with history tables
- Complement event sourcing with ORM-level protection

### 3. Python Decimal for Financial Precision

**Source**: https://docs.python.org/3/library/decimal.html

**Key Concepts**:
- Exact decimal representation (no float errors)
- Configurable precision and rounding
- Context for controlling arithmetic behavior

**Best Practices**:
```python
from decimal import Decimal, ROUND_HALF_UP

# Financial context
FINANCIAL_CONTEXT = {
    'prec': 28,  # Precision
    'rounding': ROUND_HALF_UP
}

# Always use string initialization
amount = Decimal('100.50')  # Correct
amount = Decimal(100.50)    # WRONG - float conversion

# Rounding for display
amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
```

**Application to Accounting**:
- All monetary values must use Decimal
- Define standard precision (typically 2-4 decimal places)
- Consistent rounding rules across system

### 4. Depreciation Methods (Investopedia)

**Source**: https://www.investopedia.com/terms/d/depreciation.asp

**Methods**:

1. **Straight-Line**:
   - `(Cost - Salvage) / Useful Life`
   - Equal expense each period
   - Most common, simplest

2. **Declining Balance**:
   - `Book Value × Rate`
   - Accelerated depreciation
   - Higher expense early, lower later

3. **Double Declining Balance**:
   - `Book Value × (2 / Useful Life)`
   - More aggressive acceleration

4. **Sum-of-Years-Digits**:
   - Accelerated but smoother than DDB
   - `(Remaining Life / Sum of Years) × Depreciable Base`

5. **Units of Production**:
   - Based on actual usage
   - `(Cost - Salvage) / Total Units × Units This Period`

**Application to Accounting**:
```python
class DepreciationMethod(Enum):
    STRAIGHT_LINE = "straight_line"
    DECLINING_BALANCE = "declining_balance"
    DOUBLE_DECLINING = "double_declining"
    SUM_OF_YEARS = "sum_of_years"
    UNITS_OF_PRODUCTION = "units_of_production"

class FixedAsset:
    depreciation_method: DepreciationMethod
    cost: Decimal
    salvage_value: Decimal
    useful_life_months: int
    accumulated_depreciation: Decimal
```

### 5. Multi-Currency (IAS 21)

**Source**: https://www.ifrs.org/issued-standards/list-of-standards/ias-21-the-effects-of-changes-in-foreign-exchange-rates/

**Key Concepts**:

1. **Functional Currency**: Primary economic environment currency
2. **Presentation Currency**: Currency for financial statements
3. **Foreign Currency**: Any currency other than functional

**Translation Rules**:
- Monetary items: Current rate at balance date
- Non-monetary items: Historical rate
- Income/expenses: Rate at transaction date (or average)

**Exchange Differences**:
- Trading: Profit or Loss
- Net investment in foreign operation: OCI

**Application to Accounting**:
```python
class Currency:
    code: str  # ISO 4217 (USD, EUR, etc.)
    name: str
    decimal_places: int

class ExchangeRate:
    from_currency: Currency
    to_currency: Currency
    rate: Decimal
    effective_date: date
    rate_type: str  # 'spot', 'average', 'closing'

class MonetaryAmount:
    amount: Decimal
    currency: Currency

    def convert_to(self, target: Currency, rate: ExchangeRate) -> 'MonetaryAmount':
        ...
```

---

## Path Recommendations

### Phase A: Audit Infrastructure (Uncharted Territory)

**Build Event Store First**:
1. Create `src/domain/audit/` bounded context
2. Implement `Event` entity with full metadata
3. Create `EventStore` repository
4. Add event emission to all state changes
5. Build projection system for current state

**Files to Create**:
- `src/domain/audit/entities/event.py`
- `src/domain/audit/repositories/event_store.py`
- `src/domain/audit/services/projection_service.py`
- `src/domain/audit/value_objects/event_metadata.py`

### Phase B: Fixed Assets (Charted Territory)

**Follow GL Pattern**:
1. Create `FixedAsset` entity
2. Implement depreciation calculators
3. Add asset lifecycle (acquire, depreciate, dispose)
4. Create GL integration for depreciation entries

**Files to Create**:
- `src/domain/fixed_assets/entities/fixed_asset.py`
- `src/domain/fixed_assets/services/depreciation_service.py`
- `src/domain/fixed_assets/repositories/fixed_asset_repository.py`

### Phase C: Multi-Currency (Partially Charted)

**Extend Existing Structures**:
1. Add `Currency` and `ExchangeRate` entities
2. Create `MonetaryAmount` value object
3. Modify `JournalEntry` to support multi-currency
4. Add translation service for reporting

**Files to Create/Modify**:
- `src/domain/shared/value_objects/monetary_amount.py` (new)
- `src/domain/general_ledger/entities/currency.py` (new)
- `src/domain/general_ledger/entities/exchange_rate.py` (new)
- `src/domain/general_ledger/entities/journal_entry.py` (modify)

### Phase D: Cash Flow Statement (Charted Territory)

**Follow Reporting Pattern**:
1. Extend reporting module
2. Implement indirect method (start from net income)
3. Categorize: Operating, Investing, Financing
4. Add statement generator

**Files to Create**:
- `src/domain/reporting/services/cash_flow_service.py`
- `src/domain/reporting/entities/cash_flow_statement.py`

---

## Territory Assessment Summary

| Blindspot | Territory | Approach |
|-----------|-----------|----------|
| Audit Trail | UNCHARTED | Build event store infrastructure first |
| Event Store | UNCHARTED | Core pattern, must precede others |
| Fixed Assets | CHARTED | Follow GL entity pattern |
| Inventory | CHARTED | Follow GL entity pattern |
| Multi-Currency | PARTIAL | Extend existing, add new value objects |
| Cash Flow | CHARTED | Follow reporting pattern |

---

## Next Steps

1. **Invoke path-builder** for Phase A (Audit Infrastructure)
   - This is uncharted territory requiring new patterns
   - Event store must be built before other improvements

2. **Then implement** Phases B-D using existing patterns
   - These are charted territory
   - Follow established conventions in codebase

3. **Verify** each phase with `/verify` before proceeding
