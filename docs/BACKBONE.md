# Business Ecosystem Backbone Layer

## Overview

Standardized process for building the backbone layer for all apps within this ecosystem.
This document serves as the canonical reference for initializing any app in `foundational/`, `operational/`, or future directories.

---

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Runtime | TypeScript/Node.js | Type safety, rich ecosystem, aligns with domain model (.ts files) |
| Deployment | Cloud Native (AWS/GCP/Azure) | Scalable, managed infrastructure, compliance certifications |
| Database | PostgreSQL | ACID compliance, audit trails, regulatory data integrity |
| API Style | REST + Event-Driven | REST for queries, events for cross-domain communication |
| Monorepo | Yes (pnpm workspaces) | Shared contracts, consistent versioning, atomic changes |

---

## Directory Structure (Per App)

```
foundational/
├── {app-name}/
│   ├── src/
│   │   ├── domain/           # Domain entities, value objects, aggregates
│   │   │   ├── entities/     # Core business objects
│   │   │   ├── value-objects/# Immutable domain values
│   │   │   ├── events/       # Domain events
│   │   │   └── services/     # Domain services (pure business logic)
│   │   ├── application/      # Use cases, application services
│   │   │   ├── commands/     # Write operations (mutations)
│   │   │   ├── queries/      # Read operations
│   │   │   └── handlers/     # Command/Query handlers
│   │   ├── infrastructure/   # External concerns
│   │   │   ├── persistence/  # Repository implementations
│   │   │   ├── messaging/    # Event publishers/subscribers
│   │   │   └── external/     # Third-party integrations
│   │   ├── api/              # API layer
│   │   │   ├── rest/         # REST controllers
│   │   │   ├── graphql/      # GraphQL resolvers (optional)
│   │   │   └── grpc/         # gRPC services (optional)
│   │   └── index.ts          # App entry point
│   ├── tests/
│   │   ├── unit/             # Domain logic tests
│   │   ├── integration/      # Database/API tests
│   │   └── e2e/              # End-to-end flows
│   ├── docs/
│   │   ├── api/              # OpenAPI specs
│   │   └── domain/           # Domain documentation
│   ├── migrations/           # Database migrations
│   ├── package.json          # App-specific dependencies
│   ├── tsconfig.json         # TypeScript config (extends root)
│   ├── Dockerfile            # Container definition
│   └── README.md             # App documentation
```

---

## Shared Infrastructure

```
shared/
├── contracts/                # Cross-domain type definitions
│   ├── identity/             # Identity-related contracts
│   ├── financial/            # Financial data contracts
│   ├── entity/               # Entity/governance contracts
│   ├── document/             # Document contracts
│   └── audit/                # Audit trail contracts
├── libs/                     # Shared libraries
│   ├── encryption/           # Encryption utilities
│   ├── audit-logging/        # Audit logging library
│   ├── validation/           # Common validators
│   ├── database/             # Database utilities, base repository
│   ├── messaging/            # Event bus abstraction
│   └── auth/                 # Authentication/authorization
├── events/                   # Event schemas (cross-domain)
│   ├── entity-events/
│   ├── compliance-events/
│   ├── legal-events/
│   └── financial-events/
└── config/                   # Shared configuration
```

---

## Package Stack (Standardized)

### Core Runtime
```json
{
  "dependencies": {
    "typescript": "^5.4.0",
    "@types/node": "^20.0.0"
  }
}
```

### Framework Layer
| Category | Package | Purpose |
|----------|---------|---------|
| **Web Framework** | `fastify` | High-performance, schema-based REST API |
| **Validation** | `zod` | Runtime type validation, schema inference |
| **ORM** | `drizzle-orm` | Type-safe SQL, migrations, no magic |
| **Database Driver** | `pg` | PostgreSQL native driver |
| **Dependency Injection** | `tsyringe` | Lightweight DI for clean architecture |
| **Event Bus** | `@aws-sdk/client-sqs` + `@aws-sdk/client-sns` | Cloud-native messaging |
| **Logging** | `pino` | High-performance structured logging |
| **Config** | `@t3-oss/env-core` | Type-safe environment variables |

### Testing Stack
| Category | Package | Purpose |
|----------|---------|---------|
| **Test Runner** | `vitest` | Fast, TypeScript-native testing |
| **Mocking** | `vitest` (built-in) | Mock functions and modules |
| **API Testing** | `supertest` | HTTP assertion library |
| **Database Testing** | `testcontainers` | Disposable PostgreSQL containers |

### DevOps & Tooling
| Category | Package | Purpose |
|----------|---------|---------|
| **Linting** | `eslint` + `@typescript-eslint/*` | Code quality |
| **Formatting** | `prettier` | Consistent formatting |
| **Build** | `tsup` | Fast TypeScript bundling |
| **Monorepo** | `pnpm` + workspaces | Package management |
| **Git Hooks** | `husky` + `lint-staged` | Pre-commit checks |

### Infrastructure (AWS-focused)
| Category | Package | Purpose |
|----------|---------|---------|
| **IaC** | `aws-cdk` | Infrastructure as Code |
| **Secrets** | `@aws-sdk/client-secrets-manager` | Secret management |
| **Storage** | `@aws-sdk/client-s3` | Document storage |
| **Observability** | `@opentelemetry/*` | Distributed tracing |

---

## Initialization Script

Run this to initialize any new app:

