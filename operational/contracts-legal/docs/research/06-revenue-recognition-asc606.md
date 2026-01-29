# Revenue Recognition and Contracts (ASC 606)

**Gap Identified**: README mentions "contract.signed → Triggers revenue recognition" but this oversimplifies ASC 606. Revenue recognition is NOT triggered by signing—it's triggered by satisfying performance obligations.

---

## The Fundamental Shift

### Old Standard
Revenue recognized when **risks and rewards transferred**

### ASC 606 (Current)
Revenue recognized when **control of goods/services transferred**

> "Control is the ability to direct the use of and obtain substantially all of the remaining benefits from the asset."

---

## The Five-Step Model

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: IDENTIFY THE CONTRACT                               │
│ - Agreement creating enforceable rights/obligations         │
│ - Approved and committed parties                            │
│ - Identifiable rights and payment terms                     │
│ - Commercial substance                                      │
│ - Probable collection                                       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 2: IDENTIFY PERFORMANCE OBLIGATIONS                    │
│ - Distinct goods or services promised                       │
│ - Each promise that transfers value to customer             │
│ - Can be bundled or separate                                │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 3: DETERMINE TRANSACTION PRICE                         │
│ - Fixed consideration                                       │
│ - Variable consideration (bonuses, penalties)               │
│ - Constrained if significant reversal likely                │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 4: ALLOCATE TRANSACTION PRICE                          │
│ - Allocate to each performance obligation                   │
│ - Based on relative standalone selling prices               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 5: RECOGNIZE REVENUE                                   │
│ - When (or as) performance obligation is satisfied          │
│ - Point in time OR over time                                │
└─────────────────────────────────────────────────────────────┘
```

---

## When Is Revenue Recognized?

### Point in Time
Performance obligation fulfilled at a specific moment.
- Delivery of physical goods
- License grant (right to use)
- One-time service completion

### Over Time (if ANY of these criteria met)
1. Customer simultaneously receives and consumes benefits as entity performs
2. Entity's performance creates/enhances asset customer controls
3. Entity's performance doesn't create asset with alternative use AND entity has enforceable right to payment for performance to date

---

## Milestone-Based Recognition

### When Milestones Work
- Surveyed performance to date
- Units delivered
- Project phases completed

### CAUTION: When Milestones Fail

> "Measuring progress based on contract milestones is unlikely to be appropriate if there is significant performance between milestones."

Material goods/services transferred between milestones should NOT be excluded from progress measurement.

**Example Problem**: A contract with 3 milestones at 30%, 60%, 100%, but 40% of work happens between milestone 2 and 3. Can't just recognize at milestones—must account for work between.

---

## Variable Consideration

Included in transaction price when probable that significant reversal WON'T occur:

- Performance bonuses/penalties
- Price concessions
- Milestone payments (if contingent)
- Volume discounts
- Rights of return

**Constraint**: Only include amounts highly probable of not reversing.

---

## Current Schema Gap

```prisma
model Contract {
  value             Decimal?    // Just a number
  status            ContractStatus
  // No performance obligations tracked
  // No revenue recognition status
  // No milestone tracking for accounting purposes
}
```

**What We're Missing**:
- Performance obligations identified from contract
- Revenue recognition timing per obligation
- Milestone progress tracking
- Variable consideration constraints
- Integration point for accounting system

---

## Recommended Schema Enhancement

```prisma
model Contract {
  // ... existing fields
  
  // ASC 606 data
  performanceObligations PerformanceObligation[]
  revenueRecognitionMethod RevRecMethod?
  revenueRecognitionNotes String?
}

model PerformanceObligation {
  id              String   @id @default(cuid())
  contractId      String
  contract        Contract @relation(...)
  
  // Identification
  name            String   // "Software License", "Implementation Services"
  description     String
  
  // Classification
  satisfactionTiming TimingType  // POINT_IN_TIME or OVER_TIME
  
  // Value allocation
  standalonePrice Decimal?
  allocatedPrice  Decimal
  currency        String   @default("USD")
  
  // Progress (for over-time obligations)
  measurementMethod MeasurementMethod?
  percentComplete   Decimal?  @db.Decimal(5, 2)
  
  // Milestones (if applicable)
  milestones        Milestone[]
  
  // Status
  status            POStatus @default(NOT_STARTED)
  satisfiedAt       DateTime?
  revenueRecognized Decimal?
  
  // Audit
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

enum TimingType {
  POINT_IN_TIME
  OVER_TIME
}

enum MeasurementMethod {
  OUTPUT_UNITS_DELIVERED
  OUTPUT_MILESTONES
  OUTPUT_SURVEY
  INPUT_COSTS_INCURRED
  INPUT_TIME_ELAPSED
  INPUT_RESOURCES_CONSUMED
}

enum POStatus {
  NOT_STARTED
  IN_PROGRESS
  SATISFIED
  CANCELLED
}

model Milestone {
  id                  String   @id @default(cuid())
  performanceObligationId String
  performanceObligation PerformanceObligation @relation(...)
  
  // Definition
  name                String
  description         String
  percentOfObligation Decimal  @db.Decimal(5, 2)
  
  // Target
  targetDate          DateTime?
  
  // Completion
  status              MilestoneStatus @default(PENDING)
  completedAt         DateTime?
  completedBy         String?
  evidenceDocumentId  String?
  
  // Approval (for revenue purposes)
  approvedForRevenue  Boolean @default(false)
  approvedBy          String?
  approvedAt          DateTime?
}

enum MilestoneStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  APPROVED
  DISPUTED
}

enum RevRecMethod {
  POINT_IN_TIME_DELIVERY
  POINT_IN_TIME_ACCEPTANCE
  OVER_TIME_OUTPUT
  OVER_TIME_INPUT
  PERCENTAGE_OF_COMPLETION
}
```

---

## Event Integration with Accounting

**Correct Events** (not just "contract.signed"):

| Event | Accounting Action |
|-------|-------------------|
| `performanceObligation.satisfied` | Recognize allocated revenue |
| `milestone.approved` | Update % complete, potentially recognize |
| `contract.terminated` | Assess remaining obligations, adjust |
| `variableConsideration.resolved` | Adjust transaction price |

---

## Industry Considerations

### Construction
- Long-term contracts spanning years
- Percentage of completion common
- Variable terms (change orders)
- Scope changes affect price

### SaaS
- Subscription = over-time recognition
- Implementation = often separate obligation
- Usage-based = variable consideration

### Professional Services
- Time & materials = over time as services rendered
- Fixed fee = depends on contract terms

---

## Sources

- [ASC 606 Revenue from Contracts with Customers | HCVT](https://www.hcvt.com/article-ASC-606-Revenue-Recognition-Contracts)
- [Revenue Recognition Under ASC 606 | BDO](https://www.bdo.com/insights/assurance/revenue-recognition-under-asc-606-best-practices-for-government-contractors)
- [ASC 606 Explained | Tabs](https://tabs.inc/blog/asc-606)
- [Performance Obligations Over Time | PwC](https://viewpoint.pwc.com/dt/us/en/pwc/accounting_guides/revenue_from_contrac/revenue_from_contrac_US/chapter_6_recognizin_US/63performance_obliga_US.html)
- [Revenue from Contracts with Customers | Grant Thornton](https://www.grantthornton.com/content/dam/grantthornton/website/assets/content-page-files/audit/pdfs/2022/revenue-from-contracts-with-customers-updated-220124.pdf)
