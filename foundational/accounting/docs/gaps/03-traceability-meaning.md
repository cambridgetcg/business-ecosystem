# GAP-03: What Does "Traceable" Mean Operationally?

> From statement line item to source document: the audit trail requirement.

## The Gap

MISSION.md states: "Auditors can trace any balance back to its source transactions."

**Current understanding**: Journal entries have audit fields (created_by, created_at).

**Missing understanding**: What specific queries and drill-down paths must the system support?

---

## Research Findings

### SOX Audit Trail Requirements

The Sarbanes-Oxley Act requires audit trails that answer the **5 Ws**:

| Question | What Must Be Logged | System Implication |
|----------|--------------------|--------------------|
| **Who?** | User identity for every action | Authentication + attribution |
| **What?** | Transaction type, before/after values | Change data capture |
| **When?** | Timestamp of every event | Immutable timestamps |
| **Where?** | System source, account affected | Context metadata |
| **How?** | Method of entry (manual, import, API) | Entry source tracking |

### Required Audit Capabilities

From PCAOB AS 2201, auditors need:

1. **Transaction Walkthroughs** - Follow a single transaction from source to statement
2. **Substantive Testing** - Sample transactions and verify back to source
3. **Balance Drill-Down** - Explain any balance as sum of underlying transactions
4. **Change History** - See all modifications (for non-immutable entities)
5. **Access Logs** - Who viewed/exported sensitive data

### Retention Requirements

- **7-year retention** for all financial records and audit trails
- Logs must be **readily available** for auditor review
- **Tamper-proof storage** (auditors can't alter audit trails)

### The Drill-Down Path

Auditors expect this navigation capability:

```
Financial Statement Line
         ↓
Trial Balance Account
         ↓
Account Ledger (all transactions)
         ↓
Journal Entry
         ↓
Journal Entry Lines
         ↓
Source Document
```

---

## Understanding Gap Analysis

### What We Currently Understand

| Aspect | Understanding Level | Evidence |
|--------|--------------------| ---------|
| Entry immutability | ENABLED | `ImmutableEntity` base class |
| Created timestamp | ENABLED | `created_at` field |
| Entry lines | ENABLED | `JournalEntryLine` model |

### What We Don't Yet Understand

| Aspect | Gap | Impact |
|--------|-----|--------|
| Source document linkage | No required reference to originating document | Can't complete audit trail |
| Balance composition queries | No API to show "what makes up this balance" | Auditors can't drill down |
| Change data capture for mutable entities | No before/after tracking for accounts, periods | Can't audit configuration changes |
| Access logging | No record of who viewed what | Compliance gap |
| Retention implementation | No archive/purge strategy | Storage and compliance risk |

---

## Implications for System Design

### Current State
```
Statement → Account → ??? (no further drill-down)
```

### Required State
```
Statement Line Item
    → Trial Balance Account Total
        → Account Ledger (all posted entries to this account)
            → Journal Entry Header
                → Journal Entry Lines
                    → Source Document Reference
                        → Attachments / External Evidence
```

### Proposed Enhancements

1. **Source Document Model**
   ```python
   class SourceDocument(BaseEntity):
       """External evidence supporting a journal entry."""
       id: str
       document_type: SourceDocumentType  # INVOICE, RECEIPT, CONTRACT, BANK_STATEMENT
       document_number: str  # External reference number
       document_date: date
       vendor_customer: str | None
       description: str
       file_reference: str | None  # Link to document storage
       verified_by: str | None
       verified_at: datetime | None

   class SourceDocumentType(Enum):
       INVOICE = "invoice"
       RECEIPT = "receipt"
       CONTRACT = "contract"
       BANK_STATEMENT = "bank_statement"
       PAYROLL_REGISTER = "payroll_register"
       JOURNAL_VOUCHER = "journal_voucher"  # Internal authorization
       SYSTEM_GENERATED = "system_generated"  # Automated entries
   ```

2. **Balance Composition Query**
   ```python
   class AccountLedger:
       """Shows all activity for an account."""
       account: Account
       period: FiscalPeriod
       opening_balance: Money
       entries: list[LedgerEntry]
       closing_balance: Money

   class LedgerEntry:
       entry_date: date
       entry_number: str
       description: str
       debit: Money | None
       credit: Money | None
       running_balance: Money
       source_document_ref: str | None

   # Query interface
   async def get_account_ledger(
       account_id: str,
       period_id: str | None = None,
       start_date: date | None = None,
       end_date: date | None = None,
   ) -> AccountLedger:
       """Get all transactions for an account with drill-down capability."""
   ```

3. **Audit Event Log**
   ```python
   class AuditEvent(ImmutableEntity):
       """Immutable log of all system actions."""
       event_type: AuditEventType
       entity_type: str
       entity_id: str
       user_id: str
       timestamp: datetime
       ip_address: str | None
       user_agent: str | None
       action: str  # CREATE, READ, UPDATE, DELETE, EXPORT
       before_state: dict | None  # JSON of previous state
       after_state: dict | None   # JSON of new state
       metadata: dict  # Additional context
   ```

4. **Retention Policy**
   ```python
   class RetentionPolicy:
       entity_type: str
       retention_years: int = 7
       archive_after_years: int = 2
       purge_allowed: bool = False  # Most financial data: never purge
   ```

---

## Audit Trail Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│  Statement Reports  │  Ledger Reports  │  Audit Reports     │
└──────────┬──────────┴────────┬─────────┴─────────┬──────────┘
           │                   │                   │
           ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                      QUERY LAYER                             │
│  Balance Queries  │  Drill-Down Queries  │  Audit Queries   │
└──────────┬──────────────────┬──────────────────┬────────────┘
           │                  │                  │
           ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                     DOMAIN LAYER                             │
│  Journal Entries (immutable)  │  Source Documents           │
└──────────┬────────────────────┴─────────┬───────────────────┘
           │                              │
           ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    AUDIT LAYER                               │
│  Audit Events (immutable)  │  Access Logs  │  Change History │
└─────────────────────────────────────────────────────────────┘
```

---

## Research Questions Answered

| Question | Answer | Confidence |
|----------|--------|------------|
| What must be logged? | Who, what, when, where, how for every action | HIGH |
| How long to retain? | 7 years minimum for financial records | HIGH |
| What drill-down is needed? | Statement → Account → Entry → Source Document | HIGH |
| Who ensures integrity? | Separation of duties - auditors can't modify trails | HIGH |

---

## Next Steps

1. **Immediate**: Add `source_document_id` field to `JournalEntry`
2. **Phase 2**: Implement `SourceDocument` entity and repository
3. **Phase 2**: Add `AuditEvent` logging infrastructure
4. **Phase 3**: Build balance composition query API
5. **Research**: Document storage integration (S3? Database BLOBs?)

---

## Sources

- [SOX Compliance Checklist 2026 - GroweXX](https://www.growexx.com/blog/sox-compliance-checklist/)
- [SOX Compliance Guide - AuditBoard](https://auditboard.com/blog/sox-compliance)
- [Implementing SOX Audit Requirements - Imperva](https://www.imperva.com/resources/datasheets/WP_SOX_compliance.pdf)
- [Audit Trail Requirements - Bitsight](https://www.bitsight.com/learn/compliance/sox-compliance-checklist)

---

*Gap status: RESEARCHED*
*Last updated: January 2026*
