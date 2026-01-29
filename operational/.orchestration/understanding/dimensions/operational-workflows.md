# Operational Workflows Dimension

Understanding of business processes, workflow patterns, and operational coordination across the ecosystem.

---

## Overview

The operational ecosystem supports complex multi-domain business processes through declarative workflow orchestration. Workflows coordinate actions across domains while maintaining loose coupling.

---

## Workflow Engine Architecture

### Understanding Level: [D] Deep

**Core Components**:
```
┌─────────────────────────────────────────┐
│           Workflow Engine               │
├─────────────────────────────────────────┤
│  Parser        │ Loads YAML definitions │
│  Executor      │ Runs workflow steps    │
│  DomainClient  │ HTTP calls to domains  │
│  EventHandler  │ Subscribes to triggers │
└─────────────────────────────────────────┘
```

**Workflow Definition Structure**:
```yaml
id: workflow-id
name: Human Readable Name
description: What this workflow does

trigger:
  type: event | schedule | manual
  source: domain.aggregate.event
  filter:                        # Optional event matching
    fieldPath: expectedValue

input:                           # Extract from event payload
  variableName: $.jsonPath.to.value

steps:
  - id: step-1
    domain: contracts-legal      # Target domain
    action: actionName           # API action to call
    input:                       # Input with ${var} substitution
      key: ${input.variableName}
    timeout: 30s                 # Per-step timeout
    retries: 3                   # Retry attempts
    onFailure: stop | continue | compensate
    dependsOn: []                # Step dependencies
    condition: ${expression}     # Conditional execution

compensation:                    # Rollback on failure
  - step: step-1
    action: undoActionName
```

---

## Key Business Workflows

### Understanding Level: [S] Solid

### 1. Entity Onboarding

**Trigger**: New legal entity created in entity-governance

**Process Flow**:
```
entity-governance: Entity formed
    │
    ▼
contracts-legal: Create standard agreements
    │   ├── NDA template
    │   ├── Employment agreement template
    │   └── Vendor contract template
    │
    ├───────────────┬───────────────┐
    ▼               ▼               ▼
insurance:      data-privacy:   intellectual-property:
Assess coverage Privacy impact  IP assignments
requirements    assessment      (if corp/LLC)
    │               │               │
    └───────────────┴───────────────┘
                    │
                    ▼
            operational: Emit completion event
```

**Workflow Definition**:
```yaml
id: entity-onboarding
trigger:
  type: event
  source: entity-governance.entity.created
  filter:
    status: active

input:
  entityId: $.aggregateId
  entityType: $.payload.type
  entityName: $.payload.name

steps:
  - id: create-standard-contracts
    domain: contracts-legal
    action: createStandardAgreements
    input:
      entityId: ${input.entityId}

  - id: assess-insurance
    domain: insurance
    action: assessCoverageRequirements
    dependsOn: [create-standard-contracts]
    input:
      entityId: ${input.entityId}
      entityType: ${input.entityType}

  - id: privacy-assessment
    domain: data-privacy
    action: initiatePrivacyAssessment
    dependsOn: [create-standard-contracts]
    input:
      entityId: ${input.entityId}

  - id: ip-assignments
    domain: intellectual-property
    action: createIPAssignments
    dependsOn: [create-standard-contracts]
    condition: "${input.entityType} in ['corporation', 'llc']"
    input:
      entityId: ${input.entityId}

  - id: notify-completion
    domain: operational
    action: emitOnboardingComplete
    dependsOn: [assess-insurance, privacy-assessment, ip-assignments]
```

### 2. Contract Execution

**Trigger**: Contract signed by all parties

**Process Flow**:
```
contracts-legal: Contract signed
    │
    ├──► insurance: Verify coverage
    │       └── Check contractual requirements met
    │
    ├──► compliance: Regulatory check
    │       └── Any regulatory obligations?
    │
    └──► accounting: Revenue recognition
            └── Trigger ASC 606 assessment
```

### 3. IP Licensing

**Trigger**: License agreement activated

**Process Flow**:
```
intellectual-property: License activated
    │
    ├──► contracts-legal: Link to contract
    │       └── Associate license with agreement
    │
    ├──► accounting: Royalty schedule
    │       └── Set up recurring revenue
    │
    └──► compliance: Export control
            └── Check international transfer rules
```

### 4. Expiration Handling

**Trigger**: Item approaching expiration (30 days)

**Process Flow**:
```
(any domain): Item expiring
    │
    ├──► notification: Alert stakeholders
    │       └── Email, Slack
    │
    ├──► workflow: Create renewal task
    │       └── Assign to owner
    │
    └──► compliance: Check requirements
            └── Any compliance implications?
```

### 5. Data Breach Response

**Trigger**: Breach detected in data-privacy

**Process Flow**:
```
data-privacy: Breach detected
    │
    ├──► insurance: Cyber claim notification
    │       └── Check coverage, file if applicable
    │
    ├──► compliance: 72-hour alert
    │       └── Track authority notification deadline
    │
    ├──► contracts-legal: Check DPAs
    │       └── Identify affected contracts
    │
    └──► notification: Executive alert
            └── C-suite notification
```

---

## Step Execution Model

### Understanding Level: [S] Solid

**Dependency Resolution**:
```typescript
// Steps ordered into batches by dependencies
const batches = [
  [step1],           // No dependencies
  [step2, step3],    // Depend on step1, run in parallel
  [step4],           // Depends on step2 and step3
];

// Execute batches sequentially, steps within batch parallel
for (const batch of batches) {
  await Promise.all(batch.map(step => executeStep(step)));
}
```

