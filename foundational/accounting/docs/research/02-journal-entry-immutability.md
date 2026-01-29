# Journal Entry Immutability & Corrections

> Research findings on regulatory requirements for journal entry modification, correction procedures, and audit trail preservation.

## Executive Summary

Posted journal entries must be **immutable** under all major accounting frameworks. Corrections are made through reversing or adjusting entries, never through modification or deletion. This requirement is explicitly mandated by SOX, PCAOB, and is a core principle under both GAAP and IFRS.

---

## Regulatory Requirements

### Sarbanes-Oxley Act (SOX)

| Section | Requirement |
|---------|-------------|
| **Section 302** | CEO/CFO must certify accuracy of financial statements |
| **Section 404** | Internal controls over financial reporting must be documented and tested |
| **Section 409** | Real-time disclosure of material changes |
| **Section 802** | Criminal penalties for altering, destroying, or falsifying records |

**Key SOX Requirements for Journal Entries:**

1. **Tamper-Proof Records**: Journal entries must be stored in a manner that prevents unauthorized modification
2. **Seven-Year Retention**: All financial records, including journal entries, must be retained for at least 7 years
3. **Complete Audit Trail**: Every change must be logged with who, what, when, and why
4. **Segregation of Duties**: Entry creation, approval, and posting should be separate functions

### PCAOB Standards

The Public Company Accounting Oversight Board requires:

- **AS 1215**: Audit documentation must demonstrate that underlying accounting records agree with financial statements
- **Period-End Procedures**: Auditors must test procedures for initiating, authorizing, recording, and processing journal entries
- **Electronic Evidence**: When IT is used, journal entries may exist only in electronic form—systems must preserve these records

**Journal Entry Testing Requirements:**
> "The auditor's procedures should include selecting from the general ledger journal entries to be tested and examining support for those items."

### COSO Framework

The Committee of Sponsoring Organizations (COSO) framework recommends:

1. **Control Activities**: Approval workflows for journal entries
2. **Information & Communication**: Documentation of entry purpose
3. **Monitoring**: Regular review of journal entry patterns for anomalies

---

## Immutability Principles

### What Immutability Means

| Allowed | Not Allowed |
|---------|-------------|
| Add new entries | Modify posted entries |
| Post reversing entries | Delete posted entries |
| Add adjusting entries | Change amounts retroactively |
| Void entries (with record) | Remove audit trail |

### Correction Methods

#### 1. Reversing Entry
Creates an exact opposite of the original entry, then posts the correct entry.

```
Original Entry (Posted - Error):
  DR  Office Supplies    $500
  CR  Cash               $500

Reversing Entry:
  DR  Cash               $500
  CR  Office Supplies    $500

Correct Entry:
  DR  Office Equipment   $500
  CR  Cash               $500
```

#### 2. Adjusting Entry
Posts only the difference when the error is a partial amount.

```
Original Entry (Posted - Understated):
  DR  Rent Expense       $800
  CR  Cash               $800

Adjusting Entry (Actual rent was $1,000):
  DR  Rent Expense       $200
  CR  Accounts Payable   $200
```

#### 3. Reclassification Entry
Moves amounts between accounts without affecting totals.

```
Reclassification:
  DR  Equipment (Fixed Assets)    $5,000
  CR  Supplies (Current Assets)   $5,000
```

---

## Audit Trail Requirements

### Minimum Fields to Capture

| Field | Description | Requirement |
|-------|-------------|-------------|
| `entry_id` | Unique identifier | Required |
| `created_at` | Timestamp of creation | Required |
| `created_by` | User who created entry | Required |
| `posted_at` | Timestamp of posting | Required |
| `posted_by` | User who approved/posted | Required |
| `source_document` | Reference to originating document | Required |
| `description` | Business purpose | Required |
| `reversal_of` | Link to reversed entry (if applicable) | Conditional |
| `reversed_by` | Link to reversing entry (if applicable) | Conditional |

### System Logging Requirements

