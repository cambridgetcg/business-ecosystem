# Shared Events - Purpose

## Purpose

**To define the event schemas that enable loose coupling between domains** — allowing services to communicate through well-defined events without direct dependencies.

---

## What This Module Does

The `shared/events` module provides:

1. **Event schemas** — TypeScript interfaces and Zod schemas for all domain events
2. **Event type constants** — Standardized event type strings
3. **Event metadata** — Common fields (timestamp, correlationId, source)
4. **Event contracts** — Publisher/subscriber expectations

---

## Why This Exists

Without shared event schemas:
- Publishers and subscribers can drift out of sync
- Event payloads are inconsistent
- Breaking changes propagate silently
- Event discovery requires reading source code

With shared events:
- Type-safe event publishing and consumption
- Clear contract between publishers and subscribers
- Compile-time detection of breaking changes
- Centralized event catalog

---

## Event Categories

| Package | Events | Publishers | Key Consumers |
|---------|--------|------------|---------------|
| `entity-events` | `entity.created`, `entity.updated` | Entity Governance | All |
| `financial-events` | `payment.completed`, `invoice.issued` | Banking, Accounting | Compliance, Tax |
| `compliance-events` | `compliance.status_changed` | Compliance | All |
| `legal-events` | `contract.signed`, `document.uploaded` | Contracts-Legal | Insurance, IP |
| `operational-events` | `entity_onboarded`, `item_expiring` | Orchestration | All |

---

## Event Structure

All events follow a standard envelope:

```typescript
interface EventEnvelope<T> {
  eventId: string;           // Unique event identifier
  eventType: string;         // e.g., 'entity.created'
  timestamp: string;         // ISO 8601 timestamp
  version: string;           // Schema version
  source: string;            // Publishing service
  correlationId?: string;    // Request correlation
  payload: T;                // Event-specific data
}
```

---

## Usage

### Publishing

```typescript
import { EntityCreatedEvent, ENTITY_EVENTS } from '@ecosystem/entity-events';
import { eventBus } from '@ecosystem/messaging';

const event: EntityCreatedEvent = {
  entityId: 'ent_123',
  entityType: 'CORPORATION',
  jurisdiction: 'DE',
};

await eventBus.publish(ENTITY_EVENTS.CREATED, event);
```

### Subscribing

```typescript
import { EntityCreatedEvent, ENTITY_EVENTS } from '@ecosystem/entity-events';
import { eventBus } from '@ecosystem/messaging';

eventBus.subscribe(ENTITY_EVENTS.CREATED, async (event: EntityCreatedEvent) => {
  // Handle entity creation
});
```

---

## Key Principles

1. **Schema-first** — Events are defined by schema, not implementation
2. **Versioning required** — Events include version for evolution
3. **Idempotent handling** — Consumers must handle duplicate events
4. **Backward compatible** — New fields are optional; removed fields deprecated first
5. **Documented purpose** — Each event explains when it's published and why

---

## Event Evolution

When event schemas need to change:
1. Add new optional fields (non-breaking)
2. Bump version for significant changes
3. Deprecate old versions with sunset timeline
4. Coordinate consumer migration

---

*This module defines the language of change across the ecosystem.*
