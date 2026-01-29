# Implementation Plan: Accounting System

> Strategic roadmap for realizing the mission of providing **authoritative financial truth** for the business ecosystem.

## Executive Summary

This plan integrates insights from:
- **Accounting Domain Research** (docs 01-08): Regulatory requirements, accounting standards, immutability principles
- **AI Knowledge Gap Research** (docs 09-16): Understanding limitations that inform where human oversight is essential
- **Current Codebase State**: One bounded context complete (Chart of Accounts), seven to build

The implementation follows Domain-Driven Design with explicit recognition of where AI assistance is reliable vs. where human expertise must prevail.

---

## Mission Alignment Matrix

| MISSION Commitment | Implementation Requirement | AI Gap Consideration |
|-------------------|---------------------------|---------------------|
| **Financial Integrity** | Debits = Credits invariant | None - algorithmic validation |
| **Immutability** | Posted entries permanent | None - architectural constraint |
| **Period Controls** | Closed periods locked | Temporal awareness - ensure current period logic |
| **Full Audit Trail** | Complete traceability | Meta-cognitive - AI cannot verify its own audit accuracy |

---

## Current State Assessment

### Implemented ✅
```
src/domain/chart_of_accounts/
├── models/account.py         # Account entity (COMPLETE)
├── repositories/             # Account repository (COMPLETE)
└── services/                 # (SKELETON)

src/infrastructure/
├── persistence/base.py       # BaseEntity, mixins (COMPLETE)
├── persistence/database.py   # Connection manager (COMPLETE)
└── messaging/                # (SKELETON)

src/api/rest/
├── app.py                    # FastAPI setup (COMPLETE)
└── accounts.py               # Account CRUD (COMPLETE)
```

### To Build 🔨
```
src/domain/
├── general_ledger/           # Core: Journal entries, GL posting
├── accounts_payable/         # AP invoices, payments
├── accounts_receivable/      # AR invoices, receipts
├── fixed_assets/             # Asset tracking, depreciation
├── inventory_accounting/     # Inventory valuation
├── financial_reporting/      # Statements, trial balance
└── management_reporting/     # Internal reports
```

---

## Phase 1: Core Accounting Engine
**Priority: CRITICAL** | **Timeline: Foundation**

### 1.1 General Ledger - Journal Entry Model

**Research Grounding**: docs/research/02-journal-entry-immutability.md

```python
# Pattern to follow: src/domain/chart_of_accounts/models/account.py
# Key constraint: ImmutableEntity base (no updates allowed)

src/domain/general_ledger/
├── models/
│   ├── journal_entry.py      # Immutable posted entry
│   ├── journal_entry_line.py # Individual debit/credit lines
│   └── posting_status.py     # DRAFT → PENDING → POSTED
├── repositories/
│   └── journal_entry_repository.py
├── services/
│   ├── posting_service.py    # Validates and posts entries
│   └── reversal_service.py   # Creates reversing entries
└── validators/
    └── balance_validator.py  # Enforces debits = credits
```

**Invariants to Enforce**:
1. `sum(debits) == sum(credits)` - Hard reject unbalanced entries
2. Posted entries are IMMUTABLE - Use ImmutableEntity base
3. Corrections via reversing entries only - No UPDATE/DELETE on posted
4. All entries reference source documents - Audit traceability

**AI Knowledge Gap Application** (doc 11 - Reasoning Under Uncertainty):
- Multi-step journal entry validation should NOT use AI reasoning
- Use deterministic validation: `Decimal` precision, exact equality
- Human review required for judgment calls (estimates, provisions)

### 1.2 Period Management

**Research Grounding**: docs/research/03-fiscal-period-management.md

```python
src/domain/general_ledger/
├── models/
│   └── fiscal_period.py      # Period entity with status
├── services/
│   ├── period_service.py     # Open/close periods
│   └── period_closing_service.py  # Year-end procedures
└── validators/
    └── period_validator.py   # Blocks posting to closed periods
```

**Invariants**:
1. Closed periods reject new entries - Hard constraint
2. Period closing is irreversible - Requires approval workflow
3. Adjusting periods (13-15) for year-end - Separate from regular months

**AI Knowledge Gap Application** (doc 09 - Temporal Knowledge Decay):
- Period cutoff dates are TIME-SENSITIVE
- System must use authoritative time source (database server time)
- AI should NOT determine "current period" - use system clock + configuration

### 1.3 Balance Validation Engine

