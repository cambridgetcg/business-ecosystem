# Cross-Domain Event Choreography

> Gap #07: Implementation plan identifies integration points but doesn't specify event sequences and failure recovery.

## Gap Identification

**Category**: Technical Integration
**Severity**: HIGH
**Blocks Implementation Phase(s)**: Phase 0 (Foundation), Phase 6 (Integration)

## Current State

Existing implementation plan covers:
- Events that each domain publishes (list of event types)
- Integration services that coordinate domains
- General concept of event-driven architecture

## What's Missing

Cannot build reliable cross-domain integrations because:

1. **Event Ordering**: When cap table changes, what sequence must events be published?
2. **Failure Handling**: If entity update succeeds but tax calculation fails, what happens?
3. **Idempotency**: How to make integrations safe if event published twice?
4. **Timing Constraints**: Which integrations are real-time vs batch?
5. **Consistency Model**: How long can domains be out of sync?

## Research Findings

### Saga Pattern: Two Approaches

From [Microsoft Azure Saga Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/saga):

```
CHOREOGRAPHY vs ORCHESTRATION:

┌─────────────────────────────────────────────────────────────────────────────┐
│                        CHOREOGRAPHY                                          │
│                                                                             │
│  Services exchange events without central controller                         │
│                                                                             │
│  ┌─────────┐  event   ┌─────────┐  event   ┌─────────┐                     │
│  │ Service │─────────▶│ Service │─────────▶│ Service │                     │
│  │    A    │          │    B    │          │    C    │                     │
│  └────┬────┘          └────┬────┘          └────┬────┘                     │
│       │                    │                    │                          │
│       │◀───────────────────┴────────────────────┘                          │
│       │         compensating events on failure                             │
│                                                                             │
│  PROS:                          CONS:                                       │
│  ├─ No single point of failure  ├─ Hard to trace full transaction          │
│  ├─ Services are decoupled      ├─ Cyclic dependencies possible            │
│  └─ Scales well                 └─ Complex failure handling                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        ORCHESTRATION                                         │
│                                                                             │
│  Central orchestrator controls sequence                                      │
│                                                                             │
│                    ┌─────────────┐                                          │
│                    │ Orchestrator│                                          │
│                    └──────┬──────┘                                          │
│              ┌────────────┼────────────┐                                    │
│              ▼            ▼            ▼                                    │
│         ┌─────────┐  ┌─────────┐  ┌─────────┐                              │
│         │ Service │  │ Service │  │ Service │                              │
│         │    A    │  │    B    │  │    C    │                              │
│         └─────────┘  └─────────┘  └─────────┘                              │
│                                                                             │
│  PROS:                          CONS:                                       │
│  ├─ Clear transaction flow      ├─ Single point of failure                 │
│  ├─ Easy to understand          ├─ Orchestrator coupling                   │
│  └─ Centralized rollback        └─ Orchestrator can become bottleneck      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Approach for Foundational Layer

From [AWS Saga Choreography](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/saga-choreography.html):

```
FOUNDATIONAL LAYER: HYBRID APPROACH

Use CHOREOGRAPHY for:
├─ Notifications (entity created → notify all domains)
├─ Read model updates (event triggers cache refresh)
└─ Audit logging (all events → audit service)

Use ORCHESTRATION for:
├─ Multi-step compliance workflows
├─ Financial transactions requiring atomicity
└─ Operations with compensating transactions

RATIONALE:
├─ Foundational domains have well-defined boundaries
├─ Entity governance is the "source of truth"
├─ Other domains REACT to entity events
└─ Financial operations need explicit control
```

### Event Ordering Specification

```
ENTITY GOVERNANCE → ALL DOMAINS

Event: EntityCreated
┌─────────────────────────────────────────────────────────────────────────────┐
│ PARALLEL REACTIONS (no ordering required):                                  │
│ ├─ Accounting: Create default chart of accounts                            │
│ ├─ Banking: Enable account opening                                         │
│ ├─ Tax: Create tax profile                                                 │
│ ├─ Compliance: Initialize compliance checklist                             │
│ └─ KYC: Create identity profile                                            │
└─────────────────────────────────────────────────────────────────────────────┘

Event: CapTableChanged
┌─────────────────────────────────────────────────────────────────────────────┐
│ SEQUENTIAL REACTIONS (ordering required):                                   │
│                                                                             │
│ Step 1: Entity Governance (internal)                                        │
│ └─ Update ownership records                                                 │
│                                                                             │
│ Step 2: Tax Service                                                         │
│ ├─ Recalculate CFC status                                                  │
│ ├─ Check if >50% US ownership                                              │
│ └─ Emit: CFCStatusEvaluated                                                │
│                                                                             │
│ Step 3: If CFCStatusEvaluated.changed = true                               │
│ ├─ Tax: Recalculate NCTI pro-rata                                          │
│ ├─ Accounting: Update intercompany accruals                                │
│ └─ Compliance: Update BOI if beneficial ownership changed                  │
│                                                                             │
│ Step 4: Entity Governance                                                   │
│ ├─ Check 409A material event trigger                                       │
│ └─ If triggered: Emit ValuationRequired                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Event: JournalEntryPosted (Intercompany)
┌─────────────────────────────────────────────────────────────────────────────┐
│ SEQUENTIAL REACTIONS:                                                       │
│                                                                             │
│ Step 1: Accounting (internal)                                               │
│ └─ Record entry, update balances                                           │
│                                                                             │
│ Step 2: Tax Service (if intercompany)                                      │
│ ├─ Validate against TP policy                                              │
│ └─ Emit: TPValidationResult                                                │
│                                                                             │
│ Step 3: If TPValidationResult.compliant = false                            │
│ ├─ Accounting: Flag entry for review                                       │
│ └─ Compliance: Create finding                                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Failure Handling: Compensating Transactions

