# Saga Orchestration Patterns

**Research Date**: 2026-01-26  
**Knowledge Gap**: How to handle compensation when partial failures happen across domains

---

## Overview

The Saga design pattern maintains data consistency in distributed systems by coordinating transactions across multiple services. Unlike traditional two-phase commit (2PC), Saga doesn't hold locks across services, trading strong consistency for availability and scalability.

---

## Two Implementation Approaches

### 1. Orchestration (Recommended for this ecosystem)

A centralized Saga Orchestrator coordinates the workflow by invoking microservices in sequence.

```
┌─────────────┐
│ Orchestrator│
└──────┬──────┘
       │ 1. Command: CreateContract
       ▼
┌─────────────┐
│  Contracts  │ ──► Reply: Success
└─────────────┘
       │ 2. Command: AssessInsurance
       ▼
┌─────────────┐
│  Insurance  │ ──► Reply: Failure ──► Trigger Compensation
└─────────────┘
       │
       ▼ 3. Compensate: CancelContract
┌─────────────┐
│  Contracts  │
└─────────────┘
```

**Pros**:
- Better control and visibility
- Centralized error handling
- Easier to debug and trace

**Cons**:
- Single point of coordination
- Orchestrator must be highly available

### 2. Choreography

Services exchange events without a centralized controller. Each service publishes domain events that trigger actions in other services.

**Pros**:
- Loose coupling
- Better scalability
- No single point of failure

**Cons**:
- Harder to trace workflows
- Complex failure handling
- Difficult to understand overall flow

---

## Compensation Transactions

When a step fails, the saga executes compensating transactions to undo completed steps.

### Key Principles

1. **Every step must have a compensation action**
   ```typescript
   interface SagaStep {
     execute: () => Promise<void>;
     compensate: () => Promise<void>;  // REQUIRED
   }
   ```

2. **Compensation must be idempotent**
   - Running compensation multiple times should have the same effect as running it once
   - Use unique transaction IDs for deduplication

3. **Design for semantic undo, not technical undo**
   - A "CancelContract" is not deleting a row, it's a business action
   - Compensation creates new state (e.g., "CANCELLED") rather than reverting

### Transaction Types

| Type | Definition | Example |
|------|------------|---------|
| **Compensable** | Can be undone | Create draft contract |
| **Pivot** | Point of no return | Execute contract (no undo) |
| **Retryable** | Must succeed eventually | Send notification |

```
Compensable → Compensable → PIVOT → Retryable → Retryable
     ↑            ↑           │          │           │
     └────────────┴───────────┘          │           │
     Rollback possible here              └───────────┘
                                     Must complete (retry)
```

---

## Best Practices for Production

### 1. Ensure Idempotency

```typescript
// BAD: Not idempotent
async function createPayment(orderId: string) {
  await db.insert(payments, { orderId, amount: 100 });
}

// GOOD: Idempotent with unique constraint
async function createPayment(orderId: string, paymentId: string) {
  try {
    await db.insert(payments, { id: paymentId, orderId, amount: 100 });
  } catch (e) {
    if (isDuplicateKeyError(e)) {
      return; // Already processed
    }
    throw e;
  }
}
```

### 2. Maintain Saga State

```sql
CREATE TABLE saga_executions (
  id UUID PRIMARY KEY,
  saga_type VARCHAR(100) NOT NULL,
  state JSONB NOT NULL,
  current_step INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL, -- RUNNING, COMPENSATING, COMPLETED, FAILED
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE saga_step_results (
  id UUID PRIMARY KEY,
  saga_execution_id UUID REFERENCES saga_executions(id),
  step_index INTEGER NOT NULL,
  step_name VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL, -- PENDING, COMPLETED, FAILED, COMPENSATED
  result JSONB,
  error JSONB,
  executed_at TIMESTAMPTZ
);
```

### 3. Handle Isolation Issues

**Problem**: Concurrent sagas may read uncommitted data.

**Solutions**:
- **Pessimistic View**: Reorder steps so updates occur in retryable transactions
- **Reread Values**: Confirm data unchanged before making updates
- **Versioning**: Use optimistic concurrency control

### 4. Timeout Management

```typescript
const sagaConfig = {
  stepTimeout: 30_000,     // 30 seconds per step
  totalTimeout: 300_000,   // 5 minutes total
  retryPolicy: {
    maxAttempts: 3,
    backoffMs: 1000,
    maxBackoffMs: 30_000,
  },
};
```

---

## Application to Business Ecosystem

### Entity Onboarding Saga

```yaml
saga: entity-onboarding
steps:
  - id: create-contracts
    service: contracts-legal
    action: createStandardAgreements
    compensation: deleteStandardAgreements
    
  - id: assess-insurance
    service: insurance
    action: assessCoverageRequirements
    compensation: cancelAssessment
    dependsOn: [create-contracts]
    
  - id: privacy-assessment
    service: data-privacy
    action: initiatePrivacyAssessment
    compensation: cancelPrivacyAssessment
    dependsOn: [create-contracts]
    
  - id: ip-assignments  # PIVOT - no compensation possible
    service: intellectual-property
    action: createIPAssignments
    dependsOn: [assess-insurance, privacy-assessment]
    
  - id: notify-compliance  # RETRYABLE
    service: compliance
    action: notifyEntityOnboarded
    retryable: true
```

### Recommended Framework

For TypeScript/Node.js ecosystem, consider:
- **Temporal** - Durable workflow execution
- **Zeebe** - BPMN-based workflow engine
- **Custom Implementation** - Using outbox pattern + state machine

---

## Sources

- [Microservices.io - Saga Pattern](https://microservices.io/patterns/data/saga.html)
- [Temporal - Mastering Saga Patterns](https://temporal.io/blog/mastering-saga-patterns-for-distributed-transactions-in-microservices)
- [Microsoft Azure - Saga Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/saga)
- [ByteByteGo - Saga Pattern Demystified](https://blog.bytebytego.com/p/saga-pattern-demystified-orchestration)
- [Baeldung - Saga Pattern in Microservices](https://www.baeldung.com/cs/saga-pattern-microservices)
