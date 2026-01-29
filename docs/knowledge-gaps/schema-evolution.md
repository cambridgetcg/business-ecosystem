# Event Schema Evolution Strategies

**Research Date**: 2026-01-26  
**Knowledge Gap**: How to evolve event schemas without breaking consumers

---

## Overview

In event-driven architectures, schema evolution is inevitable. New fields, deprecated fields, and structural changes must happen without breaking existing producers or consumers. This is especially critical for the business ecosystem where events are the primary cross-domain communication mechanism.

---

## The Golden Rule

> **"Producers must always be backward compatible. Consumers must always be forward compatible."**
> 
> — 2025 architecture best practice (Uber, Netflix, DoorDash)

---

## Compatibility Types

### Backward Compatibility

New consumers can read data from old producers.

```
Producer (v1) ──► Event Store ──► Consumer (v2)
                                       ✓ Works
```

**Achieved by**:
- New optional fields with defaults
- Not removing required fields

### Forward Compatibility

Old consumers can read data from new producers.

```
Producer (v2) ──► Event Store ──► Consumer (v1)
                                       ✓ Works
```

**Achieved by**:
- Consumers ignoring unknown fields
- Not changing existing field semantics

### Full Compatibility

Both forward and backward compatible. Most restrictive but safest.

```
Producer (any) ──► Event Store ──► Consumer (any)
                                       ✓ Works
```

---

## Safe vs Breaking Changes

### Safe Changes (Do Freely)

