# Dimension 15: Intellectual Property Domain

## What

The IP service manages the complete lifecycle of intellectual property assets: patents, trademarks, copyrights, trade secrets, licenses, and domain names. It serves as the **single source of truth** for IP portfolio management with a mission of 100% deadline compliance.

**Location**: `/intellectual-property`
**Port**: 3014
**Framework**: Fastify + Drizzle ORM + PostgreSQL

## Why

IP assets have lifecycles with critical deadlines - missing a deadline can mean losing rights forever. The domain exists to:
- Protect innovation through proper registration and maintenance
- Track complete lifecycles from creation through expiration
- Enable licensing monetization and strategic deployment
- Ensure filing deadlines, renewal schedules, and regulatory requirements are met

## How

### Architecture - CQRS Pattern

This is the **only domain using CQRS** (Command Query Responsibility Segregation):

```
API Layer (Fastify)
    ↓
Application Layer
    ├── Commands (writes + events)
    │   ├── CreatePatentCommand
    │   ├── FilePatentCommand
    │   └── GrantPatentCommand
    │
    └── Queries (reads + caching)
        ├── GetPatentQuery
        ├── ListPatentsQuery
        └── GetExpiringPatentsQuery
    ↓
Domain Layer (Aggregate Roots with Domain Events)
    ├── Patent (with claims, inventors)
    ├── Trademark (with Nice classes)
    ├── Copyright (with work types)
    └── License (cross-cuts all IP)
    ↓
Infrastructure Layer
    ├── Persistence (Drizzle ORM)
    └── Cache (Redis/In-memory fallback)
```

### Why CQRS Here?

- IP assets are **read-heavy** (portfolio queries, reporting)
- But writes are **critical** (missing a filing = lost rights)
- Clear audit trail needed for legal defense
- Natural fit for event sourcing readiness

### IP Types Managed

| Type | Status | Key States |
|------|--------|------------|
| Patents | Implemented | draft → provisional → pending → published → granted |
| Trademarks | Implemented | draft → pending → published → opposed → registered |
| Copyrights | Implemented | unregistered → pending → registered → disputed |
| Trade Secrets | **NOT IMPLEMENTED** | Entity doesn't exist despite LICENSE referencing it |
| Licenses | Implemented | draft → active → terminated → expired |
| Domain Names | **Planned but not implemented** | |

### Domain Events Pattern

```typescript
interface DomainEvent<T> {
  id: string;
  type: string;           // e.g., "ip.patent.filed"
  aggregateId: string;
  aggregateType: string;  // "Patent", "Trademark", etc.
  payload: T;
  metadata: EventMetadata;
  occurredAt: Date;
}
```

Events are collected during domain operations and "pulled" after persistence for eventual publishing.

## Where

| Component | Path |
|-----------|------|
| Entry Point | `intellectual-property/src/index.ts` |
| Commands | `intellectual-property/src/application/commands/` |
| Queries | `intellectual-property/src/application/queries/` |
| Domain Entities | `intellectual-property/src/domain/entities/` |
| Routes | `intellectual-property/src/api/rest/routes/` |
| Drizzle Schema | `intellectual-property/src/infrastructure/persistence/schema.ts` |
| Research Docs | `intellectual-property/research/` |

## Connections

**Depends On**:
- entity-governance: IP ownership follows corporate structure
- contracts-legal: License agreements flow from contract execution
- compliance: Filing deadlines, regulatory requirements
- accounting: IP asset capitalization, royalty revenue

**Events Published**:
- `ip.patent.filed` → Compliance, Accounting
- `ip.patent.granted` → Accounting, Entity Governance
- `ip.trademark.registered` → Compliance, Entity Governance
- `ip.license.granted` → Accounting, Contracts-Legal

## Open Questions

### Critical Gaps

1. **Trade Secret entity missing**: License references `trade_secret` as IP type but no entity exists
2. **Deadline management incomplete**: 100% compliance goal, but no maintenance fee tracking, Section 8/9 tracking, or PCT deadline tracking
3. **International filing not supported**: No PCT workflow for patents, no Madrid Protocol for trademarks
4. **Routes don't use CQRS handlers**: API routes create repositories directly instead of using command/query handlers

### Significant Gaps

5. **Patent family relationships**: No continuation/divisional/CIP relationships or priority chains
6. **Copyright duration calculation**: Duration varies by authorship type but model doesn't calculate expiration
7. **No tests exist**: Despite service being most architecturally sophisticated

## Research Topics (11 Documents)

| Topic | Key Insight |
|-------|-------------|
| Patent Families | Patents exist in family trees - no parent-child relationships modeled |
| PCT Filing | International workflow with specific timelines - no PCT phase tracking |
| Maintenance Fees | Complex payment windows with entity-size pricing - no fee tracking |
| Trademark Use | Must prove use in commerce - no use-per-class tracking |
| Madrid Protocol | 5-year dependency, central attack risk - no international support |
| Copyright Duration | Life+70 vs 95/120 rules - duration not calculated |
| FRAND Licensing | SEP obligations, court-set rates - no FRAND indicators |
| **Trade Secrets** | **Reasonable measures required, DTSA compliance - NO ENTITY AT ALL** |
| Domain Disputes | UDRP vs ACPA, bad faith factors - no implementation |
| IP Valuation | Income/Market/Cost approaches - no valuation framework |
| FTO Analysis | Freedom to operate workflow - no FTO entity |

## Interesting Patterns

### Aggregate Root with Domain Events
```typescript
export abstract class AggregateRoot extends Entity {
  private _domainEvents: DomainEvent[] = [];

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  public pullDomainEvents(): DomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents = [];
    return events;
  }
}
```

### Entity State Machine Enforcement
State transitions enforced in domain methods, not services:
```typescript
public file(applicationNumber: string, filingDate: Date): void {
  if (this.props.status !== 'draft' && this.props.status !== 'provisional') {
    throw new Error('Can only file patents in draft or provisional status');
  }
  // ... proceed
}
```

### Cache Key Builders
Centralized cache key generation for consistency:
```typescript
export const CacheKeys = {
  patent: {
    byId: (id: string) => `patent:${id}`,
    list: (filters: string) => `patents:list:${filters}`,
  }
};
```

---

*Understanding Level: SOLID*
*Gaps: Trade secret entity missing, deadline tracking incomplete, routes bypass CQRS*
