# Audit Trail Requirements

> Research findings on audit documentation standards, traceability requirements, and regulatory compliance for financial systems.

## Executive Summary

A complete audit trail is mandatory under SOX, PCAOB, and international standards. Every financial transaction must be traceable from source document through to financial statements, with comprehensive logging of who did what, when, and why.

---

## Regulatory Framework

### SOX Requirements

| Section | Audit Trail Requirement |
|---------|------------------------|
| **302** | Management must certify adequacy of internal controls |
| **404** | Document and test internal controls over financial reporting |
| **409** | Real-time disclosure requires real-time audit trail |
| **802** | 7-year minimum retention for financial records |

**Key Principles:**
- Log collection must provide complete audit trail of access to sensitive data
- Every financial transaction must have detailed record of journal entry and approval
- Database audit must attribute each transaction to specific users
- Records must be tamper-proof and securely stored

### PCAOB Standards

**AS 1215 - Audit Documentation:**
- Documentation must enable experienced auditor to understand work performed
- Must demonstrate underlying accounting records agree with financial statements
- 7-year retention from report release date

**Period-End Financial Reporting Process:**
- Procedures for entering transaction totals into general ledger
- Procedures for initiating, authorizing, recording journal entries
- Procedures for recording recurring and nonrecurring adjustments

### COSO Framework

| Component | Audit Trail Implication |
|-----------|------------------------|
| **Control Environment** | Tone at top; audit trail is non-negotiable |
| **Risk Assessment** | Identify where audit trail gaps create risk |
| **Control Activities** | Implement logging at each control point |
| **Information & Communication** | Audit logs are accessible to auditors |
| **Monitoring** | Regular review of audit logs for anomalies |

### COBIT Framework

For IT controls over financial systems:
- **DS5**: Ensure systems security (access logging)
- **DS11**: Manage data (integrity, retention)
- **ME2**: Monitor internal controls

---

## What Must Be Audited

### Transaction Level

| Event | Required Data |
|-------|---------------|
| **Create** | User, timestamp, all field values |
| **Modify** | User, timestamp, old values, new values, reason |
| **Delete** | User, timestamp, deleted values, reason |
| **Post** | User, timestamp, approval chain |
| **Reverse** | User, timestamp, reason, link to original |

### Access Level

| Event | Required Data |
|-------|---------------|
| **Login** | User, timestamp, IP, device, success/failure |
| **Logout** | User, timestamp, session duration |
| **Permission Change** | User, timestamp, old permissions, new permissions, approver |
| **Report Access** | User, timestamp, report name, parameters |
| **Export** | User, timestamp, data exported, format |

### System Level

| Event | Required Data |
|-------|---------------|
| **Configuration Change** | User, timestamp, setting, old value, new value |
| **Period Close** | User, timestamp, period, approvals |
| **Period Reopen** | User, timestamp, period, justification, approver |
| **Batch Process** | Process, timestamp, records affected, status |

---

## Implementation Architecture

### Database-Level Auditing

```sql
-- Audit log table
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL,  -- INSERT, UPDATE, DELETE
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[],
    user_id UUID NOT NULL,
    user_email VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    session_id UUID,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    correlation_id UUID,  -- Link related actions
    
    -- Indexes for query performance
    INDEX idx_audit_table_record (table_name, record_id),
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_time (occurred_at),
    INDEX idx_audit_correlation (correlation_id)
);

-- Generic audit trigger
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_log (
        table_name, record_id, action,
        old_values, new_values, changed_fields,
        user_id, ip_address, session_id
    )
    VALUES (
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END,
        CASE WHEN TG_OP = 'UPDATE' THEN 
            ARRAY(SELECT key FROM jsonb_each(to_jsonb(NEW)) 
                  WHERE to_jsonb(NEW)->key != to_jsonb(OLD)->key)
        END,
        current_setting('app.user_id')::UUID,
        current_setting('app.ip_address')::INET,
        current_setting('app.session_id')::UUID
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply to financial tables
CREATE TRIGGER audit_journal_entries
    AFTER INSERT OR UPDATE OR DELETE ON journal_entries
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_accounts
    AFTER INSERT OR UPDATE OR DELETE ON accounts
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();
```

### Application-Level Logging

