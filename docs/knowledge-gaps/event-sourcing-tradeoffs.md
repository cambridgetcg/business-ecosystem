# Event Sourcing Trade-offs

**Research Date**: 2026-01-26  
**Knowledge Gap**: When to use Event Sourcing vs CRUD, and projection rebuilding costs

---

## Overview

Event Sourcing persists state as a sequence of events rather than current state. Combined with CQRS (Command Query Responsibility Segregation), it provides powerful audit, replay, and temporal query capabilities—at significant complexity cost.

---

## When to Use Event Sourcing

### Strong Use Cases

| Scenario | Why Event Sourcing Fits |
|----------|------------------------|
| **Financial Systems** | Need complete transaction history, not just balances |
| **Healthcare/Legal** | Regulatory requirement for complete audit trails |
| **Compliance-Critical** | When "what happened" matters more than "current state" |
| **Complex Business Processes** | Need to replay, debug, or analyze decision chains |
| **Temporal Queries** | "What was the state at time X?" |
| **Multi-projection Systems** | Same events power different read models |

### The Business Ecosystem Fit

Given our mission of **compliance by design** and **auditability above all**, Event Sourcing aligns well for:
- Entity governance (corporate actions history)
- Compliance domain (finding → remediation chain)
- Contract lifecycle (negotiation → execution → amendment history)
- Data privacy (consent grant/withdraw chain)

---

## When NOT to Use Event Sourcing

### Poor Use Cases

| Scenario | Why CRUD is Better |
|----------|-------------------|
| **Reference/Static Data** | Product catalogs, country lists, config |
| **Simple CRUD Operations** | No business value in history |
| **High Write Volume + Simple Reads** | Projection overhead not justified |
| **Small Teams** | Operational complexity too high |
| **Rapid Prototyping** | Adds friction to iteration |

### The Ecosystem Anti-patterns

Avoid Event Sourcing for:
- Static configuration data
- Lookup tables
- Simple counters/metrics
- Data with no audit requirement

---

## Trade-offs Deep Dive

### Complexity Costs

```
┌─────────────────────────────────────────────────────────────┐
│                    EVENT SOURCED SYSTEM                      │
│                                                              │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐    │
│  │ Event Store  │   │  Projector   │   │ Read Models  │    │
│  │              │──►│              │──►│              │    │
│  │ Append-only  │   │ Rebuild on   │   │ Multiple     │    │
│  │ immutable    │   │ schema change│   │ per use case │    │
│  └──────────────┘   └──────────────┘   └──────────────┘    │
│         │                  │                   │            │
│         │                  │                   │            │
│         ▼                  ▼                   ▼            │
│   [Event Schema]    [Projection]        [Query Schema]      │
│   [Versioning]      [Rebuilding]        [Eventual Consistency]
│                                                              │
│                    MORE MOVING PARTS                         │
└─────────────────────────────────────────────────────────────┘

vs.

┌─────────────────────────────────────────────────────────────┐
│                       CRUD SYSTEM                            │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    DATABASE                           │   │
│  │            (Single source of truth)                   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│                    SIMPLER TO OPERATE                        │
└─────────────────────────────────────────────────────────────┘
```

### Storage Growth

Event stores grow unbounded (by design):

```
Traditional DB:  1 row per entity = O(entities)
Event Store:     N events per entity = O(entities × events)

Example: 100,000 contracts, 50 events each
- CRUD: 100,000 rows
- Event Sourcing: 5,000,000 event records
```

**Mitigation**: Snapshots reduce rehydration time but add complexity.

### Eventual Consistency

```
Write ──► Event Store ──► Projector ──► Read Model
                              │
                              └─── DELAY (ms to seconds)

User writes then immediately reads: might see stale data
```

**Mitigation**: 
- Read-your-writes consistency (query event store for recent)
- Synchronous projections (trade-off: slower writes)

---

## Projection Rebuilding

### When Projections Need Rebuilding

1. **Bug fix in projection logic**
2. **New field/calculation needed**
3. **New read model required**
4. **Data migration**

### Rebuilding at Scale

```typescript
// Naive approach - memory issues at scale
async function rebuildProjection() {
  const allEvents = await eventStore.getAllEvents(); // 5M events = OOM
  for (const event of allEvents) {
    await projector.apply(event);
  }
}

// Production approach - stream processing
async function rebuildProjection() {
  let cursor = null;
  while (true) {
    const batch = await eventStore.getEvents({ 
      after: cursor, 
      limit: 1000 
    });
    
    if (batch.length === 0) break;
    
    await projector.applyBatch(batch);
    cursor = batch[batch.length - 1].id;
    
    // Checkpoint for resumability
    await saveCheckpoint(cursor);
  }
}
```

