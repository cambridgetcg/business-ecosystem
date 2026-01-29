# Shared Libraries - Purpose

## Purpose

**To provide battle-tested infrastructure utilities** that enable consistent behavior across all services — database access, caching, messaging, authentication, encryption, and observability.

---

## What This Module Does

The `shared/libs` module provides reusable infrastructure libraries:

### Core Infrastructure
| Library | Purpose |
|---------|---------|
| `@ecosystem/repository` | **NEW** - Full repository pattern with Drizzle ORM, soft delete, audit trail, multi-tenant scoping |
| `@ecosystem/database` | Database connections, basic repository utilities, caching |
| `@ecosystem/cache` | Redis caching abstraction, cache-aside pattern |
| `@ecosystem/messaging` | Event bus, message queue integration |
| `@ecosystem/auth` | JWT validation, RBAC utilities |

### Cross-Cutting Concerns
| Library | Purpose |
|---------|---------|
| `@ecosystem/audit-logging` | Audit trail generation |
| `@ecosystem/encryption` | Data encryption/decryption, PII hashing |
| `@ecosystem/validation` | Input validation, Zod utilities |
| `@ecosystem/health` | Health check utilities |

### Observability
| Library | Purpose |
|---------|---------|
| `@ecosystem/logging` | Structured logging (Pino) |
| `@ecosystem/observability` | OpenTelemetry tracing and metrics |

### Patterns
| Library | Purpose |
|---------|---------|
| `@ecosystem/outbox` | Transactional outbox pattern |
| `@ecosystem/saga` | Saga orchestration for distributed transactions |
| `@ecosystem/service-client` | HTTP client with retry, circuit breaker |

---

## Why This Exists

Without shared libraries:
- Each service implements database access differently
- Caching strategies vary and may have bugs
- Logging formats are inconsistent
- Authentication is reimplemented per service

With shared libraries:
- Proven implementations used everywhere
- Bugs fixed once, benefit all services
- Consistent operational behavior
- Reduced boilerplate in each service

---

## Usage

```typescript
import { createRepository, withCache } from '@ecosystem/database';
import { createLogger } from '@ecosystem/logging';
import { AuditLogger } from '@ecosystem/audit-logging';

const logger = createLogger('my-service');
const repo = createRepository(MyEntity);
const auditLogger = new AuditLogger(context);
```

---

## Key Principles

1. **No business logic** — Infrastructure only, domain rules stay in services
2. **Tested thoroughly** — Libraries have comprehensive test coverage
3. **Minimal dependencies** — Each library minimizes external dependencies
4. **Documented APIs** — Clear usage documentation and examples
5. **Versioned releases** — SemVer for predictable updates

---

## When to Add a Library

Add to shared/libs when:
- 2+ services need the same infrastructure capability
- Implementation is complex enough to warrant central maintenance
- Consistency of behavior matters across services

Do NOT add when:
- Only one service needs it
- It contains domain-specific logic
- It's experimental or unstable

---

*This module provides the infrastructure foundation that all services build upon.*
