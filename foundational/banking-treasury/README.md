# Banking & Treasury (`@ecosystem/banking-treasury`)

Cash management and treasury operations for the business ecosystem. Handles bank accounts, payments, forecasting, and reconciliation.

## Domain Overview

**Aggregates:**
- **BankAccount**: Core entity for managing bank accounts across the organization
- **Payment**: Tracks inbound/outbound payments and their lifecycle
- **CashForecast**: Treasury planning and liquidity projections
- **Reconciliation**: Bank statement reconciliation

**Key Flows:**
1. Create and manage bank accounts
2. Initiate and track payments
3. Generate cash forecasts for treasury planning
4. Reconcile bank statements with system records
5. Emit financial events for cross-domain consumption

## Architecture

### Domain Layer (`src/domain/`)
- **Entities**: BankAccount, Payment, CashForecast, Reconciliation
- **Value Objects**: AccountNumber (encrypted), RoutingNumber, Money (from contracts)
- **Services**: PaymentService, ForecastService (pure business logic)
- **Events**: Re-export from @ecosystem/events-financial

### Application Layer (`src/application/`)
- **Commands**: CreateBankAccount, InitiatePayment, GenerateForecast
- **Queries**: GetAccounts, GetCashPosition, GetForecast
- **Handlers**: Command/Query handlers with transaction management

### Infrastructure Layer (`src/infrastructure/`)
- **Persistence**: Drizzle ORM with PostgreSQL
- **Messaging**: SNS/SQS event publishing
- **External**: Bank integrations (Plaid, MX), Payment providers (Stripe)

### API Layer (`src/api/`)
- REST endpoints following OpenAPI spec
- Request validation with Zod
- Error handling with audit logging

## Quick Start

### Development

```bash
# Install dependencies
pnpm install

# Create .env file
cp .env.example .env
# Update DATABASE_URL to point to local PostgreSQL

# Run migrations
pnpm db:generate
pnpm db:migrate

# Start development server
pnpm dev
```

Server runs on `http://localhost:3000`

### Testing

```bash
# Unit tests
pnpm test:unit

# Integration tests (with testcontainers)
pnpm test:integration

# All tests
pnpm test

# Watch mode
pnpm test:watch
```

### Linting & Type Checking

```bash
pnpm lint
pnpm typecheck
```

## Database Schema

**Core Tables:**
- `bank_accounts` - Account records with balance tracking
- `payments` - Payment transactions with lifecycle status
- `cash_forecasts` - Treasury forecasts and projections
- `reconciliations` - Bank statement reconciliation records

All tables include:
- `id` (UUID primary key)
- `version` (optimistic locking)
- `created_at`, `updated_at` (audit timestamps)
- `created_by`, `updated_by` (user tracking)
- `deleted_at` (soft delete support)

## Environment Variables

```
NODE_ENV         # development | production | test
PORT             # Server port (default: 3000)
DATABASE_URL     # PostgreSQL connection string
LOG_LEVEL        # debug | info | warn | error
```

## Cross-Domain Contracts

- **@ecosystem/contracts-financial**: BankAccount, Payment, Invoice, Money schemas
- **@ecosystem/events-financial**: Transaction, Invoice, Account events
- **@ecosystem/database**: Base repository pattern
- **@ecosystem/messaging**: Event bus abstraction

## Deployment

### Docker

```bash
# Build image
docker build -t banking-treasury:latest .

# Run container
docker run -e DATABASE_URL=... banking-treasury:latest
```

### Infrastructure

- **Database**: PostgreSQL 16+ with ACID compliance
- **Messaging**: AWS SNS/SQS for event distribution
- **Storage**: S3 for bank statements and documents
- **Secrets**: AWS Secrets Manager for credentials

## API Examples

### Create Bank Account

```bash
POST /accounts HTTP/1.1
Content-Type: application/json

{
  "entityId": "550e8400-e29b-41d4-a716-446655440000",
  "accountName": "Primary Operating Account",
  "accountType": "checking",
  "bankName": "Chase",
  "accountNumber": "****1234",
  "currency": "USD",
  "status": "active"
}
```

### Get Cash Position

```bash
GET /cash-position?entityId=550e8400-e29b-41d4-a716-446655440000 HTTP/1.1
```

### Initiate Payment

```bash
POST /payments HTTP/1.1
Content-Type: application/json

{
  "transactionId": "550e8400-e29b-41d4-a716-446655440000",
  "amount": { "amount": 50000, "currency": "USD" },
  "method": "bank_transfer",
  "invoiceId": "optional-invoice-id"
}
```

## Contributing

Follow the [BACKBONE.md](../../docs/BACKBONE.md) guidelines:
- Domain-driven design with clean architecture
- Test-driven development (unit + integration)
- Event-driven communication
- Audit logging for all mutations

## Compliance & Security

- Column-level encryption for PII (account numbers, routing numbers)
- Audit trail for all account modifications
- Role-based access control at API layer
- Immutable payment records
- Soft-delete for data retention

## Monitoring & Observability

- Structured logging with Pino
- OpenTelemetry for distributed tracing
- Prometheus metrics for cash positions
- Health checks at `/health`
