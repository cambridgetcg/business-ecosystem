# Material Breach vs Substantial Performance

**Gap Identified**: The contract lifecycle assumes clean states (ACTIVE → TERMINATED) but contracts often exist in murky middle ground. What constitutes a breach? When can you terminate? When must you still pay?

---

## The Fundamental Question

> When one party doesn't perform exactly as promised, is it a **material breach** (excusing the other party from performance) or **substantial performance** (requiring the other party to still perform, with damages for the shortfall)?

This determines:
- Whether the non-breaching party can terminate
- Whether the non-breaching party still has to pay
- What damages are available

---

## Material Breach

### Definition
> "A significant failure to fulfill the terms of a contract that goes to the root or essence of the agreement. It deprives the other party of the benefit they reasonably expected."

### Effect
When a party materially breaches:
1. They CANNOT enforce the contract against the non-breaching party
2. Non-breaching party can suspend or terminate performance
3. Non-breaching party can sue for damages

### Five Factors Courts Consider

| Factor | Question |
|--------|----------|
| **Extent of Deprivation** | How much benefit did the injured party lose? |
| **Adequacy of Compensation** | Can money damages make the non-breaching party whole? |
| **Hardship on Breaching Party** | How much will the breaching party suffer if contract ends? |
| **Likelihood of Cure** | Is the breaching party likely to fix the problem? |
| **Good Faith** | Did the breaching party act in good faith? |

---

## Substantial Performance

### Definition
> "Performance that, despite deviation or omission, provides the important and essential benefits of the contract."

### The Rule
Under substantial performance, **actions do not need to explicitly match contract terms** as long as they fulfill the contract's purpose.

### When It Applies
Courts look for:
- Non-breaching party received most of what was bargained for
- Performing party acted honestly and made genuine effort
- Deficiency can be remedied with relatively small expense
- Deviation is minor and doesn't affect overall purpose

### Classic Case: Jacob & Youngs v. Kent (1921)
A contractor installed plumbing fixtures of a different brand than specified. The court ruled the deviation was **immaterial** and didn't affect project value—substantial performance was achieved.

---

## The Materiality Threshold

### Minor Deviations ≠ Material Breach

> "Technical breaches may be excused if parties performed the essence of their contractual obligations."

### Example
- Contract specifies painting house "Benjamin Moore White"
- Contractor uses "Sherwin Williams White" (visually identical)
- This is likely substantial performance, not material breach
- Owner must pay, but can recover cost difference (if any)

### Counter-Example
- Contract specifies "deliver by December 1 for holiday season sales"
- Delivery occurs December 26
- This IS material breach—timing was essential
- Buyer can reject and sue for damages

---

## "Time is of the Essence"

When contract states "time is of the essence":
- Delays become material breaches
- Substantial performance doctrine may not apply
- Missing deadlines can terminate contract

---

## Current Schema Gap

```prisma
model Contract {
  status ContractStatus
}

enum ContractStatus {
  ACTIVE
  SUSPENDED
  TERMINATED
  // No concept of "breach" or "disputed performance"
}
```

**What We're Missing**:
- Breach allegations and their nature
- Cure periods and attempts
- Dispute status
- Performance deficiency tracking

---

## Recommended Schema Enhancement

