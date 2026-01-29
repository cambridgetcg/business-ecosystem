# Accounting-Banking Reconciliation Procedures

> Gap #09: System has both accounting and banking, but lacks automated reconciliation procedures.

## Gap Identification

**Category**: Technical Integration
**Severity**: HIGH
**Blocks Implementation Phase(s)**: Phase 2 (Accounting), Phase 3 (Banking-Treasury)

## Current State

Existing research covers:
- General ledger structure
- Bank account management
- Transaction recording concepts
- High-level reconciliation awareness

## What's Missing

Cannot ensure financial accuracy because:

1. **Matching Algorithms**: How to automatically match transactions across systems?
2. **Exception Handling**: What to do when matches aren't found?
3. **Timing Differences**: How to handle transactions in-flight between systems?
4. **Multi-Way Reconciliation**: How to reconcile across more than two sources?
5. **Escalation Procedures**: When and how to escalate unresolved items?

## Research Findings

### Modern Reconciliation Approaches

From [SolveXia](https://www.solvexia.com/blog/transaction-matching-using-ai) and [Cashbook](https://www.cashbook.com/auto-matching-algorithms-in-accounts-reconciliation/):

```
RECONCILIATION EVOLUTION:

Traditional (Manual):
├─ Export data from both systems
├─ Open in spreadsheet
├─ Manual line-by-line matching
├─ Document exceptions
└─ Time: Hours to days per account

Rules-Based Automation:
├─ Pre-defined matching rules
├─ Exact match on amount, date, reference
├─ Fuzzy matching on descriptions
├─ Automated exception reporting
└─ Time: Minutes per account, 70-80% auto-match

AI-Powered (2025):
├─ Machine learning from historical matches
├─ Pattern recognition across transactions
├─ Confidence scoring for matches
├─ Self-improving accuracy (70% → 95%+ over 3-6 months)
└─ Time: Seconds per account, 90-95% auto-match
```

### Matching Algorithm Types

From [Cashbook](https://www.cashbook.com/auto-matching-algorithms-in-accounts-reconciliation/) and [Trintech](https://www.trintech.com/blog/automating-multi-way-transaction-matching/):

```
MATCHING ALGORITHM HIERARCHY:

1. EXACT MATCH
   ├─ Same amount
   ├─ Same date (or within tolerance)
   ├─ Same reference number
   └─ Confidence: 100%

2. AMOUNT-ONLY MATCH
   ├─ Same amount
   ├─ Date within range (e.g., ±3 days)
   ├─ No reference match
   └─ Confidence: 80-90%

3. FUZZY MATCH
   ├─ Amount within tolerance (e.g., ±$0.01)
   ├─ Date within range
   ├─ Partial reference or description match
   └─ Confidence: 60-80%

4. MANY-TO-ONE MATCH
   ├─ Multiple transactions sum to one
   ├─ Example: 10 invoices = 1 bank deposit
   ├─ Requires additional validation
   └─ Confidence: 70-85%

5. ONE-TO-MANY MATCH
   ├─ One transaction splits to multiple
   ├─ Example: 1 payment = invoices + adjustments
   ├─ Common in AP/AR scenarios
   └─ Confidence: 70-85%

6. AI/ML MATCH
   ├─ Learned patterns from historical data
   ├─ Natural language processing on descriptions
   ├─ Predictive matching based on behavior
   └─ Confidence: Variable (50-95%)
```

### Three-Way Reconciliation

From [Trintech](https://www.trintech.com/blog/automating-multi-way-transaction-matching/):

```
THREE-WAY RECONCILIATION SCENARIOS:

Scenario 1: Order-Invoice-Payment
├─ Source 1: Purchase Order system
├─ Source 2: Invoice from vendor
├─ Source 3: Bank payment record
└─ Match: All three must reconcile

Scenario 2: GL-Bank-Subledger
├─ Source 1: General Ledger cash account
├─ Source 2: Bank statement
├─ Source 3: Cash receipts subledger
└─ Match: All three must reconcile

Scenario 3: E-commerce Multi-Source
├─ Source 1: Order management system
├─ Source 2: Payment processor (Stripe, etc.)
├─ Source 3: Bank deposit
├─ Source 4: Accounting system
└─ Match: Four-way reconciliation needed

COMPLEXITY FACTORS:
├─ Timing: Different systems update at different times
├─ Batching: Multiple orders → single deposit
├─ Fees: Payment processor takes cut before bank
├─ Currency: FX conversion between systems
└─ Refunds/Chargebacks: Reverse flows
```

### Exception Handling Framework

```
EXCEPTION TYPES AND HANDLING:

1. NO MATCH FOUND
   ┌─────────────────────────────────────────────────────────────────────────┐
   │  Possible Causes:                                                       │
   │  ├─ Timing: Transaction in flight                                      │
   │  ├─ Missing: Transaction not recorded in one system                    │
   │  ├─ Error: Wrong amount or reference recorded                          │
   │  └─ Fraud: Unauthorized transaction                                    │
   │                                                                         │
   │  Resolution Steps:                                                      │
   │  1. Wait for timing window (e.g., 2 business days)                     │
   │  2. Search with broader criteria                                        │
   │  3. Manual investigation                                                │
   │  4. Create adjusting entry or record missing transaction               │
   │  5. Escalate if unresolved after threshold                             │
   └─────────────────────────────────────────────────────────────────────────┘

2. MULTIPLE MATCHES
   ├─ Cause: Duplicate transactions or similar amounts
   ├─ Resolution: Apply secondary criteria (date, reference)
   ├─ If still ambiguous: Manual selection required
   └─ Document selection rationale

3. PARTIAL MATCH
   ├─ Cause: Many-to-one or one-to-many scenarios
   ├─ Resolution: Verify sum matches, then accept
   └─ Tolerance: Define acceptable variance

4. AMOUNT VARIANCE
   ├─ Cause: Fees, FX, timing adjustments
   ├─ Resolution: Identify variance source
   ├─ If within tolerance: Auto-reconcile
   └─ If above tolerance: Manual review

5. DATE VARIANCE
   ├─ Cause: Processing delays, timezone differences
   ├─ Resolution: Accept within defined window
   └─ Typical window: ±3 business days
```

### Timing Differences Management

```
TIMING DIFFERENCE CATEGORIES:

1. DEPOSITS IN TRANSIT
   ├─ Recorded in books, not yet on bank statement
   ├─ Treatment: Reconciling item
   ├─ Resolution: Should clear within 1-2 days
   └─ Alert if not cleared within 5 days

2. OUTSTANDING CHECKS
   ├─ Recorded as disbursement, not yet cashed
   ├─ Treatment: Reconciling item
   ├─ Resolution: May take weeks to clear
   └─ Alert if outstanding > 90 days (stale-dated)

3. BANK PROCESSING DELAY
   ├─ Transaction initiated but not posted
   ├─ Treatment: Reconciling item
   └─ Typical delay: 1-3 business days

4. CUTOFF DIFFERENCES
   ├─ Books closed at 5 PM, bank closes at 6 PM
   ├─ Treatment: Next-day reconciling items
   └─ Resolution: Consistent cutoff policy

TIMING DIFFERENCE TRACKING:
┌─────────────────────────────────────────────────────────────────────────────┐
│  For each unmatched item, track:                                           │
│  ├─ Date first identified                                                  │
│  ├─ Expected clearance date                                                │
│  ├─ Days outstanding                                                       │
│  ├─ Status (pending | cleared | escalated)                                 │
│  └─ Auto-escalation trigger (e.g., 5 days)                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Reconciliation Workflow

From [HighRadius](https://www.highradius.com/product/bank-reconciliation-software/) and [netgain](https://www.netgain.tech/blog/automated-reconciliation-software):

```
DAILY RECONCILIATION WORKFLOW:

Step 1: DATA INGESTION (Automated)
├─ Import bank statements (via API, SFTP, or manual upload)
├─ Extract GL transactions for cash accounts
├─ Normalize data formats
└─ Timestamp all records

Step 2: PRE-MATCHING PREPARATION
├─ Apply standardization rules to descriptions
├─ Parse reference numbers
├─ Convert currencies if needed
└─ Identify transaction types

Step 3: AUTOMATED MATCHING
├─ Run matching algorithms in priority order
├─ Exact match first, then fuzzy
├─ Apply many-to-one/one-to-many rules
├─ Record match confidence scores
└─ Target: 80-95% auto-match rate

Step 4: EXCEPTION GENERATION
├─ Identify all unmatched items
├─ Categorize by exception type
├─ Assign severity/priority
└─ Route to appropriate reviewer

Step 5: EXCEPTION RESOLUTION
├─ Analyst reviews exceptions
├─ Applies manual matching where appropriate
├─ Creates adjusting entries if needed
├─ Documents resolution rationale
└─ Target: Same-day resolution for most items

Step 6: RECONCILIATION COMPLETION
├─ All items matched or explained
├─ Generate reconciliation report
├─ Supervisor review and approval
└─ Archive with audit trail

Step 7: PERIOD-END PROCEDURES
├─ Outstanding items aging review
├─ Escalation of aged items
├─ Journal entries for recognized adjustments
└─ Sign-off for close
```

### AI/ML Matching Capabilities

From [Ledge.co](https://www.ledge.co/content/ai-reconciliation) and [Prophix](https://www.prophix.com/blog/ai-powered-transaction-matching-software/):

```
AI-POWERED MATCHING FEATURES:

1. PATTERN LEARNING
   ├─ Analyzes how users resolve exceptions
   ├─ Identifies patterns in successful matches
   ├─ Example: "AMAZON MKTPLACE" always maps to Office Supplies
   └─ Match rate improves over time (70% → 95% in 3-6 months)

2. NATURAL LANGUAGE PROCESSING
   ├─ Understands transaction descriptions
   ├─ Extracts entities (vendor names, invoice numbers)
   ├─ Handles abbreviations and variations
   └─ Example: "AMZN*ABC123" = "Amazon order ABC123"

3. CONFIDENCE SCORING
   ├─ Each match assigned probability score
   ├─ High confidence (>95%): Auto-match
   ├─ Medium confidence (80-95%): Suggest for review
   └─ Low confidence (<80%): Manual review required

4. ANOMALY DETECTION
   ├─ Flags unusual transactions
   ├─ Identifies potential duplicates
   ├─ Detects fraud patterns
   └─ Alerts on unexpected variances

5. CONTINUOUS IMPROVEMENT
   ├─ Learns from every correction
   ├─ Adapts to business changes
   ├─ Reduces false positives over time
   └─ Generates insights on matching patterns
```

### Escalation Procedures

```
ESCALATION FRAMEWORK:

TIER 1: Analyst Resolution (Day 1-2)
├─ Exception identified during daily reconciliation
├─ Analyst investigates using available data
├─ Resolution: Match, adjustment, or escalate
└─ SLA: 90% resolved at this level

TIER 2: Senior Review (Day 3-5)
├─ Unresolved exceptions escalated
├─ Senior analyst performs deeper investigation
├─ May involve contacting counterparties
└─ SLA: 8% resolved at this level

TIER 3: Manager Approval (Day 6-10)
├─ Significant items or policy exceptions
├─ Manager reviews and approves resolution
├─ May require write-off approval
└─ SLA: 1.5% resolved at this level

TIER 4: Controller/CFO (Beyond Day 10)
├─ Material items or potential fraud
├─ Executive review and decision
├─ May trigger audit involvement
└─ SLA: 0.5% or less

THRESHOLDS BY AMOUNT:
├─ <$100: Analyst can resolve with auto-adjustment
├─ $100-$1,000: Analyst resolution with documentation
├─ $1,000-$10,000: Manager approval required
├─ $10,000-$50,000: Controller approval required
└─ >$50,000: CFO approval required
```

## Implementation Implications

### Schema Requirements

```typescript
// Reconciliation Sessions
export const reconciliationSessions = pgTable('reconciliation_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Account being reconciled
  accountId: uuid('account_id').notNull(),
  accountType: varchar('account_type', { length: 30 }).notNull(), // bank | subledger | intercompany
  reconciliationDate: date('reconciliation_date').notNull(),

  // Sources
  source1Type: varchar('source_1_type', { length: 30 }).notNull(), // gl | bank | subledger
  source1DataAsOf: timestamp('source_1_data_as_of').notNull(),
  source2Type: varchar('source_2_type', { length: 30 }).notNull(),
  source2DataAsOf: timestamp('source_2_data_as_of').notNull(),
  source3Type: varchar('source_3_type', { length: 30 }), // Optional for 3-way

  // Summary
  totalSource1: decimal('total_source_1', { precision: 20, scale: 2 }).notNull(),
  totalSource2: decimal('total_source_2', { precision: 20, scale: 2 }).notNull(),
  totalSource3: decimal('total_source_3', { precision: 20, scale: 2 }),
  netVariance: decimal('net_variance', { precision: 20, scale: 2 }).notNull(),

  // Matching results
  autoMatchedCount: integer('auto_matched_count').notNull(),
  manualMatchedCount: integer('manual_matched_count').notNull(),
  unmatchedSource1Count: integer('unmatched_source_1_count').notNull(),
  unmatchedSource2Count: integer('unmatched_source_2_count').notNull(),
  autoMatchRate: decimal('auto_match_rate', { precision: 5, scale: 2 }).notNull(),

  // Status
  status: varchar('status', { length: 20 }).notNull(),
  // in_progress | completed | pending_approval | approved
  completedAt: timestamp('completed_at'),
  approvedBy: uuid('approved_by'),
  approvedAt: timestamp('approved_at'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Matched Transactions
export const reconciliationMatches = pgTable('reconciliation_matches', {
  id: uuid('id').primaryKey().defaultRandom(),

  sessionId: uuid('session_id').notNull(),

  // Source 1 transaction(s)
  source1TransactionIds: jsonb('source_1_transaction_ids').notNull(),
  source1Total: decimal('source_1_total', { precision: 20, scale: 2 }).notNull(),

  // Source 2 transaction(s)
  source2TransactionIds: jsonb('source_2_transaction_ids').notNull(),
  source2Total: decimal('source_2_total', { precision: 20, scale: 2 }).notNull(),

  // Source 3 (if applicable)
  source3TransactionIds: jsonb('source_3_transaction_ids'),
  source3Total: decimal('source_3_total', { precision: 20, scale: 2 }),

  // Match details
  matchType: varchar('match_type', { length: 30 }).notNull(),
  // exact | amount_only | fuzzy | many_to_one | one_to_many | ai
  matchConfidence: decimal('match_confidence', { precision: 5, scale: 2 }).notNull(),
  matchMethod: varchar('match_method', { length: 20 }).notNull(), // auto | manual

  // Variance
  variance: decimal('variance', { precision: 20, scale: 2 }).notNull(),
  varianceExplanation: text('variance_explanation'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Reconciliation Exceptions
export const reconciliationExceptions = pgTable('reconciliation_exceptions', {
  id: uuid('id').primaryKey().defaultRandom(),

  sessionId: uuid('session_id').notNull(),

  // Exception details
  exceptionType: varchar('exception_type', { length: 30 }).notNull(),
  // no_match | multiple_matches | partial_match | amount_variance | date_variance
  sourceSystem: varchar('source_system', { length: 30 }).notNull(),
  transactionId: uuid('transaction_id').notNull(),
  transactionAmount: decimal('transaction_amount', { precision: 20, scale: 2 }).notNull(),
  transactionDate: date('transaction_date').notNull(),
  transactionDescription: text('transaction_description'),

  // Categorization
  expectedClearanceDate: date('expected_clearance_date'),
  isTimingDifference: boolean('is_timing_difference').default(false),
  timingDifferenceType: varchar('timing_difference_type', { length: 30 }),
  // deposit_in_transit | outstanding_check | processing_delay

  // Status
  status: varchar('status', { length: 20 }).notNull(),
  // open | investigating | resolved | escalated
  daysOutstanding: integer('days_outstanding').notNull(),
  escalationTier: integer('escalation_tier').default(1),

  // Resolution
  resolution: text('resolution'),
  resolutionType: varchar('resolution_type', { length: 30 }),
  // matched | adjusted | written_off | fraud_investigation
  resolvedBy: uuid('resolved_by'),
  resolvedAt: timestamp('resolved_at'),

  // Approval (if required)
  approvalRequired: boolean('approval_required').default(false),
  approvedBy: uuid('approved_by'),
  approvedAt: timestamp('approved_at'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Matching Rules
export const matchingRules = pgTable('matching_rules', {
  id: uuid('id').primaryKey().defaultRandom(),

  ruleName: varchar('rule_name', { length: 100 }).notNull(),
  ruleDescription: text('rule_description'),
  priority: integer('priority').notNull(),
  isActive: boolean('is_active').default(true),

  // Matching criteria
  matchType: varchar('match_type', { length: 30 }).notNull(),
  amountTolerance: decimal('amount_tolerance', { precision: 10, scale: 2 }),
  dateTolerance: integer('date_tolerance_days'),
  referencePattern: varchar('reference_pattern', { length: 255 }),
  descriptionPattern: varchar('description_pattern', { length: 255 }),

  // Account applicability
  applicableAccountTypes: jsonb('applicable_account_types'),
  applicableAccountIds: jsonb('applicable_account_ids'),

  // Performance tracking
  matchCount: integer('match_count').default(0),
  falsePositiveCount: integer('false_positive_count').default(0),
  successRate: decimal('success_rate', { precision: 5, scale: 2 }),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

### Service Interface

```typescript
interface ReconciliationService {
  // Session Management
  startReconciliation(config: ReconciliationConfig): Promise<ReconciliationSession>;
  completeReconciliation(sessionId: string): Promise<ReconciliationResult>;
  approveReconciliation(sessionId: string, approverId: string): Promise<void>;

  // Data Import
  importBankStatement(accountId: string, statement: BankStatement): Promise<ImportResult>;
  importGLTransactions(accountId: string, dateRange: DateRange): Promise<ImportResult>;

  // Matching
  runAutoMatching(sessionId: string): Promise<MatchingResult>;
  manualMatch(sessionId: string, match: ManualMatchInput): Promise<ReconciliationMatch>;
  suggestMatches(exceptionId: string): Promise<MatchSuggestion[]>;

  // Exception Handling
  getExceptions(sessionId: string): Promise<ReconciliationException[]>;
  resolveException(exceptionId: string, resolution: ExceptionResolution): Promise<void>;
  escalateException(exceptionId: string, reason: string): Promise<void>;

  // Timing Differences
  recordTimingDifference(exception: TimingDifferenceInput): Promise<void>;
  clearTimingDifference(exceptionId: string): Promise<void>;

  // Rules Management
  createMatchingRule(rule: MatchingRuleInput): Promise<MatchingRule>;
  optimizeRules(feedback: MatchFeedback[]): Promise<void>;

  // Reporting
  generateReconciliationReport(sessionId: string): Promise<ReconciliationReport>;
  getAgingReport(accountId: string): Promise<AgingReport>;
}
```

## Outstanding Questions

1. **Multi-Currency Reconciliation**: How to handle FX rate differences between systems?
2. **Intercompany Netting**: How to reconcile when intercompany transactions are netted?
3. **Real-Time vs Batch**: Should reconciliation run continuously or on schedule?

## Sources

- [SolveXia: Transaction Matching Using AI](https://www.solvexia.com/blog/transaction-matching-using-ai)
- [Cashbook: Auto-Matching Algorithms](https://www.cashbook.com/auto-matching-algorithms-in-accounts-reconciliation/)
- [Trintech: Automating 3-Way Transaction Matching](https://www.trintech.com/blog/automating-multi-way-transaction-matching/)
- [HighRadius: Bank Reconciliation Software](https://www.highradius.com/product/bank-reconciliation-software/)
- [netgain: Automated Reconciliation Software](https://www.netgain.tech/blog/automated-reconciliation-software)
- [Ledge.co: AI Reconciliation Use Cases](https://www.ledge.co/content/ai-reconciliation)
- [Prophix: AI-Powered Transaction Matching](https://www.prophix.com/blog/ai-powered-transaction-matching-software/)
- [BlackLine: Transaction Matching](https://www.blackline.com/products/financial-close/transaction-matching/)

---

*Research conducted: January 2026*
*Gap identified in: Mission-requirement analysis - accounting-banking integration needs reconciliation procedures*
