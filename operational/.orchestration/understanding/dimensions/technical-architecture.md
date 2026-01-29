# Technical Architecture Dimension

Understanding of technical patterns, frameworks, and implementation approaches across the operational ecosystem.

---

## Overview

The operational ecosystem follows consistent architectural patterns across domains while allowing domain-specific variations in implementation details.

---

## Shared Technical Foundation

### Understanding Level: [D] Deep

**Core Stack**:
| Component | Technology | Purpose |
|-----------|------------|---------|
| Language | TypeScript 5.4+ | Type safety, ESM modules |
| HTTP Framework | Hono | Lightweight, TypeScript-first |
| ORM | Prisma (most) / Drizzle (IP) | Type-safe database access |
| Database | PostgreSQL 16+ | Primary data store |
| Validation | Zod | Runtime schema validation |
| Logging | Pino | Structured JSON logging |
| Testing | Vitest | Unit and integration tests |

**Port Assignments**:
```
contracts-legal:        3011
data-privacy:           3012
insurance:              3013
intellectual-property:  3014
workflow-engine:        3020
compliance-aggregator:  3021
gateway:                3022
reporting:              3023
```

---

## Domain-Driven Design Patterns

### Understanding Level: [D] Deep

**Entity Structure**:
```typescript
// All operational entities extend this base
interface OperationalRecord {
  id: string;                    // UUID primary key
  entityId: string;              // Owner legal entity (from entity-governance)
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;             // User ID
  updatedBy: string;
  version: number;               // Optimistic locking
  deletedAt?: Date;              // Soft delete timestamp
}
```

**Aggregate Root Pattern (IP Domain)**:
```typescript
// Domain operations encapsulated in aggregate
class Patent extends AggregateRoot {
  // Domain events accumulated during operations
  file(): void { this.addEvent(new PatentFiledEvent(...)) }
  grant(): void { this.addEvent(new PatentGrantedEvent(...)) }

  // Events pulled by handler after save
  pullDomainEvents(): DomainEvent[] { ... }
}
```

**Repository Pattern**:
```typescript
interface PatentRepository {
  findById(id: string): Promise<Patent | null>;
  findAll(options: QueryOptions): Promise<Patent[]>;
  save(patent: Patent): Promise<void>;  // Upsert
  delete(id: string): Promise<void>;    // Soft delete
}
```

---

## Layered Architecture

### Understanding Level: [D] Deep

**Standard Layer Stack**:
```
┌─────────────────────────────────────┐
│           API Layer                 │  Routes, HTTP handlers
├─────────────────────────────────────┤
│       Application Layer             │  Commands, Queries, Handlers
├─────────────────────────────────────┤
│         Domain Layer                │  Entities, Services, Events
├─────────────────────────────────────┤
│     Infrastructure Layer            │  Repositories, External APIs
└─────────────────────────────────────┘
```

**Contracts-Legal Implementation**:
```
src/
├── routes/          # Hono route handlers
├── domain/          # Business logic per subdomain
│   └── {domain}/
│       ├── service.ts      # Business logic
│       ├── repository.ts   # Data access
│       └── validators.ts   # Zod schemas
├── middleware/      # Auth, audit, errors
└── lib/             # Prisma, logging
```

**IP Domain Implementation** (More DDD-Pure):
```
src/
├── domain/
│   ├── entities/    # Aggregate roots with behavior
│   └── events/      # Domain events
├── application/
│   ├── commands/    # Write operations (Zod validated)
│   ├── queries/     # Read operations (Zod validated)
│   └── handlers/    # Command/query handlers
├── infrastructure/
│   ├── persistence/ # Drizzle repositories
│   └── cache/       # Redis/memory cache
└── api/
    └── rest/        # Fastify endpoints
```

---

## CQRS Pattern

### Understanding Level: [S] Solid

**Command Structure** (Write Operations):
```typescript
// Commands are Zod-validated input schemas
const CreatePatentCommand = z.object({
  title: z.string().min(1),
  abstract: z.string().optional(),
  inventors: z.array(InventorSchema),
  type: PatentTypeEnum,
});

// Handler executes command
class CreatePatentHandler {
  async execute(command: CreatePatentCommand): Promise<Patent> {
    const patent = Patent.create(command);
    await this.repository.save(patent);
    await this.eventPublisher.publish(patent.pullDomainEvents());
    return patent;
  }
}
```

**Query Structure** (Read Operations):
```typescript
const ListPatentsQuery = z.object({
  status: PatentStatusEnum.optional(),
  type: PatentTypeEnum.optional(),
  assigneeId: z.string().uuid().optional(),
  search: z.string().optional(),
  limit: z.number().default(20),
  offset: z.number().default(0),
});
```

---

## Event-Driven Architecture

### Understanding Level: [D] Deep

**Event Structure**:
```typescript
interface OperationalEvent {
  id: string;
  type: string;                    // e.g., 'contract.signed'
  domain: OperationalDomain;
  entityId: string;
  aggregateId: string;
  aggregateType: string;
  occurredAt: Date;
  metadata: {
    correlationId: string;
    causationId?: string;
    userId?: string;
  };
  payload: Record<string, unknown>;
}
```

