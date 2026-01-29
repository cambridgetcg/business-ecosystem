# Intercompany Netting and Cash Pooling Structures

## Knowledge Gap Identified

Current research lacks cross-domain integration guidance for intercompany financial operations. Cash pooling and netting are critical treasury tools that touch entity governance, accounting, banking, and compliance simultaneously, yet no document addresses the integrated requirements.

## Key Findings

### Cash Pooling Overview

Cash pooling is a centralized cash management tool that optimizes cash balances across subsidiaries, eliminating idle cash and reducing overdrafts among entities with varying daily positions.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CASH POOLING TYPES                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  PHYSICAL POOLING (Zero Balance Accounts)                          │
│  ├─ Actual fund movement between accounts                          │
│  ├─ Subaccounts swept to/from header account daily                 │
│  ├─ Creates intercompany loans (debtor/creditor)                   │
│  ├─ Interest on individual balances                                │
│  └─ More common in US due to regulatory constraints                │
│                                                                     │
│  NOTIONAL POOLING                                                  │
│  ├─ No actual fund movement                                        │
│  ├─ Shadow/notional position from aggregate                        │
│  ├─ Interest calculated on consolidated position                   │
│  ├─ No intercompany loans created                                  │
│  └─ More common outside US, multi-currency friendly                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Physical Pooling Mechanics

```
DAILY SWEEP EXAMPLE:

Before Sweep:                    After Sweep:
┌─────────────────┐             ┌─────────────────┐
│ Header Account  │             │ Header Account  │
│ Balance: $0     │             │ Balance: $150K  │
└─────────────────┘             └─────────────────┘
        │                               │
    ┌───┼───┐                       ┌───┼───┐
    ▼   ▼   ▼                       ▼   ▼   ▼
┌─────┐┌─────┐┌─────┐           ┌─────┐┌─────┐┌─────┐
│Sub A││Sub B││Sub C│           │Sub A││Sub B││Sub C│
│+100K││+80K ││-30K │           │  $0 ││  $0 ││  $0 │
└─────┘└─────┘└─────┘           └─────┘└─────┘└─────┘

Creates:
├─ Sub A owes Header $100K (intercompany loan)
├─ Sub B owes Header $80K (intercompany loan)
└─ Header owes Sub C $30K (intercompany loan)
```

### Legal and Regulatory Requirements

#### US Requirements

```
US CASH POOLING COMPLIANCE:

IRS Section 482 (Transfer Pricing):
├─ Interest rates must be arm's length
├─ Documentation required for intercompany loans
├─ Comparable rates must be analyzed
└─ Penalties for non-compliance

Corporate Law:
├─ Board approvals required
├─ Operating agreement amendments may be needed
├─ Fiduciary duty considerations
├─ Upstream loans may require solvency analysis

State Considerations:
├─ Usury laws in some states
├─ Franchise tax implications
├─ State income tax apportionment
└─ Corporate formality requirements

Withholding Tax:
├─ Cross-border interest may have withholding
├─ Treaty benefits require proper filing
├─ Form W-8BEN-E documentation
└─ Proper allocation to avoid double taxation
```

#### International Considerations

```
JURISDICTION-SPECIFIC ISSUES:

Belgium (2025+):
├─ Enhanced master file requirements
├─ Detailed description of financing policies
├─ Intercompany financing instruments disclosure
├─ Debt capacity analysis required
└─ Rationale documentation mandatory

Germany:
├─ Strict thin capitalization rules
├─ Interest barrier regulations
├─ Documentation requirements
└─ Transfer pricing scrutiny

China:
├─ Strict currency controls
├─ Cross-border pooling restrictions
├─ Regulatory approvals required
└─ Repatriation limitations

Thin Capitalization Rules (Various):
├─ Debt-to-equity limits
├─ Interest deductibility caps
├─ Varying by jurisdiction
└─ Intercompany debt especially scrutinized
```

### Transfer Pricing for Cash Pools