```python
src/domain/general_ledger/services/
├── balance_validator.py
│   ├── validate_entry_balance()      # Debits = Credits
│   ├── validate_account_balance()    # Account type consistency
│   └── validate_trial_balance()      # Total verification
└── balance_calculator.py
    ├── calculate_account_balance()   # From GL entries
    └── calculate_trial_balance()     # All accounts
```

**Implementation Rule**:
- Use `Decimal` with explicit precision (doc 01: minimum 4 decimal places)
- NEVER use floating point for money calculations
- Equality check: `abs(debits - credits) < Decimal('0.0001')` for rounding tolerance

---

## Phase 2: Audit Infrastructure
**Priority: HIGH** | **Timeline: After Phase 1**

### 2.1 Audit Trail System

**Research Grounding**: docs/research/04-audit-trail-requirements.md

```python
src/domain/shared/
├── audit/
│   ├── audit_log.py          # Immutable audit record
│   ├── audit_context.py      # Who/what/when/why capture
│   └── audit_service.py      # Log writes (async, non-blocking)
└── events/
    ├── domain_event.py       # Base event class
    ├── journal_entry_events.py
    └── account_events.py
```

**Required Audit Data** (per SOX/PCAOB):
| Event | Required Fields |
|-------|----------------|
| Create | user_id, timestamp, entity_type, entity_id, all_values |
| Post | user_id, timestamp, entry_id, approval_chain |
| Reverse | user_id, timestamp, original_id, reversal_id, reason |
| Period Close | user_id, timestamp, period_id, approval_chain |

**AI Knowledge Gap Application** (doc 15 - Meta-Cognitive Limitations):
- AI cannot reliably audit its own actions
- Audit trail must be EXTERNAL to AI assistance layer
- Human auditors must verify AI-assisted entries

### 2.2 Event Sourcing Foundation

```python
src/infrastructure/messaging/
├── event_store.py            # Append-only event log
├── event_bus.py              # Publish/subscribe
└── event_handlers/
    ├── audit_handler.py      # Writes to audit log
    └── balance_handler.py    # Updates denormalized balances
```

**Pattern**: Every state change emits a domain event → Event store captures → Audit handler logs

---

## Phase 3: Financial Reporting
**Priority: HIGH** | **Timeline: After Phase 2**

### 3.1 Trial Balance

**Research Grounding**: docs/research/08-financial-statement-presentation.md

```python
src/domain/financial_reporting/
├── models/
│   ├── trial_balance.py      # Point-in-time trial balance
│   └── trial_balance_line.py
├── services/
│   └── trial_balance_service.py
└── queries/
    └── trial_balance_query.py  # Read-optimized query
```

**Validation**:
- `sum(debit_balances) == sum(credit_balances)`
- If not equal, something is fundamentally broken in GL

### 3.2 Financial Statements

```python
src/domain/financial_reporting/
├── services/
│   ├── balance_sheet_service.py
│   ├── income_statement_service.py
│   └── cash_flow_service.py
└── reports/
    ├── balance_sheet.py        # Assets = Liabilities + Equity
    ├── income_statement.py     # Revenue - Expenses = Net Income
    └── cash_flow_statement.py  # Operating/Investing/Financing
```

**AI Knowledge Gap Application** (doc 12 - Cultural/Contextual Blind Spots):
- Statement presentation varies by jurisdiction (GAAP vs IFRS)
- System must be CONFIGURABLE for jurisdiction
- AI should not assume "universal" presentation standards

---

## Phase 4: Extended Accounting
**Priority: MEDIUM** | **Timeline: After Phase 3**

### 4.1 Accounts Payable

```python
src/domain/accounts_payable/
├── models/
│   ├── vendor.py
│   ├── ap_invoice.py
│   └── payment.py
├── services/
│   ├── invoice_service.py
│   ├── payment_service.py
│   └── three_way_match_service.py  # PO-Receipt-Invoice matching
└── repositories/
```

### 4.2 Accounts Receivable

```python
src/domain/accounts_receivable/
├── models/
│   ├── customer.py
│   ├── ar_invoice.py
│   └── receipt.py
├── services/
│   ├── billing_service.py
│   ├── receipt_service.py
│   └── aging_service.py          # Receivables aging
└── repositories/
```

### 4.3 Fixed Assets

**Research Grounding**: Industry practice for depreciation

```python
src/domain/fixed_assets/
├── models/
│   ├── asset.py
│   ├── depreciation_schedule.py
│   └── disposal.py
├── services/
│   ├── depreciation_service.py   # Calculate periodic depreciation
│   └── disposal_service.py
└── repositories/
```

