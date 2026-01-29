# CFC/GILTI/PFIC Anti-Deferral Regimes

## Knowledge Gap Identified

Current holding company research mentions CFC rules briefly but oversimplifies the US international tax anti-deferral regimes. The 2025 OBBBA legislative changes fundamentally altered GILTI, making existing documentation outdated.

## Key Findings

### The Anti-Deferral Framework

US tax law has multiple regimes to prevent indefinite deferral of foreign income:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    US ANTI-DEFERRAL REGIMES                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  SUBPART F (IRC §951-965)                                          │
│  ├─ Targets: Passive and mobile income                             │
│  ├─ Applies to: US shareholders of CFCs                            │
│  └─ Result: Current taxation regardless of distribution            │
│                                                                     │
│  GILTI → NCTI (IRC §951A, as amended by OBBBA)                    │
│  ├─ Targets: "Tested income" above QBAI threshold                  │
│  ├─ Applies to: US shareholders of CFCs                            │
│  ├─ Result: Current taxation with partial deduction                │
│  └─ 2025 CHANGE: Renamed, QBAI eliminated, deduction reduced       │
│                                                                     │
│  PFIC (IRC §1291-1298)                                             │
│  ├─ Targets: Passive foreign investment companies                  │
│  ├─ Applies to: US persons owning PFIC shares                      │
│  └─ Result: Punitive taxation unless elections made                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### OBBBA Changes (July 2025)

The One Big Beautiful Bill Act enacted July 4, 2025 made fundamental changes:

#### GILTI → Net CFC Tested Income (NCTI)

| Aspect | Pre-OBBBA | Post-OBBBA |
|--------|-----------|------------|
| **Name** | GILTI | Net CFC Tested Income (NCTI) |
| **Deduction** | 50% (scheduled to drop to 37.5%) | Permanent 40% |
| **QBAI Reduction** | 10% of qualified business asset investment | Eliminated |
| **Effective Tax Rate** | ~10.5% (was going to 13.125%) | ~12.6% |
| **Effective Date** | - | Taxable years after Dec 31, 2025 |

```
CRITICAL CHANGE: QBAI Elimination

Pre-OBBBA:
GILTI = (CFC Tested Income) - (10% × QBAI) - (Interest Expense)
                             ↑
                    This is now GONE

Post-OBBBA:
NCTI = CFC Tested Income - Interest Expense
       (No QBAI reduction)

Impact: Companies with significant foreign tangible assets
        will see HIGHER inclusions
```

#### Foreign Tax Credit Changes

```
FTC LIMIT CHANGES:

Pre-OBBBA: 80% of foreign taxes creditable against GILTI
Post-OBBBA: 90% of foreign taxes creditable against NCTI

NEW HAIRCUT (§960(d)(4)):
├─ Effective: After June 28, 2025
├─ Applies to: Distributions of §951A PTEP
└─ Effect: 10% of foreign taxes disallowed for credit
```

#### Subpart F Changes

```
OWNERSHIP TIMING CHANGE:

Pre-OBBBA:
├─ US shareholder must own shares on LAST DAY of CFC's tax year
└─ Day-before-sale planning was possible

Post-OBBBA (after Dec 31, 2025):
├─ Inclusion required for ownership "at ANY TIME during year"
└─ Day-before-sale planning eliminated
```

#### One-Month Deferral Repeal

```
FISCAL YEAR ALIGNMENT:

Pre-OBBBA:
├─ CFCs could elect tax year beginning one month earlier
├─ Calendar-year parent with Nov 30 CFC year
└─ Created deferral benefit

Post-OBBBA:
├─ Election eliminated
├─ CFCs must align to shareholder year
└─ 2025 transition: 13-month inclusion for calendar-year shareholders
```

### Subpart F Income Categories

Subpart F income includes:

```
SUBPART F INCOME CATEGORIES:

1. INSURANCE INCOME (§953)
   └─ Income from insuring risks outside CFC's country

2. FOREIGN BASE COMPANY INCOME (§954)
   ├─ Foreign personal holding company income
   │   ├─ Dividends, interest, royalties, rents
   │   ├─ Gains from property producing such income
   │   ├─ Gains from commodities transactions
   │   └─ Foreign currency gains
   │
   ├─ Foreign base company sales income
   │   └─ Buy from/sell to related parties
   │       Property manufactured outside CFC country
   │
   └─ Foreign base company services income
       └─ Services performed for/on behalf of related party
           Outside CFC country

3. OTHER (§952)
   ├─ International boycott income
   ├─ Bribes and illegal payments
   └─ Income from §901(j) countries
```

### GILTI High-Tax Exception (HTE)

The HTE remains available post-OBBBA:

```
HIGH-TAX EXCLUSION:

Threshold: 18.9% effective foreign tax rate
Calculation: At "tested unit" level

If tested unit ETR ≥ 18.9%:
├─ Income excluded from GILTI/NCTI
├─ Election is annual
├─ Applies to ALL high-taxed units if elected
└─ Cannot cherry-pick

TESTED UNIT DEFINITION:
├─ CFC
├─ Interest in pass-through entity
├─ Branch or disregarded entity
└─ Each tested separately
```