```prisma
model Contract {
  // ... existing fields
  performanceIssues PerformanceIssue[]
  breachAllegations BreachAllegation[]
}

model PerformanceIssue {
  id              String   @id @default(cuid())
  contractId      String
  contract        Contract @relation(...)
  
  // What's the issue
  obligationId    String?
  obligation      Obligation? @relation(...)
  
  description     String   @db.Text
  affectedSection String?  // Contract section reference
  
  // Classification
  severity        IssueSeverity
  isTimeSensitive Boolean @default(false)
  
  // Who reported
  reportedBy      String   // Party ID
  reportedAt      DateTime
  
  // Cure
  cureDeadline    DateTime?
  curePeriodDays  Int?
  cureAttempts    CureAttempt[]
  
  // Resolution
  status          IssueStatus @default(OPEN)
  resolvedAt      DateTime?
  resolution      String?
  
  // Escalation
  escalatedToBreach Boolean @default(false)
  breachAllegationId String?
}

enum IssueSeverity {
  MINOR           // Administrative, easily fixable
  MODERATE        // Affects value but not essence
  SIGNIFICANT     // Materially affects benefits
  CRITICAL        // Goes to root of contract
}

enum IssueStatus {
  OPEN
  CURE_IN_PROGRESS
  CURED
  ESCALATED_TO_BREACH
  WAIVED
  DISPUTED
}

model CureAttempt {
  id                String   @id @default(cuid())
  performanceIssueId String
  performanceIssue  PerformanceIssue @relation(...)
  
  description       String
  attemptedAt       DateTime
  attemptedBy       String
  
  // Outcome
  successful        Boolean?
  evaluatedAt       DateTime?
  evaluatedBy       String?
  evaluationNotes   String?
}

model BreachAllegation {
  id              String   @id @default(cuid())
  contractId      String
  contract        Contract @relation(...)
  
  // Allegation
  allegedBy       String   // Party ID
  allegedAt       DateTime
  
  // Nature of breach
  breachType      BreachType
  description     String   @db.Text
  affectedSections String[]
  
  // Related performance issues
  performanceIssueIds String[]
  
  // Claimed impact
  claimedMateriality MaterialityLevel
  claimedDamages    Decimal?
  claimedDamagesDesc String?
  
  // Response
  respondedAt       DateTime?
  responseDenies    Boolean?
  responseDetails   String?
  
  // Resolution
  status            BreachStatus @default(ALLEGED)
  determinedMaterial Boolean?
  resolvedAt        DateTime?
  resolutionType    BreachResolution?
  resolutionDetails String?
  
  // Legal
  linkedToMatterId  String?
  
  // Audit
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

enum BreachType {
  NON_PERFORMANCE       // Didn't do what was promised
  DEFECTIVE_PERFORMANCE // Did it wrong
  LATE_PERFORMANCE      // Did it late
  ANTICIPATORY          // Indicated won't perform
  REPUDIATION           // Explicitly refused to perform
}

enum MaterialityLevel {
  MINOR              // Substantial performance achieved
  MODERATE           // Partial breach
  MATERIAL           // Goes to essence, justifies termination
  FUNDAMENTAL        // Total failure of consideration
}

enum BreachStatus {
  ALLEGED
  ACKNOWLEDGED
  DENIED
  UNDER_CURE
  CURED
  DETERMINED_MATERIAL
  DETERMINED_IMMATERIAL
  LITIGATED
  SETTLED
}

enum BreachResolution {
  CURED_BY_BREACHING_PARTY
  DAMAGES_PAID
  CONTRACT_TERMINATED
  CONTRACT_MODIFIED
  MUTUAL_RELEASE
  WAIVED
  COURT_JUDGMENT
  ARBITRATION_AWARD
  SETTLED
}
```

---

## Process Flow

```
Performance Issue Detected
         ↓
    Reported and Classified
         ↓
    ┌────┴────┐
    ↓         ↓
  Minor    Significant+
    ↓         ↓
  Track    Notify Other Party
    ↓         ↓
  Monitor  Cure Period Begins
    ↓         ↓
    ↓    ┌────┴────┐
    ↓    ↓         ↓
    ↓  Cured    Not Cured
    ↓    ↓         ↓
    ↓  Close    Escalate to Breach
    ↓              ↓
    ↓    ┌─────────┴─────────┐
    ↓    ↓                   ↓
    ↓  Negotiate         Litigate
    ↓    ↓                   ↓
    └────┴───────────────────┘
              ↓
         Resolution
```

---

## Jury vs. Judge Question

> "Whether a party has substantially performed their obligations or has materially breached is a **factual determination resolved by the jury**. Only when all relevant facts are undisputed does this become a legal decision for the court."

**Implication**: Our system tracks facts; materiality determination is often for courts.

---

## Sources

- [Substantial Performance v. Material Breach | BuildSmart](https://www.buildsmartbradley.com/2024/10/substantial-performance-v-material-breach/)
- [Substantial Performance v. Material Breach | National Law Review](https://natlawreview.com/article/substantial-performance-v-material-breach)
- [Understanding Substantial Performance | UpCounsel](https://www.upcounsel.com/substantial-performance)
- [Substantial Performance | Cornell LII](https://www.law.cornell.edu/wex/substantial_performance)
- [Doctrine of Substantial Performance | Green Mistretta Law](https://greenmistrettalaw.com/contract-law-understanding-the-doctrine-of-substantial-performance/)
