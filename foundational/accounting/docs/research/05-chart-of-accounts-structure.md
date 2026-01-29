# Chart of Accounts Structure

> Research findings on standard CoA frameworks, numbering conventions, and best practices across GAAP, IFRS, and national standards.

## Executive Summary

Neither GAAP nor IFRS mandate a specific chart of accounts structure. However, standardized frameworks exist for consistency and interoperability. The chart of accounts should be designed for scalability, clear hierarchy, and multi-standard reporting capability.

---

## Regulatory Context

### GAAP Position
> "The FASB does not publish a US GAAP chart of accounts. Companies may use any chart of accounts provided it is consistent with published recognition guidance."

### IFRS Position
> "The IASB does not publish an IFRS chart of accounts. Companies may use any chart of accounts provided it is consistent with published recognition guidance."

### National Standards

| Country | Standard | Mandatory |
|---------|----------|-----------|
| **France** | Plan Comptable Général | Yes |
| **Germany** | SKR (03/04) | Common practice |
| **Spain** | Plan General de Contabilidad | Yes |
| **Belgium** | Minimum Accounting Standards | Yes |
| **US** | None | No |
| **UK** | None | No |

---

## Standard Account Classifications

### Primary Categories

| Code Range | Category | Normal Balance | Financial Statement |
|------------|----------|----------------|-------------------|
| **1000-1999** | Assets | Debit | Balance Sheet |
| **2000-2999** | Liabilities | Credit | Balance Sheet |
| **3000-3999** | Equity | Credit | Balance Sheet |
| **4000-4999** | Revenue | Credit | Income Statement |
| **5000-5999** | Cost of Goods Sold | Debit | Income Statement |
| **6000-6999** | Operating Expenses | Debit | Income Statement |
| **7000-7999** | Other Income/Expense | Varies | Income Statement |
| **8000-8999** | Taxes | Debit | Income Statement |
| **9000-9999** | Statistical/Memo | N/A | N/A |

### Detailed Breakdown

#### Assets (1000-1999)
```
1000-1199: Current Assets
  1000-1049: Cash and Cash Equivalents
  1050-1099: Short-term Investments
  1100-1149: Accounts Receivable
  1150-1199: Inventory

1200-1399: Non-Current Assets
  1200-1249: Property, Plant & Equipment
  1250-1299: Intangible Assets
  1300-1349: Long-term Investments
  1350-1399: Other Non-Current Assets
```

#### Liabilities (2000-2999)
```
2000-2499: Current Liabilities
  2000-2049: Accounts Payable
  2050-2099: Accrued Liabilities
  2100-2149: Short-term Debt
  2150-2199: Current Tax Payable
  2200-2249: Deferred Revenue (Current)

2500-2999: Non-Current Liabilities
  2500-2599: Long-term Debt
  2600-2699: Deferred Tax Liabilities
  2700-2799: Pension Obligations
```

#### Equity (3000-3999)
```
3000-3199: Contributed Capital
  3000-3049: Common Stock
  3050-3099: Preferred Stock
  3100-3149: Additional Paid-in Capital

3200-3499: Retained Earnings
  3200-3249: Retained Earnings
  3250-3299: Current Year Earnings
  
3500-3999: Other Equity
  3500-3549: Treasury Stock
  3600-3699: Accumulated Other Comprehensive Income
```

---

## Numbering Systems

### Digit Structure Options

| Digits | Example | Use Case |
|--------|---------|----------|
| **4 digits** | 1000 | Small business, simple structure |
| **5 digits** | 10000 | Mid-size, departmental tracking |
| **6 digits** | 100000 | Enterprise, multi-entity |
| **Segmented** | 1000-100-01 | Complex reporting dimensions |

### Recommended Structure (Enterprise)

```
Format: XXXXX-YY-ZZZ

XXXXX = Natural Account (what)
YY    = Department/Cost Center (where)
ZZZ   = Project/Program (why)

Example: 61000-05-101
  61000 = Salaries Expense
  05    = Engineering Department
  101   = Project Alpha
```

### Gap Strategy

Leave gaps for future accounts:
- **10-account gaps** within subcategories
- **100-account gaps** between subcategories
- **1000-account gaps** between major categories

```
1000 - Cash in Bank - Operating
1010 - Cash in Bank - Payroll
1020 - Cash in Bank - Reserves
1030 - (Reserved)
...
1100 - Accounts Receivable - Trade
1110 - Accounts Receivable - Employees
```

