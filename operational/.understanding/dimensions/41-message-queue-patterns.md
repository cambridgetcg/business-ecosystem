# Dimension 41: Message Queue Patterns

**Discovery Source**: Phase 1 Implementation - RabbitMQ Subscriber Integration
**Understanding Level**: ENABLED
**Last Updated**: January 27, 2026

---

## Aha Moment

> When implementing the RabbitMQ subscriber, the Dead Letter Exchange (DLX) pattern emerged as essential - not just for error handling, but for **preventing infinite message loops** that can crash the entire system.

---

## What This Is

The message queue infrastructure pattern used across the operational ecosystem:
- **RabbitMQ** as the message broker
- **Topic-based exchanges** for event routing
- **Dead Letter Exchanges** for failed message handling
- **Prefetch limits** for fair dispatch

---

## Mental Model

```
                    ┌────────────────────────────────────┐
                    │         ecosystem.events           │
                    │         (topic exchange)           │
                    └──────────────┬─────────────────────┘
                                   │
           ┌───────────────────────┼───────────────────────┐
           │                       │                       │
           ▼                       ▼                       ▼
   ┌───────────────┐      ┌───────────────┐      ┌───────────────┐
   │ workflow-     │      │ compliance-   │      │ future-       │
   │ engine queue  │      │ queue         │      │ service queue │
   └───────┬───────┘      └───────┬───────┘      └───────────────┘
           │                      │
           │ ack                  │ ack
           │                      │
           ▼ on failure           ▼ on failure
   ┌───────────────────────────────────────────────────────────┐
   │                  ecosystem.events.dlx                      │
   │               (dead letter exchange)                       │
   │                                                            │
   │   Failed messages land here for debugging, NOT requeued    │
   │   This prevents: infinite retry loops, queue flooding      │
   └───────────────────────────────────────────────────────────┘
```

---

## Key Concepts

### 1. Topic Exchange Routing

Event types act as routing keys:
```
entity-governance.entity.created  → Routes to governance subscribers
contracts-legal.contract.signed   → Routes to contract subscribers
data-privacy.dsar.submitted       → Routes to privacy subscribers
```

**Why**: Allows selective subscription without coupling publishers to consumers.

### 2. Dead Letter Exchange (DLX)

When a message fails processing:
1. Handler throws error
2. Message is `nack`'d with `requeue: false`
3. RabbitMQ routes to DLX (per queue configuration)
4. Message preserved for analysis without retry loop

**Critical Insight**: Without DLX, failed messages either:
- Requeue infinitely (crashes system)
- Are lost forever (no debugging possible)

DLX provides the middle ground: preserved but quarantined.

### 3. Prefetch Limits

```typescript
await this.channel.prefetch(this.prefetch); // default: 10
```

**Why**: Fair dispatch across multiple consumers. Without prefetch:
- Fast consumer gets ALL messages
- Slow consumer starves
- Load imbalanced

### 4. Acknowledgment Pattern

```typescript
// Success path
channel.ack(msg);

// Failure path - DO NOT requeue
channel.nack(msg, false, false);
//               │      │
//               │      └── requeue: false (send to DLX)
//               └──────── allUpTo: false (just this message)
```

---

## Implementation Details

### Location
`/shared/libs/messaging/src/rabbitmq-subscriber.ts`

### Configuration
```typescript
interface RabbitMQSubscriberConfig {
  url: string;
  exchange?: string;           // default: 'ecosystem.events'
  exchangeType?: 'topic';      // topic for selective routing
  queue?: string;              // unique per service
  prefetch?: number;           // default: 10
  deadLetterExchange?: string; // default: 'ecosystem.events.dlx'
}
```

### Connection Lifecycle
```
1. connect()     → Establish AMQP connection
2. assertExchange()  → Ensure exchanges exist
3. assertQueue()     → Create queue with DLX routing
4. bindQueue()       → Bind routing keys
5. startConsuming()  → Begin processing
6. disconnect()      → Graceful shutdown
```

---

## Curiosities Discovered

### 1. amqplib Type Mismatch
**Observation**: `amqplib.connect()` returns `ChannelModel`, not `Connection` as documented.

```typescript
// Documentation suggests:
const connection: Connection = await amqplib.connect(url);

// Reality:
const connection: ChannelModel = await amqplib.connect(url);
```

**Question**: Is this a documentation bug or type definition issue?
**Status**: Worked around, not resolved

### 2. ESM Import Behavior
amqplib with ESM requires default import handling, similar to pino.

### 3. Why No Publisher?
We built a subscriber but no publisher exists in `@ecosystem/messaging`.

**Question**: How are domains supposed to publish events?
**Hypothesis**: Each domain handles its own publishing, or this is the next gap to close.

---

## Related Patterns

- [31-workflow-orchestration.md](31-workflow-orchestration.md) - Workflow engine consumes events
- [03-cross-domain-events.md](03-cross-domain-events.md) - Pending: event schema standards

---

## Open Questions

1. **Publisher Gap**: Who publishes events? Each domain independently?
2. **Event Schema**: Is there a shared event schema/contract?
3. **Idempotency**: How are duplicate messages handled?
4. **Ordering**: Is message ordering guaranteed? Does it matter?
5. **Monitoring**: How is DLX monitored? Alerting on failures?

---

## Now You Can

With this understanding, you can:
1. Add new event subscribers to any service
2. Configure DLX for proper error handling
3. Debug failed messages in the DLX
4. Understand why message processing might fail silently
5. Add event publishing to domains (the gap identified)

---

*"The best error handling is the kind that doesn't hide errors." - This is why DLX matters*
