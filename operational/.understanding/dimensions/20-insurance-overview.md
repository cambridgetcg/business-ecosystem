# Dimension 20: Insurance Domain

## What

The insurance domain manages corporate insurance needs: risk transfer, policy management, and claims administration. It covers general liability, professional liability, property, workers compensation, cyber, and product liability insurance.

**Location**: `/insurance`
**Port**: 3013
**Framework**: Hono

**CRITICAL STATUS: DOCUMENTATION ONLY - NO IMPLEMENTATION**

## Why

Insurance is an operational domain because it represents business activity (managing risk, filing claims), references foundational entities, has clear lifecycles, generates events, and has regulatory requirements.

The domain exists to:
- Manage corporate insurance portfolio across entities
- Track policy renewals and expirations
- Process claims against policies
- Generate certificates of insurance (COI)
- Assess coverage requirements for contracts

## How

### Current State: STUB ONLY

**README describes**: 8 subdomains with ~40 entity types

**Actual implementation**: 40-line HTTP server with health check only

```typescript
// src/index.ts - This is ALL that exists
const app = new Hono();

app.get('/health', (c) => c.json({
  status: 'healthy',
  service: 'insurance',
  timestamp: new Date().toISOString(),
}));

app.get('/', (c) => c.json({
  service: 'insurance',
  version: '0.1.0',
  description: 'Insurance policy and claims management',
  domains: [
    'policy-management', 'general-liability', 'professional-liability',
    'property-insurance', 'workers-compensation', 'cyber-insurance',
    'product-liability', 'claims-management'
  ]
}));
```

### Documented Subdomains (NOT IMPLEMENTED)

| Subdomain | Key Entities | Status |
|-----------|--------------|--------|
| Policy Management | Policy, Coverage, Endorsement, Renewal | Not implemented |
| General Liability | GL Policy, COI, Additional Insured | Not implemented |
| Professional Liability | E&O, D&O, EPLI, Fiduciary | Not implemented |
| Property Insurance | Property Policy, BI, Extra Expense | Not implemented |
| Workers Compensation | WC Policy, Experience Mod, Class Code | Not implemented |
| Cyber Insurance | Cyber Policy, Data Breach Coverage | Not implemented |
| Product Liability | Product Policy, Recall, Completed Ops | Not implemented |
| Claims Management | Claim, Reserve, Adjuster, Settlement | Not implemented |

### Expected Policy Lifecycle (Based on Architecture Patterns)

```
DRAFT → PENDING_REVIEW → APPROVED → ACTIVE → EXPIRED/TERMINATED
                              ↓
                          RENEWED (loops back to ACTIVE)
```

### Expected Claims Workflow

```
CLAIM FILED → ACKNOWLEDGED → INVESTIGATION → RESERVE ADJUSTMENT →
    NEGOTIATION/SETTLEMENT → PAYMENT → SUBROGATION → CLOSED
```

## Where

| Component | Path | Status |
|-----------|------|--------|
| Entry Point | `insurance/src/index.ts` | Stub only |
| README | `insurance/README.md` | Comprehensive documentation |
| Prisma Schema | N/A | **Does not exist** |
| API Routes | N/A | **Not implemented** |
| Tests | N/A | **Not implemented** |

## Connections

**Should Depend On**:
- entity-governance: Policies owned by legal entities
- accounting: Premium payments, claim payouts, reserve accounting
- compliance: State insurance regulations, NAIC
- contracts-legal: Policy documents treated as contracts

**Should Publish Events**:
- `insurance.policy.created`
- `insurance.policy.renewed`
- `insurance.claim.filed`
- `insurance.claim.settled`
- `insurance.coi.issued`

## Gap Analysis

| Component | Documented | Implemented | Gap Severity |
|-----------|------------|-------------|--------------|
| 8 subdomains with ~40 entities | Yes | No | **CRITICAL** |
| Database schema | Yes (described) | No | **CRITICAL** |
| API endpoints | Yes | 2 (health, info) | **CRITICAL** |
| Business logic | Yes | None | **CRITICAL** |
| Claims workflow | Yes | None | **CRITICAL** |
| Policy lifecycle | Yes | None | **CRITICAL** |
| External integrations | Yes | None | HIGH |
| Events | Yes | None | HIGH |
| Tests | No | None | HIGH |

## Open Questions

### Business Logic Questions
1. How are claim reserves estimated? What actuarial model?
2. Can one policy cover multiple entities? How is allocation handled?
3. How does the system identify coverage gaps vs. contractual requirements?
4. What triggers renewal - auto-renew vs manual?
5. How is subrogation (recovery from responsible third parties) tracked?
6. Is experience mod calculated internally or imported from NCCI?

### Technical Questions
7. Should there be a shared Prisma schema or insurance-specific?
8. Are insurance-specific events in `@ecosystem/events-legal` or new package?
9. Direct carrier APIs or through broker aggregators?
10. Document storage in S3 like contracts-legal?

## Complexity Assessment

**Insurance is arguably the MOST complex operational domain**:

| Factor | Complexity |
|--------|------------|
| Entity count | ~40+ (highest) |
| Workflow complexity | Very High (claims lifecycle) |
| Multi-party relationships | High (insured, insurer, broker, adjuster) |
| Regulatory load | High (state-by-state, NAIC) |
| External integrations | High (brokers, carriers) |
| Actuarial calculations | High (reserves, experience mods) |

### Comparison to Other Domains

| Domain | Entity Count | Implementation Status |
|--------|--------------|----------------------|
| contracts-legal | ~20 | **Most Mature** |
| intellectual-property | ~25 | Documented |
| data-privacy | ~6 | Skeleton |
| **insurance** | ~40+ | **STUB ONLY** |

## Recommendations

1. **Start with contracts-legal as template** - Similar document lifecycle patterns
2. **Prioritize claims workflow** - Highest business value, most complex
3. **Design for multi-entity** - Core requirement for corporate insurance
4. **Plan for state variation** - Especially workers compensation
5. **Define events early** - Enable cross-domain integration testing

---

*Understanding Level: GAP*
*Status: Comprehensive documentation exists but NO implementation*
*Priority: HIGH - complex domain with zero functionality*
