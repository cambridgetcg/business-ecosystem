# Transfer Pricing Operational Mechanics

> Gap #01: We know transfer pricing exists, but lack operational procedures for determining arm's length prices.

## Gap Identification

**Category**: Operational HOW
**Severity**: CRITICAL
**Blocks Implementation Phase(s)**: Phase 2 (Accounting), Phase 4 (Tax)

## Current State

Existing research covers:
- Transfer pricing documentation requirements (OECD three-tier framework)
- Amount B safe harbor for distribution activities
- Penalty structures by jurisdiction
- Why transfer pricing matters (nuance-gap 01)

## What's Missing

The system can STORE transfer pricing policies but cannot DETERMINE pricing because:

1. **Method Selection Logic**: No decision tree for selecting appropriate TP method
2. **Price Calculation Procedures**: No formulas/processes for calculating actual prices
3. **Comparables Analysis**: No process for finding and using comparable data
4. **Update Triggers**: No criteria for when policies need revision
5. **Documentation Workflow**: No step-by-step process for creating required documentation

## Research Findings

### The Five OECD Methods - When to Use Each

From [Aibidia Transfer Pricing Methods](https://www.aibidia.com/resources/the-5-transfer-pricing-methods-explained):

```
METHOD SELECTION DECISION TREE:

START: What type of transaction?
        │
        ├─ GOODS (Tangible Property)
        │   │
        │   ├─ Commodities/Standard Products?
        │   │   └─ YES → CUP METHOD (comparable uncontrolled price)
        │   │           Use publicly quoted prices as benchmark
        │   │
        │   └─ Manufactured Products?
        │       │
        │       ├─ Distributor (buys, resells)?
        │       │   └─ RESALE PRICE METHOD
        │       │       Resale price minus appropriate margin
        │       │
        │       └─ Manufacturer (makes, sells)?
        │           └─ COST PLUS METHOD
        │               Cost of production plus appropriate markup
        │
        ├─ SERVICES
        │   │
        │   ├─ Routine Services (admin, back-office)?
        │   │   └─ COST PLUS METHOD
        │   │       Cost plus markup (typically 3-10%)
        │   │
        │   └─ Complex/High-Value Services?
        │       └─ TNMM or PROFIT SPLIT
        │           Based on profit contribution
        │
        ├─ INTANGIBLES (IP, licenses, royalties)
        │   │
        │   ├─ Unique, high-value IP?
        │   │   └─ PROFIT SPLIT METHOD
        │   │       Split based on relative contribution
        │   │
        │   └─ Licensed technology/trademarks?
        │       │
        │       ├─ Comparable licenses exist?
        │       │   └─ CUP METHOD (royalty benchmarking)
        │       │
        │       └─ No comparable licenses?
        │           └─ TNMM or PROFIT SPLIT
        │
        └─ FINANCING (loans, guarantees)
            │
            └─ INTEREST RATE BENCHMARKING
                Based on credit rating, loan terms
                Use comparable loan databases
```

### Method Calculation Procedures

```
1. COMPARABLE UNCONTROLLED PRICE (CUP)

   Formula: Transfer Price = Comparable Price (adjusted for differences)

   Process:
   ├─ Step 1: Identify internal comparables (transactions with 3rd parties)
   ├─ Step 2: If none, search external databases (Orbis, Amadeus)
   ├─ Step 3: Apply comparability factors:
   │   ├─ Product/service characteristics
   │   ├─ Contractual terms
   │   ├─ Economic circumstances
   │   ├─ Business strategies
   │   └─ Functions, assets, risks
   ├─ Step 4: Make adjustments for material differences
   └─ Step 5: Document rationale and comparables used

   Example:
   ├─ Internal sale of Widget X to subsidiary: $100/unit
   ├─ External sale of Widget X to third party: $95/unit
   ├─ Difference due to: volume discount (5%), shipping terms
   └─ Arm's length price: $95 + adjustments = $98/unit


2. RESALE PRICE METHOD

   Formula: Transfer Price = Resale Price × (1 - Resale Margin)

   Process:
   ├─ Step 1: Identify resale price to independent customer
   ├─ Step 2: Find comparable resale margins
   │   ├─ Search distributor benchmarking databases
   │   └─ Compare gross margins of similar distributors
   ├─ Step 3: Apply resale margin percentage
   └─ Step 4: Deduct costs associated with purchase (customs, duties)

   Example:
   ├─ Subsidiary resells product to customer for: $1,000
   ├─ Comparable distributor gross margin: 25%
   ├─ Transfer price: $1,000 × (1 - 0.25) = $750
   └─ This is the arm's length intercompany price


3. COST PLUS METHOD

   Formula: Transfer Price = Costs + (Costs × Markup %)

   Process:
   ├─ Step 1: Calculate full cost of goods/services
   │   ├─ Direct costs (materials, labor)
   │   ├─ Indirect costs (overhead allocation)
   │   └─ Operating costs (if appropriate)
   ├─ Step 2: Find comparable markups
   │   └─ Search manufacturing/service provider benchmarks
   ├─ Step 3: Apply markup percentage
   └─ Step 4: Document cost pool and allocation method

   Example:
   ├─ Manufacturing cost of product: $600
   ├─ Comparable manufacturer markup: 15%
   ├─ Transfer price: $600 × (1 + 0.15) = $690
   └─ This is the arm's length intercompany price


4. TRANSACTIONAL NET MARGIN METHOD (TNMM)

   Formula: Net Profit = Revenue × Net Margin %
            (or) Transfer Price adjusted until margin achieved

   Process:
   ├─ Step 1: Select tested party (usually less complex entity)
   ├─ Step 2: Choose profit level indicator (PLI):
   │   ├─ Operating margin (OM) = Operating profit / Revenue
   │   ├─ Berry ratio = Gross profit / Operating expenses
   │   ├─ Return on assets = Operating profit / Assets
   │   └─ Cost plus margin = Operating profit / Total costs
   ├─ Step 3: Find comparable PLIs from database
   ├─ Step 4: Establish interquartile range
   └─ Step 5: Adjust pricing to fall within range

   Example:
   ├─ Distributor revenue: $10M
   ├─ Comparable operating margin range: 2-5%
   ├─ Target margin: 3.5% (median)
   ├─ Target operating profit: $350K
   └─ Adjust transfer prices until this margin achieved


5. PROFIT SPLIT METHOD

   Formula: Each party's profit = Combined Profit × Contribution %

   Process:
   ├─ Step 1: Determine combined profits from transaction
   ├─ Step 2: Allocate routine returns to routine functions
   ├─ Step 3: Split residual profits based on:
   │   ├─ Functions performed
   │   ├─ Assets used (especially intangibles)
   │   ├─ Risks assumed
   │   └─ Capital employed
   └─ Step 4: Calculate implied transfer prices

   Example:
   ├─ Combined profit from IP-intensive product: $5M
   ├─ Parent contribution: R&D, brand (70%)
   ├─ Subsidiary contribution: Manufacturing (30%)
   ├─ Parent profit allocation: $3.5M
   ├─ Subsidiary profit allocation: $1.5M
   └─ Transfer prices set to achieve this split
```

### Comparables Analysis Process

From [RoyaltyRange](https://www.royaltyrange.com/resources/transfer-pricing-methods/):

```
COMPARABLES ANALYSIS WORKFLOW:

Step 1: Define Search Criteria
├─ Industry codes (NAICS/SIC)
├─ Geographic region
├─ Company size (revenue range)
├─ Functional profile (manufacturer, distributor, etc.)
└─ Time period (typically 3-5 years)

Step 2: Database Search
├─ Primary: Orbis, Amadeus, Capital IQ
├─ Secondary: Public filings, industry reports
└─ Tertiary: RoyaltyStat (for royalty rates)

Step 3: Apply Comparability Filters
├─ Quantitative: Financial metrics, size
├─ Qualitative: Business description, strategy
└─ Eliminate: Related party transactions, unusual items

Step 4: Calculate Interquartile Range
├─ Order results by PLI
├─ Calculate 25th percentile (Q1)
├─ Calculate median (Q2)
├─ Calculate 75th percentile (Q3)
└─ Document full range and rationale for target point

Step 5: Document and Maintain
├─ Save search parameters
├─ Retain comparables data
├─ Update annually or upon material change
└─ Prepare for audit defense
```

### Policy Update Triggers

```
WHEN TO UPDATE TRANSFER PRICING POLICIES:

MANDATORY TRIGGERS:
☐ New intercompany transaction type introduced
☐ Business model change (e.g., distributor → agent)
☐ Significant change in functions, assets, or risks
☐ Acquisition or restructuring
☐ Material change in economic conditions
☐ Regulatory change affecting methodology
☐ Audit adjustment received

PERIODIC TRIGGERS:
☐ Annual review of comparables (refresh benchmark)
☐ Three-year full policy review
☐ Update local files annually
☐ Update master file when group structure changes

MONITORING TRIGGERS:
☐ Actual results deviate from policy by >10%
☐ Comparable company results shift range
☐ Currency movements affect pricing basis
☐ Inflation materially affects cost base
```

### Documentation Requirements

From [CIAT Transfer Pricing Guide](https://www.ciat.org/transfer-pricing-traditional-transactional-methods-and-compliance-with-the-arms-length-principle/?lang=en):

```
DOCUMENTATION CREATION WORKFLOW:

MASTER FILE (Group-wide):
├─ Organizational structure with ownership
├─ Description of MNE's business
├─ MNE's intangibles (list, ownership, royalties)
├─ Intercompany financial activities
├─ MNE's financial and tax positions
└─ Update: When group structure changes

LOCAL FILE (Per entity):
├─ Local entity information
├─ Controlled transactions (with amounts)
├─ Comparability analysis
├─ Selection of TP method with rationale
├─ Financial information used
└─ Update: Annually

COUNTRY-BY-COUNTRY REPORT:
├─ Revenue (related/unrelated) by jurisdiction
├─ Profit before tax by jurisdiction
├─ Tax paid/accrued by jurisdiction
├─ Employees, assets by jurisdiction
└─ Update: Annually, file with tax authority
```

## Implementation Implications

### Schema Additions

```typescript
interface TransferPricingPolicy {
  policyId: string;
  policyType: TPTransactionType;

  // Parties
  transferorEntityId: string;
  transfereeEntityId: string;

  // Method
  selectedMethod: TPMethod;
  methodSelectionRationale: string;

  // Pricing Mechanism
  pricingMechanism: {
    type: 'fixed_price' | 'cost_plus' | 'resale_minus' | 'margin_target';
    baseValue?: Money;
    markupPercentage?: number;
    marginTarget?: number;
    adjustmentFactors?: AdjustmentFactor[];
  };

  // Comparables
  comparablesAnalysis: {
    searchDate: Date;
    database: string;
    searchCriteria: SearchCriteria;
    comparablesFound: number;
    interquartileRange: {
      q1: number;
      median: number;
      q3: number;
    };
    selectedPoint: number;
    selectionRationale: string;
  };

  // Review
  effectiveDate: Date;
  nextReviewDate: Date;
  lastReviewDate?: Date;
  reviewTriggers: TriggerEvent[];
}

type TPMethod =
  | 'cup'          // Comparable Uncontrolled Price
  | 'resale_price' // Resale Price Method
  | 'cost_plus'    // Cost Plus Method
  | 'tnmm'         // Transactional Net Margin Method
  | 'profit_split'; // Profit Split Method

type TPTransactionType =
  | 'goods'
  | 'services'
  | 'intangibles'
  | 'financing';
```

### Service Methods Needed

```typescript
interface TransferPricingService {
  // Method selection
  recommendMethod(transaction: TransactionProfile): TPMethod;

  // Price calculation
  calculateArmLengthPrice(
    transaction: IntercompanyTransaction,
    policy: TransferPricingPolicy
  ): Money;

  // Comparables
  searchComparables(criteria: SearchCriteria): ComparablesResult;
  calculateInterquartileRange(comparables: Comparable[]): IQRResult;

  // Validation
  validateTransaction(
    transaction: IntercompanyTransaction,
    policy: TransferPricingPolicy
  ): ValidationResult;

  // Monitoring
  checkPolicyTriggers(policy: TransferPricingPolicy): TriggerEvent[];
  flagDeviations(actual: Money, expected: Money, threshold: number): boolean;
}
```

## Outstanding Questions

1. **Safe Harbor Simplification**: When can Amount B safe harbor be used instead of full analysis?
2. **Intragroup Services**: When do low-value-adding services qualify for simplified 5% markup?
3. **Financial Transactions**: How to handle thin capitalization rules alongside TP?

## Sources

- [Aibidia: The 5 Transfer Pricing Methods Explained](https://www.aibidia.com/resources/the-5-transfer-pricing-methods-explained)
- [Archipel: 5 OECD Transfer Pricing Methods](https://www.archipeltaxadvice.nl/insights/5-transfer-pricing-methods/)
- [Transfer Pricing Asia: Five Methods with Examples](https://transferpricingasia.com/2017/03/17/five-transfer-pricing-methods-examples/)
- [RoyaltyRange: Transfer Pricing Methods](https://www.royaltyrange.com/resources/transfer-pricing-methods/)
- [CIAT: Traditional Transactional Methods](https://www.ciat.org/transfer-pricing-traditional-transactional-methods-and-compliance-with-the-arms-length-principle/?lang=en)
- [PIASCIK: Understanding Arm's Length Pricing](https://www.piascik.cpa/client-resources/information-center/arms-length-pricing)

---

*Research conducted: January 2026*
*Gap identified in: Mission-requirement analysis - accounting intercompany needs TP procedures*
