# Intellectual Property Valuation Methods

## Research Question
How is intellectual property valued? What are the three standard approaches, and when should each be used? How do modern AI tools and ESG considerations affect IP valuation?

## Current Model Gap
The IP service PURPOSE.md mentions **IP Strategy** including portfolio valuation, but:
- No valuation framework exists in the domain model
- No tracking of valuation history
- No linkage between valuations and business events (licensing, M&A, collateral)
- No methodology documentation per asset

---

## Key Findings

### The Strategic Imperative

In 2023, the global IP market was valued at over **$2 trillion**, projected to **triple by 2031**. Understanding IP valuation is no longer optional - it's a strategic imperative for:
- M&A transactions
- Licensing negotiations
- Financing (IP as collateral)
- Tax planning and transfer pricing
- Litigation damages calculations
- Financial reporting (GAAP/IFRS)

### The Three Core Approaches

#### 1. Income Approach (Most Common for IP)

Calculates IP value based on the **present worth of future economic benefits**.

**Methods within Income Approach**:

| Method | How It Works | Best For |
|--------|--------------|----------|
| **Discounted Cash Flow (DCF)** | Project future cash flows attributable to IP, discount to present value | Patents generating identifiable revenue |
| **Relief from Royalty** | What would you pay to license this IP if you didn't own it? | Trademarks, technology licenses |
| **Excess Earnings** | Total earnings minus fair return on other assets = IP contribution | Complex portfolios |

**Key Variables**:
- Projected revenue/cost savings
- Royalty rate (from comparable licenses)
- Useful economic life
- Discount rate (risk-adjusted)

**Strengths**: Reflects earning potential, forward-looking
**Weaknesses**: Highly dependent on projections, subjectivity in assumptions

#### 2. Market Approach (Comparables)

Compares the subject IP to **similar IP that has been sold or licensed**.

**Methods within Market Approach**:
- Comparable transactions (actual sales)
- Comparable licensing rates
- Industry benchmarking

**Key Challenges**:
- IP is inherently unique - true comparables rare
- Transaction details often confidential
- Context matters (distressed sale vs. strategic acquisition)

**Data Sources**:
- RoyaltySource, ktMINE, RoyaltyStat (royalty databases)
- SEC filings (disclosed transactions)
- Court cases (damages awards)

**Strengths**: Market-based reality, defensible
**Weaknesses**: Hard to find true comparables, historical data may be stale

#### 3. Cost Approach (Floor Value)

Calculates value based on **cost to recreate or replace** the IP.

**Methods within Cost Approach**:
- **Reproduction cost**: Exact recreation
- **Replacement cost**: Functional equivalent
- **Historical cost**: Actual R&D investment

**What to Include**:
- Direct R&D costs (labor, materials, equipment)
- Indirect costs (overhead, management)
- Opportunity cost (time to develop)
- Failed attempts (part of development process)
- Legal costs (prosecution, registration)

**Strengths**: Objective, verifiable costs
**Weaknesses**: Doesn't reflect market value or earning potential, only provides **floor value**

### When to Use Each Approach

| Situation | Recommended Approach |
|-----------|---------------------|
| Mature technology with revenue history | Income (DCF) |
| Trademark with licensing program | Income (Relief from Royalty) |
| Early-stage technology, no revenue | Cost |
| IP sale negotiation | Market (if comparables exist) |
| Litigation damages | Income + Market |
| Financial reporting | Income (GAAP/IFRS preference) |
| Tax/Transfer pricing | All three, reconciled |

### Hybrid and Emerging Methods

**Multi-Period Excess Earnings Method (MPEEM)**:
- Combines income approach with contributory asset charges
- Required under ASC 805 for business combinations
- Isolates value attributable specifically to IP vs. other assets

**Option-Based Valuation**:
- Treats IP as a "real option" on future opportunities
- Accounts for strategic flexibility value
- Useful for platform technologies with multiple applications

**AI-Driven Analytics (2025-2026)**:
- Automated comparable transaction identification
- Patent claim landscape analysis
- Predictive analytics for remaining useful life
- Portfolio-level optimization

### ESG Considerations (Emerging 2025)

- **Green patents** (clean energy, sustainability) commanding premium valuations
- ESG scoring beginning to influence IP portfolio assessments
- Carbon-reduction technology valued for regulatory positioning

