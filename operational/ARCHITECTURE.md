# Operational Domain Architecture

Cross-cutting architectural patterns for operational domains.

---

## Overview

This document defines shared patterns that apply across all operational domains. Individual domains implement these patterns consistently to enable cross-domain coordination and unified operational views.

Extends patterns from [BACKBONE.md](../docs/BACKBONE.md) with operational-specific concerns.

---

## Core Patterns

### 1. Entity-Scoped Operations

All operational records are scoped to a legal entity. This enables:
- Cross-domain queries by entity
- Entity-level compliance aggregation
- Unified audit trails

```typescript
// Base interface for all operational entities
interface OperationalRecord {
  id: string;                    // Record ID
  entityId: string;              // Owner legal entity (from entity-governance)
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;             // User ID
  updatedBy: string;
  version: number;               // Optimistic locking
}
```

**Implementation**: Every domain entity extends `OperationalRecord`.

---

### 2. Document Lifecycle

Operational domains manage documents with a unified lifecycle:

```
                    ┌─────────┐
                    │  DRAFT  │
                    └────┬────┘
                         │ submit
                         ▼
              ┌──────────────────────┐
              │   PENDING_REVIEW     │
              └──────────┬───────────┘
                    approve │ reject
                ┌──────────┴──────────┐
                ▼                     ▼
         ┌──────────┐          ┌──────────┐
         │ APPROVED │          │ REJECTED │
         └────┬─────┘          └──────────┘
              │ execute
              ▼
         ┌──────────┐
         │  ACTIVE  │
         └────┬─────┘
              │ expire/terminate
        ┌─────┴─────┐
        ▼           ▼
  ┌─────────┐ ┌────────────┐
  │ EXPIRED │ │ TERMINATED │
  └─────────┘ └────────────┘
```

**Document States**:
| State | Description | Allowed Transitions |
|-------|-------------|---------------------|
| `DRAFT` | Work in progress | PENDING_REVIEW |
| `PENDING_REVIEW` | Awaiting approval | APPROVED, REJECTED |
| `APPROVED` | Approved, not yet active | ACTIVE |
| `REJECTED` | Declined, needs revision | DRAFT |
| `ACTIVE` | Currently in effect | EXPIRED, TERMINATED |
| `EXPIRED` | Reached end date | (terminal) |
| `TERMINATED` | Manually ended | (terminal) |

**Domain Mapping**:
| Domain | Document Types |
|--------|---------------|
| contracts-legal | Contracts, amendments, exhibits |
| insurance | Policies, endorsements, certificates |
| intellectual-property | Applications, registrations, licenses |
| data-privacy | Consent records, DPIA reports, breach notices |

---

### 3. Regulatory Framework Integration

Every operational domain integrates with `compliance` for regulatory tracking:

```typescript
interface ComplianceIntegration {
  registerRequirements(requirements: ComplianceRequirement[]): Promise<void>;
  checkStatus(entityId: string): Promise<ComplianceStatus>;
  reportEvent(event: ComplianceEvent): Promise<void>;
}

interface ComplianceRequirement {
  id: string;
  domain: 'contracts-legal' | 'insurance' | 'intellectual-property' | 'data-privacy';
  regulation: string;
  requirement: string;
  frequency: 'continuous' | 'annual' | 'quarterly' | 'event-driven';
  entityTypes: string[];
}
```

**Compliance Domains by Operational Area**:
| Operational Domain | Key Regulations |
|-------------------|-----------------|
| contracts-legal | Contract law, UCC, employment law |
| insurance | State insurance regulations, NAIC |
| intellectual-property | Patent law, trademark law, DMCA |
| data-privacy | GDPR, CCPA, HIPAA, sector-specific |

---

### 4. Cross-Domain Event Patterns

Operational domains communicate via events, never direct API calls:

```typescript
interface OperationalEvent {
  id: string;
  type: string;
  domain: 'contracts-legal' | 'insurance' | 'intellectual-property' | 'data-privacy';
  entityId: string;
  aggregateId: string;
  aggregateType: string;
  occurredAt: Date;
  metadata: {
    correlationId: string;
    causationId?: string;
    userId?: string;
  };
  payload: Record<string, unknown>;
}
```

**Event Categories**:

1. **Lifecycle Events**: `{domain}.{aggregate}.created|updated|state_changed`
2. **Integration Events**: `operational.entity_operations_ready`, `operational.compliance_status_changed`
3. **Aggregation Events**: `operational.daily_summary`, `operational.compliance_snapshot`

---

### 5. Expiration and Renewal Tracking

All operational domains track items with expiration dates:

```typescript
interface ExpirableItem {
  id: string;
  entityId: string;
  domain: string;
  itemType: string;
  effectiveDate: Date;
  expirationDate: Date;
  renewalDate?: Date;
  autoRenew: boolean;
  status: 'active' | 'expiring_soon' | 'expired' | 'renewed';
}

const EXPIRATION_WINDOWS = {
  critical: 7,    // Days - requires immediate action
  warning: 30,    // Days - plan renewal
  notice: 90,     // Days - awareness
};
```

---

## Cross-Operational Coordination

### Workflow Orchestration

Multi-domain workflows are defined declaratively:

