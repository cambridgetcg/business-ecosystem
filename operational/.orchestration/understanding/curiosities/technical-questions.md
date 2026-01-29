# Technical Domain Curiosities

Questions about architecture, implementation, and technical patterns requiring deeper investigation.

---

## Architecture Questions

### DDD Implementation

**Q1**: The IP domain uses full aggregate pattern with `AggregateRoot` base class. Contracts-legal uses simpler service-repository. Which approach is better for this ecosystem, and should we standardize?

**Why it matters**: Inconsistent patterns increase cognitive load and maintenance burden.

**Investigation needed**: Compare complexity, testability, and maintainability of both approaches.

---

**Q2**: How do we handle cross-aggregate transactions? If creating a License requires updating both IP records and Contract records, who owns the transaction boundary?

**Why it matters**: Event-driven architecture doesn't naturally support distributed transactions.

**Investigation needed**: Saga pattern vs eventual consistency tradeoffs.

---

### Event-Driven Architecture

**Q3**: The ecosystem uses event-driven communication, but what message queue technology is assumed? RabbitMQ? AWS SNS+SQS? Kafka?

**Why it matters**: Implementation patterns differ significantly across message brokers.

**Investigation needed**: Check if @ecosystem/messaging specifies concrete implementation.

---

**Q4**: How do we handle event ordering? If `contract.signed` and `contract.amended` arrive out of order, how do we ensure correct state?

**Why it matters**: Distributed systems have ordering challenges.

**Investigation needed**: Event versioning and idempotency patterns.

---

**Q5**: What's the event retention policy? How long do we keep events for replay/debugging? Forever? 30 days? Compliance-driven?

**Why it matters**: Event storage costs vs auditability tradeoffs.

---

### Database & Persistence

**Q6**: Why does IP use Drizzle while contracts-legal uses Prisma? Is this intentional or historical accident?

**Why it matters**: Two different ORMs increases maintenance complexity.

**Investigation needed**: Determine if consolidation is desirable/feasible.

---

**Q7**: How do we handle schema migrations across multiple domains? Is there a coordinated migration strategy or are domains independent?

**Why it matters**: Cross-domain foreign keys (like entityId) require coordination.

**Investigation needed**: Migration orchestration patterns.

---

**Q8**: JSONB is used heavily for flexible data (inventors, authors, territories). What happens when we need to query inside JSONB structures at scale?

**Why it matters**: JSONB queries can be slow without proper indexing.

**Investigation needed**: PostgreSQL JSONB indexing strategies (GIN, expression indexes).

---

### Caching

**Q9**: The IP domain has a cache layer with Redis/memory fallback. Do other domains need similar caching? What's the cache invalidation strategy?

**Why it matters**: Caching without invalidation leads to stale data.

**Investigation needed**: Cache invalidation patterns for event-driven systems.

---

### Authentication & Authorization

**Q10**: How does entity-level authorization work? If User A can access Entity X's contracts, can they automatically access Entity X's insurance?

**Why it matters**: Cross-domain authorization needs consistent model.

**Investigation needed**: Check @ecosystem/auth for entity-scoped permissions.

---

**Q11**: How do we handle service-to-service authentication? When workflow engine calls contracts-legal, what credentials are used?

**Why it matters**: Internal API security is often overlooked.

**Investigation needed**: Service mesh or internal JWT patterns.

---

## Integration Questions

### Gateway Pattern

**Q12**: The gateway fetches from all domains in parallel with 10s timeout. What happens if one domain consistently takes 9s? Does it degrade user experience?

**Why it matters**: P95 latency could be dominated by slowest domain.

**Investigation needed**: Circuit breaker and fallback patterns for gateway.

---

**Q13**: Does the gateway cache aggregated responses, or is every request fresh? What's the consistency model?

**Why it matters**: Caching improves performance but may show stale data.

---

### Workflow Engine

**Q14**: How does the workflow engine handle long-running steps? If a step takes 2 hours (e.g., waiting for external approval), does it block the executor?

**Why it matters**: Human-in-the-loop workflows have different timing characteristics.

**Investigation needed**: Async step patterns, possibly with external task completion.

---

**Q15**: Can workflows call other workflows? How do we handle nested workflow orchestration?

**Why it matters**: Complex processes may need composition.

---

### External Integrations

**Q16**: The insurance domain mentions broker portal and carrier API integrations. What authentication patterns do these typically use? OAuth? API keys? Certificate-based?

**Why it matters**: External integration security requirements vary widely.

**Investigation needed**: Insurance industry API standards.

---

**Q17**: How do we handle external API rate limits? If we're syncing with USPTO or WIPO, are there throttling strategies?

**Why it matters**: IP offices have strict rate limits.

---

## Testing Questions

**Q18**: What's the testing strategy for cross-domain workflows? Can we test entity-onboarding workflow without running all 4 domains?

**Why it matters**: Integration testing complexity grows exponentially.

**Investigation needed**: Contract testing, consumer-driven contracts patterns.

---

**Q19**: How do we test compensation (rollback) logic? Do we have chaos engineering practices to intentionally fail steps?

**Why it matters**: Compensation paths are rarely tested but critical.

---

## Observability Questions

**Q20**: The architecture mentions OpenTelemetry trace context propagation. Is distributed tracing actually implemented?

**Why it matters**: Debugging cross-domain issues requires end-to-end visibility.

**Investigation needed**: Check if tracing instrumentation exists.

---

**Q21**: What metrics are domains expected to expose? Is there a standard dashboard per domain?

**Why it matters**: Consistent observability enables proactive monitoring.

---

## Priority Ranking

| Question | Priority | Area | Complexity |
|----------|----------|------|------------|
| Q3 | HIGH | Events | Low |
| Q10 | HIGH | Auth | Medium |
| Q18 | HIGH | Testing | High |
| Q4 | MEDIUM | Events | Medium |
| Q6 | MEDIUM | DB | Low |
| Q14 | MEDIUM | Workflow | High |
| Q8 | MEDIUM | DB | Medium |
| Q20 | LOW | Observability | Medium |
| Q15 | LOW | Workflow | Medium |

---

## Next Steps

1. Investigate message queue technology (Q3) - foundational infrastructure question
2. Research entity-level authorization model (Q10) - security architecture
3. Design cross-domain integration test strategy (Q18) - quality assurance
