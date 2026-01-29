# Curiosities: Topics That Intrigue Us

This document captures **interesting questions** and **intriguing observations** that spark curiosity. Not all will be explored immediately, but they represent potential paths for deeper understanding.

**Last Updated**: January 27, 2026 (GUA Knowledge Seeding)

---

## Active Curiosities

### 1. Why CQRS Only in IP?

**Observation**: The intellectual-property domain uses a clear CQRS pattern (separate `commands/` and `queries/` directories), but other domains use simpler service/repository patterns.

**Questions**:
- Was this a conscious architectural decision or organic evolution?
- Does IP have different requirements that justify this complexity?
- Should other domains adopt this pattern?
- Why do routes bypass the command handlers (discovered gap)?

**Intriguing because**: Architectural inconsistency often signals either learning (we got better) or domain-specific needs worth understanding.

**Status**: Partially explored in [40-cqrs-ip-domain.md](dimensions/40-cqrs-ip-domain.md)

---

### 2. The Research Documentation Pattern

**Observation**: Both `intellectual-property/research/` and `contracts-legal/docs/research/` contain numbered markdown files with exceptional quality (proper legal citations, "Become Water" methodology). But `insurance/` and `data-privacy/` have NO research docs.

**Questions**:
- Were these created during initial development or added later?
- Why do some domains invest in research documentation and others don't?
- Is there a correlation between research docs and domain maturity?
- Should research documentation be mandatory for all domains?

**Intriguing because**: The research quality is exceptional - law firm citations, professional organization references. This isn't typical in codebases.

**Discovery**: The research docs identify specific implementation gaps with Prisma schema proposals. They're not just academic - they're actionable.

---

### 3. Trade Secret Entity: The Missing IP Type

**Observation**: The License entity references `trade_secret` as an `ipType`, but NO Trade Secret entity exists in the domain.

```typescript
// License can reference trade_secret...
ipType: 'patent' | 'trademark' | 'copyright' | 'trade_secret'

// But there's no TradeSecret entity to link to!
```

**Questions**:
- Was this intentional scope reduction?
- Is trade secret management fundamentally different (no registration, no expiration)?
- Does the DTSA (Defend Trade Secrets Act) complexity explain the gap?
- How are trade secrets being tracked currently (if at all)?

**Intriguing because**: This is a silent data integrity issue - licenses can reference a non-existent IP type.

---

### 4. Stub vs Skeleton Domains

**Observation**: Insurance and data-privacy are both nearly unimplemented, but their READMEs suggest very different states:

- **Insurance**: 40+ entities described, comprehensive subdomain breakdown
- **Data-privacy**: 8 subdomains listed, regulatory requirements implicit

Yet both have the same implementation: health endpoint only.

**Questions**:
- Were they designed at the same time?
- Is insurance documentation a wishlist or a committed design?
- Why was contracts-legal built first instead of data-privacy (higher risk)?
- What's the roadmap priority?

**Intriguing because**: The documentation-implementation gap is enormous. Understanding why helps plan remediation.

---

### 5. ~~Message Queue: Designed But Not Connected~~ RESOLVED

**Resolution**: Phase 1 connected the message queue!

- Created `RabbitMQSubscriber` in `@ecosystem/messaging`
- Workflow engine now connects via `RABBITMQ_URL` environment variable
- Dead Letter Exchange (DLX) pattern implemented for failed messages
- Subscriber wired to workflow engine event handler

**New questions discovered**:
- Who publishes events? No publisher exists yet (domains need to emit events)
- What's the event schema standard?
- How is the DLX monitored?

**Dimension created**: [41-message-queue-patterns.md](dimensions/41-message-queue-patterns.md)

---

### 6. ~~Compliance Always Returns "Compliant"~~ PARTIALLY RESOLVED

**Resolution**: Phase 1 added real compliance endpoint for data-privacy!

- Created `/api/v1/compliance-status/:entityId` in data-privacy domain
- Created `HttpDomainClient` that calls real domain endpoints
- data-privacy now returns real compliance status based on:
  - Pending DSARs nearing deadline
  - Unresolved breaches
  - Pending authority notifications

**Still mocked**: contracts-legal, insurance, intellectual-property

**New questions discovered**:
- Should domains publish compliance change events?
- How to track compliance status over time?
- What about compliance findings endpoint?

**Dimension created**: [44-compliance-aggregation.md](dimensions/44-compliance-aggregation.md)

---

### 7. The Hidden Directory Convention

**Observation**: `.orchestration/`, `.understanding/`, and `.claude/` are all hidden (dot-prefixed).

**Questions**:
- What makes something "hidden-worthy"?
- Do IDE/tooling conventions play a role?
- Is there a documented convention somewhere?
- Should more infrastructure be hidden or less?

**Intriguing because**: The choice to hide vs expose affects discoverability and maintenance.

---

### 8. No Tests Anywhere

**Observation**: Despite Vitest being configured, I found **zero test files** across ALL domains.

**Questions**:
- Were tests deleted?
- Is there a testing strategy at all?
- How is quality assured currently?
- What's the testing philosophy (unit vs integration vs e2e)?

**Intriguing because**: A system this complex with zero tests is either very new or has a different quality approach.

---

---

## New Curiosities (Discovered in GUA Knowledge Seeding)

