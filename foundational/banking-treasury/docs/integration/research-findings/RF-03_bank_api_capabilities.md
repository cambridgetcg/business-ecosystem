# Research Findings: Bank API Capabilities (MG-05)

## Executive Summary

Research confirms that **<1 minute freshness is achievable** for banks with real-time APIs. However, a hybrid architecture is required due to varying bank capabilities. J.P. Morgan offers real-time balance APIs; some banks still require batch file processing.

---

## Key Findings

### 1. J.P. Morgan API Capabilities

| Capability | Status | Details |
|------------|--------|---------|
| **Real-time balance API** | ✓ Available | Via Account Balances API |
| **Real-time sweep execution** | ✓ Available | API-triggered, self-serve parameters |
| **24x7 operations** | ✓ Available | Non-business day payments |
| **Developer portal** | ✓ Available | developer.payments.jpmorgan.com |

**Key insight**: "GTreasury is working with J.P. Morgan to simplify retrieving intraday and historical balance data for cash reporting accounts. This straightforward and secure Account Balances API integration gives treasury teams real-time access to their data."

**Source**: [GTreasury Partners](https://www.gtreasury.com/company/partners)

### 2. Modern Banking API Landscape

| Bank/Provider | API Type | Balance Freshness | Notes |
|---------------|----------|-------------------|-------|
| **J.P. Morgan** | REST API + webhooks | Real-time | Account Balances API |
| **Mercury** | REST API | Real-time | Modern fintech bank |
| **Plaid** | Aggregation API | Near real-time | Multi-bank |
| **Modern Treasury** | Unified API | Real-time | Aggregates multiple banks |
| **Traditional banks** | SFTP/batch | Daily | Legacy systems |

**Key insight**: "As global markets move faster... the traditional treasury model built on batch processing, spreadsheets and siloed systems can no longer keep up. AI, ML and real-time banking APIs are reshaping how treasury teams operate."

**Source**: [J.P. Morgan Developer Blog](https://developer.payments.jpmorgan.com/blog/ai-ml/rethinking-treasury-ai-apis)

### 3. Freshness Achievability by Bank Type

| Bank Type | Expected Freshness | Architecture Impact |
|-----------|-------------------|---------------------|
| **Tier 1 with API** | Seconds | Webhook + polling hybrid |
| **Modern fintech** | Seconds | REST API polling |
| **Aggregator (Plaid)** | Minutes | Polling with cache |
| **Traditional batch** | Hours | Schedule + extrapolation |

---

## Recommended Architecture

### Hybrid Multi-Source Aggregator

```
┌─────────────────────────────────────────────────────────────┐
│                    BALANCE AGGREGATOR                        │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  REAL-TIME      │  │  POLLING        │  │  BATCH          │
│  HANDLER        │  │  HANDLER        │  │  HANDLER        │
│                 │  │                 │  │                 │
│  • Webhooks     │  │  • 30s interval │  │  • File import  │
│  • J.P. Morgan  │  │  • Mercury      │  │  • SFTP watch   │
│  • Push events  │  │  • Plaid        │  │  • Parse + load │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  POSITION CACHE     │
                    │  (Redis)            │
                    │                     │
                    │  • Per-account      │
                    │  • Timestamped      │
                    │  • Staleness flag   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  CONSOLIDATED       │
                    │  POSITION SERVICE   │
                    │                     │
                    │  • Multi-currency   │
                    │  • Multi-entity     │
                    │  • FX conversion    │
                    └─────────────────────┘
```

### Data Flow by Source Type

```
REAL-TIME SOURCE (J.P. Morgan)
─────────────────────────────────
Bank → Webhook → Event Handler → Cache → API
Latency: <5 seconds

POLLING SOURCE (Mercury, Plaid)
─────────────────────────────────
Scheduler → API Call → Response → Cache → API
Latency: 30-60 seconds

BATCH SOURCE (Traditional)
─────────────────────────────────
SFTP Watch → File Parser → Validation → Cache → API
Latency: 1-4 hours (depends on bank schedule)
```

### Staleness Detection

```typescript
interface CachedBalance {
  accountId: string;
  balance: Money;
  asOfTimestamp: Date;      // Bank's reported time
  fetchedTimestamp: Date;   // When we received it
  sourceType: 'realtime' | 'polling' | 'batch';
  freshnessStatus: 'fresh' | 'stale' | 'unknown';
}

function calculateFreshness(cached: CachedBalance): FreshnessStatus {
  const ageSeconds = (Date.now() - cached.fetchedTimestamp) / 1000;

  switch (cached.sourceType) {
    case 'realtime':
      return ageSeconds < 60 ? 'fresh' : 'stale';
    case 'polling':
      return ageSeconds < 120 ? 'fresh' : 'stale';
    case 'batch':
      return ageSeconds < 14400 ? 'fresh' : 'stale'; // 4 hours
  }
}
```

---

## <1 Minute Freshness Strategy

### For Real-Time Banks (Target: <10 seconds)
1. Register webhook endpoints with bank
2. Process balance update events immediately
3. Update cache with new balance
4. Publish internal event

### For Polling Banks (Target: <60 seconds)
1. Poll every 30 seconds
2. Compare to cached value
3. Update if changed
4. Track last successful poll

### For Batch Banks (Target: Best effort)
1. Poll file drop location every 5 minutes
2. Parse and validate immediately on arrival
3. Flag position as "batch-sourced" in UI
4. Show last update time prominently

### Freshness Reporting

| Source Type | Fresh Threshold | Warning Threshold | Stale Threshold |
|-------------|-----------------|-------------------|-----------------|
| Real-time | <1 minute | 1-5 minutes | >5 minutes |
| Polling | <2 minutes | 2-10 minutes | >10 minutes |
| Batch | <4 hours | 4-8 hours | >8 hours |

---

## Failure Handling

### Circuit Breaker Pattern

```typescript
interface BankConnection {
  bankId: string;
  status: 'healthy' | 'degraded' | 'down';
  consecutiveFailures: number;
  lastSuccessfulFetch: Date;
  circuitOpen: boolean;
}

function handleFetchFailure(conn: BankConnection): void {
  conn.consecutiveFailures++;

  if (conn.consecutiveFailures >= 3) {
    conn.circuitOpen = true;
    conn.status = 'down';
    alertOperations(conn);
    scheduleRetry(conn, exponentialBackoff(conn.consecutiveFailures));
  }
}
```

### Fallback Strategies

| Failure Type | Fallback | User Communication |
|--------------|----------|-------------------|
| API timeout | Use cached + flag stale | "Balance as of X" |
| Auth failure | Alert ops, use cached | "Authentication issue" |
| Rate limited | Reduce poll frequency | "Delayed updates" |
| Bank down | Last known + warning | "Bank connectivity issue" |

---

## Implementation Recommendations

### Phase 1: J.P. Morgan Integration (Week 1-2)
1. Register for developer portal access
2. Implement Account Balances API client
3. Set up webhook endpoint
4. Test real-time flow

### Phase 2: Aggregator Integration (Week 3-4)
1. Integrate Plaid or Modern Treasury
2. Implement polling scheduler
3. Build bank-agnostic adapter interface
4. Test multi-bank aggregation

### Phase 3: Fallback + Resilience (Week 5-6)
1. Implement circuit breaker
2. Build staleness detection
3. Create failure recovery workflows
4. Test failure scenarios

### Phase 4: Monitoring (Week 7-8)
1. Build freshness dashboard
2. Implement alerting
3. Create SLA reporting
4. Document runbooks

---

## Resolution Status

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Bank API capabilities documented | ✓ | J.P. Morgan, Mercury, Plaid |
| <1 min achievability | ✓ | For real-time API banks |
| Architecture pattern | ✓ | Hybrid multi-source |
| Staleness detection | ✓ | Threshold-based |
| Failure recovery | ✓ | Circuit breaker pattern |

**MG-05 Status: RESOLVED** (pending implementation)

---

## Sources

1. [J.P. Morgan Developer Portal](https://developer.payments.jpmorgan.com/)
2. [J.P. Morgan: APIs for Modern Treasury](https://www.jpmorgan.com/insights/treasury/digital-solutions/apis-modern-day-treasury)
3. [GTreasury + J.P. Morgan Integration](https://www.gtreasury.com/company/partners)
4. [Modern Treasury: J.P. Morgan Integration](https://www.moderntreasury.com/integrations/jp-morgan-chase)
5. [J.P. Morgan Real-Time Liquidity](https://treasury-management.com/news/j-p-morgan-payments-enables-real-time-liquidity-sweeping-solution-7-days-a-week)

---

*Research Date: January 2026*
*Gap Addressed: MG-05*
*Confidence: HIGH*