**Event Categories**:
1. **Lifecycle Events**: `{domain}.{aggregate}.created|updated|state_changed`
2. **Integration Events**: `operational.entity_operations_ready`
3. **Compliance Events**: `operational.compliance_status_changed`

**Event Flow**:
```
Domain Service
     │
     │ emit event
     ▼
Message Queue (RabbitMQ/SNS+SQS)
     │
     ├──► Workflow Engine (triggers workflows)
     ├──► Compliance Aggregator (updates status)
     ├──► Reporting Service (data collection)
     └──► Other Domains (react to events)
```

---

## Database Patterns

### Understanding Level: [S] Solid

**Prisma Schema Pattern** (Contracts-Legal):
```prisma
model Contract {
  id             String    @id @default(uuid())
  contractNumber String    @unique
  type           ContractType
  status         ContractStatus
  entityId       String

  // Relationships
  parties        ContractParty[]
  documents      Document[]
  obligations    Obligation[]
  versions       ContractVersion[]

  // Audit
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  deletedAt      DateTime?
  version        Int       @default(1)
}
```

**Drizzle Schema Pattern** (IP Domain):
```typescript
export const patents = pgTable('patents', {
  id: uuid('id').primaryKey().defaultRandom(),
  applicationNumber: varchar('application_number', { length: 50 }).unique(),
  title: varchar('title', { length: 500 }).notNull(),
  status: patentStatusEnum('status').default('draft'),

  // JSONB for complex nested data
  inventors: jsonb('inventors').$type<Inventor[]>(),
  jurisdictions: jsonb('jurisdictions').$type<string[]>(),

  // Audit columns
  createdAt: timestamp('created_at').defaultNow(),
  version: integer('version').default(1),
});
```

**JSONB Usage**:
- Complex nested structures (inventors, claims, royalty terms)
- Flexible schemas that evolve
- Arrays of related data
- Query with PostgreSQL JSON operators

---

## Caching Strategy

### Understanding Level: [S] Solid

**IP Domain Cache Pattern**:
```typescript
// Factory selects cache implementation based on environment
const cacheService = createCacheService({
  redis: process.env.REDIS_URL,  // Prefer Redis if available
  ttl: 300,                       // 5 minute default
  fallback: 'memory',             // LRU memory cache
});

// Usage in queries
const cachedPatent = await cache.get<Patent>(`patent:${id}`);
if (!cachedPatent) {
  const patent = await repository.findById(id);
  await cache.set(`patent:${id}`, patent);
}
```

---

## Error Handling

### Understanding Level: [S] Solid

**Custom Error Classes** (Contracts-Legal):
```typescript
class ValidationError extends Error { status = 400 }
class AuthenticationError extends Error { status = 401 }
class AuthorizationError extends Error { status = 403 }
class NotFoundError extends Error { status = 404 }
class ConflictError extends Error { status = 409 }
class BusinessRuleError extends Error { status = 422 }
class ContractStatusError extends Error { status = 422 }
class ExternalServiceError extends Error { status = 502 }
class DatabaseError extends Error { status = 500 }
```

**Error Middleware**:
```typescript
app.onError((err, c) => {
  logger.error({ err, requestId: c.get('requestId') });
  return c.json({
    error: err.message,
    code: err.code,
    requestId: c.get('requestId'),
  }, err.status || 500);
});
```

---

## Middleware Patterns

### Understanding Level: [S] Solid

**Standard Middleware Chain**:
```
Request
  │
  ├──► CORS Middleware
  ├──► Logger Middleware
  ├──► Request ID Middleware
  ├──► Auth Middleware (JWT validation)
  ├──► Audit Middleware (log mutations)
  │
  ▼
Route Handler
  │
  ├──► Error Middleware (catch and format)
  │
  ▼
Response
```

**Audit Middleware**:
```typescript
// Automatically logs CREATE/UPDATE/DELETE actions
const auditMiddleware = async (c, next) => {
  await next();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(c.req.method)) {
    await auditLog.create({
      entityType: extractEntityType(c.req.path),
      entityId: extractEntityId(c.req.path),
      action: methodToAction(c.req.method),
      userId: c.get('user')?.id,
      ipAddress: c.req.header('x-forwarded-for'),
      userAgent: c.req.header('user-agent'),
    });
  }
};
```

---

## Testing Patterns

### Understanding Level: [~] Surface

**Test Stack**:
- Vitest for unit and integration tests
- Supertest for API testing
- In-memory database for isolation

**Gap Areas**:
- Test coverage metrics not visible
- Integration test patterns not fully explored
- E2E testing approach unclear

---

## Key Technical Insights

1. **Consistency matters** - Same patterns (Hono, Zod, Pino) across domains enables shared knowledge
2. **Soft deletes are universal** - Legal requirements drive `deletedAt` pattern everywhere
3. **Optimistic locking via version** - Prevents concurrent modification conflicts
4. **JSONB for flexibility** - Complex structures stored as JSON, queried with PostgreSQL operators
5. **Event-driven, not API-driven** - Domains communicate through events, not direct calls
6. **Request ID propagation** - Distributed tracing via correlation IDs
7. **Factory patterns for flexibility** - Cache, database connections adapt to environment