```python
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Optional
import structlog

logger = structlog.get_logger()

@dataclass
class AuditContext:
    user_id: str
    user_email: str
    ip_address: str
    session_id: str
    correlation_id: str

class AuditLogger:
    def __init__(self, context: AuditContext):
        self.context = context
        self.logger = logger.bind(
            user_id=context.user_id,
            ip_address=context.ip_address,
            correlation_id=context.correlation_id
        )
    
    def log_action(
        self,
        action: str,
        entity_type: str,
        entity_id: str,
        old_values: Optional[dict] = None,
        new_values: Optional[dict] = None,
        metadata: Optional[dict] = None
    ):
        self.logger.info(
            f"audit.{action}",
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            old_values=old_values,
            new_values=new_values,
            metadata=metadata,
            timestamp=datetime.utcnow().isoformat()
        )
```

---

## Traceability Requirements

### Source-to-Statement Trail

```
Source Document
    ↓
Transaction Entry
    ↓
Journal Entry
    ↓
General Ledger
    ↓
Trial Balance
    ↓
Financial Statements
```

Every item on financial statements must be traceable back through this chain.

### Required Links

| From | To | Link Method |
|------|-----|-------------|
| **Financial Statement Line** | Trial Balance accounts | Account aggregation rules |
| **Trial Balance** | General Ledger | Direct sum of GL balances |
| **GL Balance** | Journal Entries | Posted entries to account |
| **Journal Entry** | Source Document | Document reference field |
| **Source Document** | External Evidence | Attachment, scan, reference |

### Drill-Down Capability

```python
class TrialBalanceReport:
    def get_balance(self, account_id: str, period: str) -> Decimal:
        # Returns balance with drill-down capability
        pass
    
    def drill_to_entries(self, account_id: str, period: str) -> List[JournalEntry]:
        # Returns all journal entries making up the balance
        pass
    
    def drill_to_source(self, entry_id: str) -> SourceDocument:
        # Returns source document for entry
        pass
```

---

## Retention Requirements

| Jurisdiction | Minimum Retention | Notes |
|--------------|-------------------|-------|
| **US (SOX)** | 7 years | From report release date |
| **US (IRS)** | 7 years | For tax-relevant records |
| **UK** | 6 years | Companies Act 2006 |
| **Germany** | 10 years | GoBD requirements |
| **EU (Various)** | 5-10 years | Varies by country |
| **Australia** | 5 years | Corporations Act |

### Retention Implementation

```python
class RetentionPolicy:
    FINANCIAL_RECORDS = timedelta(days=7*365)  # 7 years
    AUDIT_LOGS = timedelta(days=10*365)        # 10 years (German compliance)
    
    @classmethod
    def can_purge(cls, record_type: str, created_at: datetime) -> bool:
        policy = getattr(cls, record_type, cls.FINANCIAL_RECORDS)
        return datetime.now() - created_at > policy
```

---

## Best Practices

### 1. Immutable Audit Logs
- Audit logs should be append-only
- No UPDATE or DELETE on audit tables
- Consider separate audit database with restricted access

### 2. Structured Logging
- Use JSON format for machine readability
- Include correlation IDs to trace related events
- Standardize field names across systems

### 3. Real-Time vs Batch
- Critical events (journal posts): real-time logging
- Access events: near-real-time acceptable
- Aggregated metrics: batch acceptable

### 4. Integrity Verification
```python
def verify_audit_integrity(audit_records: List[AuditRecord]) -> bool:
    """Verify no gaps or tampering in audit trail."""
    for i, record in enumerate(audit_records):
        if i > 0:
            # Check sequential ordering
            if record.id <= audit_records[i-1].id:
                return False
            # Check timestamp ordering
            if record.occurred_at < audit_records[i-1].occurred_at:
                return False
            # Check hash chain (if implemented)
            expected_hash = hash(audit_records[i-1].data + audit_records[i-1].hash)
            if record.previous_hash != expected_hash:
                return False
    return True
```

### 5. Segregation of Duties
- Users who create transactions should not approve
- IT admins should not have access to modify audit logs
- Auditors should have read-only access

---

## References

- [PCAOB AS 1215: Audit Documentation](https://pcaobus.org/oversight/standards/auditing-standards/details/AS1215)
- [PCAOB Auditing Standards](https://pcaobus.org/oversight/standards/auditing-standards)
- [SOX Compliance Guide - AuditBoard](https://auditboard.com/blog/sox-compliance)
- [SOX Audits: Requirements & Best Practices - Exabeam](https://www.exabeam.com/explainers/sox-compliance/sox-audits-requirements-process-best-practices/)
- [SOX Requirements for IT Auditors - Tripwire](https://www.tripwire.com/state-of-security/understanding-sox-requirements-it-and-cybersecurity-auditors)
- [Implementing SOX Audit Requirements - Imperva](https://www.imperva.com/resources/datasheets/WP_SOX_compliance.pdf)

---

*Research conducted: January 2026*
*Applicable to: MISSION.md Core Commitment #4 - Full Audit Trail*
