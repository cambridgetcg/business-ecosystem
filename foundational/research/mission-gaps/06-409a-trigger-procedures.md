# 409A Valuation Trigger Procedures

> Gap #06: System tracks equity grants but doesn't identify when material events trigger new 409A valuations.

## Gap Identification

**Category**: Edge Cases
**Severity**: HIGH
**Blocks Implementation Phase(s)**: Phase 1 (Entity Governance)

## Current State

Existing research covers:
- Basic 409A valuation concepts
- Equity grant management basics
- General understanding of stock options
- Penalty structures for non-compliance

## What's Missing

Cannot ensure equity compensation compliance because:

1. **Material Event Definition**: What exactly constitutes a "material event"?
2. **Detection Procedures**: How to identify when a material event has occurred?
3. **Response Timeline**: How quickly must a new valuation be obtained?
4. **Gap Period Grants**: What happens to grants issued during valuation gap?
5. **Safe Harbor Requirements**: What's needed to maintain safe harbor protection?

## Research Findings

### 409A Valuation Fundamentals

From [Sofer Advisors](https://soferadvisors.com/insights/blog/409a-valuation-requirements-complete-compliance-guide-2025/):

```
409A VALUATION REQUIREMENTS:

Purpose:
├─ Determine Fair Market Value (FMV) of company stock
├─ Ensure stock options have exercise price ≥ FMV at grant
├─ Comply with IRC Section 409A deferred compensation rules
└─ Protect employees from penalties

Timing Requirements:
├─ Before first equity grant to US tax residents
├─ At least every 12 months thereafter
├─ Within 90 days of any material event
└─ Before granting options after material event

Safe Harbor Protection:
┌─────────────────────────────────────────────────────────────────────────────┐
│  When valuation meets safe harbor requirements:                            │
│  ├─ Conducted by qualified independent appraiser                           │
│  ├─ Properly documented per IRS guidelines                                 │
│  ├─ Completed within past 12 months                                        │
│  └─ No material event since valuation                                      │
│                                                                             │
│  BENEFIT: Burden of proof shifts to IRS                                    │
│  IRS must prove valuation was "grossly unreasonable"                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Material Events That Trigger New Valuation

From [Fidelity Private Shares](https://www.fidelityprivateshares.com/blog/409a-material-event-checklist-when-your-company-needs-a-new-valuation) and [Eton Venture Services](https://etonvs.com/409a-valuation/409a-material-event/):

```
MATERIAL EVENT CATEGORIES:

1. FINANCING EVENTS
   ├─ Equity financing rounds (Seed, Series A-D, etc.)
   ├─ Convertible note financing with valuation cap
   ├─ SAFE agreements (especially with valuation caps)
   ├─ Secondary stock sales at new price point
   └─ Bridge financing or extension rounds

2. M&A RELATED
   ├─ Acquisition offer received (even if declined)
   ├─ Letter of intent signed
   ├─ Merger discussions initiated
   ├─ Asset purchase negotiations
   └─ Going public preparations (IPO filing)

3. BUSINESS MILESTONES
   ├─ Major product launch
   ├─ Significant revenue increase (>25% quarter-over-quarter)
   ├─ Major customer acquisition (Fortune 500, etc.)
   ├─ Strategic partnership announcement
   └─ Patent award or regulatory approval (FDA, etc.)

4. BUSINESS CHALLENGES
   ├─ Major customer loss
   ├─ Product failure or recall
   ├─ Regulatory setback
   ├─ Significant revenue decline
   ├─ Key employee departures
   └─ Litigation that materially affects value

5. MARKET CONDITIONS
   ├─ Economic downturn affecting sector
   ├─ Comparable company valuations shift significantly
   ├─ Industry disruption events
   └─ Major competitor developments

6. OPERATIONAL CHANGES
   ├─ Significant pivot in business model
   ├─ Major restructuring
   ├─ Geographic expansion or contraction
   ├─ Significant asset acquisition or disposal
   └─ Material change in financial outlook
```

### Post-2024 IRS Guidance Updates

From [Sofer Advisors](https://soferadvisors.com/insights/blog/409a-valuation-requirements-complete-compliance-guide-2025/):

```
2024/2025 IRS GUIDANCE EXPANSIONS:

New Material Event Triggers:
├─ Substantial customer base changes
├─ Significant operational pivots
├─ Changes in competitive landscape
└─ Macroeconomic shifts affecting private valuations

Increased Scrutiny Areas:
├─ Down-round financings (must update valuation)
├─ Valuation methodology consistency
├─ Board approval documentation
└─ Grant timing relative to material events
```

### Material Event Detection Procedures

```
DETECTION FRAMEWORK:

1. AUTOMATED MONITORING
   ┌─────────────────────────────────────────────────────────────────────────┐
   │  Event Type           │ Detection Method                               │
   ├───────────────────────┼────────────────────────────────────────────────┤
   │  Financing            │ Cap table changes, board resolutions          │
   │  Revenue changes      │ Financial system thresholds (±25%)            │
   │  Customer changes     │ CRM integration, contract values              │
   │  M&A activity         │ Legal matter tracking, board minutes          │
   │  Product milestones   │ Product roadmap tracking, PR monitoring       │
   │  Market conditions    │ Comparable company tracking, index monitoring │
   └───────────────────────┴────────────────────────────────────────────────┘

2. PERIODIC REVIEW PROCESS
   ├─ Monthly: Finance team reviews for potential triggers
   ├─ Quarterly: Formal board review of material events
   ├─ Ad-hoc: Alert on specific event types
   └─ Annual: Comprehensive review before next valuation

3. RESPONSIBILITY ASSIGNMENT
   ├─ CFO/Controller: Financial event detection
   ├─ General Counsel: Legal/M&A event detection
   ├─ CEO: Strategic event detection
   ├─ HR/Equity Admin: Grant timing coordination
   └─ Board: Oversight and approval
```

### Response Timeline and Procedures

```
WHEN MATERIAL EVENT DETECTED:

Timeline:
├─ Day 0: Material event occurs/detected
├─ Day 1-3: Internal assessment - is this a trigger?
├─ Day 3-7: Decision to obtain new valuation
├─ Day 7-14: Engage valuation firm
├─ Day 14-60: Valuation process (depends on complexity)
├─ Day 60-90: Valuation completed and approved
└─ DEADLINE: New valuation must be completed within 90 days

During Gap Period:
┌─────────────────────────────────────────────────────────────────────────────┐
│  OPTIONS FOR GRANTS DURING VALUATION GAP:                                   │
│                                                                             │
│  Option 1: PAUSE GRANTS                                                    │
│  ├─ No options granted until new valuation complete                        │
│  ├─ Simplest approach, no compliance risk                                  │
│  └─ May delay recruiting/retention grants                                  │
│                                                                             │
│  Option 2: GRANT WITH CONTINGENT PRICING                                   │
│  ├─ Grant date is approval date                                            │
│  ├─ Exercise price set at higher of:                                       │
│  │   └─ Old valuation FMV OR New valuation FMV                             │
│  ├─ Protects against underpriced grants                                    │
│  └─ Requires clear documentation and employee communication               │
│                                                                             │
│  Option 3: DELAYED GRANT DATE                                              │
│  ├─ Board approves terms but grant date is deferred                        │
│  ├─ Grant becomes effective when new valuation is complete                 │
│  ├─ May affect vesting schedule                                            │
│  └─ Requires careful documentation                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Consequences of Non-Compliance

From [BPM](https://www.bpm.com/insights/409a-valuation/) and [Secfi](https://secfi.com/learn/409a-valuation-stock-options-startup):

```
PENALTIES FOR 409A VIOLATIONS:

Who Bears the Penalty: THE EMPLOYEE (not the company)
├─ This is often misunderstood
├─ Company may face reputational damage and employee claims
├─ But statutory penalties fall on option holder
└─ Company may choose to indemnify (creates additional cost)

Penalty Structure:
├─ IMMEDIATE TAXATION: All vested options taxed as ordinary income
├─ 20% PENALTY TAX: Additional penalty on top of regular tax
├─ INTEREST: Premium interest rate on unpaid tax
└─ COMPOUNDING: Penalties apply to each affected tax year

Example:
├─ Employee has $100,000 in vested underpriced options
├─ Regular tax (assume 37%): $37,000
├─ 20% penalty: $20,000
├─ Interest (assume 5%): ~$5,000+
├─ Total: $62,000+ (vs $37,000 if compliant)
└─ And this applies EVERY YEAR until corrected
```

### Safe Harbor Maintenance

```
MAINTAINING SAFE HARBOR PROTECTION:

Valuation Requirements:
├─ Independent, qualified appraiser
│   ├─ Accredited in business valuation (ABV, ASA, CFA)
│   ├─ No conflict of interest
│   └─ 5+ years of relevant experience
├─ Written report with:
│   ├─ Valuation methodology explanation
│   ├─ Comparable company analysis
│   ├─ Risk factor assessment
│   └─ Conclusion with defensible logic
└─ Board approval of valuation

Record Keeping:
├─ Maintain all valuation reports
├─ Document board approval (minutes)
├─ Track material events and responses
├─ Keep grant documentation (date, price, employee)
└─ Preserve for duration of statute of limitations

Best Practices:
├─ Schedule regular valuations (every 6-9 months)
├─ Don't wait until day 365
├─ Build buffer for material event risk
└─ Consider quarterly board review of potential triggers
```

## Implementation Implications

### Schema Requirements

```typescript
// 409A Valuations
export const valuations409a = pgTable('valuations_409a', {
  id: uuid('id').primaryKey().defaultRandom(),

  entityId: uuid('entity_id').notNull(),

  // Valuation details
  valuationDate: date('valuation_date').notNull(),
  fairMarketValue: decimal('fair_market_value', { precision: 20, scale: 6 }).notNull(),
  valuationFirmName: varchar('valuation_firm_name', { length: 255 }).notNull(),
  valuationFirmId: uuid('valuation_firm_id'),

  // Report details
  reportDate: date('report_date').notNull(),
  methodologyUsed: varchar('methodology_used', { length: 100 }).notNull(),
  // market_approach | income_approach | asset_approach | hybrid

  // Safe harbor status
  safeHarborQualified: boolean('safe_harbor_qualified').notNull(),
  qualificationBasis: varchar('qualification_basis', { length: 50 }),
  // independent_appraisal | binding_formula

  // Validity
  effectiveDate: date('effective_date').notNull(),
  expirationDate: date('expiration_date').notNull(), // valuation date + 12 months
  supersededByMaterialEvent: boolean('superseded_by_material_event').default(false),
  supersededAt: timestamp('superseded_at'),
  supersedingEventId: uuid('superseding_event_id'),

  // Approval
  boardApprovalDate: date('board_approval_date'),
  boardResolutionId: uuid('board_resolution_id'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Material Events
export const materialEvents409a = pgTable('material_events_409a', {
  id: uuid('id').primaryKey().defaultRandom(),

  entityId: uuid('entity_id').notNull(),

  // Event details
  eventType: varchar('event_type', { length: 50 }).notNull(),
  // financing | m_and_a | milestone | challenge | market | operational
  eventSubtype: varchar('event_subtype', { length: 100 }).notNull(),
  eventDescription: text('event_description').notNull(),
  eventDate: date('event_date').notNull(),
  detectedDate: date('detected_date').notNull(),

  // Assessment
  materialityAssessment: varchar('materiality_assessment', { length: 20 }).notNull(),
  // material | not_material | under_review
  assessmentRationale: text('assessment_rationale'),
  assessedBy: uuid('assessed_by'),
  assessedAt: timestamp('assessed_at'),

  // Impact on current valuation
  invalidatesCurrentValuation: boolean('invalidates_current_valuation').default(false),
  affectedValuationId: uuid('affected_valuation_id'),

  // Response
  responseRequired: boolean('response_required').default(false),
  newValuationOrdered: boolean('new_valuation_ordered').default(false),
  newValuationDueDate: date('new_valuation_due_date'),
  responseValuationId: uuid('response_valuation_id'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Grant Gap Period Tracking
export const grantGapPeriods = pgTable('grant_gap_periods', {
  id: uuid('id').primaryKey().defaultRandom(),

  entityId: uuid('entity_id').notNull(),

  // Gap period
  periodStart: date('period_start').notNull(), // material event date
  periodEnd: date('period_end'), // new valuation date
  status: varchar('status', { length: 20 }).notNull(), // active | closed

  // Triggering event
  triggeringEventId: uuid('triggering_event_id').notNull(),

  // Gap period policy
  grantPolicy: varchar('grant_policy', { length: 30 }).notNull(),
  // pause_grants | contingent_pricing | delayed_grant

  // Resolution
  resolutionValuationId: uuid('resolution_valuation_id'),
  resolutionDate: date('resolution_date'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Equity Grants (409A relevant fields)
export const equityGrants = pgTable('equity_grants', {
  id: uuid('id').primaryKey().defaultRandom(),

  entityId: uuid('entity_id').notNull(),
  granteeId: uuid('grantee_id').notNull(),

  // Grant details
  grantType: varchar('grant_type', { length: 30 }).notNull(), // iso | nso | rsu
  grantDate: date('grant_date').notNull(),
  numberOfShares: integer('number_of_shares').notNull(),
  exercisePrice: decimal('exercise_price', { precision: 20, scale: 6 }).notNull(),

  // 409A compliance
  valuationId: uuid('valuation_id').notNull(),
  grantFMV: decimal('grant_fmv', { precision: 20, scale: 6 }).notNull(),
  isGrantedAtOrAboveFMV: boolean('is_granted_at_or_above_fmv').notNull(),

  // Gap period handling
  grantedDuringGapPeriod: boolean('granted_during_gap_period').default(false),
  gapPeriodId: uuid('gap_period_id'),
  contingentPricingApplied: boolean('contingent_pricing_applied').default(false),
  finalExercisePrice: decimal('final_exercise_price', { precision: 20, scale: 6 }),

  // Board approval
  boardApprovalDate: date('board_approval_date'),
  boardResolutionId: uuid('board_resolution_id'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

### Service Interface

```typescript
interface ValuationTriggerService {
  // Valuation Management
  recordValuation(valuation: Valuation409AInput): Promise<Valuation409A>;
  getCurrentValidValuation(entityId: string): Promise<Valuation409A | null>;
  checkValuationExpiry(entityId: string): Promise<ExpiryStatus>;

  // Material Event Detection
  detectMaterialEvents(entityId: string): Promise<MaterialEvent[]>;
  assessMateriality(event: PotentialEvent): Promise<MaterialityAssessment>;
  recordMaterialEvent(event: MaterialEventInput): Promise<MaterialEvent409a>;

  // Grant Gap Period
  initiateGapPeriod(entityId: string, event: MaterialEvent): Promise<GapPeriod>;
  handleGapPeriodGrant(grant: GrantInput, gapPeriod: GapPeriod): Promise<EquityGrant>;
  closeGapPeriod(gapPeriodId: string, newValuationId: string): Promise<void>;

  // Compliance Checking
  validateGrantCompliance(grant: GrantInput): Promise<ComplianceResult>;
  assessSafeHarborStatus(entityId: string): Promise<SafeHarborStatus>;

  // Monitoring
  getUpcomingValuationDeadlines(entityId: string): Promise<Deadline[]>;
  generateValuationCalendar(entityId: string): Promise<ValuationCalendar>;

  // Reporting
  generate409AComplianceReport(entityId: string, period: Period): Promise<ComplianceReport>;
}
```

## Outstanding Questions

1. **Repricings**: How to handle option repricings and 409A implications?
2. **International Employees**: 409A applies to US tax residents - how to handle global equity?
3. **Tender Offers**: Do secondary tender offers always trigger new valuations?

## Sources

- [Sofer Advisors: 409A Valuation Requirements Complete Guide 2025](https://soferadvisors.com/insights/blog/409a-valuation-requirements-complete-compliance-guide-2025/)
- [Fidelity Private Shares: 409A Material Event Checklist](https://www.fidelityprivateshares.com/blog/409a-material-event-checklist-when-your-company-needs-a-new-valuation)
- [KLR: What Events Trigger a 409A Stock Re-Evaluation?](https://kahnlitwin.com/blogs/tax-blog/what-events-trigger-a-409a-stock-re-evaluation)
- [Eton Venture Services: 19 Examples of 409A Material Events](https://etonvs.com/409a-valuation/409a-material-event/)
- [BPM: Understanding 409A Valuations](https://www.bpm.com/insights/409a-valuation/)
- [Secfi: 409A Valuation Stock Options Startup](https://secfi.com/learn/409a-valuation-stock-options-startup)
- [Mantle: 409A Valuations for Startups 2025 Guide](https://blog.withmantle.com/409a-valuations/)

---

*Research conducted: January 2026*
*Gap identified in: Mission-requirement analysis - entity governance needs equity compliance procedures*
