# The Intercompany Loan Circularity: Cash Pool Interest Allocation

> Curiosity #5: In a cash pool with daily sweeps, do the intercompany loans net to zero, or does balance accumulate? Who owns the interest income in a multi-week position?

## The Question

Physical cash pooling creates actual intercompany loans through daily sweeps. The research diagram showed "daily zeroing," but economic substance requires real positions. So:
- Do positions truly zero out daily?
- If not, how is interest allocated?
- What makes it arm's length?

## Key Findings

### The Zero-Balance Account Mechanism

From [TreasuryXL Analysis](https://treasuryxl.com/blog/tax-considerations-in-light-of-transfer-pricing-when-setting-up-zero-balance-cash-pool-arrangements/):

```
ZERO-BALANCE ACCOUNT (ZBA) DAILY SWEEP:

End of Day 1:
┌─────────────────────────────────────────────────────────┐
│  Participant A         Participant B         Pool Leader│
│  Balance: +$500K       Balance: -$200K       Balance: 0 │
└────────────┬───────────────────┬────────────────────────┘
             │                   │
             │   SWEEP           │   SWEEP
             ▼                   ▼
┌─────────────────────────────────────────────────────────┐
│  Participant A         Participant B         Pool Leader│
│  Balance: $0           Balance: $0           +$300K     │
│  IC Receivable: $500K  IC Payable: $200K    IC: -$300K  │
└─────────────────────────────────────────────────────────┘

End of Day 2:
┌─────────────────────────────────────────────────────────┐
│  Participant A         Participant B         Pool Leader│
│  Balance: -$100K       Balance: +$400K       Balance: 0 │
└────────────┬───────────────────┬────────────────────────┘
             │                   │
             │   SWEEP           │   SWEEP
             ▼                   ▼
┌─────────────────────────────────────────────────────────┐
│  Participant A         Participant B         Pool Leader│
│  Balance: $0           Balance: $0           -$300K     │
│  IC Payable: $100K     IC Receivable: $400K IC: +$300K  │
└─────────────────────────────────────────────────────────┘
```

### Do Positions Accumulate? YES.

From [EY Belgium Analysis](https://www.ey.com/en_be/insights/tax/are-you-capturing-the-cash-pool-dynamics-in-an-arms-length-context):

```
CRITICAL INSIGHT: POSITIONS DO ACCUMULATE

The cash accounts are "zeroed out" → TRUE
The IC positions are zeroed out → FALSE

ACCUMULATION PATTERN:

Week 1:
├─ Day 1: A lends $500K to pool
├─ Day 2: A borrows $100K from pool
├─ Day 3: A lends $300K to pool
├─ Day 4: A lends $200K to pool
├─ Day 5: A borrows $50K from pool
└─ Week-end IC Position: NET $850K receivable

Week 2:
├─ Day 6: A lends $100K to pool
├─ Day 7: A borrows $600K from pool
├─ ...
└─ Position continues from Week 1 balance

IMPLICATION:
The pool leader holds NET POSITIONS against each participant.
These positions persist across days and accumulate over time.
Interest accrues on these persistent positions.
```

### Interest Allocation: The Three-Step Approach

From [KPMG Transfer Pricing Analysis](https://kpmg.com/kpmg-us/content/dam/kpmg/pdf/2025/what-are-common-transfer-pricing-pitfalls-in-cash-pooling-061225.pdf):

```
BEST PRACTICE: THREE-STEP INTEREST ALLOCATION

┌─────────────────────────────────────────────────────────┐
│  STEP 1: PRICE POSITIONS                                │
├─────────────────────────────────────────────────────────┤
│  Determine arm's length rates for:                      │
│  ├─ Debit positions (borrowing from pool)               │
│  ├─ Credit positions (lending to pool)                  │
│  └─ Different rates based on:                           │
│      ├─ Entity credit risk                              │
│      ├─ Position duration                               │
│      └─ Currency                                        │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 2: CALCULATE SYNERGY BENEFITS                     │
├─────────────────────────────────────────────────────────┤
│  Benefits created by the pool structure:                │
│  ├─ Volume benefits (larger pool = better rates)        │
│  ├─ Netting benefits (internal offsets)                 │
│  ├─ Reduced external borrowing costs                    │
│  └─ Avoided transaction fees                            │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 3: ALLOCATE SYNERGIES                             │
├─────────────────────────────────────────────────────────┤
│  Per OECD Guidelines (paragraph 10.143):                │
│  ├─ Synergy benefits generally allocated to PARTICIPANTS│
│  ├─ Allocation reflects contributions to pool           │
│  ├─ Pool leader receives service fee (not all synergy)  │
│  └─ Each participant better off than standalone         │
└─────────────────────────────────────────────────────────┘
```

### Who Owns the Interest Income?

From [Andersen Egypt Analysis](https://eg.andersen.com/cash-pooling-arrangements/):

```
INTEREST OWNERSHIP DETERMINATION:

LENDING POSITION (Credit to Pool):
├─ Interest income belongs to: THE PARTICIPANT
├─ Rate: Arm's length credit rate
├─ Adjusted for: Credit risk of pool (not just leader)
└─ Documentation: Daily position tracking

BORROWING POSITION (Debit from Pool):
├─ Interest expense belongs to: THE PARTICIPANT
├─ Rate: Arm's length debit rate
├─ Adjusted for: Entity's standalone creditworthiness
└─ Documentation: Daily position tracking

POOL LEADER:
├─ Does NOT own all interest
├─ Earns: Service fee for administration
├─ May earn: Spread between rates (if arm's length)
├─ Bears: Operational risk, counterparty management
└─ Documentation: Functional analysis justification

OECD POSITION:
"The cash pool should offer better conditions to the
participants than they would have obtained on a
standalone basis, which would typically come from
volume and netting synergies created via the pool."
```

### Short-Term vs Long-Term Treatment

From [Tiberghien Economics](https://tiberghieneconomics.com/cash-pools-current-accounts-and-short-term-loans-understanding-the-difference):

```
DURATION MATTERS FOR ARM'S LENGTH ANALYSIS:

DAILY SWEEP POSITIONS (Overnight):
├─ Characteristics: Very short term, variable
├─ Benchmark: Overnight interbank rates
├─ Examples: SOFR, €STR, SONIA
├─ Rate differential: Minimal spread

ACCUMULATED POSITIONS (Multi-Day):
├─ Characteristics: Persisting balances
├─ If position consistently one direction...
├─ May be reclassified as: IC Loan
├─ Benchmark: Term lending rates
└─ Documentation burden: Higher

REGULATORY OBSERVATION:
Tax authorities increasingly scrutinize:
├─ Average daily balance vs peak balance
├─ Consistent surplus/deficit patterns
├─ Whether "cash pool" is really disguised loan
└─ Transfer of credit risk to pool participants
```

### German 2024 Transfer Pricing Rules

From [Zanders Analysis](https://zandersgroup.com/en/insights/blog/intra-group-loan-transfer-pricing-whats-new-in-2025):

```
GERMAN 2024 GROWTH OPPORTUNITIES ACT:

New requirements for intra-group financing:

1. DEBT CAPACITY TEST:
   ├─ Credible expectation debtor can meet obligations
   ├─ Commitment to provide financing for defined period
   └─ Cannot lend beyond entity's realistic capacity

2. CREDITWORTHINESS DOCUMENTATION:
   ├─ Credit rating analysis required
   ├─ Must justify debt level assumed by subsidiary
   └─ Arm's length rate based on actual creditworthiness

3. CASH POOL IMPLICATION:
   ├─ Persistent deficit position = effective loan
   ├─ Must demonstrate entity could borrow standalone
   └─ Pool leader cannot override credit constraints

BELGIAN 2025 MASTER FILE REQUIREMENTS:
Starting FY 2025, Belgian master file requires:
├─ Detailed description of financing policies
├─ Description of financing mix
├─ Intercompany financing instruments applied
└─ Cash pool structure and terms
```

### Interest Calculation Mechanics

```
DAILY INTEREST CALCULATION EXAMPLE:

Day 1:
├─ Participant A position: +$500,000 (lending)
├─ Arm's length credit rate: SOFR + 25bps = 4.75%
├─ Daily interest earned: $500,000 × 4.75% / 365 = $65.07

├─ Participant B position: -$200,000 (borrowing)
├─ Arm's length debit rate: SOFR + 150bps = 6.00%
├─ Daily interest owed: $200,000 × 6.00% / 365 = $32.88

├─ Pool Leader position: -$300,000 (net funding need)
├─ External borrowing cost: SOFR + 50bps = 5.00%
├─ Daily funding cost: $300,000 × 5.00% / 365 = $41.10

DAILY SYNERGY CALCULATION:
├─ A's standalone borrowing would cost: N/A (lending)
├─ A's standalone lending would earn: 4.50% (treasury)
├─ A's pool benefit: 4.75% - 4.50% = 25bps better

├─ B's standalone borrowing would cost: 7.00%
├─ B's pool rate: 6.00%
├─ B's pool benefit: 7.00% - 6.00% = 100bps savings

DOCUMENTATION REQUIREMENT:
Each calculation must be documented, justified, and
arm's length comparable identified.
```

## Cross-Domain Integration Implications

### For the Foundational System

```typescript
interface CashPoolPosition {
  participantId: string;
  poolId: string;
  date: Date;

  // Daily position
  dailyPosition: {
    openingBalance: Money;
    dayActivity: Money;
    sweepAmount: Money;
    closingBalance: Money;  // Should be zero for ZBA
  };

  // Intercompany position
  icPosition: {
    priorDayPosition: Money;
    dailyChange: Money;
    currentPosition: Money;
    positionType: 'debit' | 'credit';
    daysPersistent: number;  // How long in same direction
  };

  // Interest calculation
  interestCalculation: {
    rate: number;
    rateType: 'overnight' | 'term';
    rateBenchmark: string;  // SOFR, €STR, etc.
    spread: number;
    dailyInterest: Money;
    accruedInterest: Money;  // MTD/YTD
  };

  // Transfer pricing support
  tpDocumentation: {
    armLengthJustification: string;
    comparableUsed: string;
    synergyAllocation: Money;
    standaloneComparison: {
      standaloneRate: number;
      poolBenefit: number;
    };
  };
}

interface CashPoolInterestAllocation {
  poolId: string;
  period: DateRange;

  participantAllocations: Array<{
    participantId: string;
    netPosition: Money;
    interestEarned: Money;
    interestOwed: Money;
    netInterest: Money;
    synergyBenefitReceived: Money;
  }>;

  poolLeaderAllocation: {
    serviceFee: Money;
    spreadIncome: Money;
    totalCompensation: Money;
    functionalJustification: string;
  };

  totalSynergyGenerated: Money;
  synergyAllocationMethod: string;
  allocationCompliant: boolean;
}
```

### Event and Reconciliation Flow

```
DAILY CASH POOL PROCESSING:

End of Business Day
        │
        ▼
┌─────────────────────┐
│  Bank Sweep Exec    │ ─── ZBA sweeps to header
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Position Update    │ ─── Calculate IC positions
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Interest Accrual   │ ─── Apply arm's length rates
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  TP Documentation   │ ─── Record calculations
└──────────┬──────────┘
           │
           ▼
End of Month/Quarter
        │
        ▼
┌─────────────────────┐
│ Interest Settlement │ ─── Pay/receive IC interest
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Synergy Allocation  │ ─── Distribute pool benefits
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Reconciliation     │ ─── Verify totals match
└─────────────────────┘
```

## Outstanding Questions

1. **FX Positions**: When cash pool operates in multiple currencies, how are FX gains/losses on IC positions allocated?

2. **Credit Events**: If a pool participant's creditworthiness declines mid-year, should their IC rate retroactively change?

3. **Regulatory Treatment**: Do banking regulators (OCC, Fed) view cash pool IC positions as loans requiring capital treatment?

## Sources

- [TreasuryXL: Transfer Pricing in Zero Balance Cash Pools](https://treasuryxl.com/blog/tax-considerations-in-light-of-transfer-pricing-when-setting-up-zero-balance-cash-pool-arrangements/)
- [EY Belgium: Cash Pool Dynamics Arm's Length](https://www.ey.com/en_be/insights/tax/are-you-capturing-the-cash-pool-dynamics-in-an-arms-length-context)
- [KPMG: Transfer Pricing Pitfalls in Cash Pooling](https://kpmg.com/kpmg-us/content/dam/kpmg/pdf/2025/what-are-common-transfer-pricing-pitfalls-in-cash-pooling-061225.pdf)
- [Zanders: Intra-Group Loan Transfer Pricing 2025](https://zandersgroup.com/en/insights/blog/intra-group-loan-transfer-pricing-whats-new-in-2025)
- [Andersen Egypt: Cash Pooling Arrangements](https://eg.andersen.com/cash-pooling-arrangements/)
- [Tiberghien: Cash Pools and Short-Term Loans](https://tiberghieneconomics.com/cash-pools-current-accounts-and-short-term-loans-understanding-the-difference)

---

*Research conducted: January 2026*
*Curiosity origin: Understanding Map integration, "Daily zeroing" diagram conflicted with economic substance requirement*
