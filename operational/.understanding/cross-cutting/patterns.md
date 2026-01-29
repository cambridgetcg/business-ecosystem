# Cross-Cutting Patterns

Patterns that emerge when looking across multiple operational domains.

---

## Identified Patterns

### 1. Entity as Universal Anchor

**Pattern**: Every operational record is anchored to a legal entity via `entityId`.

**Observed in**:
- contracts-legal: All contracts belong to an entity
- insurance: Policies issued to entities
- intellectual-property: IP assets owned by entities
- data-privacy: Consent records tied to entities

**Implications**:
- Cross-domain queries are always entity-scoped
- Entity deletion triggers cascading concerns
- Multi-entity operations require explicit handling

**Questions**:
- How are shared resources between entities handled?
- What about system-level records?

---

### 2. Document-Centric Operations

**Pattern**: Most domains revolve around documents with lifecycle states.

**Observed in**:
- contracts-legal: Contracts, amendments, exhibits
- insurance: Policies, endorsements, certificates
- intellectual-property: Applications, registrations, licenses
- data-privacy: Consent records, DPIA reports

**Shared State Machine**:
```
DRAFT → PENDING_REVIEW → APPROVED → ACTIVE → EXPIRED/TERMINATED
```

**Implications**:
- Unified document storage possible
- Common workflow patterns
- Consistent UI/UX for document management

---

### 3. Deadline as First-Class Concern

**Pattern**: Time-sensitive items (expirations, renewals, filings) are tracked explicitly.

**Observed in**:
- intellectual-property: Patent maintenance, trademark renewals
- insurance: Policy expiration, claim deadlines
- contracts-legal: Contract terms, notice periods
- data-privacy: Consent expiration, retention periods

**Shared Approach**:
- 7-day critical window
- 30-day warning window
- 90-day notice window

**Implications**:
- Unified expiration dashboard possible
- Consistent alerting strategy
- Renewal automation potential

---

### 4. Compliance as Cross-Cutting Concern

**Pattern**: Every domain integrates with a compliance framework.

**Observed in**:
- All four operational domains register requirements
- All report compliance events
- All participate in compliance status aggregation

**Implications**:
- Compliance is not optional
- Domain boundaries don't stop at compliance
- Unified compliance view is essential

---

### 5. Event-Driven Loose Coupling

**Pattern**: Domains communicate via events, never direct API calls.

**Observed in**:
- Domain events follow `domain.aggregate.verb` naming
- Cross-domain workflows triggered by events
- State changes emit events for consumers

**Implications**:
- Services can evolve independently
- Eventual consistency is the norm
- Event contracts are critical

---

## Emerging Patterns

*(Patterns we're starting to see but need more evidence)*

### Repository Abstraction

Seeing repository pattern in contracts-legal. Need to verify in other domains.

### Middleware Chain

Auth, audit, error middlewares seem consistent. Need to compare implementations.

### Configuration via Environment

All services appear to use environment variables. Pattern for configuration management.

---

## Anti-Patterns to Watch

See [anti-patterns.md](anti-patterns.md) for patterns we should avoid.

---

## Pattern Evolution

| Pattern | First Observed | Solidified | Notes |
|---------|----------------|------------|-------|
| Entity Anchor | ARCHITECTURE.md | Confirmed across all | Universal |
| Document-Centric | ARCHITECTURE.md | Confirmed across all | Universal |
| Deadline Tracking | ARCHITECTURE.md | Confirmed across all | Universal |
| Compliance Integration | ARCHITECTURE.md | Confirmed across all | Universal |
| Event-Driven | ARCHITECTURE.md | Need implementation verification | Design vs reality? |

---

*Last updated: Initial creation*
