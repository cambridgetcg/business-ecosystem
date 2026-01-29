# LIGHT: Accumulated Insights

Synthesized understanding and key learnings from exploring the operational ecosystem.

---

## Core Architectural Insights

### 1. The Dependency Triangle

```
         FOUNDATIONAL
        (What business IS)
             │
             │ One-way dependency
             ▼
         OPERATIONAL
        (What business DOES)
             │
             │ Event coordination
             ▼
        ORCHESTRATION
       (How it coordinates)
```

**Insight**: The ecosystem respects a clear hierarchy. Foundational never knows about operational. Operational domains never call each other directly. Orchestration coordinates without owning business logic.

**Why this works**: Changes in one operational domain don't cascade. New domains can be added without modifying existing ones. Orchestration can be replaced or enhanced independently.

---

### 2. Implementation Asymmetry

| Domain | Implementation Status | Understanding Depth |
|--------|----------------------|---------------------|
| Contracts-Legal | Full implementation | Deep |
| Intellectual Property | Full implementation | Deep |
| Data Privacy | Scaffold only | Surface (docs exist) |
| Insurance | Scaffold only | Surface (docs exist) |
| Orchestration | Full implementation | Deep |
| Gateway | Full implementation | Deep |

**Insight**: The ecosystem has two fully-implemented operational domains and two well-documented-but-empty domains. The orchestration layer is complete.

**Implication**: Building data-privacy and insurance means greenfield development following established patterns, not modifying existing code.

---

### 3. The Research-Implementation Gap

Contracts-legal and IP domains have extensive research documentation identifying model gaps:

| Research Finding | Model Exists | Model Complete |
|-----------------|--------------|----------------|
| E-Signature requirements | No | - |
| Jurisdiction vs governing law | Partial | No |
| Legal discovery process | No | - |
| Patent families | No | - |
| Trade secrets | **No entity at all** | - |
| FRAND licensing | No | - |

**Insight**: Research identifies sophisticated legal/business nuances, but implementation is simpler. This creates technical debt awareness - we know what's missing.

**Value**: The research documents serve as a roadmap for enhancement, not just documentation of current state.

---

### 4. Patterns That Repeat

**Across all domains**:
- `entityId` as universal anchor
- Soft deletes (`deletedAt`) for legal defensibility
- Optimistic locking (`version`)
- Audit columns (`createdAt`, `updatedAt`, `createdBy`, `updatedBy`)
- Zod validation at boundaries
- Pino structured logging
- Status-based lifecycle management

**Insight**: Strong consistency in cross-cutting concerns makes the codebase navigable. Once you understand one domain's patterns, others follow.

---

### 5. Event-Driven, Not API-Driven

**What we see**:
- No domain-to-domain REST calls
- Events published on state changes
- Workflow engine subscribes and coordinates
- Gateway aggregates for queries

**Insight**: This is proper event-driven architecture, not just "we use events sometimes." The discipline enables loose coupling that actually works.

**Caveat**: Event ordering, exactly-once delivery, and saga compensation are complex. The simple model in documentation may hide operational complexity.

---

## Domain-Specific Insights

### Contracts-Legal

**Key insight**: Contracts are living documents, not static records. The obligation tracking, renewal workflows, and amendment patterns reflect this lifecycle thinking.

**Underappreciated complexity**: The difference between amendment and addendum isn't just nomenclature - it affects version lineage, supersession, and legal interpretation.

**Critical gap**: E-signature is legally complex (ESIGN Act, UETA requirements) but currently just a string reference.

---

### Intellectual Property

**Key insight**: IP is the most DDD-pure implementation. Aggregates have behavior, events are first-class, and the repository pattern is fully implemented.

**Underappreciated complexity**: Patent families (continuations, divisionals, CIP) create complex parent-child relationships not currently modeled.

**Critical gap**: Trade secrets don't exist as an entity. This is a significant IP type completely missing from the system.

---

### Data Privacy

**Key insight**: The domain is well-conceived in documentation but has zero implementation. It's a specification waiting for builders.

**Underappreciated complexity**: DSAR handling spans all domains. A deletion request affects contracts (party data), IP (inventor data), and any other place personal data lives.

**Critical gap**: Everything. But the documentation provides a solid starting point.

---

### Insurance

**Key insight**: Eight product subdomains reflect industry complexity. Insurance isn't one thing - it's many distinct coverage types with different rules.

**Underappreciated complexity**: Workers' compensation is state-by-state with mandatory coverage. The model must handle multi-state operations.

**Critical gap**: Carrier and broker integrations are undefined. Real insurance operations require external system connectivity.

---

### Orchestration

**Key insight**: This is the most complete layer. Workflow engine, compliance aggregator, reporting service, and gateway all work together.

**Underappreciated value**: The declarative YAML workflows enable business-readable process definitions. Non-engineers can understand what happens during entity onboarding.

**Strength**: Compensation (saga pattern) is built in from the start, not an afterthought.

---

## Cross-Cutting Insights

### 1. Time is First-Class

Multiple time-related patterns appear consistently:
- Expiration windows (7/30/90 days)
- Deadline tracking (DSAR 30 days, breach 72 hours)
- Renewal periods
- Effective/expiry dates
- Filing deadlines (patent, trademark)

**Insight**: Time-based operations are core to operational domains. The expiration tracking framework in orchestration reflects this importance.

---

### 2. Compliance is an Overlay

Compliance doesn't live in one domain. The compliance aggregator:
- Maps regulations to domain-specific requirements
- Aggregates status across domains
- Tracks findings from all sources

**Insight**: Regulatory compliance is cross-cutting by nature. The architecture treats it as aggregation, not ownership.

---

### 3. The Entity is the Anchor

Everything relates back to `entityId`:
- Contracts belong to entities
- Policies cover entities
- IP is owned by entities
- Privacy applies to entity processing

**Insight**: Entity-centric views (via gateway) work because entityId is universally present. This enables the "show me everything about Entity X" pattern.

---

## What We Still Don't Know

1. **Message queue implementation** - Events exist but transport is undefined
2. **Authentication across services** - Service-to-service auth patterns unclear
3. **External system integration** - How do carriers, brokers, USPTO connect?
4. **Human-in-the-loop workflows** - Approval gates in automation
5. **Cross-domain deletion** - GDPR erasure spanning systems
6. **Entity dissolution** - What happens when an entity dies?

---

## Recommendations

### For Builders

1. **Follow contracts-legal patterns** when implementing data-privacy
2. **Follow IP patterns** when building complex domain logic
3. **Use orchestration as reference** for cross-domain coordination
4. **Address research gaps** as enhancement opportunities

### For Architects

1. **Standardize on one ORM** - Prisma or Drizzle, not both
2. **Define message queue** - Events need a transport
3. **Design entity dissolution** - Major lifecycle gap
4. **Plan trade secret entity** - Critical IP type missing

### For Operations

1. **Implement distributed tracing** - Cross-domain debugging needs it
2. **Define SLAs per domain** - What's acceptable latency?
3. **Plan for partial failures** - Gateway handles it, but what about workflows?