### PFIC Rules

```
PFIC DEFINITION:

A foreign corporation is a PFIC if either:
├─ INCOME TEST: 75%+ of gross income is passive
└─ ASSET TEST: 50%+ of assets produce passive income

DEFAULT TREATMENT (Excess Distribution Regime):
├─ All gains treated as ordinary income
├─ Deemed distributed ratably over holding period
├─ Each year taxed at highest rate for that year
├─ Interest charge added
└─ VERY PUNITIVE

ELECTIONS TO MITIGATE:
├─ QEF Election (§1295)
│   └─ Current inclusion of earnings, LTCG rates available
│
├─ Mark-to-Market (§1296)
│   └─ Annual gain/loss recognition, ordinary income
│
└─ Purging Election
    └─ Deemed sale to end tainted status
```

### CFC Attribution Rules

```
US SHAREHOLDER DEFINITION:

US person who owns (directly, indirectly, constructively):
├─ 10% or more of total combined voting power
└─ OR 10% or more of total value

CFC DEFINITION:

Foreign corporation with US shareholders owning:
├─ >50% of total combined voting power
└─ OR >50% of total value

ATTRIBUTION:
├─ Stock owned by foreign entities attributed to US owners
├─ Family attribution (§318 modified)
├─ Partnership/estate/trust attribution
└─ Downward attribution from foreign persons (post-TCJA)
```

## Cross-Domain Integration Requirements

### Entity Governance → International Tax
- Entity structure determines CFC status
- Holding company design affects Subpart F
- Attribution rules require cap table tracking
- Check-the-box elections have major implications

### Accounting → Tax Provisions
- GILTI/NCTI requires book-to-tax adjustments
- FTC calculations need foreign tax tracking
- PFIC compliance requires asset/income testing
- Deferred tax implications are significant

### Banking → Repatriation
- Distribution planning affects cash management
- PTEP tracking required for tax-efficient repatriation
- FX implications of foreign earnings

## Model Implications

### Required Data Elements

```typescript
interface CFCProfile {
  entityId: string;

  // CFC Status
  isCFC: boolean;
  cfcStatusDate: Date;
  usShareholderPercentage: number;

  // Income Classification
  testedIncome: Money;
  subpartFIncome: {
    insuranceIncome: Money;
    fphci: Money;
    fbcSalesIncome: Money;
    fbcServicesIncome: Money;
  };

  // GILTI/NCTI Calculation
  qbai: Money;  // Still tracked for historical periods
  testedLoss: Money;
  interestExpense: Money;

  // High-Tax Exception
  effectiveForeignTaxRate: number;
  hteEligible: boolean;
  hteElected: boolean;

  // FTC
  foreignTaxesPaid: Money;
  foreignTaxesAccrued: Money;
  ftcLimitationCategory: FTCBasket;

  // PTEP Tracking
  ptepPools: PTEPPool[];
}

interface PTEPPool {
  year: number;
  category: PTEPCategory;
  amount: Money;
  associatedFTC: Money;
  distributedAmount: Money;
}

interface PFICAnalysis {
  entityId: string;
  taxYear: number;

  // Tests
  incomeTest: {
    passiveIncome: Money;
    totalIncome: Money;
    percentage: number;
    testResult: boolean;
  };

  assetTest: {
    passiveAssets: Money;
    totalAssets: Money;
    percentage: number;
    testResult: boolean;
  };

  isPFIC: boolean;

  // Elections
  qefElection: boolean;
  mtmElection: boolean;
  purgingElection: boolean;
}
```

## Questions for Further Research

1. How should systems handle the QBAI elimination transition?
2. What automation is possible for Subpart F income classification?
3. How do check-the-box elections interact with substance requirements?
4. What are the implications of the one-month deferral repeal for existing structures?
5. How should PTEP pools be tracked across multiple tiers?

## Sources

- [EY: OBBBA International Tax Changes](https://www.ey.com/en_gl/technical/tax-alerts/united-states-changes-to-gilti-fdii-and-beat-among-others-included-in-final-reconciliation-legislation-but-not-previously-proposed-remedy-for-unfair-foreign-taxes)
- [HCVT: OBBBA International Tax Updates](https://www.hcvt.com/alertarticle-International-Tax-Changes-Under-the-OBBBA)
- [Bloomberg Tax: GILTI/NCTI Calculation](https://pro.bloombergtax.com/insights/international-tax/how-to-calculate-gilti-tax-on-foreign-earnings/)
- [Cooley: OBBBA Key International Provisions](https://www.cooley.com/news/insight/2025/2025-07-21-key-international-tax-provisions-under-the-one-big-beautiful-bill-act)
- [TaxesForExpats: GILTI High-Tax Exception](https://www.taxesforexpats.com/articles/foreign-business/gilti-high-tax-exception.html)
- [IRS Notice 2025-72](https://www.irs.gov/pub/irs-drop/n-25-72.pdf)

---

*Research conducted: January 2026*
*Gap identified in: entity-governance/research/08-holding-company-structures.md*
