# Dimension 43: Audit Trail Patterns

**Discovery Source**: Phase 1 Implementation - Activity Log Pattern in DSAR/Breach
**Understanding Level**: ENABLED
**Last Updated**: January 27, 2026

---

## Aha Moment

> The "Activity" tables (DSARActivity, BreachActivity) aren't just logging - they ARE the audit trail. Every state transition creates an Activity record in the same transaction. The audit trail is a **first-class domain concept**, not an afterthought logging concern.

---

## What This Is

The pattern of tracking all meaningful actions through Activity records:
- Embedded in the domain model (not separate logging)
- Created in the same transaction as state changes
- Immutable record of WHO did WHAT and WHEN
- Supports regulatory compliance (GDPR accountability)

---

## Mental Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AUDIT TRAIL AS DOMAIN CONCEPT                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TRADITIONAL LOGGING                  ACTIVITY PATTERN                     │
│  (Separate concern)                   (Domain-embedded)                    │
│                                                                             │
│  ┌──────────────┐                    ┌──────────────┐                      │
│  │   Entity     │                    │   Entity     │                      │
│  │  (state A)   │                    │  (state A)   │                      │
│  └──────┬───────┘                    └──────┬───────┘                      │
│         │                                   │                              │
│         │ update()                          │ update() + createActivity()  │
│         │                                   │ ◄── SAME TRANSACTION         │
│         ▼                                   ▼                              │
│  ┌──────────────┐                    ┌──────────────┐                      │
│  │   Entity     │                    │   Entity     │──┐                   │
│  │  (state B)   │                    │  (state B)   │  │                   │
│  └──────────────┘                    └──────────────┘  │                   │
│         │                                              │                   │
│         │ separate log call                            │                   │
│         │ (can fail silently)                          ▼                   │
│         ▼                                   ┌──────────────────┐           │
│  ┌──────────────┐                           │    Activity      │           │
│  │  Log File/   │                           │  (type, who,     │           │
│  │  Log Table   │                           │   when, what)    │           │
│  └──────────────┘                           └──────────────────┘           │
│         │                                              │                   │
│         │ ← May be lost                                │ ← NEVER lost     │
│         │   (crash between)                            │   (atomic)       │
│         │ ← May be out of sync                         │ ← Always in sync │
│         │ ← Separate query                             │ ← include: {...} │
│                                                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Concepts

### 1. Transactional Consistency

The activity is created in the SAME database transaction as the state change:

```typescript
// WRONG: Two separate operations
await prisma.dSARRequest.update({ ... });
await prisma.dSARActivity.create({ ... }); // Can fail independently!

// RIGHT: Single atomic operation
await prisma.dSARRequest.update({
  where: { id },
  data: {
    status: 'VERIFIED',
    activities: {
      create: {
        type: 'VERIFIED',
        description: 'Identity verified via ID_DOCUMENT',
        performedBy: 'user-123',
      },
    },
  },
});
```

**Why**: If the update succeeds but activity creation fails, you have:
- An action without audit trail (compliance violation)
- State that changed without record

### 2. Activity as Evidence

For regulatory compliance, the Activity record is LEGAL EVIDENCE:

```prisma
model DSARActivity {
  id          String   @id @default(cuid())
  dsarId      String                         // Links to parent
  type        String                         // What happened
  description String   @db.Text              // Human-readable detail
  metadata    Json?                          // Structured data
  performedBy String                         // WHO did it
  performedAt DateTime @default(now())       // WHEN
}
```

This answers:
- **WHO**: `performedBy` field
- **WHAT**: `type` + `description`
- **WHEN**: `performedAt` timestamp
- **WHERE**: Implied by `dsarId` relationship
- **WHY**: Can be in `description` or `metadata`

### 3. Cascading Deletes

```prisma
dsar DSARRequest @relation(fields: [dsarId], references: [id], onDelete: Cascade)
```

**Critical Decision**: Activities cascade delete with parent.

**Question raised**: Is this correct for audit trails? Should activities survive parent deletion?

**Possible answer**: In GDPR context, if the DSAR is deleted (e.g., per retention policy), its activities should also go. The retention policy itself is the audit trail for the deletion.