```
ARM'S LENGTH CONSIDERATIONS:

Cash Pool Leader Compensation:
├─ Typically earns spread between debit/credit rates
├─ Plus administrative fee
├─ Based on functions, assets, risks assumed
└─ Must be documented and supportable

Member Rates:
├─ Depositors should earn more than bank deposits
├─ Borrowers should pay less than external loans
├─ Spread benefits allocated to members
└─ "Enhancement" concept

Synergy Benefits:
├─ Netting benefit from consolidated position
├─ Must be allocated among participants
├─ Based on contribution to net position
└─ Documentation critical
```

### Intercompany Netting

```
NETTING ARRANGEMENT:

Purpose: Settle multiple intercompany transactions with single payment
instead of multiple cross-payments

Without Netting:              With Netting:
A pays B: $100K               A pays B: $20K (net)
B pays A: $80K                (Single settlement)
─────────────                 ────────────────
Total flows: $180K            Total flow: $20K

MULTILATERAL NETTING:
┌─────────────────────────────────────────────────────────────────┐
│                         NETTING CENTER                          │
│                                                                 │
│  Entity A    Entity B    Entity C    Entity D                   │
│  ───────     ───────     ───────     ───────                    │
│  Owes: $500K Owes: $300K Owes: $400K Owes: $200K               │
│  Owed: $400K Owed: $350K Owed: $250K Owed: $400K               │
│  ───────     ───────     ───────     ───────                    │
│  Net: -$100K Net: +$50K  Net: -$150K Net: +$200K               │
│  (Pays)      (Receives)  (Pays)      (Receives)                │
│                                                                 │
│  Total settlement: $250K instead of $1,400K gross              │
└─────────────────────────────────────────────────────────────────┘
```

### Accounting Treatment

```
PHYSICAL POOLING ACCOUNTING:

Each sweep creates journal entries:
├─ Header entity: DR Cash / CR Intercompany Payable (for deposits)
├─ Header entity: DR Intercompany Receivable / CR Cash (for funding)
├─ Subsidiary: DR Intercompany Receivable / CR Cash (deposits)
├─ Subsidiary: DR Cash / CR Intercompany Payable (funding)

Interest accrual:
├─ DR/CR Intercompany Interest based on daily balances
├─ Must use arm's length rates
└─ Monthly or quarterly settlement

Consolidated elimination:
├─ All intercompany balances eliminate
├─ All intercompany interest eliminates
└─ Only external interest appears

NETTING ACCOUNTING:

Assets and liabilities NOT novated:
├─ Original A/R and A/P remain on subsidiary books
├─ Netting center does not assume ownership
├─ Settlement reduces balances
└─ NOT balance sheet netting (different concept)
```

### BEPS and Basel Implications

```
OECD BEPS:
├─ Transfer pricing scrutiny on intercompany transactions
├─ Cash pooling is established tool (not threatened)
├─ BUT: Documentation requirements increased
├─ Complex treasury structures face more scrutiny
└─ Arm's length principle strictly enforced

Basel III/IV:
├─ Bank liquidity ratios affected
├─ Scrutiny of transaction services vs credit allocation
├─ Larger banks face higher leverage requirements
├─ May affect cash pool pricing
└─ Cross-border pool complexity
```

## Cross-Domain Integration Requirements

### Entity Governance → Cash Pool Design

```
GOVERNANCE REQUIREMENTS:

Formation:
├─ Cash Pool Agreement (master agreement)
├─ Intercompany Loan Agreements per participant
├─ Board resolutions authorizing participation
├─ Operating agreement amendments if needed

Ongoing:
├─ Annual renewal/confirmation
├─ Interest rate documentation
├─ Transfer pricing policy alignment
├─ Fiduciary duty compliance
└─ Solvency monitoring for upstream loans
```

### Accounting → Cash Pool Tracking

```
ACCOUNTING INTEGRATION:

Daily:
├─ Record sweep transactions
├─ Update intercompany balances
├─ FX translation for multi-currency

Monthly:
├─ Interest accrual
├─ Rate documentation
├─ Reconciliation

Quarterly/Annual:
├─ Transfer pricing compliance review
├─ Arm's length rate validation
├─ Disclosure preparation
└─ Consolidation elimination
```

### Banking → Cash Pool Operations

