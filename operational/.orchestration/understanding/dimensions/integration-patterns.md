# Integration Patterns Dimension

Understanding of how operational domains connect, communicate, and coordinate across the ecosystem.

---

## Overview

The operational ecosystem uses event-driven architecture for cross-domain communication, with the orchestration layer providing coordination, aggregation, and unified views.

---

## Dependency Direction

### Understanding Level: [D] Deep

**Foundational → Operational** (One-Way):
```
FOUNDATIONAL (What the business IS)
├── entity-governance (legal entities)
├── accounting (financial records)
├── compliance (regulatory framework)
├── corporate-security (access control)
└── auth (authentication/authorization)
         │
         │ References (entityId, userId)
         ▼
OPERATIONAL (What the business DOES)
├── contracts-legal
├── data-privacy
├── insurance
└── intellectual-property
```

**Key Principle**: Operational domains DEPEND ON foundational. Foundational NEVER depends on operational.

**Why This Matters**:
- Entity-governance doesn't need to know about contracts
- Compliance framework doesn't change for IP specifics
- Changes to operational domains don't cascade to foundational

---

## Event-Driven Communication

### Understanding Level: [D] Deep

**Event Flow Architecture**:
```
┌─────────────────────────────────────────────────────────────┐
│                    Message Queue (Events)                   │
├──────────────┬──────────────┬──────────────┬────────────────┤
│ contracts.*  │ insurance.*  │ ip.*         │ privacy.*      │
└──────────────┴──────────────┴──────────────┴────────────────┘
       │              │                │              │
       └──────────────┴────────────────┴──────────────┘
                              │
       ┌──────────────────────┼──────────────────────┐
       ▼                      ▼                      ▼
Workflow Engine      Compliance Aggregator    Reporting Service
```

**Event Naming Convention**:
```
{domain}.{aggregate}.{action}

Examples:
- contracts-legal.contract.created
- contracts-legal.contract.signed
- intellectual-property.patent.filed
- intellectual-property.patent.granted
- data-privacy.consent.granted
- insurance.policy.renewed
```

**Event Metadata**:
```typescript
{
  id: "evt_123",
  type: "contracts-legal.contract.signed",
  entityId: "ent_456",           // Legal entity owner
  aggregateId: "contract_789",   // The contract
  aggregateType: "contract",
  occurredAt: "2024-01-15T10:30:00Z",
  metadata: {
    correlationId: "corr_abc",   // Trace across services
    causationId: "evt_122",      // What caused this event
    userId: "user_xyz"           // Who triggered action
  },
  payload: {
    // Domain-specific data
  }
}
```

---

## Cross-Domain Workflows

### Understanding Level: [D] Deep

**Workflow Engine Orchestration**:

The workflow engine subscribes to events and coordinates multi-domain actions:

```yaml
# Entity Onboarding Workflow
id: entity-onboarding
trigger:
  type: event
  source: entity-governance.entity.created

steps:
  - id: create-standard-contracts
    domain: contracts-legal
    action: createStandardAgreements

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
```

**Execution Model**:
1. Event arrives → Matches trigger criteria
2. Steps ordered by dependencies → Executed in batches
3. Steps without dependencies run in parallel
4. Failure triggers compensation (rollback)
5. Completion emits `operational.workflow.completed` event

**Compensation (Saga Pattern)**:
```yaml
compensation:
  - step: create-standard-contracts
    action: deleteStandardAgreements
  - step: assess-insurance
    action: cancelCoverageAssessment
```

---

## Gateway Aggregation

### Understanding Level: [D] Deep

**Unified Query Layer**:

The gateway provides entity-centric views across all domains:

```
GET /operational/entities/{entityId}/overview
    │
    ├──► contracts-legal:3011  → Contract summary, pending actions
    ├──► insurance:3013        → Policy status, claims
    ├──► intellectual-property:3014 → IP portfolio
    ├──► data-privacy:3012     → Privacy status
    └──► compliance:3021       → Compliance overview
    │
    ▼
Aggregated Response {
  domains: { contracts, insurance, ip, privacy },
  pendingActions: [...sorted by priority],
  expiringItems: [...sorted by date],
  complianceStatus: { overall, byRegulation }
}
```

**Resilience Pattern**:
- Parallel fetching from all domains
- Timeout per domain (default 10s)
- Partial success model - returns available data even if some domains fail
- Health tracking per domain

---

## Compliance Integration

### Understanding Level: [S] Solid

**Regulatory Mapping**:

Each regulation maps requirements to specific domains:

```yaml
regulation: GDPR
domains:
  - domain: data-privacy
    requirements:
      - lawful-basis-for-processing
      - consent-management
      - data-subject-rights
      - breach-notification-72h

  - domain: contracts-legal
    requirements:
      - data-processing-agreements
      - standard-contractual-clauses

  - domain: insurance
    requirements:
      - cyber-liability-coverage
      - data-breach-coverage
```

