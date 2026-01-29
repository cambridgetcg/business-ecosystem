# Entity Governance

A foundational service for legal entity formation, corporate structure, governance, and compliance management.

## Architecture

```
src/
├── api/                    # API Layer
│   └── rest/              # Fastify REST endpoints
├── application/           # Application Layer (CQRS)
│   ├── commands/          # Write operations
│   ├── queries/           # Read operations
│   └── handlers/          # Command/Query handlers
├── domain/                # Domain Layer (Business Logic)
│   ├── entity/            # Legal entity aggregate
│   ├── events/            # Domain events for integration
│   └── value-objects/     # Jurisdiction, Address, Money, etc.
└── infrastructure/        # Infrastructure Layer
    ├── persistence/       # Drizzle ORM, repositories
    ├── integration/       # Event publishers/handlers
    └── aws/               # Secrets Manager, cloud services
```

## Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Language | TypeScript | Type safety, domain modeling |
| Framework | Fastify | REST API with validation |
| ORM | Drizzle | Type-safe database access |
| Database | PostgreSQL 16 | ACID compliance, audit trails |
| Validation | Zod | Schema validation |
| DI Container | tsyringe | Dependency injection |
| Infrastructure | AWS (RDS, ECS, Fargate) | Cloud deployment |
| IaC | Terraform | Infrastructure as code |

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 8+
- Docker & Docker Compose
- AWS CLI (for deployment)
- Terraform 1.5+ (for infrastructure)

### Local Development

1. **Install dependencies**
   ```bash
   pnpm install
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
   pnpm db:migrate
   ```

5. **Start the API**
   ```bash
   pnpm dev
   ```

The API will be available at `http://localhost:3000` with Swagger docs at `/docs`.

## AWS Infrastructure

Deploy to AWS using Terraform:

```bash
cd terraform
terraform init
terraform plan -var="db_password=<your-secure-password>"
terraform apply
```

This provisions:
- VPC with public/private subnets
- RDS PostgreSQL 16 instance
- ECS Fargate cluster
- Secrets Manager for credentials
- Security groups and IAM roles

## Domain Concepts

### Subdomains

#### entity
Legal entity formation and lifecycle management.
- Legal entity (Corporation, LLC, LP, Partnership, etc.)
- Entity type and status tracking
- Jurisdiction (state/country of incorporation)
- Incorporation documents

#### corporate-structure
Parent/subsidiary relationships and organizational hierarchy.
- Parent-subsidiary ownership
- Ownership percentages
- Holding company structures
- Organizational charts

#### governance
Board composition and decision-making frameworks.
- Board of directors
- Committees (audit, compensation, nominating)
- Voting rights and protocols
- Corporate bylaws

#### shareholders
Equity ownership and cap table management.
- Shareholder registry
- Cap table tracking
- Share classes (common, preferred, series)
- Equity grants (options, RSUs, warrants)

#### corporate-records
Statutory records and document management.
- Board and shareholder meeting minutes
- Written resolutions and consents
- Statutory registers
- Corporate action documentation

#### officers-directors
Leadership appointments and responsibilities.
- Officers (CEO, CFO, Secretary, etc.)
- Directors and board members
- Appointment records
- Compensation tracking

#### registered-agent
Statutory representation and service of process.
- Registered agent designation
- Service of process handling
- Registered office address

#### annual-filings
State and regulatory filing compliance.
- Annual report filings
- Jurisdiction-specific requirements
- Filing deadline tracking
- Submission and acceptance status

### Key Invariants

1. **Entity as Aggregate Root** - All entity data accessed through LegalEntity aggregate
2. **Immutable Corporate Actions** - Meeting minutes and resolutions cannot be modified after approval
3. **Jurisdictional Compliance** - Filing requirements auto-generated based on entity jurisdiction
4. **Full Audit Trail** - All entity changes tracked with who/when/what

### Event-Driven Integration

Entity Governance publishes domain events consumed by other services:

- `entity.created` → Accounting, Banking, Tax, Compliance
- `entity.updated` → All dependent services
- `entity.dissolved` → Triggers cleanup across ecosystem
- `subsidiary.added` → Updates organizational structure
- `filing.completed` → Compliance tracking
- `shares.issued` → Cap table updates

## API Endpoints

### Legal Entities

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/entities` | List entities with filters |
| GET | `/api/v1/entities/:id` | Get entity by ID |
| POST | `/api/v1/entities` | Create new entity |
| PATCH | `/api/v1/entities/:id` | Update entity |
| POST | `/api/v1/entities/:id/dissolve` | Dissolve entity |
| DELETE | `/api/v1/entities/:id` | Soft delete entity |
| GET | `/api/v1/entities/:id/subsidiaries` | Get subsidiaries |
| GET | `/api/v1/entities/:id/parent` | Get parent entity |

Full API documentation available at `/docs` (Swagger UI).

## Data Partitioning Strategy

**Single Database, Logical Partitioning**
- All 8 subdomains share one PostgreSQL database
- Entity-centric model with `entity_id` foreign keys
- Time-based partitioning on `audit_log` table
- Soft delete with `deleted_at` for compliance

See `terraform/PARTITIONING.md` for detailed strategy.

## Key Integrations

### Provides Entity Context To:
- **banking-treasury** - Entity information for account ownership
- **compliance** - Entity-level compliance requirements
- **tax** - Nexus and jurisdiction information
- **intellectual-property** - IP ownership attribution
- **accounting** - GL account structure by entity

### Consumes From:
- **tax** - Tax ID assignments (EIN, state IDs)
- **compliance** - Jurisdiction-specific filing requirements

## Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Type checking
pnpm typecheck

# Linting
pnpm lint
```

## Deployment

### Build Docker image
```bash
docker build -t entity-governance:latest .
```

### Push to ECR
```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
docker tag entity-governance:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/entity-governance:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/entity-governance:latest
```

### Deploy to ECS
```bash
aws ecs update-service --cluster entity-governance-dev-cluster --service entity-governance --force-new-deployment
```

## Further Documentation

- [PURPOSE.md](./PURPOSE.md) - Mission statement and design principles
- [terraform/PARTITIONING.md](./terraform/PARTITIONING.md) - Data partitioning strategy
- [/docs/BACKBONE.md](../../docs/BACKBONE.md) - Ecosystem-wide architecture patterns
