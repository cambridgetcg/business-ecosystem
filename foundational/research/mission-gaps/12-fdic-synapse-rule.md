# FDIC Synapse Rule Compliance

> Gap #12: System acknowledges BaaS risk but doesn't incorporate FDIC's proposed Part 375 recordkeeping requirements.

## Gap Identification

**Category**: Regulatory Change
**Severity**: CRITICAL
**Blocks Implementation Phase(s)**: Phase 3 (Banking-Treasury)

## Current State

Existing research covers:
- BaaS provider assessment framework
- Synapse collapse analysis and causes
- FDIC insurance gap explanation
- Pass-through insurance requirements

## What's Missing

System cannot ensure compliance with forthcoming FDIC rule because:

1. **Specific Data Elements**: What exactly must be maintained about beneficial owners?
2. **Reconciliation Procedures**: What constitutes "daily reconciliation"?
3. **Third-Party Requirements**: What contracts/controls needed with BaaS providers?
4. **Reporting Format**: What data file format does FDIC require?
5. **Validation Requirements**: What annual validation is needed?

## Research Findings

### Background: Why This Rule Exists

From [FDIC Chairman Statement](https://www.fdic.gov/news/speeches/2024/statement-martin-j-gruenberg-chairman-fdic-notice-proposed-rule-requirements):

```
THE SYNAPSE PROBLEM:

May 2024: Synapse bankruptcy froze $265M in consumer deposits
          across multiple fintech apps and partner banks.

ROOT CAUSE:
├─ Banks held funds in FBO (For Benefit Of) accounts
├─ Synapse maintained subledgers of individual owners
├─ When Synapse failed, subledgers became inaccessible
├─ Banks couldn't identify who owned what
├─ FDIC couldn't process insurance claims
└─ Result: $65-96M STILL unaccounted for (as of Feb 2025)

FDIC RESPONSE:
"The bankruptcy of Synapse resulted in severe hardship
for consumers that is deeply troubling to the FDIC."
```

### Proposed Rule: Part 375 Requirements

From [Federal Register - Recordkeeping for Custodial Accounts](https://www.federalregister.gov/documents/2024/10/02/2024-22565/recordkeeping-for-custodial-accounts):

```
SCOPE: "Custodial Deposit Accounts with Transactional Features"

DEFINITION:
├─ Deposits held by one party (custodian) for benefit of others
├─ Where end users can direct transactions
├─ Includes: Fintech accounts, payment processor accounts
└─ Excludes: Trust accounts, broker-dealer accounts, IOLTA, benefit plans

KEY REQUIREMENTS:

1. RECORDKEEPING FORMAT
   ├─ Maintain records in specified data file format
   ├─ Identify for each custodial account:
   │   ├─ Beneficial owners (end users)
   │   ├─ Balance attributable to each beneficial owner
   │   └─ Ownership category for each owner
   └─ Records must be continuously accessible

2. RECONCILIATION
   ├─ Daily reconciliation required
   ├─ Balances must reconcile to beneficial owner records
   └─ Internal controls must ensure accuracy

3. THIRD-PARTY REQUIREMENTS (if records maintained by third party)
   ├─ IDI must have direct, continuous, unrestricted access
   ├─ Continuity plans including backup recordkeeping
   ├─ Documented internal controls
   └─ Contracts must specify roles and responsibilities

4. ANNUAL CERTIFICATION
   ├─ Certify to FDIC and primary regulator
   ├─ Implementation and testing within prior 12 months
   └─ Annual compliance report required
```

### Specific Data Elements Required

From [Simetrik FDIC Analysis](https://simetrik.com/blog/fdic-proposed-rule-update-the-latest-on-recordkeeping-and-reporting-requirements-for-custodial-fbo-accounts/):

```
REQUIRED DATA FILE ELEMENTS:

Per Beneficial Owner:
├─ Full legal name
├─ Unique identifier (SSN/TIN or other)
├─ Address
├─ Account number(s) within custodial account
├─ Balance as of reconciliation date
├─ Ownership category (individual, joint, trust, etc.)
└─ FDIC insurance category

Per Custodial Account:
├─ Account title
├─ Account number at IDI
├─ Total balance
├─ Sum of all beneficial owner balances
├─ Reconciliation status
└─ Third-party custodian identifier (if applicable)

FORMAT SPECIFICATION:
├─ Electronic data file format (specific format TBD in final rule)
├─ Must be capable of immediate production upon request
└─ Must support FDIC deposit insurance determination
```

### Daily Reconciliation Requirements

From [Venable FDIC Analysis](https://www.venable.com/insights/publications/2024/09/custody-battles-the-fdics-latest-proposed-rule):

```
RECONCILIATION PROCESS:

Daily Requirements:
├─ Reconcile total custodial account balance at IDI
├─ Against sum of all beneficial owner balances
├─ Document and investigate any discrepancies
└─ Maintain reconciliation records

Tolerance/Thresholds:
├─ Not specified in proposed rule
├─ Expectation: Exact match or documented variance
└─ Systematic variances require root cause analysis

Internal Controls:
├─ Documented policies and procedures
├─ Segregation of duties for reconciliation
├─ Escalation procedures for unresolved variances
└─ Audit trail of reconciliation activities
```

### Third-Party Contract Requirements

From [Davis Wright Tremaine Analysis](https://www.dwt.com/blogs/financial-services-law-advisor/2024/10/fdic-proposes-bank-fintech-rules-after-synapse):

```
CONTRACT PROVISIONS REQUIRED:

If IDI uses third party to maintain records:

1. ACCESS RIGHTS
   ├─ Direct access to records (not through third party portal only)
   ├─ Continuous access (24/7)
   ├─ Unrestricted access (no permission required)
   └─ Rights to access data held by OTHER parties

2. CONTINUITY PROVISIONS
   ├─ Backup recordkeeping capabilities
   ├─ Technical capabilities for compliance
   ├─ Data portability in event of termination
   └─ Transition assistance requirements

3. INTERNAL CONTROLS
   ├─ Third party must implement appropriate controls
   ├─ Accurate beneficial ownership determination
   ├─ Daily reconciliation capabilities
   └─ Error correction procedures

4. VALIDATION REQUIREMENTS
   ├─ Periodic validation by independent party
   ├─ Verify accurate and complete records
   ├─ Verify reconciliations performed
   └─ Report findings to IDI

5. ROLE CLARITY
   ├─ Clear definition of who does what
   ├─ Responsibility assignment for each requirement
   └─ Explicit acknowledgment of bank's ultimate responsibility
```

### Annual Certification Process

```
ANNUAL CERTIFICATION REQUIREMENTS:

Certification Content:
├─ Statement that recordkeeping requirements implemented
├─ Statement that implementation tested within 12 months
├─ Description of testing methodology
├─ Summary of testing results
├─ Any material findings and remediation
└─ Certification signed by responsible officer

Timing:
├─ Submit to FDIC annually
├─ Submit to primary federal regulator
├─ Coordinate with regular examination cycle
└─ Specific deadline TBD in final rule

Testing Requirements:
├─ Verify data file can be produced
├─ Verify data is complete and accurate
├─ Verify reconciliation procedures functioning
├─ Test ability to produce records on demand
└─ Document testing procedures and results
```

### Comment Period Status

From [FDIC Extension Notice](https://www.fdic.gov/news/financial-institution-letters/2024/fdic-extends-comment-period-proposed-rule-custodial-deposit):

```
REGULATORY STATUS:

Original comment deadline: December 2, 2024
Extended deadline: January 16, 2025
Comments now closed

Expected timeline:
├─ Final rule: Expected 2025 (no specific date announced)
├─ Implementation period: Likely 18-24 months after final rule
└─ Full compliance required: Likely 2027

CURRENT STATUS: Proposed rule only - not yet effective
BUT: Smart to design systems for compliance now
```

## Implementation Implications

### Schema Requirements

```typescript
// Beneficial Owner Tracking (per FDIC requirements)
export const beneficialOwnerRecords = pgTable('beneficial_owner_records', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Link to custodial account
  custodialAccountId: uuid('custodial_account_id').notNull(),

  // Beneficial owner identification (per FDIC)
  legalName: varchar('legal_name', { length: 255 }).notNull(),
  uniqueIdentifier: varchar('unique_identifier', { length: 50 }).notNull(), // SSN/TIN/other
  identifierType: varchar('identifier_type', { length: 20 }).notNull(),
  address: jsonb('address').notNull(),

  // Account information
  subAccountNumber: varchar('sub_account_number', { length: 100 }).notNull(),
  ownershipCategory: varchar('ownership_category', { length: 50 }).notNull(),
  fdicInsuranceCategory: varchar('fdic_insurance_category', { length: 50 }).notNull(),

  // Balance tracking
  currentBalance: decimal('current_balance', { precision: 20, scale: 2 }).notNull(),
  balanceAsOfDate: timestamp('balance_as_of_date').notNull(),

  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Custodial Account Master
export const custodialAccounts = pgTable('custodial_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Account identification
  accountTitle: varchar('account_title', { length: 255 }).notNull(),
  idiAccountNumber: varchar('idi_account_number', { length: 100 }).notNull(),
  idiId: varchar('idi_id', { length: 50 }).notNull(), // Which bank

  // Third-party information
  thirdPartyCustodianId: varchar('third_party_custodian_id', { length: 100 }),
  thirdPartyCustodianName: varchar('third_party_custodian_name', { length: 255 }),

  // Balances
  totalBalance: decimal('total_balance', { precision: 20, scale: 2 }).notNull(),
  sumBeneficialOwnerBalances: decimal('sum_bo_balances', { precision: 20, scale: 2 }).notNull(),

  // Reconciliation status
  reconciliationStatus: varchar('reconciliation_status', { length: 20 }).notNull(),
  lastReconciliationDate: timestamp('last_reconciliation_date').notNull(),
  reconciliationVariance: decimal('reconciliation_variance', { precision: 20, scale: 2 }),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Daily Reconciliation Records
export const dailyReconciliations = pgTable('daily_reconciliations', {
  id: uuid('id').primaryKey().defaultRandom(),

  custodialAccountId: uuid('custodial_account_id').notNull(),
  reconciliationDate: date('reconciliation_date').notNull(),

  // Balances compared
  idiBalance: decimal('idi_balance', { precision: 20, scale: 2 }).notNull(),
  sumBeneficialOwnerBalances: decimal('sum_bo_balances', { precision: 20, scale: 2 }).notNull(),
  variance: decimal('variance', { precision: 20, scale: 2 }).notNull(),

  // Status
  status: varchar('status', { length: 20 }).notNull(), // matched | variance | investigating
  varianceExplanation: text('variance_explanation'),
  varianceResolution: text('variance_resolution'),
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: uuid('resolved_by'),

  // Controls
  performedBy: uuid('performed_by').notNull(),
  reviewedBy: uuid('reviewed_by'),
  reviewedAt: timestamp('reviewed_at'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Annual Certification Records
export const annualCertifications = pgTable('annual_certifications', {
  id: uuid('id').primaryKey().defaultRandom(),

  certificationYear: integer('certification_year').notNull(),

  // Testing documentation
  testingMethodology: text('testing_methodology').notNull(),
  testingDate: timestamp('testing_date').notNull(),
  testingResults: jsonb('testing_results').notNull(),

  // Findings
  materialFindings: jsonb('material_findings'),
  remediationActions: jsonb('remediation_actions'),

  // Certification
  certificationStatement: text('certification_statement').notNull(),
  certifiedBy: varchar('certified_by', { length: 255 }).notNull(),
  certificationDate: timestamp('certification_date').notNull(),

  // Submission
  submittedToFDIC: boolean('submitted_to_fdic').default(false),
  fdicSubmissionDate: timestamp('fdic_submission_date'),
  submittedToRegulator: boolean('submitted_to_regulator').default(false),
  regulatorSubmissionDate: timestamp('regulator_submission_date'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

### Service Requirements

```typescript
interface FDICComplianceService {
  // Beneficial Owner Management
  recordBeneficialOwner(owner: BeneficialOwnerInput): Promise<BeneficialOwnerRecord>;
  updateBeneficialOwnerBalance(ownerId: string, newBalance: Money): Promise<void>;
  getBeneficialOwnersByAccount(accountId: string): Promise<BeneficialOwnerRecord[]>;

  // Reconciliation
  performDailyReconciliation(accountId: string): Promise<ReconciliationResult>;
  getReconciliationHistory(accountId: string, days: number): Promise<DailyReconciliation[]>;
  resolveVariance(reconciliationId: string, resolution: VarianceResolution): Promise<void>;

  // Data File Generation (per FDIC format)
  generateFDICDataFile(accountId: string): Promise<FDICDataFile>;
  validateDataFile(file: FDICDataFile): Promise<ValidationResult>;

  // Annual Certification
  performAnnualTesting(): Promise<TestingResult>;
  generateCertification(year: number): Promise<AnnualCertification>;
  submitToFDIC(certificationId: string): Promise<SubmissionResult>;

  // Third-Party Contract Compliance
  validateThirdPartyContract(contractId: string): Promise<ContractComplianceResult>;
  assessThirdPartyAccess(): Promise<AccessAssessment>;
}
```

### Reconciliation Workflow

```
DAILY RECONCILIATION PROCESS:

End of Business Day
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: GATHER DATA                                                        │
│  ├─ Pull custodial account balance from IDI                                │
│  ├─ Calculate sum of all beneficial owner balances                         │
│  └─ Timestamp both values                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 2: COMPARE                                                           │
│  ├─ IDI Balance - Sum(BO Balances) = Variance                              │
│  ├─ If Variance = 0 → Status: Matched                                      │
│  └─ If Variance ≠ 0 → Status: Variance (investigate)                       │
└─────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 3: DOCUMENT                                                          │
│  ├─ Create reconciliation record                                           │
│  ├─ If variance: Document explanation and resolution steps                 │
│  └─ Assign to reviewer if unresolved                                       │
└─────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 4: ESCALATE IF NEEDED                                                │
│  ├─ Variance > threshold → Immediate escalation                            │
│  ├─ Variance unresolved > 24h → Management notification                    │
│  └─ Pattern of variances → Root cause analysis required                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Outstanding Questions

1. **Final Data Format**: What exact file format will FDIC specify? (CSV, XML, JSON?)
2. **Tolerance Thresholds**: Will final rule specify acceptable variance amounts?
3. **Implementation Timeline**: When will compliance be required after final rule?

## Sources

- [Federal Register: Recordkeeping for Custodial Accounts](https://www.federalregister.gov/documents/2024/10/02/2024-22565/recordkeeping-for-custodial-accounts)
- [FDIC Press Release: Proposed Recordkeeping Rule](https://www.fdic.gov/news/press-releases/2024/fdic-proposes-deposit-insurance-recordkeeping-rule-banks-third-party)
- [FDIC Chairman Statement on Proposed Rule](https://www.fdic.gov/news/speeches/2024/statement-martin-j-gruenberg-chairman-fdic-notice-proposed-rule-requirements)
- [Simetrik: FDIC Recordkeeping Requirements](https://simetrik.com/blog/fdic-proposed-rule-update-the-latest-on-recordkeeping-and-reporting-requirements-for-custodial-fbo-accounts/)
- [Venable: FDIC's Latest Proposed Rule on FBO Accounts](https://www.venable.com/insights/publications/2024/09/custody-battles-the-fdics-latest-proposed-rule)
- [Davis Wright Tremaine: FDIC Proposes Bank-Fintech Rules](https://www.dwt.com/blogs/financial-services-law-advisor/2024/10/fdic-proposes-bank-fintech-rules-after-synapse)
- [FDIC Comment Period Extension](https://www.fdic.gov/news/financial-institution-letters/2024/fdic-extends-comment-period-proposed-rule-custodial-deposit)

---

*Research conducted: January 2026*
*Gap identified in: Mission-requirement analysis - banking-treasury needs BaaS compliance design*
