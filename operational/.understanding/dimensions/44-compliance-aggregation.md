# Dimension 44: Cross-Domain Compliance Aggregation

**Discovery Source**: Phase 1 Implementation - Compliance Aggregator + HttpDomainClient
**Understanding Level**: ENABLED
**Last Updated**: January 27, 2026

---

## Aha Moment

> The compliance aggregator doesn't calculate compliance - it **asks each domain**. Every domain exposes a `/compliance-status/:entityId` endpoint, and the aggregator fans out to collect and synthesize. This is the "microservices query pattern" for compliance.

---

## What This Is

The architectural pattern for aggregating compliance status across operational domains:
- Each domain owns its compliance definition
- Aggregator orchestrates collection
- Gateway exposes unified view
- Status flows: Domain → Aggregator → Gateway → Client

---

## Mental Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    COMPLIANCE AGGREGATION ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                        ┌─────────────────────────────────┐                 │
│                        │         API Gateway              │                 │
│                        │  /operational/entities/:id/      │                 │
│                        │   compliance                     │                 │
│                        └───────────────┬─────────────────┘                 │
│                                        │                                    │
│                                        │ proxy                              │
│                                        ▼                                    │
│                        ┌─────────────────────────────────┐                 │
│                        │    Compliance Aggregator        │                 │
│                        │    (Port 3021)                  │                 │
│                        │                                 │                 │
│                        │  /entities/:id/compliance       │                 │
│                        └───────────────┬─────────────────┘                 │
│                                        │                                    │
│               ┌───────────────────────────────────────────┐                │
│               │           Fan-out Query                    │                │
│               │                                            │                │
│      ┌────────┴────────┬────────────────┬────────────────┐│                │
│      ▼                 ▼                ▼                ▼│                │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│ │ data-privacy │ │contracts-legal│ │  insurance   │ │     IP       │       │
│ │  (Port 3012) │ │  (Port 3011) │ │  (Port 3013) │ │ (Port 3014)  │       │
│ │              │ │              │ │              │ │              │       │
│ │ HttpDomain   │ │ MockDomain   │ │ MockDomain   │ │ MockDomain   │       │
│ │ Client ✓     │ │ Client       │ │ Client       │ │ Client       │       │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘       │
│       │                 │                │                │               │
│       ▼                 ▼                ▼                ▼               │
│    REAL DATA        "compliant"      "compliant"      "compliant"        │
│                      (mocked)         (mocked)         (mocked)          │
│                                                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Concepts

### 1. Domain Owns Compliance Definition

Each domain defines what "compliant" means for itself:

```typescript
// data-privacy compliance-status endpoint
{
  entityId: "ent-123",
  domain: "data-privacy",
  status: "compliant" | "at_risk" | "non_compliant",
  issues: [...],      // Human-readable issues
  metrics: {
    pendingDsars: 0,
    unresolvedBreaches: 0,
    pendingNotifications: 0
  }
}
```

**Why**: Compliance rules differ by domain. GDPR has different rules than contract SLAs.

### 2. Aggregator Synthesizes

The aggregator:
1. Fans out to all domains
2. Collects individual statuses
3. Applies overall compliance logic
4. Returns unified view

```typescript
// Aggregation logic
if (anyDomain === 'non-compliant') return 'non-compliant';
if (anyDomain === 'pending') return 'pending';
if (allApplicable === 'compliant') return 'compliant';
```

### 3. Mock vs Real Clients

Phase 1 revealed the progression:

```typescript
// Before: All domains mocked
const domainClients = new Map([
  ['data-privacy', new MockDomainClient('data-privacy')], // Always "compliant"
  ['contracts-legal', new MockDomainClient('contracts-legal')],
]);

// After Phase 1: data-privacy has real client
const domainClients = new Map([
  ['data-privacy', new HttpDomainClient('data-privacy', dataPrivacyUrl)], // Real!
  ['contracts-legal', new MockDomainClient('contracts-legal')], // Still mocked
]);
```

### 4. Status Mapping

Domain-specific statuses map to standard compliance statuses:

```typescript
// data-privacy → standard mapping
'compliant' → 'compliant'
'at_risk' → 'pending'        // Not failed yet, but needs attention
'non_compliant' → 'non-compliant'
```

---

## Implementation Details

### Compliance Aggregator
**Location**: `/operational/.orchestration/compliance/`

