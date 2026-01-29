# Dimension 10: Contracts-Legal Domain

## What

The contracts-legal service is a domain-driven microservice managing the complete contract lifecycle and legal operations. It serves as the **central nervous system for contractual relationships** - tracking agreements, parties, obligations, and legal matters.

**Location**: `/contracts-legal`
**Port**: 3011
**Framework**: Hono + Prisma + PostgreSQL

## Why

Contracts are living documents with ongoing obligations, not static filed-away PDFs. The domain exists to:
- Track multi-party agreements with signature workflows
- Manage obligations with due dates and reminders
- Maintain complete audit trails for legal defensibility
- Enable template-based contract generation for speed without sacrificing control

## How

### Architecture Layers

```
API Layer (Hono)
    ↓
Middleware Stack (requestId → cors → requestLogger → errorHandler → auditTrail → auth)
    ↓
Domain Layer (7 subdomains with validators → repository → service pattern)
    ↓
Data Layer (Prisma + PostgreSQL + S3 Documents + KMS Encryption)
```

### Subdomains

| Subdomain | Status | Purpose |
|-----------|--------|---------|
| customer-contracts | Implemented | Revenue-generating customer agreements |
| vendor-contracts | Implemented | Procurement and vendor services |
| employment-agreements | Implemented | Workforce contracts with compensation |
| contract-templates | Implemented | Standardized pre-approved formats |
| litigation | Implemented | Legal matters and dispute tracking |
| real-estate | Implemented | Property portfolio management |
| legal-operations | Implemented | Cross-cutting notifications, audit, dashboards |
| contract-lifecycle | **STUB** | Empty - cross-cutting lifecycle operations |

### Contract Lifecycle States

```
DRAFT → PENDING_REVIEW → IN_NEGOTIATION → PENDING_APPROVAL → PENDING_SIGNATURE → ACTIVE
                                                                                    ↓
                                              SUSPENDED ←──────────────────────────┘
                                                   ↓                               ↓
                                              (resumed)                       TERMINATED
                                                   ↓                               ↓
                                                ACTIVE → EXPIRED → RENEWED ────────┘
                                                   ↓
                                              ARCHIVED
```

### Key Patterns

1. **Factory Functions for DI**: `createCustomerContractService(repository)` - explicit, traceable dependencies
2. **Zod Validation**: Runtime type checking at API boundaries
3. **Soft Deletes**: Contracts never hard-deleted for legal defensibility
4. **Event-Driven Integration**: Emits events via EventBridge, no direct API calls to peers

## Where

| Component | Path |
|-----------|------|
| Entry Point | `contracts-legal/src/index.ts` |
| Domain Logic | `contracts-legal/src/domain/{subdomain}/` |
| Prisma Schema | `contracts-legal/prisma/schema.prisma` |
| Research Docs | `contracts-legal/docs/research/` |

## Connections

**Depends On**:
- entity-governance: Legal entities that own contracts
- accounting: Revenue recognition, payment tracking
- compliance: Regulatory requirements, audit framework

**Peers**:
- insurance: Policy coverage for contractual risks
- intellectual-property: IP assignments, licensing agreements
- data-privacy: Data processing agreements

**Events Published**:
- `contract.created` → Coverage assessment, compliance check
- `contract.signed` → Revenue recognition, obligation tracking
- `contract.expiring` → Renewal workflow, notifications
- `matter.opened` → Risk assessment, executive alerting

## Open Questions

1. **contract-lifecycle stub**: Why is this empty when it's listed as a domain?
2. **No tests exist**: Despite Vitest configuration, no tests are written
3. **Revenue Recognition gap**: Research doc 06 identified ASC 606 compliance issues not yet implemented
4. **E-signature integration**: Roadmap item, not yet implemented

## Research Topics Covered

The domain has 8 exceptional research documents identifying implementation gaps:

| # | Topic | Key Gap Found |
|---|-------|---------------|
| 01 | E-Signature Legal Requirements | `signatureRef: String?` too vague - need full consent capture |
| 02 | Jurisdiction vs Governing Law | Two distinct concepts, only one modeled |
| 03 | Non-Compete Enforceability | State-by-state rules not captured |
| 04 | Legal Discovery Process | EDRM phases not implemented |
| 05 | Amendment vs Addendum | Different workflows needed |
| 06 | Revenue Recognition (ASC 606) | Revenue on performance, not signing |
| 07 | Force Majeure Clauses | Not modeled at all (COVID exposed gap) |
| 08 | Material Breach vs Substantial Performance | Breach/cure tracking needed |

## Curiosities

- **Research quality is exceptional**: Proper legal citations from law firms, LII, and professional organizations
- **"Become Water" methodology**: Examining code with fresh eyes to find gaps
- **IAM Authentication Ready**: Production-ready AWS RDS IAM authentication support
- **Variable substitution in templates**: `{{variable}}` syntax with validation

---

*Understanding Level: SOLID*
*Gaps: contract-lifecycle stub, no tests, research recommendations unimplemented*
