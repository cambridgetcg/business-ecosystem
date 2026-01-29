# Dimension 40: CQRS in IP Domain

## What

The Intellectual Property domain uses **Command Query Responsibility Segregation (CQRS)** - a pattern where write operations (Commands) and read operations (Queries) are separated into distinct models.

This is the **ONLY domain using this pattern**. All other domains use a simpler service/repository approach.

## Why CQRS Here?

### Domain Characteristics That Justify CQRS

1. **Read-Heavy Workload**
   - Portfolio queries, reporting, dashboards
   - Executive views across thousands of IP assets
   - Search and filtering across multiple IP types

2. **Critical Writes**
   - Filing a patent = legal deadline
   - Missing a maintenance fee = losing rights
   - Every write must be auditable and event-sourced ready

3. **Complex Query Requirements**
   - "Show me all patents expiring in 90 days"
   - "List trademarks by Nice class"
   - "Find all IP licensed to Entity X"
   - Queries don't map 1:1 to write models

4. **Audit Trail Necessity**
   - IP decisions are legally significant
   - Need to prove chain of custody
   - Events capture WHY, not just WHAT

### Why Other Domains Don't Use It

| Domain | Reason for Simpler Pattern |
|--------|---------------------------|
| contracts-legal | Lower read/write ratio, simpler queries |
| insurance | Not yet implemented |
| data-privacy | Not yet implemented |

## How

### Architecture Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                     API LAYER (Fastify)                         │
│  Routes call command/query handlers                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   APPLICATION LAYER                             │
│  ┌─────────────────────┐    ┌─────────────────────┐            │
│  │      COMMANDS       │    │       QUERIES       │            │
│  │  CreatePatentCmd    │    │  GetPatentQuery     │            │
│  │  FilePatentCmd      │    │  ListPatentsQuery   │            │
│  │  GrantPatentCmd     │    │  ExpiringPatentsQ   │            │
│  └──────────┬──────────┘    └──────────┬──────────┘            │
│             │                          │                        │
│             ▼                          ▼                        │
│  ┌─────────────────────┐    ┌─────────────────────┐            │
│  │ Command Handlers    │    │  Query Handlers     │            │
│  │ • Validate          │    │ • Check cache       │            │
│  │ • Load aggregate    │    │ • Query DB          │            │
│  │ • Execute logic     │    │ • Transform         │            │
│  │ • Persist           │    │ • Return            │            │
│  │ • Publish events    │    │                     │            │
│  └─────────────────────┘    └─────────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

### Command Structure

```typescript
// Commands are validated with Zod
export const CreatePatentCommandSchema = z.object({
  title: z.string().min(1).max(500),
  type: z.enum(['utility', 'design', 'plant', 'reissue']),
  inventors: z.array(z.string().min(1)).min(1),
  assigneeId: z.string().uuid(),
  filingCountry: z.string().length(2),
  abstract: z.string().max(5000).optional(),
  claims: z.array(z.string()).optional(),
  actorId: z.string().uuid(),  // For audit trail
});

export type CreatePatentCommand = z.infer<typeof CreatePatentCommandSchema>;
```

### Command Handler Pattern

```typescript
export class PatentCommandHandler {
  constructor(
    private readonly repository: PatentRepository,
    private readonly eventPublisher?: EventPublisher
  ) {}

  async handleCreate(command: CreatePatentCommand): Promise<Patent> {
    // 1. Validate command (already done by Zod at boundary)

    // 2. Create aggregate
    const patent = Patent.create({
      title: command.title,
      type: command.type,
      // ...
    });

    // 3. Persist
    await this.repository.save(patent);

    // 4. Publish events
    if (this.eventPublisher) {
      const events = patent.pullDomainEvents();
      await this.eventPublisher.publishAll(events);
    }

    return patent;
  }
}
```

### Query Handler Pattern

```typescript
export class PatentQueryHandler {
  constructor(
    private readonly repository: PatentRepository,
    private readonly cache?: CacheService
  ) {}

  async handleGetById(query: GetPatentQuery): Promise<PatentReadModel | null> {
    // 1. Check cache
    const cacheKey = CacheKeys.patent.byId(query.id);
    const cached = await this.cache?.get(cacheKey);
    if (cached) return cached;

    // 2. Query database
    const patent = await this.repository.findById(query.id);
    if (!patent) return null;

    // 3. Transform to read model
    const readModel = this.toReadModel(patent);

    // 4. Cache and return
    await this.cache?.set(cacheKey, readModel, 300); // 5 min TTL
    return readModel;
  }
}
```

### Event Collection in Aggregates

```typescript
export abstract class AggregateRoot extends Entity {
  private _domainEvents: DomainEvent[] = [];

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  // Events are "pulled" after persistence, not published inline
  public pullDomainEvents(): DomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents = [];
    return events;
  }
}
```

## Where

| Component | Path |
|-----------|------|
| Commands | `intellectual-property/src/application/commands/` |
| Queries | `intellectual-property/src/application/queries/` |
| Command Handlers | `intellectual-property/src/application/handlers/*-command.handler.ts` |
| Query Handlers | `intellectual-property/src/application/handlers/*-query.handler.ts` |
| Aggregate Roots | `intellectual-property/src/domain/entities/*.entity.ts` |
| Domain Events | `intellectual-property/src/domain/events/` |

## Connections

- [IP Overview](15-ip-overview.md): Full domain context
- [Cross-Domain Events](03-cross-domain-events.md): Event patterns
- [Repository Pattern](41-repository-pattern.md): Data access

## Gap: Routes Don't Use Handlers

**DISCOVERED ISSUE**: API routes create repositories directly instead of using the command/query handlers:

```typescript
// routes/patents.routes.ts
app.post('/', async (c) => {
  const repository = new PatentRepository(db);
  // Should be: const handler = new PatentCommandHandler(repository, eventPublisher);
});
```

This duplicates logic and bypasses the CQRS benefits (event publishing, consistent validation).

## Open Questions

1. **Why only IP?** Was this a conscious decision or organic evolution?
2. **Should other domains adopt?** What's the threshold for CQRS worth?
3. **Event sourcing next?** The structure is ready - is full ES planned?
4. **Route-handler gap?** When will routes be wired to handlers?

## Trade-offs

| Benefit | Cost |
|---------|------|
| Clear separation of concerns | More files/abstractions |
| Optimized read models | Eventual consistency complexity |
| Event-ready architecture | Learning curve |
| Independent scaling (reads vs writes) | More infrastructure |

---

*Understanding Level: SOLID*
*Pattern is well-implemented but routes don't use it properly*