### Parallel Rebuilding (Advanced)

```
Stream 1: Events 0-1M ────► Projector ────┐
Stream 2: Events 1M-2M ───► Projector ────┼──► Merged Read Model
Stream 3: Events 2M-3M ───► Projector ────┘

Requires: Events partitionable by aggregate ID
```

---

## Hybrid Approaches

### CRUD + Event Log (Recommended Starting Point)

```typescript
async function updateContract(id: string, changes: Partial<Contract>) {
  await db.transaction(async (tx) => {
    // 1. Update current state (source of truth)
    await tx.update(contracts, { id }, changes);
    
    // 2. Log event (for audit, NOT source of truth)
    await tx.insert(contractEvents, {
      contractId: id,
      eventType: 'contract.updated',
      payload: changes,
      occurredAt: new Date(),
    });
  });
}
```

**Pros**:
- Simple mental model
- Audit trail for free
- Easy queries (no projection lag)

**Cons**:
- Event log is secondary (can drift)
- Can't rebuild state from events

### Full Event Sourcing for Critical Domains Only

```
┌─────────────────────────────────────────────────────────────┐
│                    BUSINESS ECOSYSTEM                        │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │     EVENT SOURCED                                      │  │
│  │     - Entity Governance (corporate actions)            │  │
│  │     - Compliance (audit-critical)                      │  │
│  │     - Contract Lifecycle (legal requirement)           │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │     CRUD + EVENT LOG                                   │  │
│  │     - Insurance (current coverage matters most)        │  │
│  │     - IP (registration state-focused)                  │  │
│  │     - Banking/Treasury (financial systems separate)    │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │     PURE CRUD                                          │  │
│  │     - Reference data                                   │  │
│  │     - Configuration                                    │  │
│  │     - Lookup tables                                    │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## CQRS Without Event Sourcing

CQRS can provide benefits without full event sourcing:

```typescript
// Write Model: Rich domain logic
class ContractAggregate {
  private state: ContractState;
  
  execute(command: ContractCommand): void {
    // Validate, apply business rules
  }
  
  save(): Promise<void> {
    return this.repository.save(this.state);  // CRUD save
  }
}

// Read Model: Optimized for queries
interface ContractReadModel {
  id: string;
  summary: string;
  partyNames: string[];  // Denormalized for display
  statusForDashboard: string;
}
```

---

## Decision Framework

```
┌─────────────────────────────────────────────────────────────┐
│                   DO I NEED EVENT SOURCING?                  │
│                                                              │
│  1. Is complete history a business/legal requirement?        │
│     NO ──► CRUD or CRUD+EventLog                            │
│     YES ──► Continue                                         │
│                                                              │
│  2. Do I need to query "state at time X"?                   │
│     NO ──► CRUD+EventLog might suffice                      │
│     YES ──► Event Sourcing likely beneficial                │
│                                                              │
│  3. Do I need multiple projections of the same data?        │
│     NO ──► Consider simpler approach                        │
│     YES ──► Event Sourcing shines here                      │
│                                                              │
│  4. Can my team handle the operational complexity?          │
│     NO ──► Start with CRUD+EventLog, evolve later           │
│     YES ──► Event Sourcing is viable                        │
│                                                              │
│  5. Is eventual consistency acceptable?                      │
│     NO ──► Event Sourcing adds friction                     │
│     YES ──► Event Sourcing is viable                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Sources

- [Microsoft Azure - Event Sourcing Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing)
- [JavaCodeGeeks - Event Sourcing vs CRUD](https://www.javacodegeeks.com/2025/12/event-sourcing-vs-crud-rethinking-data-persistence-in-enterprise-systems.html)
- [BayTech - Event Sourcing Explained: Pros, Cons & Strategic Use Cases](https://www.baytechconsulting.com/blog/event-sourcing-explained-2025)
- [Event Store - Event Sourcing and CQRS](https://www.kurrent.io/blog/event-sourcing-and-cqrs)
- [Ashraf Mageed - Lessons from the Trenches: CQRS and Event Sourcing](https://www.ashrafmageed.com/cqrs-eventsourcing-and-the-cost-of-tooling-constraints/)
