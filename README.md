# Business Ecosystem

A comprehensive multi-domain platform for managing complex business operations across legal, financial, compliance, and operational domains.

## Mission

**To provide a unified, compliant, and auditable platform that enables organizations to manage the complete lifecycle of their business operations** — from entity formation through daily operations — with regulatory compliance, audit trails, and cross-domain coordination built in from the foundation.

## What This Is

The business-ecosystem is a monorepo containing interconnected services that manage:

- **Legal entities and governance** — Corporate structures, boards, shareholders
- **Financial operations** — Accounting, banking, treasury, tax
- **Compliance and risk** — Regulatory requirements, KYC/AML, security
- **Operational activities** — Contracts, insurance, intellectual property, data privacy

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           OPERATIONAL LAYER                                  │
│                      "What the business DOES"                               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│  │  Contracts  │ │  Insurance  │ │     IP      │ │    Data Privacy     │   │
│  │   & Legal   │ │             │ │  Portfolio  │ │   (GDPR/CCPA)       │   │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────────┬──────────┘   │
│         │               │               │                    │              │
│         └───────────────┴───────┬───────┴────────────────────┘              │
│                                 │                                            │
│                    ┌────────────▼────────────┐                              │
│                    │     Orchestration       │                              │
│                    │  Workflows · Compliance │                              │
│                    │    Gateway · Reports    │                              │
│                    └────────────┬────────────┘                              │
├─────────────────────────────────┼───────────────────────────────────────────┤
│                                 │ Events & Queries                          │
├─────────────────────────────────┼───────────────────────────────────────────┤
│                           FOUNDATIONAL LAYER                                 │
│                       "What the business IS"                                │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐    │
│  │  Entity   │ │ Accounting│ │  Banking  │ │Compliance │ │    Tax    │    │
│  │Governance │ │           │ │ Treasury  │ │           │ │           │    │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘ └───────────┘    │
│  ┌───────────┐ ┌───────────┐                                               │
│  │    KYC    │ │ Corporate │                                               │
│  │ Identity  │ │ Security  │                                               │
│  └───────────┘ └───────────┘                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                           SHARED INFRASTRUCTURE                              │
│    Contracts · Events · Database · Cache · Auth · Messaging · Observability │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
business-ecosystem/
├── foundational/           # Core business entities and regulatory infrastructure
│   ├── entity-governance/  # Legal entities, corporate structure
│   ├── accounting/         # Double-entry bookkeeping, GL
│   ├── banking-treasury/   # Bank accounts, payments, cash management
│   ├── compliance/         # Regulatory requirements, audit findings
│   ├── tax/                # Tax returns, provisions, compliance
│   ├── kyc-identity/       # Identity verification, risk assessment
│   └── corporate-security/ # Security, access control, business continuity
│
├── operational/            # Business activity domains
│   ├── contracts-legal/    # Contract lifecycle, legal operations
│   ├── insurance/          # Policies, claims, coverage
│   ├── intellectual-property/ # Patents, trademarks, copyrights
│   ├── data-privacy/       # GDPR/CCPA, consent management
│   ├── gateway/            # Cross-operational API gateway
│   └── .orchestration/     # Workflows, compliance aggregation, reporting
│
├── shared/                 # Shared libraries and contracts
│   ├── contracts/          # Cross-domain type definitions
│   ├── events/             # Event schemas
│   ├── libs/               # Database, cache, auth, messaging, etc.
│   └── config/             # Shared configuration
│
├── infrastructure/         # DevOps and observability
│   ├── terraform/          # Infrastructure as Code
│   ├── docker-compose.yml  # Local development
│   └── init-scripts/       # Database initialization
│
└── docs/                   # Documentation
    ├── BACKBONE.md         # Architecture and initialization guide
    └── MISSION.md          # Mission, vision, and values
```

## Key Principles

1. **Two-Layer Architecture**: Foundational domains represent what the business *is*; operational domains represent what the business *does*. Operational depends on foundational, never the reverse.

2. **Event-Driven Integration**: Domains communicate via events, not direct API calls. This ensures loose coupling and auditability.

3. **Compliance by Design**: Every mutation generates an audit trail. Regulatory requirements are integrated, not bolted on.

4. **Entity-Scoped Operations**: All operational records belong to a legal entity. No orphaned data.

5. **Document Lifecycle**: All domains follow a unified document lifecycle: `DRAFT → PENDING_REVIEW → APPROVED → ACTIVE → EXPIRED/TERMINATED`

## Technology Stack

| Category | Technology |
|----------|------------|
| **Languages** | TypeScript (primary), Python (accounting) |
| **Runtime** | Node.js 20+, Python 3.11+ |
| **Frameworks** | Fastify, Hono, FastAPI |
| **Database** | PostgreSQL 16 |
| **Cache** | Redis 7 |
| **ORM** | Drizzle (TypeScript), SQLAlchemy (Python) |
| **Message Bus** | RabbitMQ / AWS SNS+SQS |
| **Monorepo** | pnpm workspaces + Turborepo |
| **Infrastructure** | Terraform, Docker, AWS |

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9.0+
- Docker and Docker Compose
- PostgreSQL 16 (or use Docker)

### Setup

```bash
# Clone and install dependencies
git clone <repository-url>
cd business-ecosystem
pnpm install

# Start infrastructure (PostgreSQL, Redis, RabbitMQ)
pnpm docker:up

# Run database migrations
pnpm db:migrate

# Start development servers
pnpm dev
```

### Running Specific Domains

```bash
# Foundational
pnpm dev --filter=entity-governance
pnpm dev --filter=accounting

# Operational
pnpm dev --filter=contracts-legal
pnpm dev --filter=insurance
```

## Documentation

| Document | Description |
|----------|-------------|
| [MISSION.md](./docs/MISSION.md) | Mission statement, vision, and values |
| [BACKBONE.md](./docs/BACKBONE.md) | Architecture guide and app initialization |
| [operational/README.md](./operational/README.md) | Operational layer documentation |
| [operational/ARCHITECTURE.md](./operational/ARCHITECTURE.md) | Cross-domain patterns and workflows |

## Service Ports

| Layer | Service | Port |
|-------|---------|------|
| Foundational | entity-governance | 3001 |
| Foundational | accounting | 3002 |
| Foundational | banking-treasury | 3003 |
| Foundational | compliance | 3004 |
| Operational | contracts-legal | 3011 |
| Operational | data-privacy | 3012 |
| Operational | insurance | 3013 |
| Operational | intellectual-property | 3014 |
| Orchestration | workflow-engine | 3020 |
| Orchestration | compliance-aggregator | 3021 |
| Orchestration | operational-gateway | 3022 |
| Orchestration | reporting | 3023 |

## Contributing

1. Follow the patterns in [BACKBONE.md](./docs/BACKBONE.md)
2. Ensure all changes include appropriate tests
3. Generate audit entries for all mutations
4. Update documentation for new domains
5. Run `pnpm typecheck && pnpm lint && pnpm test` before committing

## License

Proprietary - All rights reserved.
