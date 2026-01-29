# Shared Infrastructure

Cross-cutting libraries, contracts, and event schemas used by all domains in the business ecosystem.

## Purpose

The `shared/` directory contains infrastructure that enables **domain independence with type-safe integration**. Rather than domains depending on each other directly, they depend on shared contracts and communicate through shared event schemas.

```
┌─────────────────────────────────────────────────────────────────┐
│                    FOUNDATIONAL DOMAINS                         │
│     entity-governance · accounting · banking · compliance       │
└─────────────────────────┬───────────────────────────────────────┘
                          │ import
┌─────────────────────────▼───────────────────────────────────────┐
│                      SHARED LAYER                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  contracts  │  │   events    │  │    libs     │             │
│  │ Type defs   │  │  Schemas    │  │  Utilities  │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────▲───────────────────────────────────────┘
                          │ import
┌─────────────────────────┴───────────────────────────────────────┐
│                    OPERATIONAL DOMAINS                          │
│     contracts-legal · insurance · IP · data-privacy             │
└─────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
shared/
├── contracts/              # Cross-domain type definitions
│   ├── audit/              # Audit trail contracts
│   ├── document/           # Document lifecycle contracts
│   ├── entity/             # Legal entity contracts
│   ├── financial/          # Financial data contracts
│   └── identity/           # Identity/KYC contracts
│
├── events/                 # Event schemas for domain communication
│   ├── entity-events/      # Entity lifecycle events
│   ├── financial-events/   # Financial transaction events
│   ├── compliance-events/  # Compliance status events
│   ├── legal-events/       # Legal/contract events
│   └── operational-events/ # Cross-operational events
│
├── libs/                   # Shared utility libraries
│   ├── database/           # Repository pattern, Drizzle integration
│   ├── cache/              # Redis caching abstraction
│   ├── messaging/          # Event bus, message queue
│   ├── auth/               # Authentication utilities
│   ├── encryption/         # Encryption/decryption
│   ├── validation/         # Zod schemas, validators
│   ├── audit-logging/      # Audit trail generation
│   ├── health/             # Health check utilities
│   ├── logging/            # Structured logging (pino)
│   ├── observability/      # OpenTelemetry integration
│   ├── secrets/            # Secrets management
│   ├── outbox/             # Transactional outbox pattern
│   ├── saga/               # Saga orchestration
│   ├── service-auth/       # Service-to-service auth
│   └── service-client/     # HTTP client utilities
│
└── config/                 # Shared configuration schemas
```

## Contracts

Type definitions that establish the **language** domains use to communicate:

| Contract | Purpose | Used By |
|----------|---------|---------|
| `@ecosystem/contracts-entity` | Legal entity structures | All domains |
| `@ecosystem/contracts-financial` | Financial amounts, currencies | Accounting, Banking, Tax |
| `@ecosystem/contracts-identity` | Identity, KYC data | KYC, Compliance, Entity |
| `@ecosystem/contracts-document` | Document metadata, lifecycle | All operational domains |
| `@ecosystem/contracts-audit` | Audit entry structure | All domains |

### Usage

```typescript
import { LegalEntity, EntityType } from '@ecosystem/contracts-entity';
import { Money, Currency } from '@ecosystem/contracts-financial';
import { AuditEntry } from '@ecosystem/contracts-audit';
```

## Events

Event schemas that define **what happened** across domains:

| Event Package | Events | Publishers | Consumers |
|--------------|--------|------------|-----------|
| `@ecosystem/entity-events` | `entity.created`, `entity.updated` | Entity Governance | All |
| `@ecosystem/financial-events` | `payment.completed`, `invoice.issued` | Banking, Accounting | Compliance, Tax |
| `@ecosystem/compliance-events` | `compliance.status_changed` | Compliance | All |
| `@ecosystem/legal-events` | `contract.signed`, `document.uploaded` | Contracts-Legal | Insurance, IP |
| `@ecosystem/operational-events` | `entity_onboarded`, `item_expiring` | Orchestration | All |

### Usage

```typescript
import { EntityCreatedEvent, ENTITY_EVENT_TYPES } from '@ecosystem/entity-events';
import { ContractSignedEvent } from '@ecosystem/legal-events';
```

## Libraries

Reusable utilities that provide **consistent behavior** across domains:

### Core Infrastructure

| Library | Purpose | Key Exports |
|---------|---------|-------------|
| `@ecosystem/database` | Data access patterns | `Repository`, `DrizzleConnection`, `withCache` |
| `@ecosystem/cache` | Caching abstraction | `RedisCache`, `cacheAside`, `CacheKeyBuilder` |
| `@ecosystem/messaging` | Event publishing | `EventBus`, `MessageQueue` |
| `@ecosystem/auth` | Authentication | `JWTValidator`, `RBAC` |

### Cross-Cutting Concerns

| Library | Purpose | Key Exports |
|---------|---------|-------------|
| `@ecosystem/audit-logging` | Audit trails | `AuditLogger`, `logAuditEntry` |
| `@ecosystem/encryption` | Data protection | `encrypt`, `decrypt`, `hashPII` |
| `@ecosystem/validation` | Input validation | `validateEntity`, `zodSchemas` |
| `@ecosystem/health` | Health checks | `runHealthChecks`, `createPostgresHealthCheck` |

### Observability

| Library | Purpose | Key Exports |
|---------|---------|-------------|
| `@ecosystem/logging` | Structured logs | `createLogger`, `pinoConfig` |
| `@ecosystem/observability` | Tracing/metrics | `tracer`, `meter`, `span` |

### Patterns

| Library | Purpose | Key Exports |
|---------|---------|-------------|
| `@ecosystem/outbox` | Transactional outbox | `OutboxProcessor`, `withOutbox` |
| `@ecosystem/saga` | Distributed transactions | `SagaOrchestrator`, `SagaStep` |

## Key Principles

1. **No Business Logic**: Shared libraries contain infrastructure, not domain rules
2. **Stable Interfaces**: Contract changes require careful versioning
3. **Domain Independence**: Domains import shared, never each other
4. **Type Safety**: All contracts are TypeScript-first with Zod validation
5. **Audit Everything**: Shared patterns include audit trail generation

## Adding New Shared Code

### When to add to shared/

- Type definitions used by 2+ domains
- Event schemas for cross-domain communication
- Infrastructure utilities (database, cache, messaging)
- Cross-cutting concerns (auth, audit, encryption)

### When NOT to add to shared/

- Domain-specific business logic
- Single-domain utilities
- Experimental features
- Domain entities or aggregates

### Process

1. Create package in appropriate directory
2. Define types/interfaces with Zod schemas
3. Export from package index
4. Add to workspace in root `pnpm-workspace.yaml`
5. Document in this README

## Development

```bash
# Build all shared packages
pnpm build --filter='./shared/**'

# Test shared packages
pnpm test --filter='./shared/**'

# Type check
pnpm typecheck --filter='./shared/**'
```

## Related Documentation

- [BACKBONE.md](../docs/BACKBONE.md) - Architecture and initialization guide
- [MISSION.md](../docs/MISSION.md) - Mission and values
- [operational/ARCHITECTURE.md](../operational/ARCHITECTURE.md) - Cross-domain patterns