**AI Knowledge Gap Application** (doc 14 - Edge Cases):
- Depreciation methods vary (straight-line, declining balance, units of production)
- Asset lives are ESTIMATES requiring human judgment
- AI should NOT determine useful life - use configured rules

### 4.4 Multi-Currency

**Research Grounding**: docs/research/06-multi-currency-accounting.md

```python
src/domain/shared/
├── currency/
│   ├── exchange_rate.py
│   ├── exchange_rate_service.py
│   └── currency_converter.py
```

**AI Knowledge Gap Application** (doc 09 - Temporal Knowledge Decay):
- Exchange rates are TIME-SENSITIVE
- Must use external authoritative rate source (not AI knowledge)
- Rate at transaction date vs. reporting date distinction critical

---

## Phase 5: API Completion
**Priority: MEDIUM** | **Timeline: Parallel with Phase 3-4**

### 5.1 REST API Endpoints

```python
src/api/rest/
├── journal_entries.py        # POST, GET, POST /:id/reverse
├── periods.py                # GET, POST /:id/close
├── trial_balance.py          # GET (point-in-time)
├── financial_statements.py   # GET balance_sheet, income_statement
├── accounts_payable.py       # Full CRUD
├── accounts_receivable.py    # Full CRUD
└── reports.py                # Various reporting endpoints
```

### 5.2 GraphQL API (Optional)

```python
src/api/graphql/
├── schema.py                 # Type definitions
├── resolvers/
│   ├── account_resolvers.py
│   ├── journal_entry_resolvers.py
│   └── report_resolvers.py
└── mutations/
```

### 5.3 Webhook System

```python
src/api/webhooks/
├── webhook_registry.py       # Subscriber management
├── webhook_dispatcher.py     # Event → webhook delivery
└── handlers/
    ├── journal_posted.py
    └── period_closed.py
```

---

## Phase 6: Integration & External Systems
**Priority: LOW** | **Timeline: After Phase 5**

### 6.1 ERP Integration

```python
src/infrastructure/external/
├── erp_integrations/
│   ├── base_connector.py
│   ├── sap_connector.py
│   └── netsuite_connector.py
```

### 6.2 Reporting Tools

```python
src/infrastructure/external/
├── reporting_tools/
│   ├── excel_exporter.py
│   ├── pdf_generator.py
│   └── bi_connector.py       # Tableau, Power BI, etc.
```

---

## AI-Awareness Safeguards

Based on AI Knowledge Gap Research (docs 09-16), implement these safeguards:

### Deterministic Operations (AI Can Assist)

| Operation | Why Safe |
|-----------|----------|
| Balance validation | Mathematical - debits = credits |
| Period boundary checks | Date comparison - deterministic |
| Account type classification | Enumerated values |
| Report generation | Aggregation of existing data |

### Human-Required Operations (AI Should Flag)

| Operation | Why Human Required | Doc Reference |
|-----------|-------------------|---------------|
| Estimates (bad debt, useful life) | Judgment required | doc 11 (Reasoning) |
| Unusual transactions | Edge case detection | doc 14 (Distribution Tails) |
| Cross-cultural reporting | Jurisdiction expertise | doc 12 (Cultural Blindspots) |
| Audit interpretation | Cannot self-verify | doc 15 (Meta-Cognitive) |
| Novel scenarios | Capability uncertainty | doc 16 (Emergent Capabilities) |

### Implementation Pattern

```python
class AIAssistedOperation:
    """Base class for operations that may involve AI assistance."""

    CONFIDENCE_THRESHOLD = 0.95
    HUMAN_REVIEW_REQUIRED = False

    def execute(self, context: OperationContext) -> Result:
        result = self._perform_operation(context)

        if self._requires_human_review(result):
            result.flag_for_review(
                reason=self._review_reason(result),
                confidence=result.confidence
            )

        return result

    def _requires_human_review(self, result: Result) -> bool:
        """Override in subclasses for domain-specific logic."""
        return (
            self.HUMAN_REVIEW_REQUIRED or
            result.confidence < self.CONFIDENCE_THRESHOLD or
            result.is_edge_case
        )
```

---

## Database Migrations Strategy

### Migration Order

1. **accounts** (existing - verify/update)
2. **fiscal_periods** (new)
3. **journal_entries** (new - immutable)
4. **journal_entry_lines** (new)
5. **audit_logs** (new - append-only)
6. **domain_events** (new - event store)
7. **vendors**, **ap_invoices**, **payments** (Phase 4)
8. **customers**, **ar_invoices**, **receipts** (Phase 4)
9. **fixed_assets**, **depreciation_schedules** (Phase 4)

