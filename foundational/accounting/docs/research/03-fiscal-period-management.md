# Fiscal Period Management

> Research findings on fiscal period closing, adjusting entries, period controls, and regulatory requirements.

## Executive Summary

Fiscal period management ensures that financial results are reported accurately for discrete time periods. Both GAAP and IFRS require that once a period is closed, retroactive changes are strictly controlled. Period controls are essential for accurate reporting and regulatory compliance.

---

## Fundamental Concepts

### Fiscal Year vs Calendar Year

| Type | Definition | Example |
|------|------------|---------|
| **Calendar Year** | January 1 - December 31 | Standard for many businesses |
| **Fiscal Year** | Any 12-month period | Apple: Oct 1 - Sep 30 |
| **52/53-Week Year** | Ends on same weekday | Retail (ends on Saturday) |

### Reporting Periods

| Period | Use Case |
|--------|----------|
| **Annual** | Primary financial statements |
| **Quarterly** | SEC filings (10-Q), management reporting |
| **Monthly** | Internal management, operational control |
| **Weekly** | Retail, hospitality industries |

---

## Period Closing Process

### Standard Closing Steps

1. **Cut-off Procedures**: Ensure all transactions are recorded in correct period
2. **Accruals**: Record earned but unbilled revenue; incurred but unpaid expenses
3. **Deferrals**: Defer unearned revenue; prepaid expenses
4. **Depreciation/Amortization**: Record periodic asset consumption
5. **Adjusting Entries**: Estimates (bad debts, inventory obsolescence)
6. **Reconciliations**: Bank, intercompany, subledger to GL
7. **Trial Balance**: Verify debits = credits
8. **Financial Statements**: Generate statements
9. **Period Lock**: Prevent further entries to closed period

### Types of Adjusting Entries

| Type | Description | Example |
|------|-------------|---------|
| **Accrued Revenue** | Earned but not yet billed | Interest receivable |
| **Accrued Expense** | Incurred but not yet paid | Salaries payable |
| **Deferred Revenue** | Collected but not yet earned | Prepaid subscriptions |
| **Deferred Expense** | Paid but not yet consumed | Prepaid insurance |
| **Estimates** | Amounts requiring judgment | Bad debt allowance |

---

## Regulatory Requirements

### GAAP Requirements

| Principle | Requirement |
|-----------|-------------|
| **Matching Principle** | Expenses matched to related revenues in same period |
| **Revenue Recognition** | Revenue recorded when earned (ASC 606) |
| **Accrual Basis** | Transactions recorded when they occur, not when cash moves |
| **Consistency** | Same methods applied period to period |

### IFRS Requirements

| Standard | Requirement |
|----------|-------------|
| **IAS 1** | Financial statements at least annually with comparatives |
| **IAS 8** | Accounting policy changes applied retrospectively |
| **IAS 10** | Events after reporting period—adjusting vs non-adjusting |

### Interim Reporting Differences

| Aspect | US GAAP | IFRS |
|--------|---------|------|
| **View** | Integral (part of annual) | Discrete (standalone) |
| **MD&A** | Required | Optional |
| **Cost Variances** | May defer to year-end | Recognize immediately |
| **Tax Rate Changes** | Recognize immediately | Spread over year allowed |

---

## Period Controls

### Control Mechanisms

#### 1. Period Status Management

```
Period Statuses:
  OPEN      → Transactions allowed
  SOFT_CLOSE→ Only adjusting entries (restricted users)
  HARD_CLOSE→ No entries allowed
  ARCHIVED  → Read-only, reporting only
```

#### 2. Period Locking

