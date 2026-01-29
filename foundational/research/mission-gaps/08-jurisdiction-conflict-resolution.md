# Multi-Jurisdiction Conflict Resolution

> Gap #08: System handles jurisdiction-by-jurisdiction but doesn't address conflicts between jurisdictions.

## Gap Identification

**Category**: Technical Integration
**Severity**: HIGH
**Blocks Implementation Phase(s)**: Phase 1 (Entity Governance), Phase 4 (Tax)

## Current State

Existing research covers:
- Individual jurisdiction requirements
- Entity formation by jurisdiction
- Tax treaty basics
- General concepts of dual residency

## What's Missing

Cannot resolve jurisdiction conflicts because:

1. **Tie-Breaker Rules**: How do tax treaty tie-breaker rules work operationally?
2. **State vs Federal**: How to handle US state tax divergence from federal treaty outcomes?
3. **Conflicting Requirements**: When two jurisdictions require contradictory actions?
4. **Resolution Procedures**: Step-by-step process for resolving conflicts?
5. **Documentation Requirements**: What documentation is needed to support positions?

## Research Findings

### Tax Treaty Tie-Breaker Rules

From [DLA Piper](https://www.dlapiper.com/en/insights/publications/2021/05/agefi-dual-tax-residence-when-the-tie-does-not-break) and [Cummings Law](https://www.cummings.law/how-to-work-with-tax-treaty-tie-breaker-rules-for-dual-residents/):

```
DUAL RESIDENCE PROBLEM:

When It Occurs:
├─ Different countries have different residency tests
├─ Individual/entity can meet tests in multiple countries
├─ Without resolution: taxed on worldwide income by BOTH
└─ Creates double taxation problem

OECD Model Article 4 Tie-Breaker (Individuals):
┌─────────────────────────────────────────────────────────────────────────────┐
│  HIERARCHY OF TIE-BREAKER TESTS (apply in order):                          │
│                                                                             │
│  1. PERMANENT HOME                                                         │
│     └─ Where does the individual have a permanent home available?          │
│        └─ If only one country: Resident of that country                    │
│                                                                             │
│  2. CENTRE OF VITAL INTERESTS (if permanent home in both)                  │
│     └─ Where are personal and economic relations closer?                   │
│        ├─ Family location                                                  │
│        ├─ Principal business activities                                    │
│        ├─ Administrative/management activities                             │
│        └─ If determinable: Resident of that country                        │
│                                                                             │
│  3. HABITUAL ABODE (if centre of vital interests indeterminate)            │
│     └─ Where does the individual habitually live?                          │
│        └─ Count days present, but consider patterns                        │
│                                                                             │
│  4. NATIONALITY (if habitual abode in both or neither)                     │
│     └─ Which country is the individual a national of?                      │
│                                                                             │
│  5. MUTUAL AGREEMENT PROCEDURE (if nationality in both or neither)         │
│     └─ Competent authorities must negotiate and agree                      │
└─────────────────────────────────────────────────────────────────────────────┘

OECD Model Article 4 Tie-Breaker (Entities):
├─ Older treaties: Place of Effective Management (POEM)
├─ 2017+ Model: Competent Authority determination
└─ Many treaties still use POEM test
```

### When Tie-Breaker Rules Fail

From [DLA Piper](https://www.dlapiper.com/en/insights/publications/2021/05/agefi-dual-tax-residence-when-the-tie-does-not-break):

```
FAILURE SCENARIOS:

1. NO TREATY EXISTS
   ├─ No tie-breaker rules available
   ├─ Each country applies domestic law independently
   ├─ Double taxation likely
   └─ Unilateral credits may provide partial relief

2. TIE-BREAKER INCONCLUSIVE
   ├─ Tests don't resolve residency
   ├─ Must go to Mutual Agreement Procedure (MAP)
   ├─ Can take years to resolve
   └─ No guaranteed outcome

3. COUNTRY DOESN'T HONOR TIE-BREAKER
   ├─ Some countries apply domestic law despite treaty
   ├─ Must pursue MAP or litigation
   └─ Creates compliance uncertainty

MUTUAL AGREEMENT PROCEDURE (MAP):
├─ Taxpayer requests competent authority assistance
├─ Competent authorities negotiate
├─ No time limit for resolution (often 2-3 years)
├─ Outcome: Either country OR split
└─ Not binding in some jurisdictions
```

### 2025 Developments in Tie-Breaker Rules

From [Chambers](https://chambers.com/articles/reporting-obligations-for-foreign-financial-accounts-and-the-tie-breaker-rule-under-tax-treaties):

```
RECENT DEVELOPMENTS:

Korean Supreme Court (April 2025):
├─ Treaty tie-breaker rule cannot alone exempt from
│   domestic compliance obligations
├─ Foreign financial account reporting still required
│   even if treaty says resident of other country
└─ Impacts: FATCA, FBAR-equivalent reporting

Spanish High Court (September 2025):
├─ Foreign tax residence certificate triggers treaty analysis
├─ But doesn't prevent Spain asserting residence under domestic law
├─ Must apply treaty tie-breaker rules
└─ Documentation of foreign residence essential but not dispositive

Key Takeaway:
├─ Treaty residency ≠ Automatic exemption from all domestic rules
├─ Compliance obligations may persist
└─ Always analyze domestic law AND treaty
```

### US State vs Federal Treaty Conflicts

From [US Tax Talk](https://us-tax.org/2023/01/12/treaty-tie-breaker-oh-the-pitfalls-beware/) and [GHJ](https://www.ghjadvisors.com/ghj-insights/understanding-tax-treaties-a-guide-to-international-income-tax-agreements):

```
STATE TAX TREATY NON-CONFORMITY:

The Problem:
├─ Federal treaties bind the federal government
├─ States are NOT parties to federal treaties
├─ Many states DO NOT conform to federal treaty outcomes
└─ Result: Federal treaty relief, but state still taxes

State Approaches:
┌─────────────────────────────────────────────────────────────────────────────┐
│  CONFORM (treaty applies):                                                 │
│  ├─ Most states follow federal taxable income                              │
│  └─ Treaty adjustments flow through automatically                          │
│                                                                             │
│  PARTIAL CONFORM:                                                          │
│  ├─ Follow federal for some purposes                                       │
│  └─ Apply own rules for residency/sourcing                                 │
│                                                                             │
│  NON-CONFORM (common for aggressive states):                               │
│  ├─ Apply own residency tests regardless of treaty                         │
│  ├─ May not recognize treaty residency                                     │
│  └─ Examples: CA, NY, MA (in various contexts)                             │
└─────────────────────────────────────────────────────────────────────────────┘

California Example:
├─ Individual claims non-resident under US-UK treaty
├─ UK is sole residence per tie-breaker
├─ Federal: No US income tax on UK-source income
├─ California: May still tax as California resident
│   if domicile/connections to CA exist
└─ Result: Federal tax relief, CA taxes anyway
```

### US Treaty Exit Tax Implications

From [San Francisco Tax Counsel](https://sftaxcounsel.com/blog/closer-connection-test-treaty-tie-breaker-foreign-income/):

```
EXIT TAX TRAP:

Section 7701(b)(6) Rule:
├─ If treaty tie-breaker claimed by green card holder
├─ After 8+ years of US residence
├─ Treated as "ceasing to be lawful permanent resident"
└─ May trigger EXIT TAX (Section 877A)

Exit Tax Thresholds (2025):
├─ Net worth ≥ $2 million on expatriation date, OR
├─ Average annual net income tax ≥ $201,000 (5-year avg), OR
├─ Failed to certify 5-year tax compliance
└─ Result: Mark-to-market taxation on worldwide assets

IMPLICATION:
├─ Using treaty tie-breaker has permanent consequences
├─ Cannot be undone
├─ Must analyze exit tax exposure before claiming
└─ May be better to remain US resident in some cases
```

### Special Treaty Cases

From [Cummings Law](https://www.cummings.law/how-to-work-with-tax-treaty-tie-breaker-rules-for-dual-residents/):

```
US-CHINA TREATY (UNIQUE):

No Automatic Tie-Breaker:
├─ Unlike other treaties, no standard hierarchy
├─ Article 4(2): "shall seek to determine residency
│   by mutual agreement"
├─ Must always go to competent authorities
└─ Time-consuming and uncertain

Process:
├─ File Forms 1040/1040-NR as appropriate
├─ Request competent authority assistance
├─ Provide evidence of residence factors
├─ Wait for determination (can take 1-2 years)
└─ Comply with ultimate determination

Other Non-Standard Treaties:
├─ US-India: Modified POEM test
├─ US-Germany: Specific rules for citizens
└─ Always check specific treaty language
```

### Conflict Resolution Procedures

```
RESOLUTION WORKFLOW:

Step 1: IDENTIFY CONFLICT
├─ Map all jurisdictions claiming taxing rights
├─ Identify basis for each claim (domestic law)
├─ Determine applicable treaties
└─ Assess potential double taxation

Step 2: APPLY TIE-BREAKER RULES
├─ Follow treaty hierarchy (permanent home → POEM, etc.)
├─ Document evidence for each test
├─ Determine treaty residency
└─ Document conclusion with rationale

Step 3: ASSESS STATE/PROVINCIAL IMPACT
├─ Identify subnational jurisdictions involved
├─ Determine if they conform to federal treaty
├─ If not, apply subnational law separately
└─ Calculate potential subnational exposure

Step 4: DOCUMENT AND FILE
├─ Prepare treaty-based position
├─ File federal return with treaty disclosure (Form 8833)
├─ File state returns as required
├─ Maintain documentation package

Step 5: IF TIE-BREAKER FAILS
├─ Request Mutual Agreement Procedure
├─ Provide comprehensive evidence package
├─ Engage tax authorities
└─ Wait for resolution

DOCUMENTATION REQUIREMENTS:
┌─────────────────────────────────────────────────────────────────────────────┐
│  For Each Test:                                                            │
│  ├─ Permanent Home: Lease/ownership docs, utility bills, furnishing       │
│  ├─ Centre of Vital Interests: Employment, family, bank accounts          │
│  ├─ Habitual Abode: Travel records, calendar, passport stamps             │
│  ├─ Nationality: Passports, citizenship certificates                      │
│  └─ POEM (entities): Board minutes, management location evidence          │
│                                                                             │
│  Maintain for statute of limitations period (typically 6+ years)           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Entity Conflict Resolution

```
ENTITY DUAL RESIDENCE ISSUES:

Place of Effective Management (POEM):
├─ Where key management decisions are made
├─ Where board meets and decides
├─ Where operational control exercised
└─ Not necessarily where incorporated

POEM Factors:
├─ Location of board meetings
├─ Location of senior management
├─ Where day-to-day decisions made
├─ Where key documents signed
└─ Where strategic direction set

Common Conflicts:
├─ Incorporated in Country A, managed from Country B
├─ Holding company in Country A, operating entities in Country B
├─ Nominee directors in Country A, actual control in Country B
└─ Split management (some functions each country)

Resolution:
├─ Apply treaty tie-breaker (usually POEM or competent authority)
├─ Document management location rigorously
├─ Consider restructuring if conflict chronic
└─ May need advance ruling/determination
```

## Implementation Implications

### Schema Requirements

```typescript
// Jurisdiction Residence Claims
export const residenceClaims = pgTable('residence_claims', {
  id: uuid('id').primaryKey().defaultRandom(),

  entityOrPersonId: uuid('entity_or_person_id').notNull(),
  entityType: varchar('entity_type', { length: 20 }).notNull(), // individual | entity

  // Jurisdiction claiming residence
  jurisdictionCode: varchar('jurisdiction_code', { length: 10 }).notNull(),
  residenceBasis: varchar('residence_basis', { length: 100 }).notNull(),
  // incorporation | domicile | physical_presence | poem | etc.

  // Claim details
  effectiveDate: date('effective_date').notNull(),
  terminationDate: date('termination_date'),
  claimStatus: varchar('claim_status', { length: 20 }).notNull(),
  // active | disputed | resolved | terminated

  // Supporting evidence
  evidenceDocuments: jsonb('evidence_documents'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Dual Residence Conflicts
export const residenceConflicts = pgTable('residence_conflicts', {
  id: uuid('id').primaryKey().defaultRandom(),

  entityOrPersonId: uuid('entity_or_person_id').notNull(),

  // Conflicting claims
  claim1Id: uuid('claim_1_id').notNull(),
  claim2Id: uuid('claim_2_id').notNull(),
  claim1Jurisdiction: varchar('claim_1_jurisdiction', { length: 10 }).notNull(),
  claim2Jurisdiction: varchar('claim_2_jurisdiction', { length: 10 }).notNull(),

  // Treaty analysis
  applicableTreatyId: uuid('applicable_treaty_id'),
  hasTreaty: boolean('has_treaty').notNull(),

  // Resolution
  resolutionMethod: varchar('resolution_method', { length: 50 }),
  // tie_breaker | map | domestic_law | unresolved
  resolvedJurisdiction: varchar('resolved_jurisdiction', { length: 10 }),
  resolutionDate: date('resolution_date'),
  resolutionDocumentation: jsonb('resolution_documentation'),

  // Status
  conflictStatus: varchar('conflict_status', { length: 20 }).notNull(),
  // identified | analyzing | map_pending | resolved

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Tie-Breaker Analysis
export const tieBreakerAnalysis = pgTable('tie_breaker_analysis', {
  id: uuid('id').primaryKey().defaultRandom(),

  conflictId: uuid('conflict_id').notNull(),
  taxYear: integer('tax_year').notNull(),

  // Test results (in order)
  permanentHomeResult: jsonb('permanent_home_result'),
  // { jurisdiction: 'US' | 'UK' | 'both' | 'neither', evidence: [...] }

  centreOfVitalInterestsResult: jsonb('centre_of_vital_interests_result'),
  habitualAbodeResult: jsonb('habitual_abode_result'),
  nationalityResult: jsonb('nationality_result'),
  poemResult: jsonb('poem_result'), // For entities

  // Conclusion
  determiningTest: varchar('determining_test', { length: 50 }),
  concludedJurisdiction: varchar('concluded_jurisdiction', { length: 10 }),
  mapRequired: boolean('map_required').default(false),

  // Documentation
  analysisNarrative: text('analysis_narrative'),
  preparedBy: uuid('prepared_by'),
  reviewedBy: uuid('reviewed_by'),
  approvedAt: timestamp('approved_at'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Mutual Agreement Procedure Tracking
export const mapProceedings = pgTable('map_proceedings', {
  id: uuid('id').primaryKey().defaultRandom(),

  conflictId: uuid('conflict_id').notNull(),

  // Request details
  requestDate: date('request_date').notNull(),
  requestingJurisdiction: varchar('requesting_jurisdiction', { length: 10 }).notNull(),
  respondingJurisdiction: varchar('responding_jurisdiction', { length: 10 }).notNull(),

  // Status tracking
  currentStatus: varchar('current_status', { length: 30 }).notNull(),
  // filed | accepted | negotiating | resolved | withdrawn
  statusHistory: jsonb('status_history'),

  // Resolution
  resolutionDate: date('resolution_date'),
  resolutionOutcome: varchar('resolution_outcome', { length: 50 }),
  // jurisdiction_1 | jurisdiction_2 | split | no_agreement
  resolutionDetails: jsonb('resolution_details'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Subnational Divergence Tracking
export const subnationalDivergence = pgTable('subnational_divergence', {
  id: uuid('id').primaryKey().defaultRandom(),

  conflictId: uuid('conflict_id').notNull(),

  // Federal outcome
  federalResidenceJurisdiction: varchar('federal_residence', { length: 10 }).notNull(),
  federalTreatyApplied: boolean('federal_treaty_applied').notNull(),

  // Subnational position
  subnationalJurisdiction: varchar('subnational_jurisdiction', { length: 10 }).notNull(),
  // e.g., 'US-CA' for California
  conformsToFederal: boolean('conforms_to_federal').notNull(),
  subnationalResidencePosition: varchar('subnational_position', { length: 50 }),

  // Impact
  additionalTaxExposure: decimal('additional_tax_exposure', { precision: 20, scale: 2 }),
  mitigationStrategy: text('mitigation_strategy'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

### Service Interface

```typescript
interface JurisdictionConflictService {
  // Conflict Detection
  detectResidenceConflicts(entityId: string): Promise<ResidenceConflict[]>;
  recordResidenceClaim(claim: ResidenceClaimInput): Promise<ResidenceClaim>;

  // Tie-Breaker Analysis
  performTieBreakerAnalysis(
    conflictId: string,
    taxYear: number
  ): Promise<TieBreakerAnalysis>;

  applyTieBreakerTest(
    conflictId: string,
    test: TieBreakerTest,
    evidence: Evidence[]
  ): Promise<TestResult>;

  // MAP Proceedings
  initiateMAP(conflictId: string, details: MAPRequestDetails): Promise<MAPProceeding>;
  updateMAPStatus(proceedingId: string, status: MAPStatus): Promise<void>;

  // Subnational Analysis
  analyzeSubnationalImpact(
    conflictId: string,
    federalOutcome: ResolutionOutcome
  ): Promise<SubnationalDivergence[]>;

  // Resolution
  resolveConflict(
    conflictId: string,
    resolution: ConflictResolution
  ): Promise<void>;

  // Reporting
  generateForm8833(conflictId: string, taxYear: number): Promise<Form8833Data>;
  generateConflictSummary(entityId: string): Promise<ConflictSummaryReport>;
}
```

## Outstanding Questions

1. **Multi-Tier Structures**: How to resolve conflicts in tiered entity structures?
2. **PE Attribution**: How do permanent establishment rules interact with residence conflicts?
3. **Substance Requirements**: When do substance requirements in one jurisdiction conflict with another?

## Sources

- [DLA Piper: Dual Tax Residence When the Tie Does Not Break](https://www.dlapiper.com/en/insights/publications/2021/05/agefi-dual-tax-residence-when-the-tie-does-not-break)
- [Cummings Law: Tax Treaty Tie-Breaker Rules](https://www.cummings.law/how-to-work-with-tax-treaty-tie-breaker-rules-for-dual-residents/)
- [Chambers: Reporting Obligations and Tie-Breaker Rules](https://chambers.com/articles/reporting-obligations-for-foreign-financial-accounts-and-the-tie-breaker-rule-under-tax-treaties)
- [GHJ: Understanding Tax Treaties Guide](https://www.ghjadvisors.com/ghj-insights/understanding-tax-treaties-a-guide-to-international-income-tax-agreements)
- [SF Tax Counsel: Closer Connection Test and Treaty Tie-Breaker](https://sftaxcounsel.com/blog/closer-connection-test-treaty-tie-breaker-foreign-income/)
- [US Tax Talk: Treaty Tie-Breaker Pitfalls](https://us-tax.org/2023/01/12/treaty-tie-breaker-oh-the-pitfalls-beware/)
- [CIAT: Dispute Resolution for International Tax](https://www.ciat.org/Biblioteca/Estudios/2025_Dispute_Resolution.pdf)

---

*Research conducted: January 2026*
*Gap identified in: Mission-requirement analysis - entity governance needs conflict resolution procedures*
