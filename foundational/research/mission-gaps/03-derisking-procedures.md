# Banking De-Risking Response Procedures

> Gap #03: System acknowledges de-risking risk but lacks operational response procedures.

## Gap Identification

**Category**: Operational HOW
**Severity**: HIGH
**Blocks Implementation Phase(s)**: Phase 3 (Banking-Treasury)

## Current State

Existing research covers:
- Definition of de-risking and why it happens
- Categories of businesses most affected
- General impact on correspondent banking
- Conceptual understanding of the problem

## What's Missing

Cannot maintain banking continuity because:

1. **Warning Sign Detection**: What indicators suggest de-risking is imminent?
2. **Response Timeline**: How much notice is typically given and what actions are possible?
3. **Relationship Diversification**: What backup structures should be maintained?
4. **Documentation Requirements**: What proactive documentation prevents de-risking?
5. **Escalation Procedures**: When and how to engage regulators or industry groups?

## Research Findings

### Why De-Risking Happens

From [U.S. Treasury De-risking Strategy](https://home.treasury.gov/system/files/136/Treasury_AMLA_23_508.pdf):

```
ROOT CAUSES OF DE-RISKING:

Primary Driver: PROFITABILITY
├─ Cost of AML/CFT compliance exceeds revenue from relationship
├─ Small accounts with high risk profiles aren't economical
├─ Correspondent banking margins have compressed
└─ Regulatory fines create existential risk

Secondary Drivers:
├─ Risk appetite mismatch (bank vs client profile)
├─ Lack of transparency in client activities
├─ Geographic concentration in high-risk jurisdictions
├─ Industry sector concerns (MSBs, crypto, cannabis)
└─ Reputational risk concerns

MOST AFFECTED CATEGORIES:
├─ Small/medium Money Service Businesses (MSBs)
├─ Non-profits operating in high-risk jurisdictions
├─ Foreign correspondent banks
├─ Cryptocurrency-related businesses
└─ Businesses with complex ownership structures
```

### Warning Signs of Imminent De-Risking

```
EARLY WARNING INDICATORS:

Relationship Changes:
├─ Enhanced due diligence requests (increased frequency)
├─ Requests for additional documentation on routine matters
├─ Account restrictions (wire limits, transaction types)
├─ Relationship manager changes (often to "special" teams)
└─ Delayed processing of routine transactions

Bank Behavior:
├─ Fee increases without corresponding service changes
├─ Reduced credit availability
├─ Requirement to reduce account balances
├─ Requests to close certain account types
└─ Declining to onboard related entities

External Signals:
├─ Bank announces exit from certain business lines
├─ Regulatory consent orders against the bank
├─ Industry-wide pullback announcements
└─ Changes in bank's public risk appetite statements

TIMELINE INDICATORS:
┌─────────────────────────────────────────────────────────────────────────────┐
│  6-12 months before:  Enhanced monitoring, more questions                   │
│  3-6 months before:   Account restrictions, fee increases                  │
│  30-90 days before:   Formal notice of account closure                     │
│  0-30 days:           Final wind-down period                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Regulatory Guidance on Notice Periods

From [OCC Guidance](https://www.congress.gov/crs-product/IF10873):

```
OCC GUIDANCE ON ACCOUNT TERMINATION:

Banks Should:
├─ Conduct periodic risk reevaluations of relationships
├─ Provide "sufficient time" for customers to find alternatives
├─ Avoid terminating entire categories without individual assessment
├─ Document risk-based rationale for decisions
└─ Consider the customer's ability to manage identified risks

Notice Period Expectations:
├─ Routine closures: 30-60 days minimum
├─ Complex relationships: 90-180 days recommended
├─ Mass closures: Extended timeline with transition support
└─ Immediate closure: Only for suspected illegal activity

Customer Rights:
├─ Right to understand closure reason (general terms)
├─ Right to cure compliance deficiencies if identified
├─ Right to transition assistance for complex accounts
└─ NO right to continued service (banking is discretionary)
```

### Proactive Defense Strategies

```
PREVENTIVE MEASURES:

1. RELATIONSHIP DIVERSIFICATION
   ┌─────────────────────────────────────────────────────────────────────────┐
   │  Primary Bank:        Main operating accounts, credit facilities        │
   │  Secondary Bank:      Backup accounts, partial operations              │
   │  Treasury Services:   Separate provider for cash management            │
   │  Payment Rails:       Alternative payment processors                    │
   │  Correspondent:       Direct relationships where possible              │
   └─────────────────────────────────────────────────────────────────────────┘

   Rule: Never have >50% of banking with single institution

2. COMPLIANCE DOCUMENTATION
   ├─ Maintain updated KYC/AML program documentation
   ├─ Proactively share SAR filing statistics (if applicable)
   ├─ Document transaction monitoring procedures
   ├─ Regular compliance certifications
   └─ Independent compliance audits (annual)

3. TRANSPARENCY PRACTICES
   ├─ Clear explanation of business model
   ├─ Ownership structure documentation
   ├─ Source of funds evidence
   ├─ Geographic footprint mapping
   └─ Customer base composition data

4. RELATIONSHIP MANAGEMENT
   ├─ Maintain executive-level banking relationships
   ├─ Regular business review meetings
   ├─ Proactive communication of business changes
   └─ Participate in industry/bank forums
```

### Response Procedures When De-Risking Occurs

```
IMMEDIATE RESPONSE (Days 1-7):

1. ASSESS THE SITUATION
   ├─ Determine: Is this negotiable or final?
   ├─ Review: What is the stated reason?
   ├─ Evaluate: What is the actual timeline?
   └─ Identify: What accounts/services are affected?

2. ESCALATE INTERNALLY
   ├─ CFO/Treasurer notification
   ├─ Legal counsel engagement
   ├─ Board notification (if material)
   └─ Document all communications

3. REQUEST DETAILS
   ├─ Formal written confirmation of decision
   ├─ Specific concerns that led to decision
   ├─ Any cure options or remediation paths
   └─ Extended timeline requests

SHORT-TERM RESPONSE (Weeks 1-4):

4. ACTIVATE BACKUP RELATIONSHIPS
   ├─ Notify secondary banks of situation
   ├─ Accelerate onboarding at backup institutions
   ├─ Assess capacity of existing backup accounts
   └─ Identify gaps in backup coverage

5. PRIORITIZE CONTINUITY
   ├─ Payroll and critical payments
   ├─ Customer receipts/collections
   ├─ Vendor payments (by criticality)
   └─ Intercompany transfers

6. EXPLORE ALTERNATIVES
   ├─ Regional banks (may have different risk appetite)
   ├─ Credit unions (for applicable activities)
   ├─ Community Development Financial Institutions
   └─ Specialized industry-focused banks

MEDIUM-TERM RESPONSE (Months 1-3):

7. REBUILD BANKING INFRASTRUCTURE
   ├─ Establish new primary relationship
   ├─ Transfer account structures
   ├─ Update payment routing
   └─ Notify customers/vendors as needed

8. ADDRESS ROOT CAUSES
   ├─ Enhance compliance program if deficient
   ├─ Consider business model adjustments
   ├─ Evaluate geographic/product exposure
   └─ Document improvements for future banks
```

### Technology Solutions

From [Deutsche Bank](https://flow.db.com/topics/cash-management/an-ecosystem-approach-to-limit-de-risking):

```
TECHNOLOGY APPROACHES TO MITIGATE DE-RISKING:

1. ENHANCED KYC/AML SYSTEMS
   ├─ AI-powered transaction monitoring
   ├─ Automated screening against sanctions lists
   ├─ Real-time risk scoring
   └─ Reduced false positives (bank confidence)

2. TRANSPARENCY TOOLS
   ├─ Legal Entity Identifiers (LEIs) for all entities
   ├─ Standardized beneficial ownership registries
   ├─ Electronic document sharing platforms
   └─ API-based compliance data sharing

3. CENTRALIZED DATABASES
   ├─ KYC utility services (shared compliance)
   ├─ Industry-specific verification networks
   └─ Reduced redundant due diligence
```

### Industry Support and Escalation

From [State Department](https://www.state.gov/de-risking):

```
ESCALATION OPTIONS:

1. REGULATORY ENGAGEMENT
   ├─ OCC: If national bank is involved
   ├─ FDIC: If state-chartered bank is involved
   ├─ Federal Reserve: For systemic concerns
   └─ FinCEN: For AML/BSA clarification

2. INDUSTRY ASSOCIATIONS
   ├─ Money Transmitter Regulators Association (MTRA)
   ├─ Electronic Transactions Association (ETA)
   ├─ Independent Community Bankers of America (ICBA)
   └─ Sector-specific trade groups

3. TREASURY RESOURCES
   ├─ Treasury De-risking Strategy (guidance)
   ├─ FinCEN advisory letters
   └─ Interagency statements on banking access

4. LEGAL OPTIONS
   ├─ Documentation of discriminatory treatment
   ├─ Fair lending considerations (if applicable)
   └─ Contractual remedies (if available)
```

## Implementation Implications

### Schema Requirements

```typescript
// Banking Relationship Tracking
export const bankingRelationships = pgTable('banking_relationships', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Bank identification
  bankId: uuid('bank_id').notNull(),
  bankName: varchar('bank_name', { length: 255 }).notNull(),
  relationshipType: varchar('relationship_type', { length: 50 }).notNull(),
  // primary | secondary | backup | correspondent

  // Account coverage
  accountTypes: jsonb('account_types').notNull(), // operating, payroll, etc.
  volumeShare: decimal('volume_share', { precision: 5, scale: 2 }), // % of total banking

  // Relationship health
  healthScore: integer('health_score'), // 1-100
  lastReviewDate: date('last_review_date'),
  nextReviewDate: date('next_review_date'),

  // Contacts
  relationshipManager: jsonb('relationship_manager'),
  executiveContact: jsonb('executive_contact'),

  // Status
  status: varchar('status', { length: 20 }).notNull(), // active | at_risk | terminated
  terminationNoticeDate: date('termination_notice_date'),
  terminationEffectiveDate: date('termination_effective_date'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// De-risking Warning Indicators
export const deRiskingIndicators = pgTable('de_risking_indicators', {
  id: uuid('id').primaryKey().defaultRandom(),

  bankingRelationshipId: uuid('banking_relationship_id').notNull(),

  // Indicator details
  indicatorType: varchar('indicator_type', { length: 50 }).notNull(),
  // enhanced_diligence | fee_increase | restriction | personnel_change
  indicatorDescription: text('indicator_description').notNull(),
  detectedDate: date('detected_date').notNull(),

  // Severity assessment
  severity: varchar('severity', { length: 20 }).notNull(), // low | medium | high
  riskScore: integer('risk_score'),

  // Response
  responseRequired: boolean('response_required').default(false),
  responseDeadline: date('response_deadline'),
  responseActions: jsonb('response_actions'),
  responseCompletedAt: timestamp('response_completed_at'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Banking Continuity Plan
export const bankingContinuityPlan = pgTable('banking_continuity_plan', {
  id: uuid('id').primaryKey().defaultRandom(),

  entityId: uuid('entity_id').notNull(),

  // Primary banking
  primaryBankId: uuid('primary_bank_id').notNull(),
  primaryAccountIds: jsonb('primary_account_ids').notNull(),

  // Backup arrangements
  backupBankId: uuid('backup_bank_id'),
  backupAccountIds: jsonb('backup_account_ids'),
  backupCapacity: jsonb('backup_capacity'), // what % can backup handle?

  // Critical payment routing
  payrollBackupPlan: jsonb('payroll_backup_plan'),
  vendorPaymentBackupPlan: jsonb('vendor_payment_backup_plan'),
  customerReceiptBackupPlan: jsonb('customer_receipt_backup_plan'),

  // Testing
  lastTestDate: date('last_test_date'),
  testResults: jsonb('test_results'),
  nextTestDate: date('next_test_date'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// De-risking Events (when they occur)
export const deRiskingEvents = pgTable('de_risking_events', {
  id: uuid('id').primaryKey().defaultRandom(),

  bankingRelationshipId: uuid('banking_relationship_id').notNull(),

  // Event details
  noticeDate: date('notice_date').notNull(),
  effectiveDate: date('effective_date').notNull(),
  statedReason: text('stated_reason'),
  affectedAccounts: jsonb('affected_accounts').notNull(),

  // Response tracking
  responseStatus: varchar('response_status', { length: 30 }).notNull(),
  // assessing | negotiating | transitioning | completed

  // Escalation
  escalatedToRegulator: boolean('escalated_to_regulator').default(false),
  escalationDate: date('escalation_date'),
  escalationOutcome: text('escalation_outcome'),

  // Transition
  transitionPlan: jsonb('transition_plan'),
  newBankingArrangement: jsonb('new_banking_arrangement'),
  transitionCompletedAt: timestamp('transition_completed_at'),

  // Impact
  operationalImpact: text('operational_impact'),
  financialImpact: decimal('financial_impact', { precision: 20, scale: 2 }),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

### Service Interface

```typescript
interface DeRiskingResponseService {
  // Monitoring
  monitorRelationshipHealth(relationshipId: string): Promise<HealthAssessment>;
  recordWarningIndicator(indicator: WarningIndicator): Promise<void>;
  assessDeRiskingRisk(entityId: string): Promise<RiskAssessment>;

  // Response
  initiateDeRiskingResponse(event: DeRiskingNotice): Promise<ResponsePlan>;
  trackResponseProgress(eventId: string): Promise<ResponseStatus>;

  // Continuity
  validateContinuityPlan(entityId: string): Promise<ValidationResult>;
  activateBackupBanking(entityId: string): Promise<ActivationResult>;

  // Escalation
  escalateToRegulator(eventId: string, details: EscalationDetails): Promise<void>;

  // Reporting
  generateDeRiskingReport(entityId: string): Promise<DeRiskingReport>;
}
```

## Outstanding Questions

1. **Multi-Entity Coordination**: How to handle de-risking that affects multiple entities in a corporate group?
2. **Cross-Border Complications**: What if de-risking affects correspondent banking for international entities?
3. **Crypto Exposure**: Special considerations for entities with any cryptocurrency exposure?

## Sources

- [U.S. Treasury De-risking Strategy 2023](https://home.treasury.gov/system/files/136/Treasury_AMLA_23_508.pdf)
- [FATF Guidance on Correspondent Banking](https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Correspondent-banking-services.html)
- [Congressional Research Service: De-Risking Overview](https://www.congress.gov/crs-product/IF10873)
- [State Department: De-risking](https://www.state.gov/de-risking)
- [Deutsche Bank: Ecosystem Approach to Limit De-risking](https://flow.db.com/topics/cash-management/an-ecosystem-approach-to-limit-de-risking)
- [Treasury FACT SHEET: 2023 De-Risking Strategy](https://home.treasury.gov/news/press-releases/jy1439)

---

*Research conducted: January 2026*
*Gap identified in: Mission-requirement analysis - banking-treasury needs continuity procedures*