```json
{
  "action": "JOURNAL_ENTRY_POSTED",
  "timestamp": "2026-01-26T15:30:00Z",
  "user_id": "user_123",
  "entry_id": "je_456",
  "ip_address": "10.0.1.50",
  "session_id": "sess_789",
  "details": {
    "total_debits": 1500.00,
    "total_credits": 1500.00,
    "line_count": 3,
    "period": "2026-01"
  }
}
```

---

## Implementation Requirements

### Database Design

```sql
-- Journal entries are append-only
CREATE TABLE journal_entries (
    id UUID PRIMARY KEY,
    entry_number SERIAL UNIQUE,  -- Sequential, never reused
    status VARCHAR(20) NOT NULL CHECK (status IN ('DRAFT', 'POSTED', 'REVERSED')),
    posted_at TIMESTAMPTZ,
    posted_by UUID,
    reversal_of UUID REFERENCES journal_entries(id),
    -- Entry cannot be updated once posted
    CONSTRAINT immutable_when_posted CHECK (
        status = 'DRAFT' OR posted_at IS NOT NULL
    )
);

-- Prevent UPDATE on posted entries (use trigger)
CREATE OR REPLACE FUNCTION prevent_posted_entry_modification()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'POSTED' THEN
        RAISE EXCEPTION 'Cannot modify posted journal entry';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_immutability
    BEFORE UPDATE ON journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION prevent_posted_entry_modification();
```

### Application Layer

```python
class JournalEntry:
    def modify(self, changes: dict):
        if self.status == EntryStatus.POSTED:
            raise ImmutableEntryError(
                "Posted entries cannot be modified. "
                "Create a reversing entry instead."
            )
        # Apply changes to draft entry
        
    def delete(self):
        if self.status == EntryStatus.POSTED:
            raise ImmutableEntryError(
                "Posted entries cannot be deleted. "
                "Create a reversing entry instead."
            )
        # Delete draft entry
```

---

## Best Practices

### 1. Draft vs Posted States
- Allow modifications only in DRAFT state
- Once POSTED, entry is permanently immutable
- Implement approval workflow between states

### 2. Sequential Entry Numbers
- Assign sequential numbers at posting time
- Numbers should never be reused or have gaps
- Gaps indicate potential tampering and trigger audit flags

### 3. Soft Delete Pattern
- Never physically delete financial records
- Use `deleted_at` timestamp for logical deletion
- Even drafts should be preserved for audit

### 4. Cryptographic Integrity (Advanced)
- Hash each entry with previous entry's hash (blockchain-style)
- Enables detection of any tampering with historical records

```python
entry.hash = sha256(
    entry.data + 
    previous_entry.hash + 
    entry.timestamp
)
```

---

## Nuances Across Jurisdictions

| Jurisdiction | Specific Requirement |
|--------------|---------------------|
| **US (SOX)** | 7-year retention; CEO/CFO certification |
| **EU (GDPR)** | Right to erasure does NOT apply to financial records required by law |
| **Germany (GoBD)** | Electronic records must be tamper-proof; 10-year retention |
| **UK** | Companies Act 2006 requires 6-year retention |
| **Australia** | 5-year minimum retention under Corporations Act |

---

## References

- [SOX Compliance Guide - AuditBoard](https://auditboard.com/blog/sox-compliance)
- [SOX Audit Requirements](https://www.sarbanes-oxley-101.com/sarbanes-oxley-audits.htm)
- [PCAOB AS 1215: Audit Documentation](https://pcaobus.org/oversight/standards/auditing-standards/details/AS1215)
- [PCAOB Auditing Standards](https://pcaobus.org/oversight/standards/auditing-standards)
- [SOX IT Audit Requirements - SafePaaS](https://www.safepaas.com/sarbanes-oxley-sox/)
- [Sarbanes-Oxley Act - Wikipedia](https://en.wikipedia.org/wiki/Sarbanes%E2%80%93Oxley_Act)

---

*Research conducted: January 2026*
*Applicable to: MISSION.md Core Commitment #2 - Immutability*