From [Baeldung Saga Pattern](https://www.baeldung.com/cs/saga-pattern-microservices):

```
COMPENSATING TRANSACTIONS BY DOMAIN:

ENTITY GOVERNANCE:
├─ Original: CreateEntity
├─ Compensate: SoftDeleteEntity (mark as failed_creation)
│
├─ Original: UpdateEntity
├─ Compensate: RevertEntityChange (restore from audit log)
│
└─ CANNOT COMPENSATE: Hard delete (requires manual intervention)

ACCOUNTING:
├─ Original: PostJournalEntry
├─ Compensate: PostReversingEntry (never delete, always reverse)
│
├─ Original: ClosePeriod
├─ Compensate: ReopenPeriod (requires authorization)
│
└─ CANNOT COMPENSATE: Entries in hard-closed periods

BANKING-TREASURY:
├─ Original: InitiatePayment
├─ Compensate: CancelPayment (if not yet sent)
├─ Compensate: RequestRefund (if already sent)
│
├─ Original: ExecutePoolSweep
├─ Compensate: ReverseSweep (same-day only)
│
└─ CANNOT COMPENSATE: Completed external wire transfers

TAX:
├─ Original: RecordTaxProvision
├─ Compensate: AdjustProvision (via adjustment entry)
│
├─ Original: SubmitReturn
├─ Compensate: FileAmendedReturn
│
└─ CANNOT COMPENSATE: Past filing deadlines with penalties
```

### Saga Implementation Pattern

```typescript
// Saga Orchestrator for Multi-Domain Operations

interface SagaStep<T> {
  name: string;
  execute: (context: T) => Promise<StepResult>;
  compensate: (context: T) => Promise<void>;
  isCompensatable: boolean;
}

interface SagaDefinition<T> {
  name: string;
  steps: SagaStep<T>[];
  onComplete: (context: T) => Promise<void>;
  onFailure: (context: T, failedStep: string, error: Error) => Promise<void>;
}

// Example: CFC Status Change Saga
const cfcStatusChangeSaga: SagaDefinition<CFCChangeContext> = {
  name: 'CFC_STATUS_CHANGE',
  steps: [
    {
      name: 'update_ownership',
      execute: async (ctx) => entityService.updateOwnership(ctx.change),
      compensate: async (ctx) => entityService.revertOwnership(ctx.change),
      isCompensatable: true,
    },
    {
      name: 'evaluate_cfc_status',
      execute: async (ctx) => taxService.evaluateCFCStatus(ctx.entityId),
      compensate: async (ctx) => { /* Read-only, no compensation needed */ },
      isCompensatable: false,
    },
    {
      name: 'recalculate_ncti',
      execute: async (ctx) => taxService.recalculateNCTI(ctx.entityId, ctx.taxYear),
      compensate: async (ctx) => taxService.revertNCTICalculation(ctx.calculationId),
      isCompensatable: true,
    },
    {
      name: 'update_accounting_accruals',
      execute: async (ctx) => accountingService.updateIntercompanyAccruals(ctx.entityId),
      compensate: async (ctx) => accountingService.postReversingEntry(ctx.accrualEntryId),
      isCompensatable: true,
    },
    {
      name: 'check_boi_update',
      execute: async (ctx) => complianceService.checkBOIUpdateRequired(ctx.entityId),
      compensate: async (ctx) => { /* Check only, no compensation */ },
      isCompensatable: false,
    },
  ],
  onComplete: async (ctx) => {
    await auditService.logSagaCompletion('CFC_STATUS_CHANGE', ctx);
  },
  onFailure: async (ctx, failedStep, error) => {
    await auditService.logSagaFailure('CFC_STATUS_CHANGE', ctx, failedStep, error);
    await alertService.notifyOperations('CFC status change failed', ctx, error);
  },
};
```

### Idempotency Design

From [ByteByteGo Saga Pattern](https://blog.bytebytego.com/p/saga-pattern-demystified-orchestration):

```
IDEMPOTENCY REQUIREMENTS:

1. EVENT DEDUPLICATION
   ├─ Every event has unique eventId (UUID)
   ├─ Consumers track processed eventIds
   ├─ Duplicate events are acknowledged but not reprocessed
   └─ Deduplication window: 7 days (configurable)

2. IDEMPOTENT OPERATIONS
   ├─ Use idempotency keys for mutations
   ├─ Return same result for same key
   └─ Key format: {entityId}-{operation}-{timestamp}

3. OUTBOX PATTERN
   ├─ Write event to outbox table in same transaction as mutation
   ├─ Separate process publishes from outbox
   ├─ Ensures exactly-once semantics
   └─ Handles publisher failures gracefully

IMPLEMENTATION:

interface Event {
  eventId: string;      // UUID, unique per event
  eventType: string;
  aggregateId: string;  // Entity this relates to
  idempotencyKey: string;
  timestamp: Date;
  payload: unknown;
  metadata: {
    correlationId: string;  // Track related events
    causationId: string;    // What caused this event
    version: number;        // For optimistic concurrency
  };
}

// Consumer deduplication
async function handleEvent(event: Event): Promise<void> {
  // Check if already processed
  const processed = await eventStore.isProcessed(event.eventId);
  if (processed) {
    logger.info('Duplicate event, skipping', { eventId: event.eventId });
    return; // Acknowledge but don't process
  }

  // Process event
  await processEventLogic(event);

  // Mark as processed
  await eventStore.markProcessed(event.eventId);
}
```

### Timing Constraints

```
TIMING REQUIREMENTS BY INTEGRATION:

REAL-TIME (< 1 second):
├─ Entity status → Banking (account holds)
├─ Payment initiation → Accounting (pending entry)
├─ Fraud detection → Payment blocking
└─ Security events → Access revocation

NEAR-REAL-TIME (< 5 minutes):
├─ Cap table changes → CFC status evaluation
├─ Ownership changes → BOI update check
├─ Journal entry → TP validation
└─ Bank statement → Reconciliation

BATCH (Daily):
├─ Cash pool sweeps → IC loan entries
├─ Interest calculations → Accrual entries
├─ FX rate updates → Revaluation entries
└─ Reconciliation completion → Exception reports

PERIODIC (Weekly/Monthly):
├─ Financial statement generation
├─ Tax provision calculations
├─ Compliance report generation
└─ Veil health assessments
```

### Consistency Model

```
EVENTUAL CONSISTENCY WINDOWS:

ENTITY → ACCOUNTING:
├─ Maximum drift: 1 business day
├─ Reconciliation: Daily entity-GL sync
└─ Alert: If entity exists without GL accounts > 24h

ACCOUNTING → BANKING:
├─ Maximum drift: 1 business day (for reconciliation)
├─ Reconciliation: Daily bank-GL match
└─ Alert: If unmatched items > 24h

ENTITY → TAX:
├─ Maximum drift: 30 days (quarterly provisions)
├─ Reconciliation: Quarterly tax sync
└─ Alert: If CFC status stale > 30 days

ENTITY → COMPLIANCE:
├─ Maximum drift: 24 hours (BOI changes)
├─ Reconciliation: Daily ownership sync
└─ Alert: If beneficial ownership change not reflected in BOI
```

## Implementation Implications

### Event Infrastructure Schema

```typescript
// Event Store Tables
export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().unique(),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  aggregateType: varchar('aggregate_type', { length: 100 }).notNull(),
  aggregateId: uuid('aggregate_id').notNull(),
  payload: jsonb('payload').notNull(),
  metadata: jsonb('metadata').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const eventOutbox = pgTable('event_outbox', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull(),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  payload: jsonb('payload').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  publishedAt: timestamp('published_at'),
  retryCount: integer('retry_count').default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const processedEvents = pgTable('processed_events', {
  eventId: uuid('event_id').primaryKey(),
  consumerName: varchar('consumer_name', { length: 100 }).notNull(),
  processedAt: timestamp('processed_at').notNull().defaultNow(),
});

export const sagaInstances = pgTable('saga_instances', {
  id: uuid('id').primaryKey().defaultRandom(),
  sagaType: varchar('saga_type', { length: 100 }).notNull(),
  correlationId: uuid('correlation_id').notNull(),
  currentStep: varchar('current_step', { length: 100 }),
  status: varchar('status', { length: 20 }).notNull(),
  context: jsonb('context').notNull(),
  completedSteps: jsonb('completed_steps'),
  startedAt: timestamp('started_at').notNull(),
  completedAt: timestamp('completed_at'),
});
```

## Outstanding Questions

1. **Event Ordering Guarantees**: Do we need strict ordering within an aggregate, or is causal ordering sufficient?
2. **Dead Letter Handling**: When events fail after max retries, what manual intervention process?
3. **Schema Evolution**: How to handle event schema changes without breaking consumers?

## Sources

- [Microsoft Azure: Saga Design Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/saga)
- [AWS: Saga Choreography Pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/saga-choreography.html)
- [Microservices.io: Saga Pattern](https://microservices.io/patterns/data/saga.html)
- [Baeldung: Saga Pattern in Microservices](https://www.baeldung.com/cs/saga-pattern-microservices)
- [ByteByteGo: Saga Pattern Demystified](https://blog.bytebytego.com/p/saga-pattern-demystified-orchestration)

---

*Research conducted: January 2026*
*Gap identified in: Mission-requirement analysis - Phase 0 needs event infrastructure design*
