# Financial Statement Presentation

> Research findings on IAS 1, financial statement requirements, and reporting standards across GAAP and IFRS.

## Executive Summary

Financial statements must present a complete, comparable picture of an entity's financial position and performance. IAS 1 (IFRS) and various ASC topics (US GAAP) prescribe the required statements, their format, and minimum content requirements. IFRS 18 will supersede IAS 1 starting in 2027.

---

## Complete Set of Financial Statements

### Required Statements

| Statement | IAS 1 Name | US GAAP Name |
|-----------|------------|--------------|
| Balance Sheet | Statement of Financial Position | Balance Sheet |
| Income Statement | Statement of Profit or Loss and OCI | Income Statement + Statement of Comprehensive Income |
| Equity Changes | Statement of Changes in Equity | Statement of Stockholders' Equity |
| Cash Flows | Statement of Cash Flows | Statement of Cash Flows |
| Notes | Notes to Financial Statements | Notes to Financial Statements |

### Reporting Frequency

- **Annual statements**: Required (at minimum)
- **Comparative information**: Previous period required
- **Interim statements**: Required for public companies (quarterly in US)

---

## Statement of Financial Position (Balance Sheet)

### Classification Requirements

| Approach | Description |
|----------|-------------|
| **Current/Non-current** | Separate current from non-current (most common) |
| **Liquidity Order** | Present in order of liquidity (financial institutions) |

### Current vs Non-Current

**Current if:**
- Expected to be realized/settled within 12 months
- Held primarily for trading
- Cash or cash equivalent (unless restricted)

### Minimum Line Items (IAS 1)

**Assets:**
- Property, plant and equipment
- Investment property
- Intangible assets
- Financial assets
- Investments (equity method)
- Biological assets
- Inventories
- Trade and other receivables
- Cash and cash equivalents
- Assets held for sale

**Liabilities:**
- Trade and other payables
- Provisions
- Financial liabilities
- Current tax liabilities
- Deferred tax liabilities
- Liabilities in disposal groups

**Equity:**
- Issued capital
- Reserves
- Non-controlling interests

### Example Structure

```
STATEMENT OF FINANCIAL POSITION
As at December 31, 2025

ASSETS
Non-current assets
  Property, plant and equipment      xxx
  Intangible assets                  xxx
  Investments                        xxx
                                     ───
  Total non-current assets           xxx

Current assets
  Inventories                        xxx
  Trade receivables                  xxx
  Cash and cash equivalents          xxx
                                     ───
  Total current assets               xxx
                                     ───
TOTAL ASSETS                         xxx
                                     ═══

EQUITY AND LIABILITIES
Equity
  Share capital                      xxx
  Retained earnings                  xxx
                                     ───
  Total equity                       xxx

Non-current liabilities
  Long-term borrowings               xxx
  Deferred tax liabilities           xxx
                                     ───
  Total non-current liabilities      xxx

Current liabilities
  Trade payables                     xxx
  Short-term borrowings              xxx
  Current tax payable                xxx
                                     ───
  Total current liabilities          xxx
                                     ───
TOTAL EQUITY AND LIABILITIES         xxx
                                     ═══
```

---

## Statement of Profit or Loss and OCI

### Presentation Options (IAS 1)

| Option | Description |
|--------|-------------|
| **Single statement** | P&L section + OCI section combined |
| **Two statements** | Separate income statement, then OCI statement |

### Expense Classification

| Method | Description | Example |
|--------|-------------|---------|
| **By Nature** | Raw materials, employee costs, depreciation | Manufacturing |
| **By Function** | Cost of sales, admin, selling | Retail/Distribution |

### Minimum Line Items

**Income Statement:**
- Revenue
- Finance costs
- Share of profit of associates (equity method)
- Tax expense
- Profit or loss from discontinued operations
- Profit or loss

**OCI Items:**
- Revaluation surplus changes
- Actuarial gains/losses on pension plans
- Exchange differences on foreign operations
- Fair value changes (certain instruments)

### Example Structure (By Function)