```yaml
# Example: Entity Onboarding Workflow
id: entity-onboarding
name: Entity Onboarding
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

### Unified Query Layer

```typescript
interface OperationalQueryService {
  getEntityOperations(entityId: string): Promise<EntityOperations>;
  getComplianceOverview(entityId: string): Promise<ComplianceOverview>;
  getPendingActions(entityId: string): Promise<PendingAction[]>;
  getExpiringItems(entityId: string, withinDays: number): Promise<ExpirableItem[]>;
}
```

---

## Data Architecture

### Cross-Domain Data Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FOUNDATIONAL                                  │
│  ┌─────────────────┐                                                │
│  │  legal_entity   │◄──────────────────────────────────────────┐    │
│  │  (entity-gov)   │                                           │    │
│  └────────┬────────┘                                           │    │
└───────────┼────────────────────────────────────────────────────┼────┘
            │ entityId (FK)                                      │
┌───────────┼────────────────────────────────────────────────────┼────┐
│           │              OPERATIONAL                           │    │
│   ┌───────┴────────┬──────────────┬───────────────┐           │    │
│   ▼                ▼              ▼               ▼           │    │
│ ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌─────────────┐      │    │
│ │contracts │ │insurance │ │intellectual│ │data_privacy │      │    │
│ │          │ │_policies │ │_property   │ │_records     │      │    │
│ └────┬─────┘ └────┬─────┘ └─────┬──────┘ └──────┬──────┘      │    │
│      └────────────┴─────────────┴───────────────┘              │    │
│                          │                                     │    │
│                 ┌────────▼────────┐                            │    │
│                 │operational_audit│────────────────────────────┘    │
│                 └─────────────────┘                                 │
└─────────────────────────────────────────────────────────────────────┘
```

### Shared Operational Tables

```sql
-- Cross-domain document registry
CREATE TABLE operational_documents (
  id UUID PRIMARY KEY,
  domain VARCHAR(50) NOT NULL,
  domain_record_id UUID NOT NULL,
  entity_id UUID NOT NULL REFERENCES legal_entities(id),
  document_type VARCHAR(100) NOT NULL,
  title VARCHAR(500) NOT NULL,
  status document_status NOT NULL,
  storage_path VARCHAR(1000) NOT NULL,
  effective_date TIMESTAMPTZ,
  expiration_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cross-domain expiration tracking
CREATE TABLE operational_expirations (
  id UUID PRIMARY KEY,
  domain VARCHAR(50) NOT NULL,
  domain_record_id UUID NOT NULL,
  entity_id UUID NOT NULL REFERENCES legal_entities(id),
  item_type VARCHAR(100) NOT NULL,
  description VARCHAR(500) NOT NULL,
  expiration_date TIMESTAMPTZ NOT NULL,
  renewal_date TIMESTAMPTZ,
  auto_renew BOOLEAN DEFAULT FALSE,
  notification_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cross-domain compliance status
CREATE TABLE operational_compliance_status (
  id UUID PRIMARY KEY,
  entity_id UUID NOT NULL REFERENCES legal_entities(id),
  domain VARCHAR(50) NOT NULL,
  regulation VARCHAR(100) NOT NULL,
  status compliance_status NOT NULL,
  last_assessment TIMESTAMPTZ,
  next_assessment_due TIMESTAMPTZ,
  findings JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(entity_id, domain, regulation)
);
```

---

## API Patterns

### REST Conventions

```
# Domain-specific operations
GET    /{domain}/entities/{entityId}/{resources}
POST   /{domain}/entities/{entityId}/{resources}
GET    /{domain}/{resources}/{id}
PUT    /{domain}/{resources}/{id}
DELETE /{domain}/{resources}/{id}

# Cross-operational queries (via gateway)
GET    /operational/entities/{entityId}/overview
GET    /operational/entities/{entityId}/compliance
GET    /operational/entities/{entityId}/pending-actions
GET    /operational/entities/{entityId}/expiring?days=30
```

### Health Endpoints

All domains expose `/health` with dependency status including foundational services.

---

## Security

### Authorization

Cross-operational queries require entity-level authorization:

```typescript
interface OperationalPermission {
  entityId: string;
  userId: string;
  domains: string[];
  actions: ('read' | 'write' | 'admin')[];
}
```

### Data Classification

| Level | Description | Examples |
|-------|-------------|---------|
| Public | Publicly available | Some IP registrations |
| Internal | Business confidential | Most operational records |
| Confidential | Sensitive business data | Contract terms, policy limits |
| Restricted | Highly sensitive | Trade secrets, breach data |

---

## Observability

### Standard Metrics

```typescript
// All operational domains expose these metrics
operational_records_created_total{domain, entity_type}
operational_records_updated_total{domain, entity_type}
operational_state_transitions_total{domain, from_state, to_state}
operational_active_records{domain, entity_type}
operational_pending_actions{domain}
operational_expiring_items{domain, window}
```

### Distributed Tracing

All cross-operational requests propagate OpenTelemetry trace context through event metadata.

---

## Adding New Operational Domains

1. Implement base patterns: Entity scoping, document lifecycle, compliance integration
2. Define domain events: Lifecycle + integration events
3. Register with compliance: Map regulations to requirements
4. Add to workflow definitions: Include in relevant cross-domain workflows
5. Expose standard endpoints: Health, entity-scoped operations
6. Configure observability: Metrics, logging, tracing
7. Update documentation: README.md, this file
