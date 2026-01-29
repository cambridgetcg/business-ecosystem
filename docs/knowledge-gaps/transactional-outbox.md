# Transactional Outbox Pattern

**Research Date**: 2026-01-26  
**Knowledge Gap**: Exactly-once delivery guarantees and deduplication at scale

---

## Overview

The transactional outbox pattern ensures atomic message publishing with database changes. Instead of publishing directly to a message broker, messages are stored in a database table within the same transaction as business data.

---

## How It Works

```
┌────────────────────────────────────────────────────────────────┐
│                      APPLICATION                                │
│                                                                 │
│  BEGIN TRANSACTION                                              │
│    1. Save business entity to table                            │
│    2. Save event to outbox table                               │
│  COMMIT                                                         │
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐                   │
│  │  business_data  │    │     outbox      │                   │
│  │                 │    │                 │                   │
│  │ { entity... }   │    │ { event... }    │ ◄── Same TX       │
│  └─────────────────┘    └─────────────────┘                   │
└────────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │   MESSAGE RELAY       │
                    │   (Polling or CDC)    │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │   MESSAGE BROKER      │
                    │   (RabbitMQ/Kafka)    │
                    └───────────────────────┘
```

---

## Delivery Guarantees

### The Reality

> **"Exactly-once is a system design, not a flag."**

- **Outbox provides**: At-least-once delivery from producer to broker
- **Exactly-once requires**: Deduplication at consumer side (Inbox pattern)

### Achieving Exactly-Once Semantics

```
PRODUCER                          CONSUMER
   │                                 │
   ├──────────────────────────────►  │
   │    message (id: abc-123)        │
   │                                 │
   │   [network timeout - retry]     │
   │                                 │
   ├──────────────────────────────►  │
   │    message (id: abc-123)        │
   │                                 │
   │              ┌──────────────────▼─────────────────┐
   │              │ BEGIN TRANSACTION                   │
   │              │   1. Check inbox for abc-123       │
   │              │   2. If exists: skip (deduplicate) │
   │              │   3. If not: process + save to inbox│
   │              │ COMMIT                              │
   │              └─────────────────────────────────────┘
```

---

## PostgreSQL Implementation

### Outbox Table Schema

```sql
CREATE TABLE outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type VARCHAR(100) NOT NULL,
  aggregate_id UUID NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,  -- NULL until processed
  
  -- For ordering within aggregate
  sequence_number BIGSERIAL
);

-- Index for polling
CREATE INDEX idx_outbox_unsent ON outbox(created_at) 
  WHERE sent_at IS NULL;
```

### Inbox Table Schema (Consumer Side)

```sql
CREATE TABLE inbox (
  message_id UUID PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Retention policy: delete after N days
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

-- Automatic cleanup
CREATE INDEX idx_inbox_expires ON inbox(expires_at);
```

### Concurrent Message Relay with Row Locking

```sql
-- PostgreSQL's SKIP LOCKED prevents duplicate processing
SELECT * FROM outbox 
WHERE sent_at IS NULL 
ORDER BY created_at 
LIMIT 10 
FOR UPDATE SKIP LOCKED;
```

```typescript
async function processOutbox() {
  await db.transaction(async (tx) => {
    // Lock and fetch unprocessed messages
    const messages = await tx.execute(sql`
      SELECT * FROM outbox 
      WHERE sent_at IS NULL 
      ORDER BY created_at 
      LIMIT 10 
      FOR UPDATE SKIP LOCKED
    `);
    
    for (const message of messages) {
      // Publish to broker
      await messageBroker.publish(message.event_type, message.payload);
      
      // Mark as sent
      await tx.execute(sql`
        UPDATE outbox SET sent_at = NOW() WHERE id = ${message.id}
      `);
    }
  });
}
```

---

## Two Relay Approaches

### 1. Polling

```typescript
// Simple interval-based polling
setInterval(async () => {
  await processOutbox();
}, 1000); // Every second
```

