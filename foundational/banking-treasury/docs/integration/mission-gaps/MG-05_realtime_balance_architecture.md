# MG-05: Real-Time Balance Aggregation Architecture

## Gap Classification

| Attribute | Value |
|-----------|-------|
| **Gap ID** | MG-05 |
| **Domain** | Cash Visibility |
| **Mission Capability** | M3: Real-Time Liquidity Visibility |
| **Understanding Level** | KNOWS |
| **Priority** | IMPORTANT |

---

## The Gap

We understand **what** real-time visibility means (consolidated positions, <1 minute freshness). We do **not** understand **how** to build an architecture that reliably achieves this across multiple banks with varying API capabilities.

---

## What We Know

From PURPOSE.md success metrics:
- **Cash position freshness**: Real-time (within 1 minute of bank update)
- **Cash position accuracy**: 99.99%

From research 01-04 (Banking infrastructure):
- J.P. Morgan CashPro has API access
- Mercury has modern REST APIs
- Plaid aggregates across banks
- Some banks only offer SFTP batch files

---

## What We Don't Know

### 1. Polling vs. Streaming Architecture

**Unknown**: What's the right architecture for aggregating balances across banks with different capabilities?

| Bank Type | API Capability | Freshness Achievable |
|-----------|---------------|---------------------|
| Tier 1 (J.P. Morgan) | Real-time API + webhooks | Seconds |
| Modern (Mercury) | REST API | Minutes |
| Traditional | SFTP batch | Hours |
| Aggregator (Plaid) | Polling | Minutes |

**Questions**:
- How do we handle banks with only batch file exports?
- Should we use webhooks where available, polling elsewhere?
- What's the fallback when APIs are unavailable?

### 2. Data Consistency Model

**Unknown**: How do we maintain 99.99% accuracy with asynchronous data sources?

| Challenge | Description | Unknown |
|-----------|-------------|---------|
| **Stale data detection** | How do we know a balance is stale? | Detection patterns |
| **Conflict resolution** | What if sources disagree? | Resolution rules |
| **Gap handling** | What if a bank is unreachable? | Fallback strategy |
| **Eventual consistency** | How long until consistent? | SLA guarantees |

### 3. Scalability Architecture

**Unknown**: How does the system scale with number of accounts and banks?

- Rate limiting by bank APIs
- Connection pooling strategies
- Caching architecture
- Event-driven vs. request-driven

### 4. Failure Modes

**Unknown**: What happens when components fail?

| Failure | Impact | Recovery |
|---------|--------|----------|
| Bank API down | Stale balances | **UNKNOWN** |
| Network partition | Partial data | **UNKNOWN** |
| Rate limited | Delayed updates | **UNKNOWN** |
| Bad data received | Incorrect position | **UNKNOWN** |

---

## Impact on Mission

### M3: Real-Time Liquidity Visibility

**SUCCESS METRICS** (PURPOSE.md):
- Cash position freshness: <1 minute
- Cash position accuracy: 99.99%

**BLOCKED BY THIS GAP**: Cannot guarantee success metrics without understanding:
- How to achieve <1 minute with batch-only banks
- How to guarantee 99.99% with unreliable sources
- How to scale across potentially hundreds of accounts

### Implementation Plan Impact

**Phase 2 (Weeks 11-16)**: Cash Position Service

```typescript
// From IMPLEMENTATION_PLAN.md
interface CashPositionService {
  getPosition(entityId: string): Promise<CashPosition>;
  getConsolidatedPosition(entityIds: string[]): Promise<ConsolidatedPosition>;
  projectPosition(entityId: string, horizon: Duration): Promise<ProjectedPosition>;
  checkLiquidityAlerts(position: CashPosition): LiquidityAlert[];
}
```

The implementation of `getPosition` and `getConsolidatedPosition` depends on understanding the aggregation architecture.

---

## Architectural Options to Investigate

### Option A: Centralized Polling

```
┌─────────────────┐
│  Balance        │     ┌─────────┐
│  Aggregator     │────►│ Bank 1  │  (poll every 30s)
│  Service        │────►│ Bank 2  │  (poll every 60s)
│                 │────►│ Bank 3  │  (poll every 5m - batch)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Position       │
│  Cache          │
│  (Redis)        │
└─────────────────┘
```

**Pros**: Simple, predictable
**Cons**: Not truly real-time, high API load

### Option B: Event-Driven with Webhooks

```
┌─────────┐  webhook   ┌─────────────────┐
│ Bank 1  │───────────►│  Event          │
└─────────┘            │  Processor      │
                       │                 │
┌─────────┐  poll      │                 │
│ Bank 2  │◄───────────│  (hybrid)       │
└─────────┘            │                 │
                       └────────┬────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │  Event Store    │
                       │  + Position     │
                       └─────────────────┘
```

**Pros**: Real-time where possible
**Cons**: Complex, hybrid logic needed

### Option C: Aggregator-First

```
┌─────────┐     ┌─────────────────┐
│ Bank 1  │────►│                 │
│ Bank 2  │────►│  Plaid /        │
│ Bank 3  │────►│  MX             │
└─────────┘     └────────┬────────┘
                         │
                         ▼
                ┌─────────────────┐
                │  Our            │
                │  Application    │
                └─────────────────┘
```

**Pros**: Simplest, outsources complexity
**Cons**: Dependency, may not cover all banks, latency

---

## Research Required

### Primary Questions

1. **Bank API capabilities audit**: What API capabilities do our target banks actually offer?
2. **Hybrid architecture patterns**: How do mature treasury systems handle mixed capabilities?
3. **Staleness detection**: How do we flag when data is stale?
4. **Consistency guarantees**: What consistency model is appropriate (eventual? causal?)?
5. **Failure recovery**: What are the fallback patterns for API failures?

### Secondary Questions

1. How do enterprise TMS vendors (Kyriba, SAP) solve this?
2. What are typical bank API rate limits?
3. How do we handle timezone differences in balance reporting?
4. What metadata should accompany each balance (timestamp, source, confidence)?

---

## Connection to Existing Work

| Document | Relevance |
|----------|-----------|
| research/01_INTERNATIONAL_BANKING.md | Bank capabilities overview |
| research/04_BAAS_PROVIDERS.md | Modern API providers |
| No existing question or prompt | **NEW GAP** |

---

## Resolution Criteria

This gap is **RESOLVED** when:

- [x] Bank API capabilities documented for target banks
- [x] Architecture pattern selected and justified
- [x] Staleness detection approach defined
- [x] Failure recovery patterns documented
- [x] <1 minute freshness achievability confirmed
- [ ] 99.99% accuracy approach validated (see MG-06)

---

## Resolution Status: ✓ RESOLVED

**Research findings documented in**: `research-findings/RF-03_bank_api_capabilities.md`

**Key decisions**:
- Architecture: Hybrid multi-source aggregator
- Real-time: J.P. Morgan webhooks + polling
- Staleness: Threshold-based detection
- Fallback: Circuit breaker pattern

---

*Gap Identified: January 2026*
*Gap Resolved: January 2026*
*Blocks: Phase 2 implementation*
