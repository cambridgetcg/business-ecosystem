# Dimension 30: Gateway Architecture

## What

The Operational Gateway is the **unified API entry point** for cross-operational queries. It aggregates data from multiple domain services, handles partial failures gracefully, and provides entity-centric operational views.

**Location**: `/gateway`
**Port**: 3022
**Framework**: Hono

## Why

Clients need a single place to get "entity operational overview" without calling 4+ services themselves. Individual domain services are autonomous and own their data, but business operations frequently span multiple domains simultaneously.

The gateway exists to:
- Aggregate data from all operational domains into unified views
- Handle partial failures (return data from healthy domains even if one is down)
- Normalize responses from heterogeneous domain APIs
- Provide cross-domain queries (pending actions, expiring items)
- Coordinate workflow triggers

## How

### Architecture

```
┌────────────────────────────────────────────────────┐
│                    CLIENTS                          │
└──────────────────────┬─────────────────────────────┘
                       │
┌──────────────────────▼─────────────────────────────┐
│              OPERATIONAL GATEWAY (3022)             │
│  ┌──────────────┬──────────────┬──────────────┐   │
│  │   Overview   │  Compliance  │   Pending    │   │
│  │  Aggregator  │    Proxy     │   Actions    │   │
│  └──────────────┴──────────────┴──────────────┘   │
└──────────────────────┬─────────────────────────────┘
                       │
       ┌───────────────┼───────────────┐
       ▼               ▼               ▼
┌────────────┐  ┌────────────┐  ┌────────────┐
│contracts   │  │ insurance  │  │    IP      │
│  (3011)    │  │  (3013)    │  │  (3014)    │
└────────────┘  └────────────┘  └────────────┘
       │               │               │
       └───────────────┼───────────────┘
                       ▼
              ┌────────────┐
              │data-privacy│
              │  (3012)    │
              └────────────┘
```

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| DomainClient | `domain-client.ts` | HTTP wrapper for domain calls with timeout |
| OperationalAggregator | `aggregator.ts` | Combines responses from multiple domains |
| API Endpoints | `index.ts` | Hono REST API exposing aggregated operations |

### Aggregation Flow

```
1. Client calls: GET /operational/entities/{entityId}/overview

2. Gateway receives request

3. OperationalAggregator.getEntityOverview():
   Promise.all([
     fetchDomainSummaries(entityId, domains),    // Parallel to all 4 domains
     fetchPendingActions({entityId}),            // /pending-actions each domain
     fetchExpiringItems({entityId, withinDays}), // /expiring each domain
     fetchComplianceOverview(entityId)           // Call to compliance aggregator
   ])

4. Each DomainClient makes HTTP with timeout:
   - Success: Return domain data
   - Failure: Return degraded status + empty data

5. Aggregator combines results:
   - Domain summaries into domains map
   - Pending actions sorted by priority, then due date
   - Expiring items sorted by days until expiry
   - Compliance status overall + per-domain

6. Response returned
```

### Partial Failure Handling

**Critical design decision**: Gateway never blocks on unhealthy services.

```typescript
// Response with partial data
{
  "entityId": "uuid",
  "domains": {
    "contracts-legal": { /* OK */ },
    "insurance": { "error": "Service unavailable" },  // Failed
    "intellectual-property": { /* OK */ }
  }
}
```

### API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /operational/entities/:entityId/overview` | Full operational overview |
| `GET /operational/entities/:entityId/compliance` | Compliance status |
| `GET /operational/entities/:entityId/pending-actions` | Pending items for entity |
| `GET /operational/entities/:entityId/expiring` | Expiring items for entity |
| `GET /operational/pending-actions` | All pending actions (cross-entity) |
| `GET /operational/expiring?days=30` | All expiring items |
| `GET /operational/domains/health` | Domain service health |
| `GET /operational/workflows` | List available workflows |
| `POST /operational/workflows/:id/trigger` | Trigger workflow |

## Where

| Component | Path |
|-----------|------|
| Entry Point | `gateway/src/index.ts` |
| Aggregator | `gateway/src/aggregator.ts` |
| Domain Client | `gateway/src/domain-client.ts` |
| Types | `gateway/src/types.ts` |
| README | `gateway/README.md` |

## Connections

**Gateway depends on**:
- contracts-legal (3011)
- data-privacy (3012)
- insurance (3013)
- intellectual-property (3014)
- compliance aggregator (3021)
- workflow engine (3020)

**Domain Contract Required**:
Domains must expose:
- `/health` - Health check
- `/entities/{id}/summary` - Domain summary for entity
- `/entities/{id}/pending-actions` - Pending items
- `/entities/{id}/expiring?days=N` - Expiring items

## Gaps

| Feature | Status |
|---------|--------|
| Partial failure handling | Implemented |
| Response aggregation | Implemented |
| Authentication | **NOT IMPLEMENTED** |
| Rate limiting | **NOT IMPLEMENTED** |
| Response caching | **NOT IMPLEMENTED** |
| Observability (metrics) | Pino logging only |

## Open Questions

1. **Who validates authorization?** Gateway assumes caller is authorized - upstream responsibility?
2. **Should responses be cached?** Every request hits all domains currently
3. **What's the timeout strategy?** Currently configurable per-domain
4. **How are breaking domain API changes handled?** No versioning strategy visible

## Configuration

```bash
PORT=3022
CONTRACTS_LEGAL_URL=http://localhost:3011
DATA_PRIVACY_URL=http://localhost:3012
INSURANCE_URL=http://localhost:3013
IP_URL=http://localhost:3014
COMPLIANCE_URL=http://localhost:3021
WORKFLOW_ENGINE_URL=http://localhost:3020
DOMAIN_TIMEOUT_MS=10000
```

---

*Understanding Level: SOLID*
*Implementation: Functional but missing auth, caching, rate limiting*
