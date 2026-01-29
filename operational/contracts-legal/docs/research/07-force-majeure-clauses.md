# Force Majeure Clauses

**Gap Identified**: Schema has no force majeure modeling at all. This was painfully exposed during COVID-19 when organizations scrambled to understand which contracts had force majeure provisions and whether they applied.

---

## What Is Force Majeure

> "Extraordinary events beyond the control of either party that prevent one or both parties from performing under the contract."

Force majeure (French: "superior force") provisions address:
- When a party may suspend performance
- When a party may fail to perform without liability
- When a party may terminate the contract

---

## Key Requirements for Invoking Force Majeure

### 1. Event Must Be Covered by the Clause

Courts focus on **whether the event is specifically listed**:

| Clause Language | COVID-19 Coverage |
|----------------|-------------------|
| "Pandemic, epidemic, disease outbreak" | Likely covered |
| "Acts of God" only | Probably NOT covered |
| "Government action, orders" | May cover lockdowns |
| "Labor disruption" | May cover if supply chain affected |

**Key Lesson**: General "beyond control" language is often insufficient. Specific enumeration matters.

### 2. Causation Requirement

The force majeure event must be the **sole or substantial cause** of inability to perform.

**Common Failure**: Citing "economic hardship from COVID-19" as reason for non-performance. Economic hardship is generally NOT a force majeure event.

> Courts strictly interpret force majeure. If there's another reason for non-performance that's not a force majeure event, relief may not be available.

### 3. Performance Standard

| Language | Standard | Difficulty |
|----------|----------|------------|
| "Prevented" / "Rendered unable" | Performance physically or legally impossible | Highest |
| "Hindered" | Performance made more difficult | Lower |
| "Delayed" | Performance postponed | Lower |

**Critical**: "Unprofitable" or "expensive" ≠ "Impossible"

### 4. Foreseeability (Jurisdiction-Dependent)

| Jurisdiction | Foreseeability Required? |
|-------------|-------------------------|
| New York | Yes - event must be unforeseen |
| Texas | No - foreseeability not required |
| Florida | Yes - must be unforeseeable and outside party's control |

### 5. Notice Requirements

Many clauses require:
- Immediate notice (within days) of the event
- Description of the specific event
- Anticipated effect on performance
- Expected duration

**Failure to give timely notice may waive force majeure rights.**

---

## COVID-19 Lessons

### What Worked
- Clauses expressly including "pandemic" or "epidemic"
- References to "government orders" or "mandatory closures"
- Broad language covering "public health emergencies"

### What Didn't Work
- Generic "Acts of God" without pandemic language
- Economic hardship arguments
- General "beyond control" without specificity
- Claims where the virus itself (not government action) was cited

### The Real Trigger
> "It is often the steps taken by governments in response to COVID-19 which actually prevent or hinder performance rather than the virus itself."

---

## Consequences of Force Majeure

| Consequence | Description |
|-------------|-------------|
| **Suspension** | Rights/obligations paused during event |
| **Extension** | Performance deadline extended |
| **Termination** | Contract may be cancelled if event persists |
| **Partial Performance** | Some obligations may be excused |

---

## Current Schema Gap

```prisma
model Contract {
  // No force majeure tracking at all
}

model ContractClause {
  title       String
  content     String  // Force majeure buried in here
  // No structured extraction
}
```

**What We're Missing**:
- Whether contract HAS force majeure clause
- What events are covered
- What notice requirements exist
- Whether force majeure has been invoked
- Current status of any invocation

---

## Recommended Schema Enhancement