### Valuation for Different IP Types

| IP Type | Primary Method | Key Considerations |
|---------|----------------|-------------------|
| **Patents** | Income or Cost | Remaining term, claim breadth, market coverage |
| **Trademarks** | Income (Relief from Royalty) | Brand strength, market recognition, licensing history |
| **Copyrights** | Income | Remaining duration, exploitation channels |
| **Trade Secrets** | Cost or Income | Competitive advantage duration, protection strength |
| **Software** | Income or Cost | Technology lifecycle, maintenance requirements |

---

## Domain Model Implications

### Missing Entity: IPValuation

```typescript
interface IPValuation {
  id: string;

  // What's being valued
  ipAssetId: string;
  ipAssetType: 'patent' | 'trademark' | 'copyright' | 'trade_secret' | 'portfolio';

  // Valuation context
  purpose: 'licensing' | 'sale' | 'financing' | 'litigation' | 'tax' |
           'financial_reporting' | 'strategic_planning' | 'ma_due_diligence';
  valuationDate: Date;
  effectiveDate: Date;       // As-of date for valuation

  // Methodology
  primaryApproach: 'income' | 'market' | 'cost';
  methodology: string;       // Specific method (DCF, Relief from Royalty, etc.)
  secondaryApproach?: 'income' | 'market' | 'cost';

  // Results
  concludedValue: number;
  valueLow?: number;         // Range low
  valueHigh?: number;        // Range high
  currency: string;

  // Key assumptions
  assumptions: ValuationAssumption[];

  // Preparer
  preparedBy: 'internal' | 'external';
  valuationFirmName?: string;
  valuatorName?: string;
  valuatorCredentials?: string;  // ASA, CFA, etc.

  // Documentation
  reportDocumentId?: string;
  status: 'draft' | 'final' | 'superseded';
}

interface ValuationAssumption {
  category: 'revenue' | 'royalty_rate' | 'discount_rate' | 'useful_life' |
            'growth_rate' | 'market_size' | 'cost' | 'other';
  description: string;
  value: string;
  source?: string;
  sensitivityImpact?: 'high' | 'medium' | 'low';
}
```

### Missing Entity: ComparableTransaction

```typescript
interface ComparableTransaction {
  id: string;

  // Transaction details
  transactionType: 'sale' | 'license' | 'settlement' | 'court_award';
  transactionDate: Date;

  // IP involved
  ipType: 'patent' | 'trademark' | 'copyright' | 'trade_secret' | 'portfolio';
  industryClassification: string;
  technologyArea?: string;

  // Economics
  transactionValue?: number;
  royaltyRate?: number;      // As percentage
  royaltyBase?: string;      // Net sales, gross sales, units, etc.
  upfrontPayment?: number;

  // Source
  source: 'public_filing' | 'database' | 'court_record' | 'industry_report';
  sourceReference: string;
  confidenceLevel: 'high' | 'medium' | 'low';

  // Notes
  adjustmentFactors?: string;
  notes?: string;
}
```

### Integration Points

- **License entity**: Link valuations to license negotiations
- **M&A due diligence**: Portfolio valuation for transactions
- **Financial reporting**: Annual impairment testing
- **Litigation**: Damages calculations reference valuations

---

## Sources
- [IP Valuation Methods - ETB Law](https://www.etblaw.com/how-is-ip-financially-evaluated/)
- [How to Value IP - Acquire.com](https://blog.acquire.com/how-to-value-intellectual-property/)
- [Introduction to IP Valuation - IAM](https://www.iam-media.com/guide/india-managing-the-ip-lifecycle/2026/article/introduction-ip-valuation)
- [IP Valuation Methods - PatentPC](https://patentpc.com/blog/ip-valuation-methods-explained-cost-market-and-income-approaches)
- [Traditional IP Valuation - Nevium](https://nevium.com/ip-valuation/ip-value/)
- [Cost Approach - CONSOR](https://consor.com/ip-valuation-what-methods-are-used-to-value-intellectual-property-and-intangible-assets-the-cost-approach)
- [IP Valuation Methods - RoyaltyRange](https://www.royaltyrange.com/news/ip-valuation-methods/)

---

## Research Date
2026-01-27