---

## Hierarchy Design

### Multi-Level Hierarchy

```
Level 1: Category (Asset, Liability, etc.)
  └─ Level 2: Subcategory (Current, Non-Current)
       └─ Level 3: Group (Cash, Receivables, etc.)
            └─ Level 4: Detail Account (specific account)
                 └─ Level 5: Sub-Account (entity, department)
```

### Implementation

```python
class Account:
    id: UUID
    code: str                    # "1100"
    name: str                    # "Accounts Receivable"
    account_type: AccountType    # ASSET
    parent_id: Optional[UUID]    # Points to "1000" Current Assets
    is_header: bool              # True if grouping account only
    is_active: bool
    normal_balance: BalanceType  # DEBIT or CREDIT
    
    @property
    def full_path(self) -> str:
        """Returns: 'Assets / Current Assets / Accounts Receivable'"""
        if self.parent:
            return f"{self.parent.full_path} / {self.name}"
        return self.name
    
    @property
    def level(self) -> int:
        """Returns depth in hierarchy: 1, 2, 3, etc."""
        if self.parent is None:
            return 1
        return self.parent.level + 1
```

---

## Multi-Standard Considerations

### GAAP vs IFRS Differences

| Area | GAAP | IFRS |
|------|------|------|
| **Development Costs** | Expense as incurred | Capitalize if criteria met |
| **Inventory (LIFO)** | Permitted | Prohibited |
| **Revaluation** | Not permitted (except certain) | Permitted |
| **Extraordinary Items** | Prohibited | Prohibited |
| **Biological Assets** | Historical cost | Fair value (IAS 41) |

### Dual-Standard Account Structure

```
Account 1200: Property, Plant & Equipment

Subaccounts:
  1200-GAAP: PPE at historical cost (GAAP)
  1200-IFRS: PPE at revalued amount (IFRS)
  1200-ADJ:  GAAP-to-IFRS adjustment
```

Or use adjustment layer:
```
Base books: GAAP
Adjustment ledger: IFRS differences
IFRS view = Base + Adjustment
```

---

## Best Practices

### 1. Scalability
- Design for 10x current size
- Use consistent digit structure
- Leave room for acquisitions

### 2. Consistency
- Standardized naming conventions
- Consistent capitalization
- Avoid abbreviations (or define in glossary)

### 3. Centralized Maintenance
- Single owner for CoA changes
- Formal change request process
- Impact analysis before changes

### 4. Documentation
- Account purpose/description
- When to use (and when NOT to use)
- Related accounts
- Reporting classifications

### 5. Regular Review
- Annual CoA cleanup
- Identify unused accounts
- Consolidate similar accounts
- Archive (don't delete) obsolete accounts

---

## Government/Industry Standards

### US Federal Government (USSGL)
The US Standard General Ledger provides standardized accounts for federal agencies.

### Healthcare (HCPCS)
Industry-specific chart of accounts for healthcare organizations.

### Non-Profit (FASB ASC 958)
Specific requirements for net asset classifications:
- Without donor restrictions
- With donor restrictions

---

## Implementation Checklist

- [ ] Define digit structure and segmentation
- [ ] Map primary categories (1000-9000)
- [ ] Define subcategories with gaps
- [ ] Document naming conventions
- [ ] Create header accounts for grouping
- [ ] Map to financial statement lines
- [ ] Define multi-standard requirements
- [ ] Establish change control process
- [ ] Document each account
- [ ] Configure system hierarchies

---

## References

- [US GAAP Chart of Accounts](https://www.ifrs-gaap.com/us-gaap-chart-accounts)
- [IFRS Chart of Accounts](https://www.ifrs-gaap.com/ifrs-chart-accounts)
- [Standard Chart of Accounts - Strategic CFO](https://strategiccfo.com/articles/accounting/standard-chart-of-accounts/)
- [Chart of Accounts Best Practices - NetSuite](https://www.netsuite.com/portal/resource/articles/accounting/chart-of-accounts.shtml)
- [Strategic CoA Design - Deloitte](https://www.deloitte.com/us/en/services/consulting/articles/chart-of-accounts-design.html)
- [Chart of Accounts - Wikipedia](https://en.wikipedia.org/wiki/Chart_of_accounts)

---

*Research conducted: January 2026*
*Applicable to: MISSION.md Domain Scope - Account Management*