**Pros**: Simple, no extra infrastructure  
**Cons**: Latency, database load

### 2. Change Data Capture (CDC)

Using PostgreSQL logical replication to stream changes:

```typescript
// Using pg-transactional-outbox library
import { setupReplicationListener } from 'pg-transactional-outbox';

const listener = await setupReplicationListener({
  connectionString: DATABASE_URL,
  slotName: 'outbox_slot',
  publicationName: 'outbox_publication',
});

listener.on('message', async (message) => {
  await messageBroker.publish(message.event_type, message.payload);
});
```

**Pros**: Real-time, lower database load  
**Cons**: More complex setup, requires WAL configuration

---

## Deduplication Strategies

### 1. Idempotency Key in Consumer

```typescript
async function handleEvent(event: Event) {
  const result = await db.transaction(async (tx) => {
    // Check if already processed
    const existing = await tx.query(
      'SELECT 1 FROM inbox WHERE message_id = $1',
      [event.id]
    );
    
    if (existing.rows.length > 0) {
      return { deduplicated: true };
    }
    
    // Process the event
    await processBusinessLogic(tx, event);
    
    // Record in inbox
    await tx.query(
      'INSERT INTO inbox (message_id, event_type) VALUES ($1, $2)',
      [event.id, event.type]
    );
    
    return { deduplicated: false };
  });
  
  return result;
}
```

### 2. Natural Idempotency

Design operations to be naturally idempotent:

```typescript
// BAD: Not idempotent
async function incrementCounter(entityId: string) {
  await db.execute(sql`
    UPDATE entities SET counter = counter + 1 WHERE id = ${entityId}
  `);
}

// GOOD: Idempotent with version check
async function setCounterValue(entityId: string, newValue: number, expectedVersion: number) {
  const result = await db.execute(sql`
    UPDATE entities 
    SET counter = ${newValue}, version = version + 1
    WHERE id = ${entityId} AND version = ${expectedVersion}
  `);
  
  if (result.rowCount === 0) {
    throw new ConcurrentModificationError();
  }
}
```

---

## Performance Considerations

### Table Maintenance

```sql
-- Delete old processed messages
DELETE FROM outbox 
WHERE sent_at IS NOT NULL 
AND sent_at < NOW() - INTERVAL '7 days';

-- Vacuum to reclaim space
VACUUM ANALYZE outbox;
```

### Partitioning for Scale

```sql
CREATE TABLE outbox (
  id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- ... other columns
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE outbox_2026_01 PARTITION OF outbox
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
```

---

## Application to Business Ecosystem

### Integration with Domain Events

```typescript
// In domain service
async function createContract(data: ContractData): Promise<Contract> {
  return await db.transaction(async (tx) => {
    // 1. Create contract
    const contract = await tx.insert(contracts, data);
    
    // 2. Add to outbox (same transaction)
    await tx.insert(outbox, {
      aggregateType: 'Contract',
      aggregateId: contract.id,
      eventType: 'contract.created',
      payload: {
        contractId: contract.id,
        entityId: contract.entityId,
        // ... event data
      },
    });
    
    return contract;
  });
}
```

### Recommended Library

For Node.js + PostgreSQL: **[pg-transactional-outbox](https://github.com/Zehelein/pg-transactional-outbox)**
- Supports both polling and CDC
- TypeScript-first
- Tested with PostgreSQL 14+

---

## Sources

- [Event-Driven.io - Outbox Inbox Patterns Explained](https://event-driven.io/en/outbox_inbox_patterns_and_delivery_guarantees_explained/)
- [pg-transactional-outbox GitHub](https://github.com/Zehelein/pg-transactional-outbox)
- [AWS - Transactional Outbox Pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html)
- [Decodable - Revisiting the Outbox Pattern](https://www.decodable.co/blog/revisiting-the-outbox-pattern)
- [NP Blog - Outbox Pattern From Theory to Production](https://www.npiontko.pro/2025/05/19/outbox-pattern)
