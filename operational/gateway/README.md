# Operational Gateway

Unified API gateway for cross-operational queries and actions.

## Purpose

The `gateway/` service provides a **single entry point** for cross-operational queries that span multiple domains. Instead of clients calling each domain separately, the gateway:

1. **Aggregates Data** — Combines responses from multiple operational domains
2. **Provides Unified Views** — Entity-centric operational overviews
3. **Routes Requests** — Proxies to appropriate domain services
4. **Coordinates Actions** — Triggers cross-domain workflows

```
┌────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                        │
│                   (Web App, Mobile, External APIs)                         │
└─────────────────────────────────┬──────────────────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                        OPERATIONAL GATEWAY                                  │
│                           (Port 3022)                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Overview   │  │  Compliance  │  │   Pending    │  │   Expiring   │  │
│  │  Aggregator  │  │    Proxy     │  │   Actions    │  │    Items     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────┬──────────────────────────────────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
          ▼                       ▼                       ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  contracts-legal │  │    insurance     │  │ intellectual-    │
│     (3011)       │  │     (3013)       │  │   property       │
└──────────────────┘  └──────────────────┘  │     (3014)       │
                                            └──────────────────┘
          │                       │                       │
          └───────────────────────┼───────────────────────┘
                                  ▼
                      ┌──────────────────┐
                      │   data-privacy   │
                      │     (3012)       │
                      └──────────────────┘
```

## Key Features

### 1. Entity Operational Overview

Get a complete operational picture for any legal entity:

```
GET /operational/entities/:entityId/overview

Response:
{
  "entityId": "uuid",
  "domains": {
    "contracts-legal": { "activeCount": 12, "pendingCount": 3 },
    "insurance": { "activeCount": 5, "pendingCount": 1 },
    "intellectual-property": { "activeCount": 8, "pendingCount": 0 },
    "data-privacy": { "activeCount": 2, "pendingCount": 1 }
  },
  "pendingActions": [...],
  "expiringItems": [...],
  "complianceStatus": { "overall": "compliant", ... }
}
```

### 2. Cross-Domain Queries

| Endpoint | Description |
|----------|-------------|
| `/operational/pending-actions` | All pending items across domains |
| `/operational/expiring` | Items expiring within N days |
| `/operational/domains/health` | Health status of all domains |

### 3. Compliance Proxy

Routes to compliance aggregator service:

```
GET /operational/entities/:entityId/compliance
GET /operational/entities/:entityId/compliance/dashboard
```

### 4. Workflow Integration

Trigger cross-domain workflows:

```
POST /operational/workflows/:workflowId/trigger
GET /operational/workflows
```

## API Endpoints

### Entity Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/operational/entities/:entityId/overview` | Full operational overview |
| GET | `/operational/entities/:entityId/compliance` | Compliance status |
| GET | `/operational/entities/:entityId/compliance/dashboard` | Compliance dashboard |
| GET | `/operational/entities/:entityId/pending-actions` | Pending items for entity |
| GET | `/operational/entities/:entityId/expiring` | Expiring items for entity |

### Cross-Domain Queries

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/operational/pending-actions` | All pending actions |
| GET | `/operational/expiring` | All expiring items |
| GET | `/operational/domains/health` | Domain service health |

### Workflow Integration

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/operational/workflows` | List available workflows |
| POST | `/operational/workflows/:id/trigger` | Trigger workflow |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Gateway health + domain connectivity |

## Query Parameters

### Pending Actions

```
GET /operational/pending-actions?
  entityId=uuid           # Filter by entity
  domains=contracts-legal,insurance  # Filter by domains
  priority=high           # Filter by priority
  assignee=user-uuid      # Filter by assignee
  dueBefore=2024-02-01    # Due before date
  limit=100               # Pagination
  offset=0
```

### Expiring Items

```
GET /operational/expiring?
  entityId=uuid           # Filter by entity
  domains=insurance       # Filter by domains
  days=30                 # Expiring within N days
  renewal-required=true   # Only items requiring renewal
  limit=100
  offset=0
```

## Architecture

```typescript
// Gateway aggregates from domain clients
const domainClients = new Map([
  ['contracts-legal', new DomainClient('http://localhost:3011')],
  ['insurance', new DomainClient('http://localhost:3013')],
  ['intellectual-property', new DomainClient('http://localhost:3014')],
  ['data-privacy', new DomainClient('http://localhost:3012')],
]);

// Aggregator combines responses
const aggregator = new OperationalAggregator(domainClients, {
  complianceUrl: 'http://localhost:3021',
});
```

## Configuration

```bash
# Environment variables
PORT=3022

# Domain service URLs
CONTRACTS_LEGAL_URL=http://localhost:3011
DATA_PRIVACY_URL=http://localhost:3012
INSURANCE_URL=http://localhost:3013
IP_URL=http://localhost:3014

# Orchestration services
COMPLIANCE_URL=http://localhost:3021
WORKFLOW_ENGINE_URL=http://localhost:3020

# Timeouts
DOMAIN_TIMEOUT_MS=10000
COMPLIANCE_TIMEOUT_MS=10000
```

## Error Handling

The gateway handles partial failures gracefully:

- If one domain is unavailable, returns data from healthy domains
- Includes domain health status in responses
- Never blocks on unhealthy services

```typescript
// Response with partial data
{
  "entityId": "uuid",
  "domains": {
    "contracts-legal": { ... },      // OK
    "insurance": { "error": "Service unavailable" },  // Failed
    "intellectual-property": { ... } // OK
  }
}
```

## Development

```bash
# Start gateway
pnpm dev --filter=gateway

# Start all operational services
pnpm dev --filter='./operational/**'

# Test
pnpm test --filter=gateway
```

## Related Documentation

- [operational/README.md](../README.md) - Operational layer overview
- [operational/ARCHITECTURE.md](../ARCHITECTURE.md) - Cross-domain patterns
- [.orchestration/README.md](../.orchestration/README.md) - Workflow engine