**Status Aggregation Logic**:
```
Overall = NON_COMPLIANT if ANY domain is non-compliant
Overall = PENDING if ANY domain is pending
Overall = COMPLIANT if ALL applicable domains are compliant
```

**Finding Tracking**:
- Each domain reports findings to compliance aggregator
- Findings have: severity, status, due date
- Cross-domain view: all findings for an entity

---

## Domain-to-Domain Interactions

### Understanding Level: [S] Solid

**Contracts-Legal ↔ Other Domains**:

| Interaction | Trigger | Action |
|-------------|---------|--------|
| Contract → Insurance | contract.created | Assess coverage requirements |
| Contract → Insurance | contract.signed | Verify coverage |
| Contract → IP | contract.executed | Link IP assignments |
| Contract → Privacy | contract.signed | Verify DPA in place |
| Contract → Accounting | contract.signed | Revenue recognition trigger |

**Insurance ↔ Other Domains**:

| Interaction | Trigger | Action |
|-------------|---------|--------|
| Insurance → Contracts | policy.renewed | Update related contracts |
| Insurance → Accounting | claim.settled | Record payment |
| Insurance ← Privacy | breach.detected | Cyber coverage notification |

**IP ↔ Other Domains**:

| Interaction | Trigger | Action |
|-------------|---------|--------|
| IP → Contracts | license.activated | Link license agreement |
| IP → Accounting | patent.granted | Capitalize asset |
| IP → Compliance | deadline.approaching | Alert stakeholders |

---

## Data Flow Patterns

### Understanding Level: [S] Solid

**Entity Reference Pattern**:
```
All operational records include:
- entityId: Reference to entity-governance
- No embedding of entity data
- Lookup on demand via gateway
```

**Document Flow**:
```
Documents stored in shared S3 bucket
├── contracts-legal/   → Contract PDFs
├── insurance/         → Policy documents
├── ip/                → Patent filings
└── privacy/           → Consent records

Referenced by domain-specific records
Encryption via shared KMS
```

**Audit Trail Pattern**:
```
Every mutation generates audit entry:
{
  entityType: "contract",
  entityId: "contract_123",
  action: "UPDATE",
  changes: { status: { from: "DRAFT", to: "PENDING_REVIEW" }},
  userId: "user_456",
  timestamp: "2024-01-15T10:30:00Z"
}
```

---

## Expiration Coordination

### Understanding Level: [S] Solid

**Unified Expiration Tracking**:

All domains track expiring items with consistent windows:
```typescript
const EXPIRATION_WINDOWS = {
  critical: 7,    // Days - requires immediate action
  warning: 30,    // Days - plan renewal
  notice: 90,     // Days - awareness
};
```

**Cross-Domain Expiration Query**:
```
GET /operational/entities/{entityId}/expiring?days=30
    │
    ├──► contracts-legal  → Expiring contracts
    ├──► insurance        → Expiring policies
    ├──► ip               → Expiring patents, trademarks
    └──► privacy          → Expiring consents
    │
    ▼
Combined, sorted by expirationDate
```

---

## Report Integration

### Understanding Level: [S] Solid

**Cross-Domain Reporting**:

Reports fetch from multiple domains in parallel:

```yaml
id: expiration-forecast
sources:
  - domain: contracts-legal
    query: getExpiringContracts
  - domain: insurance
    query: getExpiringPolicies
  - domain: intellectual-property
    query: getExpiringIP
  - domain: data-privacy
    query: getExpiringConsents

output:
  sections:
    - title: Critical (7 days)
      filter: daysUntilExpiration <= 7
```

**Scheduled Distribution**:
```yaml
schedules:
  - report: expiration-forecast
    cron: "0 6 * * *"
    distribution:
      - type: email
        recipients: [operations@company.com]
      - type: slack
        channel: "#operations-alerts"
```

---

## API Gateway Pattern

### Understanding Level: [S] Solid

**Gateway as Aggregator**:
```
External Client
      │
      ▼
Gateway (3022)
      │
      ├──► Auth validation
      ├──► Route to domains
      ├──► Aggregate responses
      └──► Format unified response
      │
      ▼
Domain Services (3011-3014)
```

**Gateway Responsibilities**:
1. Single entry point for cross-operational queries
2. Authentication/authorization validation
3. Request routing and aggregation
4. Response formatting and error handling
5. Health monitoring of all domains

---

## Key Integration Insights

1. **Events over APIs** - Domains never call each other directly; events enable loose coupling
2. **Gateway for queries** - Cross-domain reads go through gateway for aggregation
3. **Workflows for actions** - Multi-domain writes orchestrated by workflow engine
4. **Compliance as overlay** - Regulatory requirements map across domains, not owned by one
5. **Entity as anchor** - entityId is the common reference across all domains
6. **Correlation for tracing** - correlationId propagates through all interactions
7. **Partial success is OK** - System remains useful even when some domains are down
