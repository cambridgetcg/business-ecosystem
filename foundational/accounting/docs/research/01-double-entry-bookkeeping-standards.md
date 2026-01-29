# Double-Entry Bookkeeping Standards

> Research findings on the accounting equation, debit/credit mechanics, and regulatory requirements across major frameworks.

## Executive Summary

Double-entry bookkeeping is the universal foundation of all modern accounting systems. While GAAP and IFRS differ in many specifics, they share the same fundamental requirement: **every transaction must affect at least two accounts with equal debits and credits**.

---

## The Accounting Equation

### Universal Principle

```
Assets = Liabilities + Equity
```

This equation must **always balance**. It is the fundamental invariant that all accounting systems enforce.

### Extended Form (Including Operations)

```
Assets = Liabilities + Equity + (Revenue - Expenses)
```

Revenue increases equity; expenses decrease equity. At period close, net income flows into retained earnings (equity).

---

## Regulatory Framework

### GAAP (US Generally Accepted Accounting Principles)

| Aspect | Requirement |
|--------|-------------|
| **Governing Body** | Financial Accounting Standards Board (FASB) |
| **Double-Entry** | Required for all public companies |
| **Approach** | Rules-based (detailed guidance) |
| **Inventory Methods** | FIFO, LIFO, weighted-average permitted |

**Key Point**: FASB does not publish an official chart of accounts. Companies may use any structure consistent with recognition guidance.

### IFRS (International Financial Reporting Standards)

| Aspect | Requirement |
|--------|-------------|
| **Governing Body** | International Accounting Standards Board (IASB) |
| **Double-Entry** | Required |
| **Approach** | Principles-based (professional judgment) |
| **Inventory Methods** | FIFO, weighted-average only (LIFO prohibited) |
| **Adoption** | 110+ countries |

**Key Point**: IASB similarly does not mandate a specific chart of accounts.

### Convergence Status

GAAP and IFRS have been converging on key standards but remain separate frameworks. Full adoption of IFRS in the US is considered unlikely due to implementation costs and institutional inertia.

---

## Debit and Credit Rules

### Standard Convention

| Account Type | Normal Balance | Increase | Decrease |
|--------------|----------------|----------|----------|
| Assets | Debit | Debit | Credit |
| Liabilities | Credit | Credit | Debit |
| Equity | Credit | Credit | Debit |
| Revenue | Credit | Credit | Debit |
| Expenses | Debit | Debit | Credit |

### Balance Validation

**Every journal entry must satisfy:**
```
Sum(Debits) = Sum(Credits)
```

This is not optional or configurable—it is a hard constraint.

---

## Implementation Requirements

### For Accounting Systems

1. **Entry Validation**: Reject any journal entry where debits ≠ credits
2. **Account Classification**: Each account must have a defined type (Asset, Liability, Equity, Revenue, Expense)
3. **Normal Balance Tracking**: System should understand which side increases each account type
4. **Trial Balance**: Ability to produce trial balance proving total debits = total credits

### Data Model Implications

```python
class JournalEntry:
    lines: List[JournalEntryLine]
    
    def validate(self):
        total_debits = sum(line.debit for line in self.lines)
        total_credits = sum(line.credit for line in self.lines)
        if total_debits != total_credits:
            raise UnbalancedEntryError(
                f"Debits ({total_debits}) must equal Credits ({total_credits})"
            )
```

---

## Best Practices

### 1. Enforce at Multiple Levels
- Database constraints (CHECK constraint on entry totals)
- Application validation (before save)
- API validation (reject unbalanced requests)

### 2. Use Decimal Precision
- Financial amounts should use `Decimal` type, not floating-point
- Minimum 4 decimal places for currencies
- 6+ decimal places for unit costs and exchange rates

### 3. Atomic Transactions
- Journal entries should be saved atomically
- Either all lines post or none do
- Use database transactions

### 4. Immutable Posted Entries
- Once posted, entries cannot be modified
- Corrections via reversing entries only

---

## Nuances Across Jurisdictions

| Jurisdiction | Specific Requirement |
|--------------|---------------------|
| **US (GAAP)** | LIFO permitted for inventory |
| **EU (IFRS)** | LIFO prohibited; write-down reversals allowed |
| **Germany** | National chart of accounts (SKR) often used |
| **France** | Plan Comptable Général mandated |
| **UK** | IFRS for public; UK GAAP (FRS 102) for private |
| **China** | Chinese Accounting Standards (converging with IFRS) |

---

## References

- [GAAP Rules 2025 Explained](https://www.houseblend.io/articles/gaap-rules-2025-explained)
- [GAAP vs IFRS: Key Differences](https://www.shopify.com/blog/gaap-vs-ifrs)
- [US GAAP versus IFRS: The Basics - EY](https://www.ey.com/en_us/technical/accountinglink/us-gaap-versus-ifrs--the-basics-december-2024)
- [EY US GAAP/IFRS Differences Tool](https://www.ey.com/en_us/technical/accountinglink/us-gaap-ifrs-accounting-differences-identifier-tool-december-2024)
- [Double-Entry Bookkeeping - FreshBooks](https://www.freshbooks.com/hub/accounting/double-entry-bookkeeping)

---

*Research conducted: January 2026*
*Applicable to: MISSION.md Core Commitment #1 - Financial Integrity*