### Migration Commands

```bash
# Generate migration
alembic revision --autogenerate -m "add_journal_entries"

# Apply migration
alembic upgrade head

# Rollback (CAREFUL - audit implications)
alembic downgrade -1
```

---

## Testing Strategy

### Unit Tests

```
tests/
├── unit/
│   ├── domain/
│   │   ├── test_journal_entry.py
│   │   ├── test_balance_validator.py
│   │   └── test_period_service.py
│   └── services/
│       └── test_posting_service.py
```

### Integration Tests

```
tests/
├── integration/
│   ├── test_journal_posting_flow.py
│   ├── test_period_closing_flow.py
│   └── test_audit_trail.py
```

### Invariant Tests (CRITICAL)

```python
# tests/invariants/test_accounting_equation.py
def test_accounting_equation_always_holds():
    """Assets MUST equal Liabilities + Equity at all times."""
    # This test should run after EVERY journal entry

def test_trial_balance_always_balances():
    """Total debits MUST equal total credits."""

def test_posted_entries_never_modified():
    """Posted entries MUST be immutable."""
```

---

## Deployment Checkpoints

### Phase 1 Complete When:
- [ ] Journal entries can be created, validated, posted
- [ ] Debits = Credits enforced at database level
- [ ] Posted entries are immutable (no UPDATE/DELETE)
- [ ] Period controls block posting to closed periods
- [ ] All invariant tests pass

### Phase 2 Complete When:
- [ ] Full audit trail for all operations
- [ ] Events captured in event store
- [ ] Audit queries work for compliance

### Phase 3 Complete When:
- [ ] Trial balance generates correctly
- [ ] Balance sheet balances (A = L + E)
- [ ] Income statement calculates correctly
- [ ] Financial statements exportable

### Phase 4 Complete When:
- [ ] AP workflow complete (invoice → payment)
- [ ] AR workflow complete (invoice → receipt)
- [ ] Fixed asset depreciation calculates
- [ ] Multi-currency conversions work

---

## Risk Mitigation

| Risk | Mitigation | AI Gap Awareness |
|------|------------|------------------|
| Balance errors | Immutable entries + reversal only | Deterministic - safe |
| Period violations | Database-level constraints | Temporal - verify system time |
| Audit gaps | Event sourcing architecture | Meta-cognitive - external verification |
| Regulatory non-compliance | Research-grounded design | Cultural - jurisdiction configuration |
| Data loss | Immutability + backups | None - infrastructure concern |

---

## Success Metrics

From MISSION.md, the system succeeds when:

| Criterion | Measurement | Implementation |
|-----------|-------------|----------------|
| Financial statements with confidence | Trial balance always balances | Invariant test suite |
| Auditors can trace any balance | Full audit trail | Event sourcing + queries |
| Dependent systems receive reliable data | API contracts honored | Contract tests |
| Regulatory requirements met | Compliance checklist | Research doc alignment |
| Trustworthy financial decisions | Accurate, timely reporting | Performance + accuracy tests |

---

## Appendix: Research Document Quick Reference

| Doc | Title | Key Implementation Impact |
|-----|-------|--------------------------|
| 01 | Double-Entry Standards | Balance validation invariant |
| 02 | Journal Entry Immutability | ImmutableEntity base class |
| 03 | Fiscal Period Management | Period closing service |
| 04 | Audit Trail Requirements | Event sourcing architecture |
| 05 | Chart of Accounts Structure | Account hierarchy (DONE) |
| 06 | Multi-Currency Accounting | Currency converter service |
| 07 | Revenue Recognition | AR service timing rules |
| 08 | Financial Statement Presentation | Reporting service structure |
| 09 | Temporal Knowledge Decay | Use system time, not AI |
| 10 | Epistemic Confidence | Human review for estimates |
| 11 | Reasoning Under Uncertainty | Deterministic validation |
| 12 | Cultural Blind Spots | Jurisdiction configuration |
| 13 | Embodied Knowledge | N/A for accounting system |
| 14 | Edge Cases | Flag unusual transactions |
| 15 | Meta-Cognitive Limitations | External audit verification |
| 16 | Emergent Capabilities | Conservative automation |

---

*Implementation Plan created: January 2026*
*Aligned with: MISSION.md, Research Documents 01-16*
*Territory: Hybrid (Charted patterns + Uncharted bounded contexts)*