```
BANKING INTEGRATION:

Account Structure:
├─ Header account at pool bank
├─ Subaccounts linked for sweeping
├─ Target balance configuration
├─ Sweep timing and frequency

Reporting:
├─ Daily balance reports
├─ Sweep transaction details
├─ Interest statements
├─ Multi-currency positions

Technology:
├─ TMS integration
├─ Automated reconciliation
├─ Cash forecasting inputs
└─ Payment initiation
```

## Model Implications

### Required Data Elements

```typescript
interface CashPoolStructure {
  poolId: string;
  poolName: string;
  poolType: 'physical' | 'notional';

  // Participants
  headerEntityId: string;
  participants: CashPoolParticipant[];

  // Bank
  bankId: string;
  headerAccountId: string;

  // Configuration
  sweepTiming: 'end_of_day' | 'intraday' | 'both';
  targetBalance: Money;
  interestCalculation: InterestMethod;

  // Transfer Pricing
  spreadConfiguration: SpreadConfig;
  benchmarkRate: string;  // e.g., "SOFR + 50bps"

  // Governance
  poolAgreementId: string;
  boardResolutions: BoardResolutionId[];
  effectiveDate: Date;
  reviewDate: Date;
}

interface CashPoolParticipant {
  entityId: string;
  accountId: string;
  participationType: 'depositor_only' | 'borrower_only' | 'full';

  // Limits
  maxBorrowingLimit?: Money;
  targetBalance: Money;

  // Rates (spread from benchmark)
  depositSpread: number;  // basis points
  borrowSpread: number;   // basis points

  // Intercompany Agreement
  intercompanyAgreementId: string;

  // Authorization
  boardResolutionId: string;
  effectiveDate: Date;
}

interface IntercompanyNettingRun {
  runId: string;
  runDate: Date;
  settlementDate: Date;

  // Participants
  positions: NettingPosition[];

  // Results
  grossPayables: Money;
  grossReceivables: Money;
  netSettlements: NetSettlement[];
  savingsVsGross: Money;

  // Settlements
  settlementStatus: 'pending' | 'in_progress' | 'completed' | 'failed';
  settlementTransactions: PaymentId[];
}

interface NettingPosition {
  entityId: string;

  // Gross Amounts
  totalPayables: Money;
  totalReceivables: Money;

  // Counterparty Detail
  payablesByCounterparty: Map<EntityId, Money>;
  receivablesByCounterparty: Map<EntityId, Money>;

  // Net Position
  netPosition: Money;  // Positive = receives, Negative = pays
}
```

## Questions for Further Research

1. How should cash pool interest rates be documented for transfer pricing defense?
2. What solvency tests apply to upstream loans in cash pools?
3. How do thin capitalization rules affect cash pool structures?
4. What is the optimal netting frequency for different business models?
5. How should FX risk in multi-currency pools be managed and allocated?

## Sources

- [Modern Treasury: Cash Pooling Guide](https://www.moderntreasury.com/learn/cash-pooling)
- [NeuGroup: Cash Pooling for Multinationals](https://www.neugroup.com/cash-pooling-a-refresher-on-the-effects-of-tax-and-regulatory-changes/)
- [FTI Treasury: Intercompany Netting](https://www.ftitreasury.com/how-inter-company-netting-can-save-your-business-time-and-money/)
- [Ramp: Cash Pooling Types and Examples](https://ramp.com/blog/cash-pooling)
- [Nomentia: Cash Pooling Best Practices](https://www.nomentia.com/blog/best-cash-pooling-practices-and-strategies-for-centralized-cash)
- [CFGI: Strategic Intercompany Netting](https://www.cfgi.com/resources/articles/untangling-the-web-how-strategic-intercompany-netting-can-prevent-fx-issues-before-they-start/)
- [Tiberghien Economics: Cash Pools vs Current Accounts](https://tiberghieneconomics.com/cash-pools-current-accounts-and-short-term-loans-understanding-the-difference)
- [PwC Viewpoint: Treasury Center Hedging](https://viewpoint.pwc.com/dt/us/en/pwc/accounting_guides/derivatives_and_hedg/derivatives_and_hedg_US/chapter_8_foreign_cu_US/88_treasury_center_h_US.html)

---

*Research conducted: January 2026*
*Gap identified in: Cross-domain integration between entity-governance, accounting, and banking-treasury*