**Conditional Execution**:
```yaml
condition: "${input.entityType} in ['corporation', 'llc']"
condition: "${input.contractValue} > 100000"
condition: "${previousStep.result.requiresReview} == true"
```

**Retry Strategy**:
```typescript
const executeWithRetry = async (step, attempt = 1) => {
  try {
    return await domainClient.execute(step);
  } catch (error) {
    if (attempt < step.retries) {
      await sleep(exponentialBackoff(attempt));
      return executeWithRetry(step, attempt + 1);
    }
    throw error;
  }
};
```

**Failure Handling**:
| Strategy | Behavior |
|----------|----------|
| `stop` | Halt workflow, mark as failed |
| `continue` | Log failure, proceed to next steps |
| `compensate` | Trigger compensation for completed steps |

---

## Compensation (Saga Pattern)

### Understanding Level: [S] Solid

**Purpose**: Rollback partial work when workflow fails

**Compensation Flow**:
```
Normal: step1 → step2 → step3 (FAIL)
Compensate: undo-step2 → undo-step1
```

**Compensation Definition**:
```yaml
compensation:
  - step: create-standard-contracts
    action: deleteStandardAgreements
    input:
      entityId: ${input.entityId}

  - step: assess-insurance
    action: cancelCoverageAssessment
    input:
      assessmentId: ${assess-insurance.result.assessmentId}
```

**Compensation Rules**:
1. Run in reverse order of completion
2. Best effort - log failures but continue
3. May not achieve perfect rollback (eventual consistency)
4. Critical for financial/legal operations

---

## Scheduled Workflows

### Understanding Level: [S] Solid

**Cron-Based Triggers**:
```yaml
trigger:
  type: schedule
  cron: "0 6 * * *"    # Daily at 6 AM
```

**Common Scheduled Workflows**:

| Schedule | Workflow | Purpose |
|----------|----------|---------|
| Daily 6 AM | expiration-check | Find items expiring in 30 days |
| Weekly Mon | compliance-review | Aggregate compliance status |
| Monthly 1st | renewal-reminder | Contract/policy renewal alerts |
| Quarterly | regulatory-report | Generate compliance reports |

---

## Workflow State Management

### Understanding Level: [S] Solid

**Execution State**:
```typescript
interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'compensating';
  input: Record<string, unknown>;
  steps: StepExecution[];
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

interface StepExecution {
  stepId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: Date;
  completedAt?: Date;
  result?: unknown;
  error?: string;
  attempts: number;
}
```

**State Persistence**:
- Execution state stored for audit and debugging
- Can resume failed workflows
- Can query execution history

---

## Reporting Workflows

### Understanding Level: [S] Solid

**Report Generation Flow**:
```
Schedule triggers
    │
    ▼
Report Generator
    │
    ├──► Fetch from contracts-legal
    ├──► Fetch from insurance
    ├──► Fetch from IP
    └──► Fetch from data-privacy
    │
    ▼
Combine & Format
    │
    ▼
Distribute
    ├──► Email
    ├──► Slack
    └──► Dashboard
```

**Report Types**:

| Report | Sources | Purpose |
|--------|---------|---------|
| Entity Overview | All domains | Comprehensive entity status |
| Expiration Forecast | All domains | Items expiring in N days |
| Compliance Dashboard | Compliance aggregator | Regulatory status |
| Document Inventory | All domains | All documents by entity |
| Pending Actions | All domains | Items requiring attention |

---

## Manual Workflow Triggers

### Understanding Level: [S] Solid

**API for Manual Trigger**:
```
POST /workflows/{workflowId}/trigger
{
  "input": {
    "entityId": "ent_123",
    "reason": "Manual entity setup"
  }
}
```

**Use Cases**:
- Onboarding existing entities
- Re-running failed workflows
- Testing workflow changes
- Ad-hoc business processes

---

## Pending Actions Tracking

### Understanding Level: [S] Solid

**Cross-Domain Action Aggregation**:
```
GET /operational/pending-actions?entityId=ent_123
    │
    ├──► contracts-legal
    │       ├── Contracts pending signature
    │       ├── Obligations due
    │       └── Renewals needed
    │
    ├──► insurance
    │       ├── Claims under review
    │       └── Policies expiring
    │
    ├──► IP
    │       ├── Maintenance fees due
    │       ├── Renewals needed
    │       └── Filing deadlines
    │
    └──► data-privacy
            ├── DSARs in progress
            └── Consents expiring
    │
    ▼
Combined, sorted by priority + due date
```

**Action Priority**:
```typescript
enum ActionPriority {
  HIGH = 1,    // Due within 7 days or critical
  MEDIUM = 2,  // Due within 30 days
  LOW = 3,     // Due within 90 days
}
```

---

## Key Workflow Insights

1. **Declarative over imperative** - YAML definitions enable business understanding
2. **Events as triggers** - Workflows react to domain events, not scheduled polling
3. **Parallel where possible** - Independent steps run concurrently for efficiency
4. **Compensation for safety** - Saga pattern handles partial failures gracefully
5. **Domain isolation maintained** - Workflows coordinate but don't embed domain logic
6. **Correlation throughout** - Every execution tracked with correlation IDs
7. **Timeout protection** - Every step has bounded execution time
8. **Retry with backoff** - Transient failures handled automatically