```
STATEMENT OF PROFIT OR LOSS
For the year ended December 31, 2025

Revenue                                      xxx
Cost of sales                               (xxx)
                                            ────
Gross profit                                 xxx

Other income                                 xxx
Distribution costs                          (xxx)
Administrative expenses                     (xxx)
Other expenses                              (xxx)
Finance costs                               (xxx)
                                            ────
Profit before tax                            xxx
Income tax expense                          (xxx)
                                            ────
PROFIT FOR THE YEAR                          xxx
                                            ════

OTHER COMPREHENSIVE INCOME
Items that will not be reclassified to P&L:
  Revaluation of property                    xxx
  Actuarial losses on pension plans         (xxx)

Items that may be reclassified to P&L:
  Foreign currency translation               xxx
  Cash flow hedges                           xxx
                                            ────
Other comprehensive income for the year      xxx
                                            ────
TOTAL COMPREHENSIVE INCOME                   xxx
                                            ════
```

---

## Statement of Cash Flows (IAS 7)

### Activity Classification

| Activity | Examples |
|----------|----------|
| **Operating** | Cash from customers, payments to suppliers, taxes |
| **Investing** | Purchase/sale of PPE, acquisitions, investments |
| **Financing** | Issue of shares, borrowings, dividends paid |

### Operating Activities Methods

| Method | Approach |
|--------|----------|
| **Direct** | Shows actual cash receipts/payments (preferred) |
| **Indirect** | Starts with profit, adjusts for non-cash items |

### Example (Indirect Method)

```
STATEMENT OF CASH FLOWS
For the year ended December 31, 2025

OPERATING ACTIVITIES
Profit before tax                            xxx
Adjustments for:
  Depreciation                               xxx
  Finance costs                              xxx
  Loss on disposal of equipment              xxx
                                            ────
Operating profit before working capital      xxx
  Decrease/(increase) in receivables         xxx
  Decrease/(increase) in inventory           xxx
  Increase/(decrease) in payables            xxx
                                            ────
Cash generated from operations               xxx
  Interest paid                             (xxx)
  Income taxes paid                         (xxx)
                                            ────
Net cash from operating activities           xxx

INVESTING ACTIVITIES
  Purchase of property, plant, equipment    (xxx)
  Proceeds from sale of equipment            xxx
  Acquisition of subsidiary                 (xxx)
                                            ────
Net cash used in investing activities       (xxx)

FINANCING ACTIVITIES
  Proceeds from issue of shares              xxx
  Proceeds from long-term borrowings         xxx
  Repayment of borrowings                   (xxx)
  Dividends paid                            (xxx)
                                            ────
Net cash from financing activities           xxx
                                            ────
Net increase in cash                         xxx
Cash at beginning of year                    xxx
                                            ────
Cash at end of year                          xxx
                                            ════
```

---

## Statement of Changes in Equity

### Required Components

- Total comprehensive income for the period
- Effects of retrospective application/restatement
- Reconciliation of each component of equity showing:
  - Profit or loss
  - Each item of OCI
  - Transactions with owners (contributions, distributions)

### Example Structure

```
STATEMENT OF CHANGES IN EQUITY
For the year ended December 31, 2025

                    Share    Retained  Revaluation  Translation  Total
                   Capital   Earnings    Reserve      Reserve    Equity
                   ───────  ─────────  ──────────  ───────────  ──────
Balance Jan 1       xxx        xxx         xxx          xxx       xxx
Profit for year      -         xxx          -            -        xxx
Other comprehensive
  income             -          -          xxx          xxx       xxx
                   ─────    ───────     ───────      ───────    ──────
Total comprehensive
  income             -         xxx         xxx          xxx       xxx
Dividends            -        (xxx)         -            -       (xxx)
Issue of shares     xxx         -           -            -        xxx
                   ─────    ───────     ───────      ───────    ──────
Balance Dec 31      xxx        xxx         xxx          xxx       xxx
                   ═════    ═══════     ═══════      ═══════    ══════
```

---

## Key Differences: GAAP vs IFRS

