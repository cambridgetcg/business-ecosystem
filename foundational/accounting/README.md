# Accounting System

A foundational double-entry bookkeeping platform built with Python, FastAPI, and PostgreSQL.

## Architecture

```
src/
├── api/                    # API Layer
│   ├── rest/              # FastAPI REST endpoints
│   ├── graphql/           # GraphQL schema and resolvers
│   └── webhooks/          # Webhook handlers
├── application/           # Application Layer (CQRS)
│   ├── commands/          # Write operations
│   └── queries/           # Read operations
├── domain/                # Domain Layer (Business Logic)
│   ├── shared/            # Shared value objects, exceptions
│   ├── general-ledger/    # GL entries, accounts
│   ├── chart-of-accounts/ # Account hierarchy
│   └── ...                # Other bounded contexts
└── infrastructure/        # Infrastructure Layer
    ├── persistence/       # Database, ORM, repositories
    ├── messaging/         # Event bus, queues
    └── external/          # External integrations
```

## Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Language | Python 3.12 | Runtime |
| Framework | FastAPI | REST API |
| ORM | SQLAlchemy 2.0 | Database access |
| Database | PostgreSQL 16 | ACID-compliant storage |
| Migrations | Alembic | Schema versioning |
| Validation | Pydantic v2 | Request/response validation |
| Infrastructure | AWS (RDS, ECS) | Cloud deployment |
| IaC | Terraform | Infrastructure as code |

## Getting Started

### Prerequisites

- Python 3.12+
- Docker & Docker Compose
- AWS CLI (for deployment)
- Terraform 1.6+ (for infrastructure)

### Local Development

1. **Setup environment**
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   pip install -e ".[dev]"
   ```

2. **Copy environment file**
   ```bash
   cp .env.example .env
   ```

3. **Start local services**
   ```bash
   docker-compose up -d postgres
   ```

4. **Run migrations**
   ```bash
   alembic upgrade head
   ```

5. **Start the API**
   ```bash
   uvicorn src.api.rest.app:app --reload
   ```

## AWS Infrastructure

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

## Domain Concepts

### Double-Entry Bookkeeping

Every transaction affects at least two accounts with equal debits and credits:
Assets = Liabilities + Equity

### Key Invariants

1. Debits = Credits (every entry must balance)
2. Immutable Entries (posted entries cannot be modified)
3. Period Controls (closed periods reject new entries)
4. Full Audit Trail (all changes tracked)