### 4. Activity Types as Workflow States

```typescript
// Types map to workflow transitions
'RECEIVED'          → Initial state
'VERIFIED'          → Identity confirmed
'PROCESSING_STARTED' → Work begun
'EXTENDED'          → Deadline changed
'COMPLETED'         → Response provided
'REJECTED'          → Request denied
```

This creates a **recoverable state history** - you can reconstruct the full workflow just from activities.

---

## Implementation Details

### Location
- `/operational/data-privacy/prisma/schema.prisma` - DSARActivity, BreachActivity
- `/operational/data-privacy/src/routes/dsar.routes.ts` - Activity creation in updates
- `/operational/data-privacy/src/routes/breach.routes.ts` - Activity creation in updates

### Activity Creation Pattern

```typescript
// Standard pattern across all routes
const updated = await prisma.dSARRequest.update({
  where: { id },
  data: {
    // State changes
    status: newStatus,
    someField: newValue,

    // Activity creation (nested write)
    activities: {
      create: {
        type: 'STATE_CHANGE_NAME',
        description: `Human readable: ${details}`,
        performedBy: userId,
        metadata: optionalStructuredData,
      },
    },
  },
  include: {
    activities: {
      orderBy: { performedAt: 'desc' },
    },
  },
});
```

### Querying Activity History

```typescript
// Get full history
const dsar = await prisma.dSARRequest.findUnique({
  where: { id },
  include: {
    activities: {
      orderBy: { performedAt: 'desc' },
    },
  },
});

// Recent activities only
include: {
  activities: {
    take: 5,
    orderBy: { performedAt: 'desc' },
  },
}
```

---

## Curiosities Discovered

### 1. No Activity for Failed Actions
We only create activities on successful state changes.

**Question**: Should failed attempts also be logged?
**Example**: What if identity verification fails 3 times before succeeding?
**Gap**: No visibility into failed attempts

### 2. performedBy is Unvalidated
The `performedBy` field accepts any string. No FK to a users table.

**Question**: Is this intentional flexibility or missing integrity?
**Trade-off**: Flexibility (external users, system actions) vs Integrity (valid user references)

### 3. No Activity Summarization
With many activities, queries could become expensive.

**Question**: At what scale do we need materialized summaries?
**Pattern Needed**: Activity aggregation for reporting

### 4. Metadata Schema
`metadata Json?` is untyped. Each activity type could have different metadata needs.

**Question**: Should metadata be typed per activity type?
**Trade-off**: Flexibility vs Validation

---

## Anti-Patterns Avoided

### 1. Separate Audit Tables
Some systems use a generic `audit_log` table for all entities.

**Problem**: Joins become expensive, harder to query entity-specific history.
**Our Approach**: Activity table per entity type.

### 2. Trigger-Based Auditing
Database triggers can create audit records automatically.

**Problem**: Lose application context (WHO, WHY), hard to test.
**Our Approach**: Application-level activity creation.

### 3. Log Files for Compliance
Relying on application logs for audit trail.

**Problem**: Logs are mutable, separate system, hard to correlate.
**Our Approach**: Audit trail in same database as data.

---

## Related Patterns

- [42-gdpr-compliance-architecture.md](42-gdpr-compliance-architecture.md) - Why audit trails matter
- [02-document-lifecycle-states.md](02-document-lifecycle-states.md) - State machines in contracts domain
- [40-cqrs-ip-domain.md](40-cqrs-ip-domain.md) - Event sourcing (related pattern)

---

## Open Questions

1. **Retention of Activities**: When/how should old activities be purged?
2. **Activity Immutability**: How enforced? DB constraints? Application logic?
3. **Cross-Entity Activities**: What if an action affects multiple entities?
4. **Activity Aggregation**: How to efficiently query "all activities for entity X across all types"?

---

## Now You Can

With this understanding, you can:
1. Add activity tracking to any new workflow
2. Query complete audit history for compliance reports
3. Reconstruct workflow state from activity history
4. Explain why activities are in the domain model
5. Design new entities with built-in audit trails

---

*"If it's not recorded, it didn't happen." - The audit trail principle*
