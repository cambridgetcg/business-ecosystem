# The High-Tax Election Timing: GILTI HTE Mechanics

> Curiosity #6: The GILTI High-Tax Exclusion is elective, but when must the election be made? What if you don't know your ETR until year-end?

## The Question

The GILTI High-Tax Exclusion (HTE) allows excluding CFC income that's already taxed at a high rate. But tax rates are calculated retrospectively. How can you elect prospectively when you don't know your rate until the year is over?

## Key Findings

### The Annual Election Mechanism

From [Greenback Tax Services](https://www.greenbacktaxservices.com/knowledge-center/gilti-high-tax-exception/):

```
KEY INSIGHT: ELECTION IS RETROSPECTIVE

You DO NOT elect at the start of the year.
You elect WHEN FILING THE RETURN for that year.

TIMELINE:
┌─────────────────────────────────────────────────────────┐
│  CFC Tax Year    ───────────────────────────────────►   │
│                                                         │
│  Jan 1           Operations        Dec 31              │
│    │                │                │                 │
│    │    (Don't know ETR yet)         │                 │
│    │                                 │                 │
│    │                                 ▼                 │
│                              Calculate actual ETR      │
│                                      │                 │
│                                      ▼                 │
│                              Return Due (+ extensions) │
│                                      │                 │
│                                      ▼                 │
│                              MAKE ELECTION ON RETURN   │
└─────────────────────────────────────────────────────────┘

No need to predict - you KNOW the rate when you elect.
```

### Who Makes the Election

From [BT Partners Analysis](https://www.btcpa.net/insights/gilti-high-tax-exception-considerations-2025):

```
ELECTION MECHANICS:

WHO ELECTS:
├─ Controlling domestic shareholders of the CFC
├─ Defined as: U.S. shareholders who, in aggregate,
│   directly or indirectly (not constructively) own
│   more than 50% of CFC's total combined voting power
└─ NOT individual minority shareholders

HOW ELECTED:
├─ Made on annual basis
├─ Made on tested-unit basis
├─ Statement attached to U.S. income tax return
└─ For each CFC meeting the threshold

CFC GROUP RULE:
├─ If CFC is member of CFC group
├─ Election must be made for ALL members
├─ Or not made at all
└─ Cannot cherry-pick within group
```

### The Threshold: 90% of U.S. Corporate Rate

From [Taxes for Expats](https://www.taxesforexpats.com/articles/foreign-business/gilti-high-tax-exception.html):

```
THRESHOLD CALCULATION:

2024-2025 Threshold:
├─ U.S. corporate rate: 21%
├─ Threshold: 90% × 21% = 18.9%
└─ If foreign ETR > 18.9%, HTE may apply

EFFECTIVE TAX RATE CALCULATION:

ETR = Foreign Income Taxes ÷ Net Tested Income
                         (for that tested unit)

EXAMPLE:
├─ CFC Tested Income: $1,000,000
├─ Foreign Taxes Paid: $200,000
├─ ETR: 20%
├─ Threshold: 18.9%
├─ 20% > 18.9% ✓
└─ HTE election available

TESTED UNIT CONCEPT:
├─ Calculation done at "tested unit" level
├─ Not at CFC level
├─ Tested unit ≈ separate income stream/location
└─ Complex attribution rules apply
```

### Post-OBBBA Changes (2026+)

From [Plante Moran Analysis](https://www.plantemoran.com/explore-our-thinking/insight/2025/11/updates-to-the-gilti-tax-regime-under-the-obbb):

```
OBBBA IMPACT ON HTE THRESHOLD:

Pre-2026:
├─ GILTI deduction: 50%
├─ Effective U.S. rate: 10.5% (21% × 50%)
├─ HTE threshold: 18.9%

Post-2026 (OBBBA):
├─ NCTI deduction: 40%
├─ Effective U.S. rate: 12.6% (21% × 60%)
├─ HTE threshold: ???

UNCERTAINTY:
"Starting in 2026, higher GILTI effective rates may
increase the high tax exception threshold, potentially
disqualifying income that currently benefits from
the exclusion."

PLANNING IMPLICATION:
├─ Income currently qualifying at 19% may NOT qualify
├─ If threshold rises proportionally to 90% of new rate
├─ New threshold could be ~22.7% (90% × 25.2% gross-up)
└─ Need guidance on exact threshold calculation
```

### Late Election Relief (9100)

From [Tax Notes Letter Ruling](https://www.taxnotes.com/research/federal/irs-private-rulings/letter-rulings-technical-advice/extension-granted-make-gilti-high-tax-exclusion-election/7qtxl):

```
MISSED THE DEADLINE? 9100 RELIEF MAY BE AVAILABLE

Section §301.9100-1(a):
├─ IRS may grant extension for regulatory elections
├─ Must show reasonable cause for delay
├─ Relief is discretionary

PROCESS:
1. Submit request to IRS
2. Show reasonable cause for missing deadline
3. If granted: 120 days to make election
4. File amended returns (Form 1120X) with election

IMPORTANT CAVEATS:
├─ Granting extension ≠ confirming eligibility
├─ Still must meet all other requirements
├─ Not automatic - requires IRS approval
└─ Time and cost involved
```

### Practical Decision Framework

From [Wipfli Analysis](https://www.wipfli.com/insights/articles/mrd-cfcs-be-aware-of-the-considerations-for-opting-out-of-gilti):

```
HTE ELECTION DECISION TREE:

Step 1: CALCULATE ETR FOR EACH TESTED UNIT
        │
        ├─ ETR < 18.9%? → No HTE available
        │                  Must include in GILTI/NCTI
        │
        └─ ETR ≥ 18.9%? → HTE election AVAILABLE
                          │
                          ▼
Step 2: SHOULD YOU ELECT?
        │
        ├─ Consider: Foreign Tax Credit position
        │   └─ Electing HTE = No FTC for those taxes
        │
        ├─ Consider: Other GILTI inclusions
        │   └─ FTCs from HTE-eligible income may
        │      cross-credit against other GILTI
        │
        ├─ Consider: Overall FTC limitation
        │   └─ Are you already in excess credit?
        │
        └─ Consider: 2026+ threshold changes
            └─ Plan for potential disqualification

Step 3: IF ELECTING FOR CFC IN CFC GROUP
        │
        └─ Must elect for ALL CFCs in group
           └─ Model impact across entire group
```

### Computational Requirements

```
SYSTEM REQUIREMENTS FOR HTE ANALYSIS:

DATA NEEDED:
├─ Tested income by tested unit
├─ Foreign taxes paid/accrued by tested unit
├─ ETR calculation per tested unit
├─ CFC group membership mapping
├─ U.S. shareholder FTC position

TIMING OF CALCULATION:
├─ Cannot finalize until CFC year-end
├─ May require foreign audit completion
├─ FTC analysis requires U.S. shareholder full picture
└─ Practical deadline: Before U.S. return due date

WHAT-IF ANALYSIS:
├─ Model: Elect HTE vs. Don't elect
├─ Compare: Total U.S. tax liability
├─ Consider: Current year AND carryforward impact
└─ Document: Rationale for election decision
```

## Cross-Domain Integration Implications

### For the Foundational System

```typescript
interface GILTIHTEAnalysis {
  cfcId: string;
  taxYear: number;

  // Tested unit level calculations
  testedUnits: Array<{
    testedUnitId: string;
    testedUnitDescription: string;

    testedIncome: Money;
    foreignTaxesPaid: Money;
    effectiveTaxRate: number;

    hteThreshold: number;  // Currently 18.9%
    hteEligible: boolean;  // ETR > threshold?
  }>;

  // CFC group analysis
  cfcGroup?: {
    groupId: string;
    memberCFCs: string[];
    groupElectionRequired: boolean;  // All or nothing
    groupHteEligible: boolean;
  };

  // Election modeling
  electionAnalysis: {
    scenarioWithHTE: {
      giltiInclusion: Money;
      ftcAvailable: Money;
      netUSTax: Money;
    };
    scenarioWithoutHTE: {
      giltiInclusion: Money;
      ftcAvailable: Money;
      netUSTax: Money;
    };
    recommendation: 'elect' | 'do_not_elect';
    recommendationRationale: string;
  };

  // OBBBA impact projection
  obbbaProjection?: {
    year2026Threshold: number;
    stillEligible2026: boolean;
    planningConsiderations: string[];
  };
}

interface HTEElectionRecord {
  electionId: string;
  cfcId: string;
  taxYear: number;

  // Election details
  electionMade: boolean;
  electionDate: Date;
  filingDate: Date;

  // If late election (9100 relief)
  lateElection: boolean;
  reliefRequestDate?: Date;
  reliefGrantedDate?: Date;
  reliefDeadline?: Date;

  // Documentation
  controllingShareholderConsent: boolean;
  formReference: string;  // Attached to which return
  calculationWorkpapers: string;
}
```

### Analysis Workflow

```
HTE ELECTION ANALYSIS WORKFLOW:

CFC Year-End Closes
        │
        ▼
┌─────────────────────┐
│  Gather Data        │ ─── Foreign financials, taxes
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Calculate ETR      │ ─── By tested unit
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Eligibility Check  │ ─── ETR vs threshold
└──────────┬──────────┘
           │
      ┌────┴────┐
      │         │
      ▼         ▼
   Eligible   Not Eligible
      │         │
      ▼         └──► Include in GILTI/NCTI
┌─────────────────────┐
│  Model Scenarios    │ ─── With/without election
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  FTC Analysis       │ ─── Overall position impact
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  CFC Group Check    │ ─── All-or-nothing rule
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Make Decision      │ ─── Document rationale
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  File Election      │ ─── Attach to return
└─────────────────────┘
```

## Outstanding Questions

1. **Tested Unit Definition**: How granular should tested unit tracking be in the system? What drives tested unit boundaries?

2. **Estimated Payments**: If HTE decision affects U.S. tax liability, how do you handle estimated payments before knowing ETR?

3. **CFC Group Coordination**: When CFCs are owned by different shareholders, how is the group election coordinated?

## Sources

- [Greenback Tax Services: GILTI High-Tax Exception](https://www.greenbacktaxservices.com/knowledge-center/gilti-high-tax-exception/)
- [BT Partners: GILTI HTE Considerations 2025](https://www.btcpa.net/insights/gilti-high-tax-exception-considerations-2025)
- [Taxes for Expats: GILTI High Tax Exception Guide](https://www.taxesforexpats.com/articles/foreign-business/gilti-high-tax-exception.html)
- [Plante Moran: Final GILTI HTE Regulations](https://www.plantemoran.com/explore-our-thinking/insight/2020/08/final-regulations-clarify-potential-benefits-of-the-gilti-high-tax-exclusion)
- [Plante Moran: Updates to GILTI Under OBBBA](https://www.plantemoran.com/explore-our-thinking/insight/2025/11/updates-to-the-gilti-tax-regime-under-the-obbb)
- [Wipfli: CFC Considerations for Opting Out of GILTI](https://www.wipfli.com/insights/articles/mrd-cfcs-be-aware-of-the-considerations-for-opting-out-of-gilti)
- [Tax Notes: Extension Granted for HTE Election](https://www.taxnotes.com/research/federal/irs-private-rulings/letter-rulings-technical-advice/extension-granted-make-gilti-high-tax-exclusion-election/7qtxl)

---

*Research conducted: January 2026*
*Curiosity origin: Understanding Map integration, "Elections require foresight but tax rates are calculated retrospectively"*
