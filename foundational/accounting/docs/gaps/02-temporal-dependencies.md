# GAP-02: Temporal Dependencies in Statement Generation

> When timing affects accuracy: cutoffs, accruals, and the matching principle.

## The Gap

MISSION.md states: "Financial statements can be produced at any time with full confidence."

**Current understanding**: Periods have states (FUTURE → OPEN → CLOSING → CLOSED).

**Missing understanding**: What temporal dependencies must be satisfied before statements are accurate?

---

## Research Findings

### The Cutoff Principle

Under GAAP, the end of the accounting period serves as a **cutoff** for when revenue and expenses are recognized. The exchange of cash doesn't drive recognition - **earning and incurring** do.

| Timing Issue | Risk | Example |
|--------------|------|---------|
| Revenue recorded too early | Overstatement | Recognizing sale before delivery |
| Revenue recorded too late | Understatement | Missing sale completed in period |
| Expense recorded too early | Understatement of income | Prepaying and expensing immediately |
| Expense recorded too late | Overstatement of income | Ignoring incurred but unpaid expense |

### Accrual Requirements

Accruals ensure transactions appear in the period they were **incurred**, not when cash moves:

```
Contractor completes work: October
Contractor invoices:       November
Cash paid:                 December

Without accrual: Expense appears in December (wrong)
With accrual:    Expense appears in October (correct)
```

**Types of accruals needed**:
- Accounts payable (goods received, invoice pending)
- Accounts receivable (service delivered, not yet billed)
- Payroll and bonuses
- Taxes
- Interest
- Recurring services (utilities, subscriptions)

### Period Close Sequence

The financial close is not atomic - it has temporal dependencies:

```
1. Transaction cutoff enforced
2. Accruals recorded
3. Adjusting entries posted
4. Reconciliations completed
5. Trial balance verified
6. Financial statements generated
7. Period closed
```

**Each step depends on previous steps being complete.**

---

## Understanding Gap Analysis

### What We Currently Understand

| Aspect | Understanding Level | Evidence |
|--------|--------------------| ---------|
| Period states | ENABLED | `PeriodStatus` enum implemented |
| Period date ranges | KNOWS | `start_date`, `end_date` on period |
| Adjusting periods | UNDERSTANDS | `is_adjusting` flag exists |

### What We Don't Yet Understand

| Aspect | Gap | Impact |
|--------|-----|--------|
| Cutoff enforcement timing | When exactly to prevent backdating? | Statements include wrong-period items |
| Accrual completeness | How to know all accruals are recorded? | Understatement of liabilities |
| Close sequence dependencies | What must complete before what? | Premature close = inaccurate statements |
| Reconciliation requirements | What must reconcile before close? | Undetected errors persist |

---

## Implications for System Design

### Current State
```
Period Status: OPEN
        ↓
close_period() → CLOSED
```

### Required State
```
Period Status: OPEN
        ↓
Pre-Close Checklist:
  □ Transaction cutoff date reached
  □ All expected accruals recorded
  □ All adjusting entries posted
  □ Bank reconciliation complete
  □ AR/AP reconciliation complete
  □ Trial balance in balance
        ↓
All checks pass → CLOSING
        ↓
Review period → CLOSED
```

### Proposed Enhancements

1. **Close Readiness Checklist**
   ```python
   class CloseReadinessCheck:
       check_type: CloseCheckType
       description: str
       required: bool
       satisfied: bool
       satisfied_at: datetime | None
       evidence: str | None

   class CloseCheckType(Enum):
       CUTOFF_ENFORCED = "cutoff_enforced"
       ACCRUALS_COMPLETE = "accruals_complete"
       ADJUSTMENTS_POSTED = "adjustments_posted"
       BANK_RECONCILED = "bank_reconciled"
       AR_RECONCILED = "ar_reconciled"
       AP_RECONCILED = "ap_reconciled"
       TRIAL_BALANCE_VERIFIED = "trial_balance_verified"
   ```

2. **Accrual Tracking**
   ```python
   class RecurringAccrual:
       """Expected accruals that must be recorded each period."""
       name: str
       frequency: AccrualFrequency
       expected_amount: Money | None  # None if variable
       account_debit: str
       account_credit: str
       last_posted_period: str | None
   ```

3. **Cutoff Enforcement**
   ```python
   def validate_entry_date(entry: JournalEntry, period: FiscalPeriod) -> bool:
       """Entries cannot be backdated to closed periods."""
       if period.status == PeriodStatus.CLOSED:
           raise PeriodClosedError(f"Cannot post to closed period {period.name}")

       if entry.entry_date < period.start_date:
           raise CutoffViolationError(f"Entry date {entry.entry_date} before period start")

       if entry.entry_date > period.end_date and not period.is_adjusting:
           raise CutoffViolationError(f"Entry date {entry.entry_date} after period end")
   ```

4. **Statement Generation Guards**
   ```python
   def generate_statements(period: FiscalPeriod) -> FinancialStatements:
       """Only generate statements when period is ready."""
       readiness = check_close_readiness(period)

       if not readiness.all_satisfied:
           raise StatementsNotReady(
               f"Period not ready for statements: {readiness.unsatisfied_checks}"
           )

       return _generate_statements(period)
   ```

---

## Temporal Dependency Map

```
Transaction Cutoff
       │
       ▼
┌──────────────────┐
│ Accruals Posted  │◄─── Recurring accrual schedule
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Adjustments Made │◄─── Auditor adjustments, corrections
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────┐
│ Reconciliations Complete             │
│  - Bank reconciliation               │
│  - AR aging reconciliation           │
│  - AP aging reconciliation           │
│  - Intercompany reconciliation       │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────┐
│ Trial Balance OK │◄─── All adjustments, debits = credits
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Statements Ready │
└──────────────────┘
```

---

## Research Questions Answered

| Question | Answer | Confidence |
|----------|--------|------------|
| What is cutoff? | Period boundary for revenue/expense recognition | HIGH |
| When do accruals matter? | When cash timing differs from economic timing | HIGH |
| What's the close sequence? | Cutoff → Accruals → Adjustments → Reconciliation → TB → Statements | HIGH |
| Can we close without reconciliation? | Technically yes, but statements unreliable | HIGH |

---

## Next Steps

1. **Immediate**: Add `CloseReadinessCheck` model
2. **Phase 2**: Implement reconciliation module
3. **Phase 3**: Add recurring accrual tracking
4. **Research**: Automation of accrual detection (AI opportunity?)

---

## Sources

- [Cutoff Rules When Reporting Revenue & Expenses - KPM](https://www.kpmcpa.com/cutoff-rules-when-reporting-revenue-expenses/)
- [The Financial Close Process - Numeric](https://www.numeric.io/blog/financial-close-process)
- [Year-End Accruals - Princeton Finance](https://finance.princeton.edu/budgeting-financial-management/month-and-year-end-close/year-end-close/year-end-accruals)
- [Accounting Cutoffs: Timing Counts - Hood & Strong](https://www.hoodstrong.com/en/insights-resources/accounting-cutoffs-timing-counts-when-reporting-revenue-and-expenses/)

---

*Gap status: RESEARCHED*
*Last updated: January 2026*
