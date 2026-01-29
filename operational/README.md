# Operational Domain Layer

Activity-based business functions that leverage foundational infrastructure to perform specialized operations.

## Purpose

The `operational/` directory contains domains that represent **what the business DOES** - activities performed using the foundational entities and infrastructure. These are business operations that:

1. **Reference foundational entities** - All operational records belong to legal entities from `entity-governance`
2. **Execute business activities** - Contracts, insurance, IP management, privacy compliance
3. **Generate operational events** - Activities that trigger cross-domain workflows
4. **Have regulatory obligations** - Each domain has compliance requirements

## Operational vs Foundational

| Aspect | Foundational | Operational |
|--------|--------------|-------------|
| **Represents** | What the business IS | What the business DOES |
| **Examples** | Entities, accounts, tax IDs | Contracts, policies, patents |
| **Stability** | Rarely changes | Changes with business activity |
| **Dependency** | Referenced BY operational | References foundational |
| **Lifecycle** | Entity lifecycle (formation → dissolution) | Activity lifecycle (create → execute → expire) |

```
Operational domains DEPEND ON foundational domains
Foundational domains DO NOT depend on operational domains
```

## Current Domains

| Domain | Purpose | Key Integrations |
|--------|---------|------------------|
| `contracts-legal` | Contract lifecycle, legal operations | entity-governance, compliance, accounting |
| `data-privacy` | GDPR/CCPA compliance, privacy management | entity-governance, compliance, corporate-security |
| `insurance` | Policy and claims management | contracts-legal, entity-governance, accounting |
| `intellectual-property` | IP portfolio - patents, trademarks, copyrights | contracts-legal, entity-governance, compliance |

## Cross-Domain Patterns

All operational domains share these patterns:

### 1. Entity Ownership
Every operational record belongs to a legal entity:
```typescript
// All operational entities include
{
  entityId: string; // References entity-governance.legal-entity
  // ...domain-specific fields
}
```

### 2. Document Lifecycle
All domains manage documents with common lifecycle:
```
DRAFT → PENDING_REVIEW → APPROVED → ACTIVE → EXPIRED/TERMINATED
```

### 3. Regulatory Framework
All domains integrate with `compliance` for:
- Regulatory requirements mapping
- Audit trail generation
- Compliance calendar integration
- Remediation tracking

### 4. Audit Requirements
All mutations generate audit entries:
```typescript
{
  action: string;
  entityType: string;
  entityId: string;
  actor: string;
  timestamp: Date;
  changes: Record<string, { from: unknown; to: unknown }>;
}
```

## Cross-Operational Workflows

Many business processes span multiple operational domains:

### Entity Onboarding
```
entity-governance: Entity formed
    ↓
contracts-legal: Standard agreements created
    ↓
insurance: Coverage requirements assessed
    ↓
data-privacy: Privacy impact assessment
    ↓
intellectual-property: IP assignment agreements
```

### Contract Execution
```
contracts-legal: Contract signed
    ↓
insurance: Coverage verification
    ↓
compliance: Regulatory check
    ↓
accounting: Revenue recognition trigger
```

### IP Licensing
```
intellectual-property: License agreement drafted
    ↓
contracts-legal: Contract execution
    ↓
accounting: Royalty schedule setup
    ↓
compliance: Export control check
```

## Adding New Operational Domains

A domain belongs in `operational/` if it:

1. **Represents business activity**, not business structure
2. **References foundational entities** (never the reverse)
3. **Has a clear lifecycle** independent of entity lifecycle
4. **Generates events** consumed by other domains
5. **Has regulatory/compliance requirements**

### Creation Checklist

- [ ] Define domain purpose and boundaries
- [ ] Identify foundational dependencies
- [ ] Map compliance requirements
- [ ] Define integration events
- [ ] Add to this README
- [ ] Document in ARCHITECTURE.md

## Directory Structure

```
operational/
├── README.md                    # This file
├── ARCHITECTURE.md              # Cross-domain architectural patterns
├── .orchestration/              # Cross-operational coordination
│   ├── workflows/               # Multi-domain workflow definitions
│   ├── compliance/              # Operational compliance aggregation
│   └── reporting/               # Cross-operational reporting
├── contracts-legal/             # Contract lifecycle management
├── data-privacy/                # Privacy compliance management
├── insurance/                   # Insurance policy management
└── intellectual-property/       # IP portfolio management
```

## Events

Operational domains emit events consumed across the ecosystem:

```typescript
// From @ecosystem/events-legal
'contract.created' | 'contract.signed' | 'contract.executed'
'document.uploaded' | 'document.signature_requested'
'ip.trademark_filed' | 'ip.patent_granted'

// Cross-operational (from @ecosystem/events-operational)
'operational.entity_onboarded'      // All operational domains ready for entity
'operational.compliance_status'      // Aggregated compliance state
'operational.document_lifecycle'     // Cross-domain document state
```

## Queries

Cross-operational queries available:

| Query | Description | Domains Aggregated |
|-------|-------------|-------------------|
| `getEntityOperations(entityId)` | All operational records for entity | All |
| `getComplianceStatus(entityId)` | Aggregated compliance state | All |
| `getPendingDocuments(entityId)` | Documents awaiting action | contracts-legal, IP, insurance |
| `getExpiringItems(entityId, days)` | Items expiring within N days | contracts-legal, insurance, IP |

## Development

### Running All Operational Services
```bash
pnpm dev:operational
```

### Testing Cross-Domain Integration
```bash
pnpm test:integration --filter='./operational/**'
```

### Port Assignments
| Service | Port |
|---------|------|
| contracts-legal | 3011 |
| data-privacy | 3012 |
| insurance | 3013 |
| intellectual-property | 3014 |

## Key Decisions

1. **No direct cross-operational dependencies**: Operational domains communicate via events, not direct API calls
2. **Foundational as source of truth**: Entity, account, and compliance data always fetched from foundational
3. **Document storage centralized**: All domains use shared S3 bucket with domain-prefixed paths
4. **Compliance integration mandatory**: Every operational domain must integrate with `compliance`
