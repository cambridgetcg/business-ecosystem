# Cash Pool Interest Calculations

> Gap #02: System understands cash pooling exists but lacks operational mechanics for interest allocation.

## Gap Identification

**Category**: Operational HOW
**Severity**: CRITICAL
**Blocks Implementation Phase(s)**: Phase 3 (Banking-Treasury)

## Current State

Existing research covers:
- Physical vs notional pooling concepts
- In-house bank structures
- Cross-border pooling restrictions
- General cash management strategies

## What's Missing

Cannot operationalize treasury cash management because:

1. **Interest Calculation Formulas**: How exactly is interest calculated in physical vs notional pools?
2. **IC Loan Generation**: When physical sweeps occur, what intercompany loan records are created?
3. **Arm's Length Rates**: How to determine compliant interest rates for pool transactions?
4. **Allocation Methods**: How is pool benefit/cost distributed among participants?
5. **Settlement Mechanics**: When and how are interest settlements processed?

## Research Findings

### Physical Cash Pooling Interest Mechanics

From [Agicap](https://agicap.com/en/article/cash-pooling/) and [Nomentia](https://www.nomentia.com/blog/how-does-physical-cash-pooling-target-balancing-work-with-a-tms):

```
PHYSICAL POOLING MECHANICS:

How It Works:
├─ Sub-account balances "sweep" to header account periodically
├─ Header account takes legal ownership of cash
├─ Sweep creates intercompany loan between header and subsidiary
└─ Reverse sweep returns funds as needed

Intercompany Loan Treatment:
┌─────────────────────────────────────────────────────────────────────────────┐
│  When Subsidiary A sweeps $100K to Header:                                  │
│                                                                             │
│  Header's Books:                                                            │
│  ├─ DR: Cash                           $100,000                            │
│  └─ CR: IC Loan Payable to Sub A       $100,000                            │
│                                                                             │
│  Subsidiary A's Books:                                                      │
│  ├─ DR: IC Loan Receivable from Header $100,000                            │
│  └─ CR: Cash                           $100,000                            │
│                                                                             │
│  Interest Accrual (monthly):                                                │
│  ├─ Header: DR Interest Expense, CR IC Interest Payable                    │
│  └─ Sub A: DR IC Interest Receivable, CR Interest Income                   │
└─────────────────────────────────────────────────────────────────────────────┘

Interest Calculation:
├─ Interest = Average Daily Balance × Rate × (Days / 365)
├─ Rate must be arm's length (see TP requirements below)
└─ Calculated daily, settled monthly or quarterly
```

### Notional Cash Pooling Interest Mechanics

From [Oracle Documentation](https://docs.oracle.com/cd/E86317_01/html/OBLM/OBLM04_Notional%20Pooling.htm):

```
NOTIONAL POOLING METHODS:

1. REPLACEMENT INTEREST PAYMENT METHOD
   ├─ Bank suppresses interest at participant accounts
   ├─ Single payment/charge based on pool header net balance
   ├─ Header receives/pays all interest
   └─ No intercompany loans created (no physical movement)

2. ADVANTAGE METHOD
   ├─ Bank calculates interest as if no pooling
   ├─ Then calculates interest on net pooled balance
   ├─ Difference = "advantage" rebated to group
   ├─ Allocation: Pro-rata based on contribution
   └─ Example:
       Without pooling: Sub A pays 5% on $-100K = ($5K)
                        Sub B earns 2% on $+100K = $2K
                        Net: ($3K) cost
       With pooling:    Net balance $0, interest $0
       Advantage:       $3K rebated to participants

3. INTEREST OPTIMIZATION METHOD (Dual Rate)
   ├─ Used where full notional pooling not permitted
   ├─ Balance segregated: compensated vs non-compensated
   ├─ Different rates applied to each portion
   └─ Partial offset benefit
```

### Transfer Pricing for Cash Pools

From [KPMG](https://kpmg.com/kpmg-us/content/dam/kpmg/pdf/2025/what-are-common-transfer-pricing-pitfalls-in-cash-pooling-061225.pdf):

```
ARM'S LENGTH RATE DETERMINATION:

Key Factors:
├─ Credit rating of borrower (not just parent guarantee)
├─ Loan term/duration
├─ Currency denomination
├─ Market conditions at time of transaction
└─ Collateral/security arrangements

Common Approach:
┌─────────────────────────────────────────────────────────────────────────────┐
│  CASH POOL INTEREST RATE STRUCTURE:                                         │
│                                                                             │
│  Deposits to Pool (Cash Pool Loans TO Header):                             │
│  ├─ Base: Overnight bank deposit rate                                       │
│  ├─ Plus: Risk premium (0-50 bps)                                          │
│  └─ Rationale: Depositor bears counterparty risk vs bank                   │
│                                                                             │
│  Borrowings from Pool (Cash Pool Loans FROM Header):                        │
│  ├─ Base: Bank overdraft/credit facility rate                               │
│  ├─ Minus: Operational savings (0-25 bps)                                   │
│  └─ Rationale: Internal lending has lower admin costs                       │
│                                                                             │
│  Spread Between Deposit and Borrow Rate:                                    │
│  ├─ This spread compensates header for administration                       │
│  ├─ Range: 25-100 bps typical                                               │
│  └─ Must be benchmarked against comparable arrangements                     │
└─────────────────────────────────────────────────────────────────────────────┘

PITFALL: Comparing header entity to a bank is often inappropriate.
Banks have different risk profiles, regulatory capital, and expertise.
```

### Interest Allocation Methods

From [Nomentia](https://www.nomentia.com/blog/everything-you-need-to-know-cash-pools-and-in-house-banks):

```
ALLOCATION METHODS FOR POOL BENEFIT:

1. PRO-RATA BY CONTRIBUTION
   ├─ Each participant's share based on average balance
   ├─ Positive balances: Share of total positive balances
   ├─ Negative balances: Share of total negative balances
   └─ Simplest and most common

2. FIRST-IN-FIRST-OUT (FIFO)
   ├─ Match specific deposits to specific borrowings
   ├─ Track time of each transaction
   └─ More complex but more precise

3. AVERAGE BALANCE METHOD
   ├─ Calculate weighted average daily balance
   ├─ Allocate interest based on contribution days
   └─ Standard for most treasury systems

EXAMPLE - Pro-Rata Allocation:

Pool Interest Earned: $10,000
Total Positive Balances: $1,000,000

Participant  | Avg Balance | Share  | Allocation
-------------|-------------|--------|------------
Sub A        | $600,000    | 60%    | $6,000
Sub B        | $300,000    | 30%    | $3,000
Sub C        | $100,000    | 10%    | $1,000
-------------|-------------|--------|------------
Total        | $1,000,000  | 100%   | $10,000
```

### Settlement Mechanics

```
INTEREST SETTLEMENT WORKFLOW:

Daily Processing:
├─ Step 1: Calculate average daily balance per participant
├─ Step 2: Apply daily interest rate
├─ Step 3: Accrue interest in subledger
└─ Step 4: Update IC loan balance if physical pool

Monthly Settlement:
├─ Step 1: Close monthly interest calculation
├─ Step 2: Generate IC interest invoices
├─ Step 3: Net settlement (if allowed by TP policy)
│   └─ Sub A owes Sub B $5K, Sub B owes Sub A $3K → Net $2K
├─ Step 4: Post journal entries
└─ Step 5: Update IC loan principal for accrued interest (if applicable)

Quarter-End:
├─ Reconcile all IC loan balances
├─ Verify interest calculations match ledger
└─ Prepare TP documentation
```

### Cross-Border Restrictions

From [NeuGroup](https://www.neugroup.com/cash-pooling-a-refresher-on-the-effects-of-tax-and-regulatory-changes/):

```
JURISDICTIONS WITH RESTRICTIONS:

BLOCKED FROM POOLING:
├─ Brazil: Capital controls prohibit cross-border sweeping
├─ China: SAFE approval required, strict limitations
├─ India: FEMA regulations restrict IC lending
└─ Argentina: Currency controls prevent participation

PARTIAL RESTRICTIONS:
├─ Korea: Reporting requirements, limits on terms
├─ Taiwan: Approval required, documented purpose needed
├─ Russia: Sanctions and capital controls (2022+)
└─ Turkey: FX restrictions, lira pooling only

TAX CONSIDERATIONS:
├─ Withholding tax on IC interest (often 15-30%)
├─ Treaties may reduce but require application
├─ Thin capitalization rules may limit deductions
└─ UK: 20% WHT unless treaty exempt (not automatic!)
```

## Implementation Implications

### Schema Requirements

```typescript
// Cash Pool Configuration
export const cashPools = pgTable('cash_pools', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Pool identification
  poolName: varchar('pool_name', { length: 100 }).notNull(),
  poolType: varchar('pool_type', { length: 20 }).notNull(), // physical | notional | hybrid
  currency: varchar('currency', { length: 3 }).notNull(),

  // Header account
  headerEntityId: uuid('header_entity_id').notNull(),
  headerBankAccountId: uuid('header_bank_account_id').notNull(),

  // Interest method
  interestMethod: varchar('interest_method', { length: 50 }).notNull(),
  // replacement | advantage | optimization | standard

  // Rate configuration
  depositRate: decimal('deposit_rate', { precision: 8, scale: 6 }),
  borrowingRate: decimal('borrowing_rate', { precision: 8, scale: 6 }),
  rateSource: varchar('rate_source', { length: 100 }), // e.g., "SOFR + 50bps"

  // Settlement
  settlementFrequency: varchar('settlement_frequency', { length: 20 }).notNull(),
  settlementDay: integer('settlement_day'), // Day of month

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Pool Participants
export const cashPoolParticipants = pgTable('cash_pool_participants', {
  id: uuid('id').primaryKey().defaultRandom(),

  cashPoolId: uuid('cash_pool_id').notNull(),
  entityId: uuid('entity_id').notNull(),
  bankAccountId: uuid('bank_account_id').notNull(),

  // Sweep configuration
  sweepType: varchar('sweep_type', { length: 20 }), // zero_balance | target_balance | threshold
  targetBalance: decimal('target_balance', { precision: 20, scale: 2 }),
  sweepThreshold: decimal('sweep_threshold', { precision: 20, scale: 2 }),

  // Status
  isActive: boolean('is_active').default(true),
  effectiveDate: date('effective_date').notNull(),
  terminationDate: date('termination_date'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Daily Interest Accruals
export const poolInterestAccruals = pgTable('pool_interest_accruals', {
  id: uuid('id').primaryKey().defaultRandom(),

  cashPoolId: uuid('cash_pool_id').notNull(),
  participantId: uuid('participant_id').notNull(),
  accrualDate: date('accrual_date').notNull(),

  // Balance tracking
  openingBalance: decimal('opening_balance', { precision: 20, scale: 2 }).notNull(),
  closingBalance: decimal('closing_balance', { precision: 20, scale: 2 }).notNull(),
  averageDailyBalance: decimal('average_daily_balance', { precision: 20, scale: 2 }).notNull(),

  // Interest calculation
  applicableRate: decimal('applicable_rate', { precision: 8, scale: 6 }).notNull(),
  interestAmount: decimal('interest_amount', { precision: 20, scale: 2 }).notNull(),

  // IC loan reference (for physical pools)
  icLoanId: uuid('ic_loan_id'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Intercompany Loans (from physical pooling)
export const icPoolLoans = pgTable('ic_pool_loans', {
  id: uuid('id').primaryKey().defaultRandom(),

  cashPoolId: uuid('cash_pool_id').notNull(),

  // Parties
  lenderEntityId: uuid('lender_entity_id').notNull(),
  borrowerEntityId: uuid('borrower_entity_id').notNull(),

  // Loan details
  principalAmount: decimal('principal_amount', { precision: 20, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  interestRate: decimal('interest_rate', { precision: 8, scale: 6 }).notNull(),

  // Balance tracking
  currentPrincipal: decimal('current_principal', { precision: 20, scale: 2 }).notNull(),
  accruedInterest: decimal('accrued_interest', { precision: 20, scale: 2 }).notNull(),

  // Origination
  originationType: varchar('origination_type', { length: 20 }).notNull(), // sweep | top_up
  originationDate: timestamp('origination_date').notNull(),

  // Settlement
  settledAt: timestamp('settled_at'),
  settlementAmount: decimal('settlement_amount', { precision: 20, scale: 2 }),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

### Service Interface

```typescript
interface CashPoolService {
  // Pool Management
  createPool(config: CashPoolConfig): Promise<CashPool>;
  addParticipant(poolId: string, participant: ParticipantConfig): Promise<void>;

  // Daily Operations
  executeDailySweeps(poolId: string, date: Date): Promise<SweepResult[]>;
  calculateDailyInterest(poolId: string, date: Date): Promise<InterestAccrual[]>;

  // Interest Allocation
  allocatePoolBenefit(
    poolId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<AllocationResult>;

  // Settlement
  generateInterestSettlement(
    poolId: string,
    period: Period
  ): Promise<SettlementInstructions>;

  // IC Loan Management
  createICLoan(sweep: SweepTransaction): Promise<ICPoolLoan>;
  settleICLoan(loanId: string, settlement: SettlementDetails): Promise<void>;

  // Arm's Length Compliance
  validateRates(poolId: string): Promise<TPValidationResult>;
  generateTPDocumentation(poolId: string, year: number): Promise<TPDocument>;
}
```

## Outstanding Questions

1. **Multi-Currency Pools**: How to handle FX conversion for cross-currency pooling?
2. **Thin Capitalization**: When do IC loans from pooling trigger thin cap rules?
3. **Withholding Tax Optimization**: Best approach to minimize WHT on IC interest?

## Sources

- [Agicap: All about Cash Pooling](https://agicap.com/en/article/cash-pooling/)
- [Nomentia: Physical Cash Pooling](https://www.nomentia.com/blog/how-does-physical-cash-pooling-target-balancing-work-with-a-tms)
- [Oracle: Notional Pooling](https://docs.oracle.com/cd/E86317_01/html/OBLM/OBLM04_Notional%20Pooling.htm)
- [KPMG: Transfer Pricing Pitfalls in Cash Pooling](https://kpmg.com/kpmg-us/content/dam/kpmg/pdf/2025/what-are-common-transfer-pricing-pitfalls-in-cash-pooling-061225.pdf)
- [NeuGroup: Cash Pooling Effects of Tax and Regulatory Changes](https://www.neugroup.com/cash-pooling-a-refresher-on-the-effects-of-tax-and-regulatory-changes/)
- [Nomentia: Cash Pools and In-House Banks](https://www.nomentia.com/blog/everything-you-need-to-know-cash-pools-and-in-house-banks)

---

*Research conducted: January 2026*
*Gap identified in: Mission-requirement analysis - banking-treasury needs interest calculation procedures*
