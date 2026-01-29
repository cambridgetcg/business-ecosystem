# Dimension 31: Workflow Orchestration

## What

The orchestration layer (`.orchestration/`) provides **cross-domain workflow coordination**. It executes multi-step processes that span multiple operational domains, triggered by events or manual requests.

**Location**: `/.orchestration/`
**Components**:
- Workflow Engine (3020)
- Compliance Aggregator (3021)
- Reporting Service (3023)

## Why

Cross-domain processes (like entity onboarding) require coordinated actions across multiple services. No single domain owns these flows. The orchestration layer provides:

- Declarative workflow definition (YAML, no code changes for new workflows)
- Dependency-based execution ordering (DAG)
- Automatic retry with exponential backoff
- Compensation (rollback) for failed workflows
- Compliance aggregation across domains
- Scheduled and on-demand reporting

## How

### Workflow Engine Architecture

```
Event (entity-governance.entity.created)
    │
    ▼
WorkflowEngine.handleEvent()
    │
    ├── Lookup workflows triggered by event
    ├── Check filter conditions
    └── Extract input from event payload
    │
    ▼
WorkflowExecutor.execute()
    │
    ├── Build execution order (DAG)
    ├── Execute steps in parallel batches
    │   ├── Evaluate conditions
    │   ├── Call domain action via HTTP
    │   ├── On failure: retry with backoff (2^n seconds)
    │   └── Track step results
    │
    ├── On workflow failure:
    │   └── Run compensation in reverse order
    │
    └── Emit completion event
```

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| WorkflowParser | `engine/src/parser.ts` | Loads/validates YAML workflows with Zod |
| WorkflowExecutor | `engine/src/executor.ts` | Executes steps with retry and compensation |
| WorkflowEngine | `engine/src/engine.ts` | Manages lifecycle, events, concurrency |
| ComplianceAggregator | `compliance/src/aggregator.ts` | Combines compliance status from domains |
| ReportGenerator | `reporting/src/generator.ts` | Generates reports from definitions |

### Workflow YAML Structure

```yaml
# workflows/entity-onboarding.yaml
id: entity-onboarding
name: Entity Onboarding
version: 1.0.0

trigger:
  type: event
  source: entity-governance.entity.created
  filter:
    status: active
  input:
    entityId: $.payload.entityId
    entityName: $.payload.name

steps:
  - id: create-standard-contracts
    domain: contracts-legal
    action: createStandardAgreements
    input:
      entityId: $input.entityId

  - id: assess-insurance
    domain: insurance
    action: assessCoverageRequirements
    dependsOn: [create-standard-contracts]

  - id: privacy-assessment
    domain: data-privacy
    action: initiatePrivacyAssessment
    dependsOn: [create-standard-contracts]

  - id: ip-assignments
    domain: intellectual-property
    action: createIPAssignments
    dependsOn: [create-standard-contracts]
    condition: "entity.type in ['corporation', 'llc']"

compensation:
  - stepId: create-standard-contracts
    action: rollbackStandardAgreements
```

### Compliance Aggregation

```typescript
// Per-entity compliance overview
interface EntityComplianceOverview {
  entityId: string;
  overall: 'compliant' | 'non-compliant' | 'pending';
  domains: {
    [domain: string]: {
      status: 'compliant' | 'non-compliant' | 'pending';
      lastAssessed: Date;
      findings: ComplianceFinding[];
    }
  };
  findingCounts: { critical: number; high: number; medium: number; low: number };
}
```

**Aggregation Logic**:
- ANY non-compliant → overall non-compliant
- ANY pending → overall pending
- ALL compliant/not-applicable → overall compliant

### Reporting

Reports are defined declaratively in YAML:

```yaml
# definitions/expiration-forecast.yaml
id: expiration-forecast
name: Expiration Forecast Report
description: Items expiring in the next 90 days

parameters:
  - name: entityId
    type: string
    required: true
  - name: days
    type: integer
    default: 90

sources:
  - id: contracts
    domain: contracts-legal
    endpoint: /entities/{entityId}/expiring?days={days}
  - id: insurance
    domain: insurance
    endpoint: /entities/{entityId}/expiring?days={days}

sections:
  - title: Expiring Contracts
    source: contracts
    fields: [title, expirationDate, daysUntilExpiry]
```

## Where

| Component | Path |
|-----------|------|
| Engine Core | `.orchestration/engine/src/` |
| Workflow Definitions | `.orchestration/workflows/` |
| Compliance Service | `.orchestration/compliance/src/` |
| Regulatory Mappings | `.orchestration/compliance/regulatory-mappings/` |
| Reporting Service | `.orchestration/reporting/src/` |
| Report Definitions | `.orchestration/reporting/definitions/` |
| Report Schedules | `.orchestration/reporting/schedules/` |

## Gaps

### Critical Implementation Gaps

1. **Message Queue Not Connected** (engine/src/index.ts):
   ```typescript
   // TODO: Connect to message queue and subscribe to events
   ```
   **Impact**: Workflows only trigger via manual API calls, not events.

2. **Mock Domain Clients in Compliance**:
   ```typescript
   class MockDomainClient {
     async getComplianceStatus(entityId: string) {
       return { status: 'compliant' }; // Always compliant!
     }
   }
   ```
   **Impact**: Compliance always returns "compliant" regardless of reality.

3. **Report Distribution Missing**:
   ```typescript
   // TODO: Handle distribution (email, slack, webhook)
   ```
   **Impact**: Scheduled reports generate but don't send.

### Other Gaps

| Feature | Status |
|---------|--------|
| Workflow YAML parsing | Implemented |
| Step execution with retry | Implemented |
| Compensation/rollback | Implemented |
| Message queue integration | **TODO** |
| Real compliance clients | **Mock only** |
| Report distribution | **TODO** |
| PDF/Excel formats | **JSON only** |
| Persistence (workflow state) | **In-memory** |
| High availability | **None** |

## Open Questions

1. **How should workflow state be persisted?** Currently in-memory - lost on restart
2. **What's the retry policy for event consumption?** If queue fails, events lost?
3. **Where are domain-specific actions defined?** Contract for `createStandardAgreements`?
4. **What happens with long-running workflows?** No checkpoint/resume
5. **How is compliance cache invalidated?** Event-based, but what if events missed?
6. **What if compensation fails?** No dead-letter strategy visible

## Connections

**Orchestration depends on**:
- All 4 operational domains (for action execution)
- Message queue (for event triggers - TODO)
- entity-governance (for entity validation)

**Domains are unaware of orchestration** - they just emit events and expose action endpoints.

---

*Understanding Level: SOLID*
*Implementation: Core patterns work but production gaps (queue, persistence, distribution)*