```prisma
model Contract {
  // ... existing fields
  forceMajeureClause ForceMajeureClause?
  forceMajeureEvents ForceMajeureEvent[]
}

model ForceMajeureClause {
  id              String   @id @default(cuid())
  contractId      String   @unique
  contract        Contract @relation(...)
  
  // Does the contract have FM clause?
  hasClause       Boolean
  clauseSection   String?  // e.g., "Section 12.3"
  
  // What's covered (extracted from clause text)
  coveredEvents   CoveredEvent[]
  
  // Performance standard
  performanceStandard PerformanceStandard
  
  // Notice requirements
  noticeRequired      Boolean @default(true)
  noticePeriodDays    Int?
  noticeRecipient     String?
  
  // Consequences available
  allowsSuspension    Boolean @default(true)
  allowsTermination   Boolean @default(false)
  terminationThresholdDays Int?  // e.g., terminate if FM lasts > 90 days
  
  // Full text (for reference)
  clauseText      String   @db.Text
  
  // Review
  reviewedAt      DateTime?
  reviewedBy      String?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

enum CoveredEvent {
  ACT_OF_GOD
  NATURAL_DISASTER
  EARTHQUAKE
  FLOOD
  FIRE
  PANDEMIC
  EPIDEMIC
  DISEASE_OUTBREAK
  WAR
  TERRORISM
  CIVIL_UNREST
  RIOT
  STRIKE
  LABOR_DISPUTE
  GOVERNMENT_ACTION
  CHANGE_IN_LAW
  EMBARGO
  SANCTIONS
  SUPPLY_CHAIN_DISRUPTION
  UTILITY_FAILURE
  CYBERATTACK
  OTHER
}

enum PerformanceStandard {
  PREVENTED         // Impossible
  RENDERED_UNABLE   // Impossible  
  HINDERED          // Difficult
  DELAYED           // Postponed
  IMPACTED          // Affected (broad)
}

model ForceMajeureEvent {
  id              String   @id @default(cuid())
  contractId      String
  contract        Contract @relation(...)
  
  // The event
  eventType       CoveredEvent
  eventName       String   // e.g., "COVID-19 Pandemic"
  eventDescription String  @db.Text
  eventStartDate  DateTime
  eventEndDate    DateTime?
  
  // Invocation
  invokedAt       DateTime
  invokedBy       String   // Which party invoked
  noticeGiven     Boolean
  noticeDate      DateTime?
  
  // Claim details
  obligationsAffected String[]
  reliefRequested String   // "suspension", "extension", "termination"
  
  // Response
  counterpartyResponse String?
  responseDate    DateTime?
  disputed        Boolean @default(false)
  disputeDetails  String?
  
  // Resolution
  status          FMStatus @default(INVOKED)
  resolutionType  FMResolution?
  resolvedAt      DateTime?
  performanceResumed DateTime?
  
  // Documentation
  documentIds     String[]
  
  // Audit
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

enum FMStatus {
  INVOKED
  ACKNOWLEDGED
  DISPUTED
  SUSPENDED
  RESUMED
  TERMINATED
  RESOLVED
}

enum FMResolution {
  PERFORMANCE_RESUMED
  OBLIGATIONS_MODIFIED
  EXTENSION_GRANTED
  PARTIAL_PERFORMANCE
  CONTRACT_TERMINATED
  CLAIM_REJECTED
  SETTLED
}
```

---

## Drafting Best Practices (Post-COVID)

### Specific Event Enumeration
List specific events including:
- Pandemic, epidemic, public health emergency
- Government orders, mandatory closures, quarantine
- Travel restrictions
- Supply chain disruption

### Clear Trigger Language
Define what triggers the clause:
- "Prevents" vs "hinders" vs "delays"
- Causation standard
- Duration threshold

### Notice Mechanics
- How notice must be given
- When (within X days of event)
- What it must contain
- Ongoing reporting requirements

### Termination Rights
- How long before termination allowed
- Mutual or one-sided
- Wind-down provisions

---

## Sources

- [Q&A on COVID-19 Force Majeure Claims | Norton Rose Fulbright](https://www.nortonrosefulbright.com/en-us/knowledge/publications/849d7568/q-and-a-on-covid-19-related-force-majeure-claims)
- [Force Majeure Checklist | LexisNexis](https://www.lexisnexis.com/supp/largelaw/no-index/coronavirus/commercial-transactions/commercial-transactions-coronavirus-and-force-majeure-checklist.pdf)
- [Drafting Force Majeure Clauses | WilmerHale](https://www.wilmerhale.com/en/insights/client-alerts/20200413-drafting-force-majeure-clauses-in-light-of-the-covid-19-pandemic)
- [Force Majeure Flowchart | Gibson Dunn](https://www.gibsondunn.com/an-updated-checklist-and-flowchart-for-analyzing-force-majeure-clauses-during-the-covid-19-crisis/)
- [Force Majeure Under COVID-19 | Paul Weiss](https://www.paulweiss.com/practices/litigation/litigation/publications/update-force-majeure-under-the-coronavirus-covid-19-pandemic?id=30881)
