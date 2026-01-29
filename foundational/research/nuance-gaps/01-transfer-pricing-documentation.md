# Transfer Pricing Documentation Requirements

## Knowledge Gap Identified

Current holding company and intercompany research mentions transfer pricing but lacks depth on documentation requirements, penalty safe harbors, and the critical intersection with entity governance, accounting, and banking.

## Key Findings

### The Arm's Length Principle

Transfer pricing rules require that intercompany transactions be priced as if conducted between unrelated parties. This applies to:
- Sale of goods between related entities
- Provision of services (management fees, IT services, etc.)
- Licensing of intellectual property
- Intercompany loans and financing

```
CRITICAL INSIGHT: Transfer pricing is NOT optional
├─ Applies to ALL intercompany transactions
├─ Requires contemporaneous documentation
├─ Penalties are severe (20% to 40% in US)
└─ Documentation burden is on the taxpayer
```

### OECD Three-Tier Documentation Framework

```
┌─────────────────────────────────────────────────────────────────────┐
│                    OECD TRANSFER PRICING DOCUMENTATION              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  TIER 1: MASTER FILE (Global Overview)                             │
│  ├─ Organizational structure                                        │
│  ├─ Description of MNE's business                                   │
│  ├─ MNE's intangibles                                               │
│  ├─ Intercompany financial activities                               │
│  └─ MNE's financial and tax positions                               │
│                                                                     │
│  TIER 2: LOCAL FILE (Country-Specific)                             │
│  ├─ Local entity information                                        │
│  ├─ Controlled transactions                                         │
│  ├─ Financial information                                           │
│  ├─ Comparability analysis                                          │
│  └─ Selection and application of transfer pricing method            │
│                                                                     │
│  TIER 3: COUNTRY-BY-COUNTRY REPORT (CbCR)                          │
│  ├─ Revenue (related/unrelated)                                     │
│  ├─ Profit before tax                                               │
│  ├─ Income tax paid/accrued                                         │
│  ├─ Employees                                                       │
│  └─ Tangible assets                                                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

Thresholds: CbCR typically required for MNEs with €750M+ consolidated revenue
```

### Amount B: New Safe Harbor (2025)

The OECD's "Amount B" provides a simplified approach for routine marketing and distribution activities:

| Aspect | Amount B Details |
|--------|------------------|
| **Effective Date** | Fiscal years beginning on or after Jan 1, 2025 |
| **Scope** | Baseline marketing and distribution activities |
| **Benefit** | Reduced documentation burden, enhanced tax certainty |
| **US Implementation** | IRS Notice 2025-4 provides guidance |
| **Election** | Voluntary safe harbor election with tax return |

### US Documentation Requirements (IRC Section 482)

```
CONTEMPORANEOUS DOCUMENTATION MUST INCLUDE:
├─ Description of related party transactions
├─ Transfer pricing method selection rationale
├─ Economic analysis supporting arm's length nature
├─ Comparable company/transaction analysis
├─ Contractual terms and conditions
└─ Financial data supporting the analysis

CONTEMPORANEOUS = Available at time of tax return filing
Not automatically submitted but must be available upon IRS request
```

### Penalties

| Jurisdiction | Standard Penalty | Aggravated Penalty | Safe Harbor Relief |
|--------------|------------------|--------------------|--------------------|
| **United States** | 20% of underpayment | 40% for gross valuation misstatement | Contemporaneous documentation |
| **Germany** | Penalties + interest | Additional for late/non-compliant docs | Transaction matrix required |
| **Italy** | 70% of additional tax | Criminal implications possible | Full documentation |
| **Belgium** | Standard corporate penalties | Enhanced scrutiny 2025+ | Master file, local file |

### Germany 2025 Changes

Effective January 1, 2025, Germany requires:
- **Transaction Matrix**: Central element showing all intercompany transactions
- **Required Details**: Parties involved, volume, remuneration, contractual basis, methodology, jurisdictions
- **Shortened Deadlines**: Stricter submission timelines
- **Increased Penalties**: Specific penalties for non-compliance

### The Five Transfer Pricing Methods

```
OECD-APPROVED METHODS:

Traditional Transaction Methods:
1. COMPARABLE UNCONTROLLED PRICE (CUP)
   └─ Direct price comparison with independent transactions

2. RESALE PRICE METHOD (RPM)
   └─ Works backward from resale to unrelated party

3. COST PLUS METHOD
   └─ Cost plus appropriate markup

Transactional Profit Methods:
4. TRANSACTIONAL NET MARGIN METHOD (TNMM)
   └─ Net profit margin relative to appropriate base

5. PROFIT SPLIT METHOD
   └─ Allocates combined profits based on value contribution
```

## Cross-Domain Integration Requirements

### Entity Governance → Transfer Pricing
- Intercompany agreements must be documented
- Management fee arrangements need economic substance
- IP licensing requires functional analysis
- Financing arrangements need arm's length interest rates

### Accounting → Transfer Pricing
- Journal entries must reflect documented transfer prices
- Book-tax differences must be tracked
- Adjustments require audit trail
- Multi-currency considerations apply

### Banking → Transfer Pricing
- Intercompany payments must match documented prices
- Cash pooling interest must be arm's length
- Cross-border payments need supporting documentation
- Withholding tax implications vary by treaty

## Model Implications

### Required Data Elements

```typescript
interface TransferPricingPolicy {
  id: string;
  policyType: 'goods' | 'services' | 'ip' | 'financing';

  // Parties
  transferorEntityId: string;
  transfereeEntityId: string;

  // Method
  method: TPMethod;
  methodRationale: string;

  // Pricing
  pricingMechanism: PricingFormula;
  comparableAnalysis: ComparableAnalysisId;

  // Documentation
  masterFileRef?: string;
  localFileRef?: string;
  intercompanyAgreementId: string;

  // Lifecycle
  effectiveDate: Date;
  reviewDate: Date;  // Annual minimum
  approvedBy: string;
}

interface IntercompanyTransaction {
  id: string;
  policyId: string;

  // Transaction details
  transactionDate: Date;
  amount: Money;
  currency: CurrencyCode;

  // Audit trail
  journalEntryId: string;
  paymentId?: string;

  // Compliance
  armLengthTestResult: 'pass' | 'adjustment_needed';
  adjustmentAmount?: Money;
}
```

## Questions for Further Research

1. How should the system handle transfer pricing adjustments that affect multiple entities?
2. What automation is possible for comparable company analysis?
3. How do tax treaties affect transfer pricing documentation requirements?
4. What triggers a mandatory transfer pricing study update?
5. How should intercompany financing be documented for cash pooling arrangements?

## Sources

- [OECD Transfer Pricing Guidelines 2024 Updates](https://efeconsultinggroup.com/resources/article/navigating-the-oecd-transfer-pricing-guidelines-2025-key-updates-and-global-implications)
- [Chambers Transfer Pricing 2025 Guide](https://practiceguides.chambers.com/practice-guides/transfer-pricing-2025)
- [OECD US Country Profile](https://www.oecd.org/content/dam/oecd/en/topics/policy-sub-issues/transfer-pricing/transfer-pricing-country-profile-united-states.pdf)
- [EY Worldwide Transfer Pricing Reference Guide 2025](https://www.ey.com/en_gl/technical/tax-guides/worldwide-transfer-pricing-reference-guide)
- [IRS Guidance on Amount B](https://www.mgocpa.com/perspective/irs-releases-guidance-on-new-transfer-pricing-methodology/)

---

*Research conducted: January 2026*
*Gap identified in: entity-governance/research/08-holding-company-structures.md*