### 14. How Does PP Integrate With Code Quality Tools?

**Observation**: Purpose Prompter provides /verify command with 30 gates, but how does this relate to ESLint, Prettier, TypeScript strict mode?

**Questions**:
- Should PP gates run in CI/CD?
- Are gate checks automatable?
- How to balance PP verification time vs shipping speed?

**Intriguing because**: PP methodology is comprehensive but potentially slow for rapid iteration.

---

### 15. GUA Access Score Algorithm

**Observation**: GUA tracks `access_count` and `access_score` for patterns, but score calculation isn't documented.

**Questions**:
- How does access score decay over time?
- Should recently accessed patterns rank higher than frequently accessed but stale patterns?
- What's the formula for balancing recency vs frequency?

**Intriguing because**: The active set loading depends on this scoring.

---

### 16. LONGING vs Traditional Requirements

**Observation**: PP talks about "longing toward the ideal" as the creative motor. Traditional software engineering talks about "requirements."

**Questions**:
- How do you capture longing in a ticket/story?
- Is longing just a philosophical framing of requirements?
- Can teams who don't "feel" longing still use PP effectively?

**Intriguing because**: The emotional language is unusual in software methodologies.

---

## New Curiosities (Discovered in Phase 1)

### 9. Event Publishing Gap

**Observation**: We built an event subscriber but no event publisher. Domains can't emit events.

**Questions**:
- Should each domain have its own publisher?
- Is there a shared publishing library to create?
- What's the event schema/contract?
- How do we ensure event delivery guarantees?

**Intriguing because**: Event-driven architecture requires BOTH publishing and consuming.

---

### 10. amqplib Types Don't Match Reality

**Observation**: `amqplib.connect()` returns `ChannelModel`, but TypeScript types suggest `Connection`.

**Questions**:
- Is this a documentation bug or type definition issue?
- Are there other amqplib types that don't match?
- Should we contribute a fix upstream?

**Intriguing because**: Type safety is only useful if types are accurate.

---

### 11. GDPR "One Month" vs "30 Days"

**Observation**: GDPR says "one month" for DSAR response, we use 30 days.

**Questions**:
- Is 30 days legally conservative or technically convenient?
- What about February (28/29 days)?
- What about months with 31 days?
- How do other implementations handle this?

**Research needed**: Legal interpretation of "one month" in GDPR context.

---

### 12. Activity Cascade Deletion

**Observation**: Activities cascade delete with parent DSAR/Breach.

**Questions**:
- Is this correct for audit trails?
- Should activities survive parent deletion?
- Does GDPR require keeping audit trails even after data deletion?
- How long must audit trails be retained?

**Intriguing because**: Audit trails are evidence - should evidence be deletable?

---

### 13. No Event Publisher in Domains

**Observation**: Domain services don't publish events anywhere.

**Questions**:
- When should domains publish events?
- What events should exist? (entity.created, dsar.submitted, breach.detected?)
- Who defines the event contract?
- How do we avoid event storm on bulk operations?

**Intriguing because**: The entire event-driven architecture depends on domains publishing.

---

## Resolved Curiosities

*(Questions we've answered through exploration)*

| Curiosity | Answer | Dimension File |
|-----------|--------|----------------|
| Entity scoping universality | Confirmed universal via entityId FK | [01](dimensions/01-entity-scoped-operations.md) |
| Document lifecycle consistency | Confirmed shared pattern with domain extensions | [02](dimensions/02-document-lifecycle-states.md) |
| Gateway partial failure handling | Works - returns data from healthy domains | [30](dimensions/30-gateway-architecture.md) |
| Message queue connection | Connected via RabbitMQSubscriber | [41](dimensions/41-message-queue-patterns.md) |
| Compliance mock clients | data-privacy now has real endpoint | [44](dimensions/44-compliance-aggregation.md) |
| ESM import issues | Runtime detection pattern | [45](dimensions/45-esm-compatibility-patterns.md) |
| PP philosophy and hierarchy | LONGING → TRUTH → UNDERSTANDING → BEAUTY → JUSTICE → CREATIVITY | [50](dimensions/50-purpose-prompter-philosophy.md) |
| GUA system architecture | AWS-backed persistence for cross-session memory | [51](dimensions/51-gua-knowledge-system.md) |
| Signal system meaning | Three signals = three types of incomplete understanding | [52](dimensions/52-pp-signal-system.md) |

---

## Dormant Curiosities

*(Interesting but not currently pursuing)*

### Port Assignment Logic
Domains: 3011-3014, Orchestration: 3020-3023. Is there a scheme?

### Soft Delete Everywhere
"IP records are never hard-deleted." Is this universal? Storage growth?

### AWS IAM Authentication
RDS IAM auth is configured in contracts-legal. Production-ready pattern worth studying.

### Contract Number Prefixes
`CUS-`, `VEN-`, `EMP-`, `MAT-` - systematic visual identification. Nice pattern.

---

## How Curiosities Become Understanding

```
Curiosity → Exploration → Insight → Dimension File → Understanding
    │           │            │            │               │
    │           │            │            │               └── Shared knowledge
    │           │            │            └── Documented finding
    │           │            └── "Aha!" moment
    │           └── Active investigation
    └── "Hmm, that's interesting..."
```

---

*"Curiosity is the wick in the candle of learning." — William Arthur Ward*