```sql
CREATE TABLE fiscal_periods (
    id UUID PRIMARY KEY,
    period_name VARCHAR(20) NOT NULL,  -- '2026-01'
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    closed_at TIMESTAMPTZ,
    closed_by UUID,
    reopened_at TIMESTAMPTZ,  -- Track if ever reopened
    reopened_by UUID,
    CONSTRAINT valid_status CHECK (
        status IN ('OPEN', 'SOFT_CLOSE', 'HARD_CLOSE', 'ARCHIVED')
    )
);

-- Prevent entries to closed periods
CREATE OR REPLACE FUNCTION check_period_open()
RETURNS TRIGGER AS $$
DECLARE
    period_status VARCHAR(20);
BEGIN
    SELECT status INTO period_status
    FROM fiscal_periods
    WHERE NEW.posting_date BETWEEN start_date AND end_date;
    
    IF period_status IN ('HARD_CLOSE', 'ARCHIVED') THEN
        RAISE EXCEPTION 'Cannot post to closed period';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

#### 3. Reopening Controls

- Reopening requires senior approval (CFO level)
- All reopenings logged for audit
- Automatic notifications to auditors
- Reclose required within defined window

---

## Events After Reporting Period (IAS 10)

### Adjusting Events
Events that provide evidence of conditions existing at balance sheet date.

**Action**: Adjust the financial statements

**Examples**:
- Settlement of court case confirming liability
- Bankruptcy of customer confirming bad debt
- Discovery of fraud or error

### Non-Adjusting Events
Events indicative of conditions arising after balance sheet date.

**Action**: Disclose but do not adjust (if material)

**Examples**:
- Business combination after year-end
- Major restructuring announced
- Significant decline in market value

---

## Best Practices

### 1. Close Calendar
Establish and publish closing calendar with:
- Deadline for transaction entry
- Deadline for adjusting entries
- Soft close date
- Hard close date
- Financial statement release date

### 2. Checklist-Driven Closing
```markdown
## Month-End Closing Checklist
- [ ] All AR invoices posted
- [ ] All AP invoices entered
- [ ] Bank reconciliations complete
- [ ] Intercompany reconciled
- [ ] Accruals recorded
- [ ] Depreciation run
- [ ] Subledgers reconciled to GL
- [ ] Trial balance reviewed
- [ ] Period closed
```

### 3. Segregation by Period Type
- Adjustment entries tagged separately
- Distinguish between:
  - Standard entries
  - Month-end accruals
  - Audit adjustments
  - Prior period corrections

### 4. Year-End Specifics
- Close nominal accounts (Revenue, Expenses) to Retained Earnings
- Revenue and expense accounts start new year at zero
- Balance sheet accounts carry forward

```sql
-- Year-end closing entry
INSERT INTO journal_entries (description, entry_type)
VALUES ('Close income summary to retained earnings', 'YEAR_END_CLOSE');

INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit)
SELECT 
    @entry_id,
    account_id,
    CASE WHEN balance > 0 THEN balance ELSE 0 END as debit,
    CASE WHEN balance < 0 THEN ABS(balance) ELSE 0 END as credit
FROM accounts
WHERE account_type IN ('REVENUE', 'EXPENSE');
```

---

## Error Corrections

### GAAP/IFRS Treatment

| Error Type | Current Period | Prior Period |
|------------|----------------|--------------|
| **Immaterial** | Out-of-period adjustment | Out-of-period adjustment |
| **Material** | Correct in current period | Restate prior periods |

### Prior Period Restatement
- Direct adjustment to retained earnings
- Bypasses income statement
- Requires disclosure of nature and impact

---

## Implementation Requirements

### Data Model

```python
class FiscalPeriod:
    id: UUID
    name: str  # "2026-01", "2026-Q1", "FY2026"
    period_type: PeriodType  # MONTH, QUARTER, YEAR
    start_date: date
    end_date: date
    status: PeriodStatus
    parent_period_id: Optional[UUID]  # Month → Quarter → Year
    
    def can_post(self, user: User) -> bool:
        if self.status == PeriodStatus.OPEN:
            return True
        if self.status == PeriodStatus.SOFT_CLOSE:
            return user.has_permission('POST_TO_SOFT_CLOSED')
        return False
    
    def close(self, user: User):
        if not user.has_permission('CLOSE_PERIOD'):
            raise PermissionError("Insufficient privileges to close period")
        self.status = PeriodStatus.HARD_CLOSE
        self.closed_at = datetime.now()
        self.closed_by = user.id
```

---

## References

- [IAS 10 Events after Reporting Period](https://www.ifrs.org/content/dam/ifrs/publications/pdf-standards/english/2024/issued/part-a/ias-10-events-after-the-reporting-period.pdf)
- [IAS 8 Accounting Policies, Changes and Errors](https://www.ifrs.org/content/dam/ifrs/publications/pdf-standards/english/2022/issued/part-a/ias-8-accounting-policies-changes-in-accounting-estimates-and-errors.pdf)
- [Interim Financial Reporting: IFRS vs US GAAP - KPMG](https://kpmg.com/us/en/articles/2023/interim-financial-reporting.html)
- [GAAP Rules 2025 Explained](https://www.houseblend.io/articles/gaap-rules-2025-explained)
- [Adjusting Entries - AccountingTools](https://www.accountingtools.com/articles/adjusting-entries)

---

*Research conducted: January 2026*
*Applicable to: MISSION.md Core Commitment #3 - Period Controls*
