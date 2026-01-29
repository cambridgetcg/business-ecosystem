# Tax - Mission Statement

## Mission

**To ensure accurate, timely, and compliant tax management across all jurisdictions** — enabling the business ecosystem to meet tax obligations, optimize tax positions, and maintain defensible records for examination.

---

## The Problem We Solve

### Business Challenge

Organizations operating across multiple entities and jurisdictions face:

1. **Compliance complexity** — Federal, state, local, and international tax requirements multiply with each entity and jurisdiction
2. **Deadline pressure** — Missed filing deadlines trigger penalties and interest
3. **Calculation accuracy** — Tax calculations require precise data from accounting, payroll, and operations
4. **Audit exposure** — Inadequate documentation creates risk during examinations
5. **Transfer pricing scrutiny** — Intercompany transactions face increasing regulatory attention
6. **Provision accuracy** — Financial statement tax accounting (ASC 740) requires careful estimates

### What This Leads To

- **Financial penalties** from late or incorrect filings
- **Reputational damage** from public tax controversies
- **Cash flow disruption** from unexpected tax assessments
- **Financial statement misstatement** from provision errors
- **Operational friction** when tax considerations block business transactions

---

## Our Solution

### What Tax Provides

A **comprehensive tax management platform** that:

1. **Manages tax registrations** — Tracks EINs, VAT numbers, nexus, and filing obligations by jurisdiction
2. **Calculates taxes** — Income tax, sales/VAT, payroll, and withholding calculations
3. **Prepares returns** — Compiles data for federal, state, and international filings
4. **Tracks provisions** — ASC 740 calculations, deferred taxes, and uncertain tax positions
5. **Manages transfer pricing** — Documents intercompany transactions and arm's length pricing
6. **Supports examinations** — Maintains audit-ready documentation and tracks controversy

### How It Works

```
Transaction Recorded (Accounting)
        │
        ├──> Tax determination (taxable? which jurisdiction?)
        ├──> Rate lookup (current rates by jurisdiction)
        ├──> Tax calculation (amount due)
        └──> Tax.Calculated event published
                │
                └──> Liability tracked for payment

Period End
        │
        ├──> Tax provision calculated (ASC 740)
        ├──> Deferred tax assets/liabilities updated
        ├──> Effective tax rate computed
        └──> Provision.Completed event published
                │
                └──> Accounting records provision entries

Filing Deadline
        │
        ├──> Return data compiled from transactions
        ├──> Return prepared and reviewed
        ├──> Filing submitted (e-file or paper)
        └──> Return.Filed event published
                │
                └──> Compliance calendar updated
```

---

## Scope & Boundaries

### In Scope

**Tax Registration & Nexus**
- Tax ID management (EIN, VAT, state IDs)
- Nexus determination and tracking
- Filing obligation calendars
- Registration status monitoring

**Income Tax**
- Federal, state, and international returns
- Book-to-tax adjustments
- Estimated payments and extensions
- NOL and credit carryforwards

**Indirect Tax**
- Sales tax rate determination
- VAT/GST calculations
- Exemption certificate management
- Tax remittance tracking

**Payroll Tax**
- Withholding calculations
- Employer contributions (FICA, FUTA)
- W-2 and 1099 generation
- Quarterly/annual payroll filings

**Transfer Pricing**
- Intercompany transaction tracking
- Pricing policy documentation
- Benchmark studies and comparables
- Country-by-country reporting

**Tax Provision**
- Current and deferred tax calculations
- Valuation allowance assessments
- Uncertain tax position (FIN 48) tracking
- Effective tax rate analysis

**Tax Controversy**
- Examination tracking
- IRS notice management
- Audit response coordination
- Settlement documentation

### Out of Scope

**Not Tax's Responsibility:**

- **Transaction recording** → Accounting (we consume their data)
- **Payment processing** → Banking-Treasury (we calculate, they pay)
- **Payroll processing** → HR/Payroll (we calculate withholding, they process payroll)
- **Entity formation** → Entity Governance (we track tax status of entities they create)
- **Legal tax advice** → External counsel (we calculate, not advise)

### Integration Points

Tax **provides to**:
- **Accounting** — Tax provision entries, tax account balances
- **Banking-Treasury** — Tax payment amounts and due dates
- **Compliance** — Tax compliance status, filing calendar
- **Entity Governance** — Tax ID assignments, nexus status

Tax **consumes from**:
- **Accounting** — Transaction data, financial statements
- **Entity Governance** — Entity structure, jurisdictions
- **Banking-Treasury** — Payment confirmations
- **Compliance** — Jurisdiction-specific requirements

---

## Key Design Principles

### 1. Jurisdiction-Aware

Every tax calculation considers the specific jurisdiction's rules, rates, and requirements. No one-size-fits-all assumptions.

### 2. Defensible Documentation

All tax positions are documented with supporting rationale. We maintain exam-ready files at all times.

### 3. Calendar-Driven

Filing deadlines drive proactive workflows. The system surfaces upcoming obligations before they become urgent.

### 4. Conservative by Default

When uncertain, we err on the side of compliance. Tax optimization follows only after compliance is assured.

### 5. Audit Trail Complete

Every calculation can be traced to source data. Auditors can follow the path from return to transaction.

---

## Success Metrics

### Operational Metrics
- **Filing compliance**: 100% of returns filed on time
- **Calculation accuracy**: <0.1% error rate on tax calculations
- **Provision accuracy**: Provision within 5% of actual for filed returns
- **Deadline visibility**: 100% of deadlines visible 90+ days in advance

### Business Metrics
- **Penalty avoidance**: Zero late filing or late payment penalties
- **Examination readiness**: Audit response time <48 hours for document requests
- **Cash optimization**: Estimated payments optimized to avoid overpayment
- **ETR management**: Effective tax rate within planned range

---

## Non-Goals

**What We Explicitly Do Not Aim To Do:**

1. **Provide tax advice** — We calculate and comply, not advise on strategy
2. **Replace tax software** — We integrate with Avalara, Vertex, and filing systems
3. **Handle payroll processing** — We calculate tax, HR processes payroll
4. **Make entity decisions** — Entity Governance decides structure, we track tax implications
5. **Guarantee audit outcomes** — We maintain defensible positions, not guarantees

---

## Events We Publish

| Event | Trigger | Consumers |
|-------|---------|-----------|
| `Tax.Calculated` | Tax determined for transaction | Accounting |
| `TaxPayment.Due` | Payment obligation approaching | Banking-Treasury |
| `Return.Filed` | Tax return submitted | Compliance |
| `Provision.Completed` | Period-end provision calculated | Accounting |
| `Deadline.Approaching` | Filing deadline within 30 days | Compliance, Stakeholders |
| `Examination.Opened` | Tax authority audit initiated | Compliance, Legal |

---

## Events We Subscribe To

| Event | Source | Action |
|-------|--------|--------|
| `Entity.Created` | Entity Governance | Determine nexus and filing obligations |
| `Transaction.Posted` | Accounting | Calculate applicable taxes |
| `Period.Closed` | Accounting | Finalize period tax calculations |
| `Payment.Completed` | Banking-Treasury | Record tax payment |

---

## Conclusion

Tax serves as the **compliance engine** for the business ecosystem's tax obligations. By providing accurate calculations, timely filings, and defensible documentation, it enables the organization to meet regulatory requirements while optimizing cash flow and minimizing risk.

**Our success is measured by the absence of penalties, the accuracy of provisions, and readiness for examination.**

---

*This document defines the purpose and scope of the Tax Service within the Business Ecosystem. It should be reviewed annually or when significant tax law changes occur.*
