# Research Prompt: Real-Time Balance Aggregation Architecture

## Research Objective

Design a balance aggregation architecture that achieves **<1 minute freshness** and **99.99% accuracy** across banks with heterogeneous API capabilities.

## Context

PURPOSE.md requires:
- Cash position freshness: Real-time (within 1 minute of bank update)
- Cash position accuracy: 99.99%

Current gap (MG-05): We don't understand how to achieve these targets with banks that offer varying capabilities—from real-time webhooks to daily batch files.

## Research Questions

### Section 1: Bank API Capability Audit

**Primary question:** What balance retrieval capabilities do major banks actually offer?

Investigate for each target bank:
- Real-time balance APIs (if any)
- Webhook/push notification support
- Polling API availability and rate limits
- Batch file formats and delivery timing
- Latency characteristics

| Bank | API Type | Expected Latency |
|------|----------|------------------|
| J.P. Morgan (CashPro) | ? | ? |
| Citi (CitiDirect) | ? | ? |
| HSBC | ? | ? |
| BNY Mellon | ? | ? |
| Mercury | ? | ? |
| Plaid (aggregator) | ? | ? |

**Desired output:**
- Bank capability matrix
- Latency expectations per bank
- Fallback options when primary unavailable

### Section 2: Architecture Patterns

**Primary question:** What architectural patterns achieve real-time aggregation with mixed-capability sources?

Investigate:
- Event-driven architectures with webhook ingestion
- Polling strategies with adaptive frequency
- Hybrid approaches (webhook where available, poll otherwise)
- Aggregator-first patterns (outsource to Plaid/MX)
- CQRS patterns for position materialization

For each pattern:
- How does it handle mixed capabilities?
- What's the achievable freshness?
- What are the failure modes?

**Desired output:**
- Pattern comparison matrix
- Architecture recommendation with justification
- Sequence diagrams for data flow

### Section 3: Staleness Detection

**Primary question:** How do we detect and communicate when balance data is stale?

Investigate:
- Timestamp-based staleness detection
- Heartbeat patterns for source monitoring
- User notification approaches
- Position degradation strategies (show with warning vs. hide)

**Desired output:**
- Staleness detection algorithm
- User communication patterns
- Degradation policy recommendations

### Section 4: Failure Recovery

**Primary question:** What happens when a bank API is unavailable?

Investigate:
- Graceful degradation patterns
- Retry strategies with exponential backoff
- Circuit breaker patterns
- Fallback data sources
- Position calculation with partial data

**Desired output:**
- Failure mode catalog
- Recovery strategy for each mode
- SLA impact assessment

### Section 5: Scaling Considerations

**Primary question:** How does the system scale with accounts and banks?

Investigate:
- Connection pooling strategies
- Rate limit management across banks
- Caching architecture
- Horizontal scaling patterns

**Desired output:**
- Scalability analysis
- Capacity planning guidelines
- Performance benchmarks to target

## Research Methodology

1. **Bank documentation:** CashPro API docs, CitiDirect developer portal, etc.
2. **Aggregator documentation:** Plaid, MX, Finicity capabilities
3. **Vendor analysis:** How do Kyriba, SAP Treasury handle this?
4. **Architecture patterns:** Martin Fowler, AWS/Azure patterns

## Success Criteria

Research is complete when:
- [ ] Bank API capabilities documented for top 5 target banks
- [ ] Architecture pattern selected with justification
- [ ] <1 minute freshness achievability confirmed or constraints documented
- [ ] Failure recovery patterns defined
- [ ] Scaling approach documented
- [ ] MG-05 gap resolved

## Related Files

- docs/integration/mission-gaps/MG-05_realtime_balance_architecture.md
- docs/research/01_INTERNATIONAL_BANKING.md
- docs/research/04_BAAS_PROVIDERS.md

---

*Research Priority: MEDIUM*
*Estimated Effort: 2 sessions + bank documentation review*
*Dependencies: Bank API documentation access*