```typescript
// Core aggregation flow
async getEntityOverview(entityId: string): Promise<EntityComplianceOverview> {
  // Fan out to all domains
  for (const [domain, client] of this.domainClients) {
    const status = await client.getComplianceStatus(entityId);
    const findings = await client.getFindings(entityId);
    domains.set(domain, status);
  }

  // Synthesize overall status
  const overallStatus = this.calculateOverallStatus(Array.from(domains.values()));

  return { entityId, overallStatus, domains, ... };
}
```

### Domain Compliance Endpoint
**Location**: `/operational/data-privacy/src/routes/index.ts`

```typescript
// /api/v1/compliance-status/:entityId
api.get('/compliance-status/:entityId', async (c) => {
  const entityId = c.req.param('entityId');

  // Check for issues
  const pendingDsars = await prisma.dSARRequest.count({ where: {...} });
  const unresolvedBreaches = await prisma.dataBreach.count({ where: {...} });
  const pendingNotifications = await prisma.dataBreach.count({ where: {...} });

  // Determine status
  let status = 'compliant';
  if (pendingNotifications > 0) status = 'non_compliant';
  else if (unresolvedBreaches > 0) status = 'at_risk';
  else if (pendingDsars > 0) status = 'at_risk';

  return c.json({ entityId, domain: 'data-privacy', status, issues, metrics });
});
```

### HttpDomainClient
**Location**: `/operational/.orchestration/compliance/src/index.ts`

```typescript
class HttpDomainClient {
  async getComplianceStatus(entityId: string) {
    const response = await fetch(
      `${this.baseUrl}/api/v1/compliance-status/${entityId}`
    );
    // Map response to standard format
    return { domain, status, regulations, openFindings };
  }
}
```

---

## Curiosities Discovered

### 1. No Caching
Every compliance request fans out to all domains.

**Question**: At what scale does this become a problem?
**Trade-off**: Real-time accuracy vs Performance

**Possible solution**: Time-based cache with manual invalidation on significant events.

### 2. No Partial Failure Handling in Aggregator
If one domain times out, the entire compliance check may hang.

**Question**: Should aggregator return partial results?
**Reference**: Gateway already handles partial failure (see dimension 30).

### 3. Findings Not Implemented
`getFindings()` returns empty array in HttpDomainClient.

```typescript
async getFindings(entityId: string): Promise<ComplianceFinding[]> {
  // TODO: Implement findings endpoint in data-privacy service
  return [];
}
```

**Gap Identified**: Need `/api/v1/findings/:entityId` endpoint in domains.

### 4. Regulatory Mapping Empty
The aggregator accepts `RegulatoryMapping[]` but we pass `[]`.

**Question**: What is regulatory mapping supposed to do?
**Code suggests**: Map regulations (GDPR, CCPA) to domain requirements.

---

## Status Definitions

| Domain Status | Aggregator Status | Meaning |
|---------------|-------------------|---------|
| `compliant` | `compliant` | All checks pass |
| `at_risk` | `pending` | Issues exist but not yet violations |
| `non_compliant` | `non-compliant` | Active violations |
| (timeout/error) | `pending` | Unknown state |
| N/A | `not-applicable` | Domain doesn't apply to entity |

---

## Related Patterns

- [30-gateway-architecture.md](30-gateway-architecture.md) - Gateway partial failure handling
- [42-gdpr-compliance-architecture.md](42-gdpr-compliance-architecture.md) - Domain compliance definition
- [41-message-queue-patterns.md](41-message-queue-patterns.md) - Event-driven compliance updates

---

## Open Questions

1. **Compliance Events**: Should domains publish compliance change events?
2. **Historical Compliance**: How to track compliance status over time?
3. **Cross-Entity Compliance**: What if one entity's compliance depends on another's?
4. **Compliance SLAs**: Can we define response time requirements for compliance checks?
5. **Dashboard Efficiency**: The dashboard endpoint calls getEntityOverview + getFindings - duplicates fan-out?

---

## Next Steps (Identified Gaps)

1. Add HttpDomainClient for contracts-legal, insurance, IP
2. Implement `/compliance-status/:entityId` in each domain
3. Add findings endpoint to domains
4. Add caching layer to aggregator
5. Add compliance event publishing

---

## Now You Can

With this understanding, you can:
1. Add compliance endpoints to any new domain
2. Integrate a domain into the compliance aggregator
3. Debug compliance status mismatches
4. Explain why some domains show "compliant" (mocked)
5. Design compliance metrics for new regulations

---

*"Compliance is not a destination, it's a continuous journey." - This architecture supports that journey*
