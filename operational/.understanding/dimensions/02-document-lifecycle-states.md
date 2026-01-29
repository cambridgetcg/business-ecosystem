# Dimension 02: Document Lifecycle States

## What

All operational domains manage **documents with a unified lifecycle state machine**. Documents progress through predictable states from creation to completion/expiration.

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

## Why

A unified lifecycle enables:
- **Consistent UI/UX** across all document types
- **Cross-domain workflow patterns** (same triggers work everywhere)
- **Unified pending action tracking** ("all documents awaiting approval")
- **Standard audit events** (state transitions logged uniformly)

## How

### State Definitions

| State | Description | Allowed Transitions |
|-------|-------------|---------------------|
| `DRAFT` | Work in progress | PENDING_REVIEW |
| `PENDING_REVIEW` | Awaiting approval | APPROVED, REJECTED |
| `APPROVED` | Approved, not yet active | ACTIVE |
| `REJECTED` | Declined, needs revision | DRAFT |
| `ACTIVE` | Currently in effect | EXPIRED, TERMINATED |
| `EXPIRED` | Reached end date | (terminal) |
| `TERMINATED` | Manually ended | (terminal) |

### Domain-Specific Extensions

While the core states are universal, domains add specifics:

**contracts-legal**:
```
DRAFT → PENDING_REVIEW → IN_NEGOTIATION → PENDING_APPROVAL →
    PENDING_SIGNATURE → ACTIVE → SUSPENDED → TERMINATED/EXPIRED → ARCHIVED
```
Adds: IN_NEGOTIATION, PENDING_APPROVAL, PENDING_SIGNATURE, SUSPENDED, ARCHIVED, RENEWED

**intellectual-property (Patents)**:
```
draft → provisional → pending → published → granted → abandoned/expired/lapsed
```
Adds: provisional (for provisional patents), published (18-month publication), granted, abandoned, lapsed

**intellectual-property (Trademarks)**:
```
draft → pending → published → opposed → registered → cancelled/expired/abandoned
```
Adds: published (for opposition period), opposed, registered, cancelled

### State Transition Enforcement

States are enforced in domain methods, not services:

```typescript
// From contracts-legal
public submitForReview(): void {
  if (this.status !== 'DRAFT') {
    throw new ContractStatusError('Can only submit DRAFT contracts for review');
  }
  this.status = 'PENDING_REVIEW';
  this.addDomainEvent(new ContractSubmittedEvent(this.id));
}
```

### Cross-Domain Document Registry

Shared table for unified document tracking:

```sql
CREATE TABLE operational_documents (
  id UUID PRIMARY KEY,
  domain VARCHAR(50) NOT NULL,
  domain_record_id UUID NOT NULL,
  entity_id UUID NOT NULL REFERENCES legal_entities(id),
  document_type VARCHAR(100) NOT NULL,
  title VARCHAR(500) NOT NULL,
  status document_status NOT NULL,
  effective_date TIMESTAMPTZ,
  expiration_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL
);
```

## Where

- **ARCHITECTURE.md:42-91**: State machine documentation
- **contracts-legal/src/domain/*/service.ts**: State transition methods
- **intellectual-property/src/domain/entities/*.ts**: State enforcement in entities

## Connections

- [Entity-Scoped Operations](01-entity-scoped-operations.md): Documents belong to entities
- [Expiration and Renewal](05-expiration-renewal.md): Tracking expiring documents
- [Cross-Domain Events](03-cross-domain-events.md): State changes emit events

## Domain Mapping

| Domain | Document Types |
|--------|---------------|
| contracts-legal | Contracts, amendments, exhibits |
| insurance | Policies, endorsements, certificates |
| intellectual-property | Applications, registrations, licenses |
| data-privacy | Consent records, DPIA reports, breach notices |

## Open Questions

1. **State history tracking?** Is there a state_transitions table or just current state?
2. **Reason for transition?** Do we capture WHY something was rejected?
3. **Automatic state changes?** Are EXPIRED states triggered automatically or manually?
4. **Notification triggers?** Who gets notified on each state change?

---

*Understanding Level: DEEP*
*Well-documented pattern with domain-specific extensions*