| Change | Why Safe |
|--------|----------|
| Add optional field with default | Old consumers ignore it |
| Add new event type | Old consumers don't subscribe |
| Add optional enum value | Old consumers ignore it |
| Deprecate field (don't remove) | Still there for old consumers |

### Breaking Changes (Avoid)

| Change | Why Breaking | Mitigation |
|--------|--------------|------------|
| Remove field | Old consumers expect it | Deprecate first, remove after migration |
| Rename field | Consumers use old name | Add new field, deprecate old |
| Change field type | Deserialization fails | Version the event type |
| Change field semantics | Logic breaks | New event type instead |
| Make optional field required | Old producers don't send it | Add default |

---

## Recommended Strategy: Schema-as-Code

### 1. Version Control Schemas

```
shared/
└── events/
    └── contract-events/
        ├── v1/
        │   └── contract-created.schema.ts
        ├── v2/
        │   └── contract-created.schema.ts
        └── index.ts  # Exports latest
```

### 2. Define Schemas with Zod

```typescript
// shared/events/contract-events/v1/contract-created.schema.ts
import { z } from 'zod';

export const ContractCreatedV1Schema = z.object({
  eventId: z.string().uuid(),
  eventType: z.literal('contract.created.v1'),
  occurredAt: z.string().datetime(),
  
  payload: z.object({
    contractId: z.string().uuid(),
    entityId: z.string().uuid(),
    counterpartyName: z.string(),
    value: z.number(),
    currency: z.string().length(3),
  }),
});

export type ContractCreatedV1 = z.infer<typeof ContractCreatedV1Schema>;
```

### 3. Evolve with New Version

```typescript
// shared/events/contract-events/v2/contract-created.schema.ts
import { z } from 'zod';

export const ContractCreatedV2Schema = z.object({
  eventId: z.string().uuid(),
  eventType: z.literal('contract.created.v2'),
  occurredAt: z.string().datetime(),
  
  payload: z.object({
    contractId: z.string().uuid(),
    entityId: z.string().uuid(),
    
    // RENAMED: counterpartyName → counterparty (object)
    counterparty: z.object({
      id: z.string().uuid().optional(),
      name: z.string(),
      type: z.enum(['INDIVIDUAL', 'ORGANIZATION']),
    }),
    
    // NEW: structured value
    value: z.object({
      amount: z.number(),
      currency: z.string().length(3),
    }),
    
    // NEW: optional field
    contractType: z.enum(['NDA', 'MSA', 'SOW', 'OTHER']).optional(),
    
    // DEPRECATED but still present for backward compat
    counterpartyName: z.string().optional(),
    currency: z.string().length(3).optional(),
  }),
});
```

---

## Schema Registry Integration

### Benefits

1. **Centralized management** - Single source of truth for schemas
2. **Compatibility checking** - Reject breaking changes at registration
3. **Version discovery** - Consumers find correct schema version
4. **Serialization** - Efficient binary encoding (Avro, Protobuf)

### Implementation

```typescript
// Using a schema registry client
import { SchemaRegistry } from '@ecosystem/schema-registry';

const registry = new SchemaRegistry({
  url: process.env.SCHEMA_REGISTRY_URL,
});

// Producer: Register schema before producing
async function produceEvent(event: ContractCreatedV2) {
  const schemaId = await registry.register({
    subject: 'contract.created',
    schema: ContractCreatedV2Schema,
    compatibilityMode: 'FULL',  // Reject if not compatible
  });
  
  await messageQueue.publish({
    topic: 'contract-events',
    schemaId,
    payload: event,
  });
}

// Consumer: Fetch schema to deserialize
async function consumeEvent(message: Message) {
  const schema = await registry.getSchema(message.schemaId);
  const event = schema.parse(message.payload);
  
  // Handle based on version
  if (event.eventType === 'contract.created.v1') {
    await handleV1(event);
  } else if (event.eventType === 'contract.created.v2') {
    await handleV2(event);
  }
}
```

---

## Migration Pattern: Expand and Contract

For significant schema changes, use the expand-and-contract pattern:

```
Phase 1: EXPAND (Dual Write)
┌──────────────┐
│   Producer   │──► Writes BOTH old and new fields
└──────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│  Event: { oldField: X, newField: Y } │
└──────────────────────────────────────┘
       │
       ├──────────────► Old Consumer (reads oldField)
       │
       └──────────────► New Consumer (reads newField)


Phase 2: MIGRATE
- All consumers updated to read newField
- Monitor that oldField is unused


Phase 3: CONTRACT
- Remove oldField from schema
- Stop writing oldField
```

### Implementation

```typescript
// Phase 1: Producer writes both
async function createContractEvent(data: ContractData): Promise<void> {
  await publish({
    eventType: 'contract.created.v2',
    payload: {
      // New structure
      counterparty: {
        id: data.counterpartyId,
        name: data.counterpartyName,
        type: data.counterpartyType,
      },
      value: {
        amount: data.value,
        currency: data.currency,
      },
      
      // DEPRECATED - still present for old consumers
      counterpartyName: data.counterpartyName,
      currency: data.currency,
    },
  });
}

// Phase 1: Old consumer still works
async function handleContractCreatedV1(event: ContractCreatedV1) {
  const counterpartyName = event.payload.counterpartyName;
  const value = event.payload.value;
  const currency = event.payload.currency;
  // ... process
}

// Phase 2: New consumer uses new structure
async function handleContractCreatedV2(event: ContractCreatedV2) {
  const counterparty = event.payload.counterparty;
  const value = event.payload.value.amount;
  const currency = event.payload.value.currency;
  // ... process
}
```

---

## Consumer Resilience

### Ignore Unknown Fields

```typescript
// Configure Zod to passthrough unknown fields
const schema = z.object({
  knownField: z.string(),
}).passthrough();  // Don't fail on unknown fields

// Or strip them
const strictSchema = z.object({
  knownField: z.string(),
}).strip();  // Remove unknown fields
```

### Version-Aware Handler

```typescript
type EventHandler = {
  eventType: string;
  version: number;
  handle: (event: unknown) => Promise<void>;
};

const handlers: EventHandler[] = [
  { eventType: 'contract.created', version: 1, handle: handleV1 },
  { eventType: 'contract.created', version: 2, handle: handleV2 },
];

async function routeEvent(event: { eventType: string }) {
  const [type, version] = parseEventType(event.eventType);
  
  // Find handler for exact version or fallback to latest compatible
  const handler = handlers
    .filter(h => h.eventType === type && h.version <= version)
    .sort((a, b) => b.version - a.version)[0];
  
  if (handler) {
    await handler.handle(event);
  } else {
    logger.warn(`No handler for ${event.eventType}`);
  }
}
```

---

## Application to Business Ecosystem

### Event Naming Convention

```
{domain}.{aggregate}.{action}.v{version}

Examples:
- contracts-legal.contract.created.v1
- contracts-legal.contract.created.v2
- insurance.policy.renewed.v1
- data-privacy.consent.withdrawn.v1
```

### Shared Events Package Structure

```
shared/events/
├── types.ts                    # Common event interfaces
├── registry.ts                 # Schema registry client
├── contract-events/
│   ├── index.ts               # Re-exports latest versions
│   ├── v1/
│   │   ├── contract-created.ts
│   │   ├── contract-signed.ts
│   │   └── index.ts
│   └── v2/
│       ├── contract-created.ts
│       └── index.ts
├── insurance-events/
│   └── ...
└── operational-events/
    └── ...
```

### Compatibility Mode per Topic

| Topic | Compatibility | Rationale |
|-------|---------------|-----------|
| `entity-events` | FULL | Critical, rarely changes |
| `contract-events` | BACKWARD | Evolves regularly |
| `analytics-events` | FORWARD | Schema-on-read pattern |
| `internal-events` | NONE | Ephemeral, version-locked |

---

## Sources

- [Confluent - Schema Evolution and Compatibility](https://docs.confluent.io/platform/current/schema-registry/fundamentals/schema-evolution.html)
- [Cloudurable - Apache Avro 2025 Guide](https://cloudurable.com/blog/avro-2025/)
- [TheBurningMonk - Event Versioning Strategies](https://theburningmonk.com/2025/04/event-versioning-strategies-for-event-driven-architectures/)
- [Stackademic - Schema Versioning in Kafka Events](https://blog.stackademic.com/schema-versioning-in-kafka-events-designing-backward-forward-compatible-payloads-in-spring-b3533ee8dac8)
- [JavaCodeGeeks - Schema Evolution in Avro, Protobuf, JSON Schema](https://www.javacodegeeks.com/2025/06/schema-evolution-in-apache-avro-protobuf-and-json-schema.html)
- [Solace - Schema Registry Best Practices](https://docs.solace.com/Schema-Registry/schema-registry-best-practices.htm)