```bash
#!/bin/bash
# init-app.sh <app-name> <layer>
# Example: ./init-app.sh accounting foundational

APP_NAME=$1
LAYER=$2  # foundational, operational, growth

cd $LAYER/$APP_NAME

# Initialize package.json
pnpm init

# Install core dependencies
pnpm add fastify zod drizzle-orm pg tsyringe reflect-metadata pino

# Install dev dependencies
pnpm add -D typescript @types/node vitest supertest testcontainers \
  eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser \
  prettier tsup husky lint-staged

# Create tsconfig.json
cat > tsconfig.json << 'EOF'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
EOF

# Create source structure
mkdir -p src/{domain/{entities,value-objects,events,services},application/{commands,queries,handlers},infrastructure/{persistence,messaging,external},api/rest}

# Create entry point
cat > src/index.ts << 'EOF'
import 'reflect-metadata';
import { buildApp } from './api/rest/app';

const start = async () => {
  const app = await buildApp();
  await app.listen({ port: 3000, host: '0.0.0.0' });
  console.log('Server running on http://localhost:3000');
};

start();
EOF

# Create Dockerfile
cat > Dockerfile << 'EOF'
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
EXPOSE 3000
CMD ["node", "dist/index.js"]
EOF

echo "Initialized $APP_NAME in $LAYER"
```

---

## Standard App Backbone Template

Each app gets these foundational files:

### 1. Base Repository (shared/libs/database/base-repository.ts)
```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

export abstract class BaseRepository<T> {
  protected db: ReturnType<typeof drizzle>;

  constructor(pool: Pool) {
    this.db = drizzle(pool);
  }

  abstract findById(id: string): Promise<T | null>;
  abstract save(entity: T): Promise<void>;
  abstract delete(id: string): Promise<void>;
}
```

### 2. Domain Event Base (shared/libs/messaging/domain-event.ts)
```typescript
export interface DomainEvent {
  eventId: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  occurredAt: Date;
  payload: Record<string, unknown>;
  metadata: {
    correlationId: string;
    causationId?: string;
    userId?: string;
  };
}
```

### 3. Audit Logger (shared/libs/audit-logging/audit-logger.ts)
```typescript
import pino from 'pino';

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  timestamp: Date;
  changes?: Record<string, { from: unknown; to: unknown }>;
  metadata?: Record<string, unknown>;
}

export const auditLogger = pino({
  name: 'audit',
  level: 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
});

export const logAuditEntry = (entry: AuditEntry) => {
  auditLogger.info(entry, `AUDIT: ${entry.action} on ${entry.entityType}`);
};
```

---

## Cross-Cutting Concerns

### Authentication & Authorization
- Use JWT tokens with claims-based authorization
- Implement RBAC (Role-Based Access Control) at API layer
- Propagate user context through all layers

### Data Encryption
- Encrypt PII at rest using AES-256
- Use AWS KMS for key management
- Column-level encryption for sensitive fields

### Audit Trail Requirements
- Every mutation must generate an audit entry
- Include: who, what, when, from-state, to-state
- Immutable audit log (append-only)

### Compliance Hooks
- Pre-save validation hooks for regulatory rules
- Post-save event emission for compliance monitoring
- Retention policy enforcement

---

## Database Schema Conventions

```sql
-- Every table includes these columns
CREATE TABLE {table_name} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TIMESTAMPTZ,  -- Soft delete

  -- Domain-specific columns...
);

-- Audit trail table per domain
CREATE TABLE {domain}_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(100) NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,
  actor_id UUID NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changes JSONB,
  metadata JSONB
);
```

---

## CI/CD Pipeline Template

```yaml
# .github/workflows/app-ci.yml
name: App CI

on:
  push:
    paths:
      - '{layer}/{app-name}/**'

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm --filter {app-name} test
      - run: pnpm --filter {app-name} lint

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/build-push-action@v5
        with:
          context: ./{layer}/{app-name}
          push: false
          tags: {app-name}:${{ github.sha }}
```

---

## App Initialization Checklist

When bootstrapping any app in this ecosystem:

- [ ] Run `init-app.sh {app-name} {layer}`
- [ ] Define domain entities in `src/domain/entities/`
- [ ] Create Drizzle schema in `src/infrastructure/persistence/schema.ts`
- [ ] Generate initial migration: `pnpm drizzle-kit generate`
- [ ] Implement repository interfaces
- [ ] Define API routes in `src/api/rest/`
- [ ] Write unit tests for domain logic
- [ ] Write integration tests with testcontainers
- [ ] Configure environment variables in `.env.example`
- [ ] Add app to root `pnpm-workspace.yaml`
- [ ] Create Dockerfile
- [ ] Add CI workflow

---

## Foundational Apps Reference

| App | Domain | Key Entities |
|-----|--------|--------------|
| accounting | Financial records | Account, JournalEntry, Transaction |
| banking-treasury | Cash management | BankAccount, Payment, CashForecast |
| compliance | Regulatory | Policy, AuditFinding, Remediation |
| corporate-security | Risk/Security | Incident, AccessLog, BusinessContinuityPlan |
| entity-governance | Legal entities | LegalEntity, Board, Shareholder |
| kyc-identity | Identity | Identity, KYCCheck, RiskAssessment |
| tax | Tax compliance | TaxReturn, TaxLiability, TaxProvision |

---

## Next Steps

1. Initialize root monorepo configuration
2. Set up shared libraries
3. Bootstrap first app (recommend: entity-governance as foundation)
4. Establish event contracts between domains
5. Deploy infrastructure (database, message bus)
