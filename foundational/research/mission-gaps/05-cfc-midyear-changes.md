# CFC Mid-Year Status Changes

> Gap #05: System calculates CFC status but doesn't handle mid-year ownership changes under OBBBA pro-rata rules.

## Gap Identification

**Category**: Edge Cases
**Severity**: CRITICAL
**Blocks Implementation Phase(s)**: Phase 4 (Tax)

## Current State

Existing research covers:
- CFC definition (>50% US ownership)
- GILTI/NCTI calculation basics
- Subpart F income categories
- General US shareholder concepts

## What's Missing

Cannot accurately calculate international tax inclusions because:

1. **Pro-Rata Mechanics**: How exactly is NCTI/Subpart F allocated when ownership changes mid-year?
2. **Day-of-Change Rules**: What happens on the actual day of ownership change?
3. **Transition Period (2024-2026)**: Special rules for the OBBBA transition period?
4. **M&A Implications**: How do acquisitions/dispositions affect calculations?
5. **System Design**: How to track and calculate partial-year inclusions?

## Research Findings

### OBBBA Changes to Pro-Rata Share Rules

From [Baker Tilly](https://www.bakertilly.com/insights/irs-guidance-on-new-pro-rata-rule-under-obbba) and [HCVT](https://www.hcvt.com/alertarticle-International-Tax-Changes-Under-the-OBBBA):

```
PRE-OBBBA RULE (Through 2025):

"Last Day" Rule:
├─ US shareholder must own CFC stock on LAST DAY of CFC's tax year
├─ If sold before year-end: NO Subpart F or GILTI inclusion
├─ If acquired before year-end: FULL year inclusion (per share)
└─ Created significant planning opportunities

Example (Pre-OBBBA):
├─ US Co owns 100% of CFC for 364 days
├─ Sells on December 30
├─ Result: ZERO Subpart F/GILTI inclusion for US Co
└─ (This was intentional tax planning)


POST-OBBBA RULE (Effective for CFC tax years beginning after Dec 31, 2025):

"Any Time During Year" Rule:
├─ US shareholder includes Subpart F/NCTI if owned stock at ANY TIME
├─ Pro-rata share based on:
│   ├─ Period shareholder held CFC stock
│   ├─ Period US person was a US shareholder
│   └─ Period foreign corporation was a CFC
└─ Eliminates last-day planning entirely

Example (Post-OBBBA):
├─ US Co owns 100% of CFC for 364 days
├─ Sells on December 30
├─ Result: 364/365 of Subpart F/NCTI included
└─ (Cannot avoid inclusion by year-end sale)
```

### Pro-Rata Calculation Mechanics

From [IRS Notice 2025-75](https://www.irs.gov/pub/irs-drop/n-25-75.pdf) and [DLA Piper](https://www.dlapiper.com/en-us/insights/publications/2025/12/irs-issues-notice-2025-75-notice-2025-7-notice-2025-78):

```
PRO-RATA SHARE CALCULATION:

Formula:
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  Pro-Rata Share = Subpart F or NCTI                                        │
│                   × (Days Owned / Total Days in CFC Year)                  │
│                   × (Shares Owned / Total Shares Outstanding)              │
│                   × CFC Status Fraction                                    │
│                   × US Shareholder Status Fraction                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Where:
├─ Days Owned: Days during CFC year shareholder held stock
├─ CFC Status Fraction: Days FC was a CFC / Total days in year
├─ US Shareholder Status Fraction: Days US person was US shareholder / Days owned
└─ All fractions apply only for the period all conditions met

EXAMPLE CALCULATION:

Facts:
├─ CFC has calendar year
├─ CFC has $1,000,000 NCTI for full year
├─ US Co acquires 60% on July 1
├─ US Co holds through December 31

Calculation:
├─ Period of ownership: July 1 - Dec 31 = 184 days
├─ Period as CFC: Assume CFC all year = 365 days
├─ Period as US shareholder: Assume 60% makes US Co a US shareholder
│   from July 1 = 184 days
├─ Pro-rata share: $1,000,000 × (184/365) × 60% = $302,466
└─ US Co includes $302,466 of NCTI
```

### Multiple Ownership Changes

```
COMPLEX SCENARIOS:

Scenario 1: Multiple Acquisitions
├─ US Co 1 owns 60% Jan 1 - June 30 (181 days)
├─ US Co 2 acquires 60% July 1 - Dec 31 (184 days)
├─ CFC NCTI = $1,000,000

Calculation:
├─ US Co 1: $1,000,000 × (181/365) × 60% = $297,534
├─ US Co 2: $1,000,000 × (184/365) × 60% = $302,466
└─ Total included: $600,000 (same as if one owner all year)


Scenario 2: Partial Year CFC Status
├─ FC is not CFC Jan 1 - March 31 (90 days)
├─ US Co acquires 60% April 1, making FC a CFC
├─ US Co owns 60% April 1 - Dec 31 (275 days)
├─ CFC NCTI = $1,000,000 (assume evenly earned)

Calculation:
├─ CFC status period: 275 days
├─ US Co ownership period: 275 days (coincides with CFC status)
├─ Pro-rata NCTI attributable to CFC period: $1,000,000 × (275/365) = $753,425
├─ US Co share: $753,425 × 60% = $452,055
└─ (Income earned before CFC status not included)


Scenario 3: Loss of CFC Status
├─ US Co owns 60% Jan 1 - Sept 30 (273 days)
├─ US Co sells to non-US person Oct 1
├─ FC loses CFC status Oct 1 (non-US persons now own >50%)
├─ CFC NCTI for period = $750,000

Calculation:
├─ CFC status period: 273 days
├─ US Co ownership during CFC period: 273 days
├─ Pro-rata share: $750,000 × (273/273) × 60% = $450,000
└─ US Co includes $450,000
```

### OBBBA Transition Rule (2024-2026)

From [IRS Notice 2025-75](https://www.irs.gov/pub/irs-drop/n-25-75.pdf):

```
TRANSITION RULE: DIVIDEND REDUCTION LIMITATION

Affected Periods:
├─ CFC tax years including June 28, 2025
├─ CFC tax years beginning after June 28, 2025 but before Jan 1, 2026
└─ Essentially: Portions of 2024, all of 2025, portions of 2026

The Rule:
┌─────────────────────────────────────────────────────────────────────────────┐
│  Under pre-OBBBA law, dividends paid by CFC reduced pro-rata share         │
│  of Subpart F and GILTI.                                                   │
│                                                                             │
│  Transition rule DISALLOWS this reduction if:                              │
│  ├─ Dividend does not increase taxable income of US person                 │
│  │   (e.g., due to Section 245A DRD, or exclusion)                         │
│  └─ Applied during transition period                                       │
│                                                                             │
│  Purpose: Prevent "dividend stripping" before new rules take effect        │
└─────────────────────────────────────────────────────────────────────────────┘

Practical Impact:
├─ Cannot use dividends to reduce Subpart F/GILTI during transition
├─ If dividend qualifies for 245A DRD, no reduction in inclusion
├─ Affects year-end planning for 2025 tax years
└─ IRS will issue proposed regulations with further guidance
```

### M&A Transaction Implications

From [Cooley](https://www.cooley.com/news/insight/2025/2025-07-21-key-international-tax-provisions-under-the-one-big-beautiful-bill-act):

```
M&A CONSIDERATIONS UNDER NEW RULES:

1. ACQUISITION PLANNING
   ├─ Buyer includes NCTI for post-acquisition period
   ├─ Seller includes NCTI for pre-disposition period
   ├─ No "last day" timing opportunities
   └─ Purchase price adjustments should reflect partial year inclusions

2. DEAL STRUCTURING
   ├─ Stock vs asset purchase analysis changes
   ├─ Timing of closing less critical for CFC income
   ├─ Tax indemnities should address pro-rata calculations
   └─ Due diligence must assess partial year exposures

3. POST-CLOSE ACTIONS
   ├─ Cannot "clean out" CFC earnings before year-end
   ├─ Intercompany transactions affect both buyer and seller periods
   └─ Check-the-box elections have immediate pro-rata effect

4. TAX INDEMNITY PROVISIONS
   ├─ Specify responsibility for pre vs post-closing CFC income
   ├─ Define calculation methodology
   ├─ Address transition rule implications
   └─ Coordinate with actual CFC tax reporting
```

### Other OBBBA NCTI Changes

```
RELATED CHANGES TO CONSIDER:

1. QBAI ELIMINATION
   ├─ Pre-OBBBA: GILTI reduced by 10% of QBAI (deemed tangible income return)
   ├─ Post-OBBBA: QBAI reduction eliminated entirely
   ├─ Result: Higher NCTI inclusions for capital-intensive CFCs
   └─ Renamed: GILTI → NCTI (Net CFC Tested Income)

2. SECTION 250 DEDUCTION CHANGE
   ├─ Pre-OBBBA: 50% deduction for GILTI (effective 10.5% rate)
   ├─ Post-OBBBA: 40% deduction for NCTI (effective 12.6% rate)
   └─ Increases US tax on CFC income

3. FOREIGN TAX CREDIT HAIRCUT
   ├─ Pre-OBBBA: 80% of foreign taxes creditable
   ├─ Post-OBBBA: 90% of foreign taxes creditable
   └─ Partially offsets higher NCTI rate
```

## Implementation Implications

### Schema Requirements

```typescript
// CFC Status Tracking
export const cfcStatusPeriods = pgTable('cfc_status_periods', {
  id: uuid('id').primaryKey().defaultRandom(),

  entityId: uuid('entity_id').notNull(),
  taxYear: integer('tax_year').notNull(),

  // Status period
  statusType: varchar('status_type', { length: 20 }).notNull(), // cfc | non_cfc
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  daysInPeriod: integer('days_in_period').notNull(),

  // Status change reason
  changeReason: varchar('change_reason', { length: 100 }),
  changeEventId: uuid('change_event_id'), // Link to ownership change event

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// US Shareholder Ownership Periods
export const usShareholderPeriods = pgTable('us_shareholder_periods', {
  id: uuid('id').primaryKey().defaultRandom(),

  cfcEntityId: uuid('cfc_entity_id').notNull(),
  shareholderId: uuid('shareholder_id').notNull(),
  taxYear: integer('tax_year').notNull(),

  // Ownership period
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  daysInPeriod: integer('days_in_period').notNull(),

  // Ownership details
  ownershipPercentage: decimal('ownership_percentage', { precision: 8, scale: 4 }).notNull(),
  isUsShareholderDuringPeriod: boolean('is_us_shareholder').notNull(),

  // Acquisition/disposition details
  acquisitionType: varchar('acquisition_type', { length: 50 }),
  dispositionType: varchar('disposition_type', { length: 50 }),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Pro-Rata Share Calculations
export const proRataCalculations = pgTable('pro_rata_calculations', {
  id: uuid('id').primaryKey().defaultRandom(),

  cfcEntityId: uuid('cfc_entity_id').notNull(),
  shareholderId: uuid('shareholder_id').notNull(),
  taxYear: integer('tax_year').notNull(),

  // Income components
  totalSubpartFIncome: decimal('total_subpart_f', { precision: 20, scale: 2 }).notNull(),
  totalNCTI: decimal('total_ncti', { precision: 20, scale: 2 }).notNull(),

  // Allocation factors
  daysOwned: integer('days_owned').notNull(),
  daysCFC: integer('days_cfc').notNull(),
  daysUSShareholderStatus: integer('days_us_shareholder').notNull(),
  totalDaysInYear: integer('total_days_in_year').notNull(),

  ownershipFraction: decimal('ownership_fraction', { precision: 8, scale: 6 }).notNull(),
  periodFraction: decimal('period_fraction', { precision: 8, scale: 6 }).notNull(),
  cfcStatusFraction: decimal('cfc_status_fraction', { precision: 8, scale: 6 }).notNull(),
  usShareholderFraction: decimal('us_shareholder_fraction', { precision: 8, scale: 6 }).notNull(),

  // Calculated inclusions
  proRataSubpartF: decimal('pro_rata_subpart_f', { precision: 20, scale: 2 }).notNull(),
  proRataNCTI: decimal('pro_rata_ncti', { precision: 20, scale: 2 }).notNull(),

  // Section 250 deduction
  section250Deduction: decimal('section_250_deduction', { precision: 20, scale: 2 }).notNull(),
  netNCTIInclusion: decimal('net_ncti_inclusion', { precision: 20, scale: 2 }).notNull(),

  // Calculation metadata
  calculationMethod: varchar('calculation_method', { length: 50 }).notNull(),
  // pre_obbba | post_obbba | transition
  calculatedAt: timestamp('calculated_at').notNull(),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Transition Rule Tracking
export const transitionRuleEvents = pgTable('transition_rule_events', {
  id: uuid('id').primaryKey().defaultRandom(),

  cfcEntityId: uuid('cfc_entity_id').notNull(),
  taxYear: integer('tax_year').notNull(),

  // Dividend details
  dividendDate: date('dividend_date').notNull(),
  dividendAmount: decimal('dividend_amount', { precision: 20, scale: 2 }).notNull(),

  // Transition rule application
  qualifiesForReduction: boolean('qualifies_for_reduction').notNull(),
  disallowedReason: varchar('disallowed_reason', { length: 100 }),
  // drd_applied | exclusion_applied | etc.

  // Impact
  subpartFReductionDenied: decimal('subpart_f_reduction_denied', { precision: 20, scale: 2 }),
  nctiReductionDenied: decimal('ncti_reduction_denied', { precision: 20, scale: 2 }),

  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

### Service Interface

```typescript
interface CFCProRataService {
  // Status tracking
  recordCFCStatusChange(
    entityId: string,
    statusChange: CFCStatusChange
  ): Promise<CFCStatusPeriod>;

  trackOwnershipPeriod(
    cfcId: string,
    shareholderId: string,
    period: OwnershipPeriod
  ): Promise<USShareholderPeriod>;

  // Pro-rata calculation
  calculateProRataShare(
    cfcId: string,
    shareholderId: string,
    taxYear: number
  ): Promise<ProRataCalculation>;

  // Handle mid-year changes
  handleOwnershipChange(
    cfcId: string,
    change: OwnershipChangeEvent
  ): Promise<ProRataImpact>;

  // Transition rule
  evaluateTransitionRule(
    cfcId: string,
    dividend: DividendEvent
  ): Promise<TransitionRuleResult>;

  // M&A support
  modelAcquisitionImpact(
    targetCfcId: string,
    acquisitionDate: Date,
    acquirerDetails: AcquirerInfo
  ): Promise<ProRataProjection>;

  // Reporting
  generateForm5471Data(
    cfcId: string,
    shareholderId: string,
    taxYear: number
  ): Promise<Form5471Data>;
}
```

## Outstanding Questions

1. **Section 962 Interaction**: How do pro-rata rules interact with Section 962 elections?
2. **Tested Loss CFCs**: How to allocate tested losses for partial-year CFCs?
3. **Tiered CFCs**: Pro-rata calculations for indirect ownership through other CFCs?

## Sources

- [Baker Tilly: IRS Guidance on New Pro-Rata Rule Under OBBBA](https://www.bakertilly.com/insights/irs-guidance-on-new-pro-rata-rule-under-obbba)
- [IRS Notice 2025-75](https://www.irs.gov/pub/irs-drop/n-25-75.pdf)
- [HCVT: International Tax Changes Under the OBBBA](https://www.hcvt.com/alertarticle-International-Tax-Changes-Under-the-OBBBA)
- [DLA Piper: IRS Issues Notice 2025-75, 2025-77, 2025-78](https://www.dlapiper.com/en-us/insights/publications/2025/12/irs-issues-notice-2025-75-notice-2025-7-notice-2025-78)
- [Cooley: Key International Tax Provisions Under OBBBA](https://www.cooley.com/news/insight/2025/2025-07-21-key-international-tax-provisions-under-the-one-big-beautiful-bill-act)
- [Alvarez & Marsal: OBBBA International Tax Guidance](https://www.alvarezandmarsal.com/insights/obbba-international-tax-guidance-whats-new-whats-looming)
- [KLR: OBBBA Shifts International Tax Law](https://kahnlitwin.com/blogs/tax-blog/the-obbba-shifts-international-tax-law)

---

*Research conducted: January 2026*
*Gap identified in: Mission-requirement analysis - tax service needs OBBBA pro-rata calculations*