| Area | US GAAP | IFRS |
|------|---------|------|
| **Extraordinary items** | Prohibited | Prohibited |
| **Balance sheet format** | Usually current first | Either order |
| **OCI presentation** | Usually separate statement | Single or two statements |
| **Expense classification** | By function common | By nature or function |
| **Cash flow: Interest** | Operating or financing | Operating or investing |
| **Cash flow: Dividends paid** | Financing | Operating or financing |

---

## IFRS 18 - Upcoming Changes (Effective 2027)

IFRS 18 will replace IAS 1 with significant changes:

| Change | Description |
|--------|-------------|
| **Income statement categories** | Operating, investing, financing, taxes |
| **Management-defined performance measures** | Required disclosure |
| **Aggregation/disaggregation** | Enhanced guidance |
| **Statement of cash flows** | Amendments aligned with income statement |

---

## Implementation Requirements

### Data Model for Statements

```python
class FinancialStatementLine:
    id: UUID
    statement_type: StatementType  # BALANCE_SHEET, INCOME, CASH_FLOW, EQUITY
    line_code: str                 # 'TOTAL_ASSETS', 'REVENUE', etc.
    parent_line_id: Optional[UUID] # Hierarchy
    display_name: str
    sequence: int                  # Display order
    normal_sign: str               # 'DEBIT' or 'CREDIT'
    account_mappings: List[AccountMapping]  # Links to GL accounts
    
class StatementGenerator:
    def generate(
        self, 
        statement_type: StatementType,
        period: FiscalPeriod,
        comparative_period: Optional[FiscalPeriod] = None
    ) -> FinancialStatement:
        lines = self.get_statement_template(statement_type)
        
        for line in lines:
            line.current_amount = self.calculate_amount(line, period)
            if comparative_period:
                line.comparative_amount = self.calculate_amount(
                    line, comparative_period
                )
        
        return FinancialStatement(
            statement_type=statement_type,
            period=period,
            lines=lines
        )
```

### Report Configuration

```sql
CREATE TABLE statement_templates (
    id UUID PRIMARY KEY,
    statement_type VARCHAR(50) NOT NULL,
    line_code VARCHAR(50) NOT NULL,
    parent_line_code VARCHAR(50),
    display_name VARCHAR(200) NOT NULL,
    sequence INT NOT NULL,
    indent_level INT DEFAULT 0,
    is_total BOOLEAN DEFAULT FALSE,
    is_bold BOOLEAN DEFAULT FALSE
);

CREATE TABLE statement_account_mappings (
    id UUID PRIMARY KEY,
    template_id UUID REFERENCES statement_templates(id),
    account_code_pattern VARCHAR(50),  -- '1%' for all assets
    sign_convention INT DEFAULT 1      -- 1 or -1
);
```

---

## Best Practices

### 1. Flexible Templating
- Configure statement formats, not hardcode
- Support multiple reporting standards
- Allow custom management reports

### 2. Drill-Down Capability
- Every line item should drill to underlying accounts
- Accounts should drill to transactions
- Transactions should link to source documents

### 3. Comparative Automation
- Auto-calculate comparative columns
- Support multiple comparative periods
- Handle reclassifications

### 4. Multi-Currency Support
- Generate statements in any currency
- Apply translation for group reporting
- Track translation adjustments

---

## References

- [IAS 1 - IFRS Foundation](https://www.ifrs.org/issued-standards/list-of-standards/ias-1-presentation-of-financial-statements/)
- [IAS 1 Full Text (PDF)](https://www.ifrs.org/content/dam/ifrs/publications/pdf-standards/english/2022/issued/part-a/ias-1-presentation-of-financial-statements.pdf)
- [IAS 1 Summary - CPDbox](https://www.cpdbox.com/ias-1-presentation-of-financial-statements/)
- [IAS 1 - Moore Global](https://www.moore-global.com/services/ifrs/ias-1-presentation-of-financial-statements/)
- [IAS 1 - ICAEW](https://www.icaew.com/technical/corporate-reporting/ifrs/ifrs-accounting-standards-tracker/ias-1-presentation-of-financial-statements)

---

*Research conducted: January 2026*
*Applicable to: MISSION.md Domain Scope - Financial Reporting*
