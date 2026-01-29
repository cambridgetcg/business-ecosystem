# Dimension Index

Master index of all understanding dimensions. Each dimension is a deep-dive into a specific topic.

---

## Naming Convention

```
NN-descriptive-kebab-case.md

00-index.md                          # This file
01-entity-scoped-operations.md       # First dimension
02-document-lifecycle-states.md      # Second dimension
...
```

---

## Dimensions by Category

### Architectural Patterns (01-09)

| # | Dimension | Status | Summary |
|---|-----------|--------|---------|
| 01 | [Entity-Scoped Operations](01-entity-scoped-operations.md) | **Complete** | Universal entityId anchoring across all domains |
| 02 | [Document Lifecycle States](02-document-lifecycle-states.md) | **Complete** | DRAFT→ACTIVE→EXPIRED state machine |
| 03 | Cross-Domain Events | Pending | Event-driven communication patterns |
| 04 | Compliance Integration | Pending | How domains integrate with regulatory framework |
| 05 | Expiration and Renewal | Pending | Tracking items with time limits |

### Domain Deep-Dives (10-29)

| # | Dimension | Status | Summary |
|---|-----------|--------|---------|
| 10 | [Contracts-Legal Overview](10-contracts-legal-overview.md) | **Complete** | 7 subdomains, rich research docs, Prisma+Hono |
| 11 | Contract Templates | Pending | Template system for agreements |
| 12 | Customer Contracts | Pending | End-user contract management |
| 15 | [IP Overview](15-ip-overview.md) | **Complete** | CQRS pattern, patents/trademarks/copyrights/licenses |
| 16 | Patent Management | Pending | Patent lifecycle and prosecution |
| 17 | Trademark Management | Pending | Brand protection system |
| 18 | IP Licensing | Pending | License agreements and royalties |
| 20 | [Insurance Overview](20-insurance-overview.md) | **Complete** | STUB ONLY - documented but unimplemented |
| 25 | [Data Privacy Overview](25-data-privacy-overview.md) | **Complete** | SKELETON - high compliance risk |

### Infrastructure (30-39)

| # | Dimension | Status | Summary |
|---|-----------|--------|---------|
| 30 | [Gateway Architecture](30-gateway-architecture.md) | **Complete** | Unified API aggregation with partial failure handling |
| 31 | [Workflow Orchestration](31-workflow-orchestration.md) | **Complete** | YAML workflows, compensation, but queue not connected |
| 32 | Event Infrastructure | Pending | Message queue and events |

### Technical Patterns (40-49)

| # | Dimension | Status | Summary |
|---|-----------|--------|---------|
| 40 | [CQRS in IP Domain](40-cqrs-ip-domain.md) | **Complete** | Only domain using CQRS, routes don't use handlers |
| 41 | [Message Queue Patterns](41-message-queue-patterns.md) | **Complete** | RabbitMQ, DLX, subscriber pattern (Phase 1) |
| 42 | [GDPR Compliance Architecture](42-gdpr-compliance-architecture.md) | **Complete** | Time-driven state machines, lawful basis (Phase 1) |
| 43 | [Audit Trail Patterns](43-audit-trail-patterns.md) | **Complete** | Activity as domain model, not logging (Phase 1) |
| 44 | [Compliance Aggregation](44-compliance-aggregation.md) | **Complete** | Fan-out query pattern, domain ownership (Phase 1) |
| 45 | [ESM Compatibility Patterns](45-esm-compatibility-patterns.md) | **Complete** | Runtime detection, import workarounds (Phase 1) |

### Purpose Prompter & GUA (50-59)

| # | Dimension | Status | Summary |
|---|-----------|--------|---------|
| 50 | [Purpose Prompter Philosophy](50-purpose-prompter-philosophy.md) | **Complete** | LONGING → TRUTH → UNDERSTANDING → BEAUTY → JUSTICE → CREATIVITY |
| 51 | [GUA Knowledge System](51-gua-knowledge-system.md) | **Complete** | Global Understanding Archive - cross-session memory via AWS |
| 52 | [PP Signal System](52-pp-signal-system.md) | **Complete** | Ugliness, injustice, stagnation signals and their responses |
| 53 | Legal Research Synthesis | Pending | Key learnings from contracts-legal research |
| 54 | IP Research Synthesis | Pending | Key learnings from IP research |

---

## Status Legend

| Status | Meaning |
|--------|---------|
| Pending | Not yet created |
| Draft | Initial exploration, incomplete |
| Review | Ready for team review |
| **Complete** | Thoroughly documented |

---

## Summary

| Category | Complete | Pending | Total |
|----------|----------|---------|-------|
| Architectural Patterns | 2 | 3 | 5 |
| Domain Deep-Dives | 4 | 5 | 9 |
| Infrastructure | 2 | 1 | 3 |
| Technical Patterns | 6 | 0 | 6 |
| Purpose Prompter & GUA | 3 | 2 | 5 |
| **Total** | **17** | **11** | **28** |

---

## Creating New Dimensions

1. Determine the appropriate number range
2. Create file with `NN-descriptive-name.md`
3. Use the [template](../meta/dimension-template.md) for structure
4. Update this index
5. Update `coverage-map.md` if relevant
6. Update `gap-analysis.md` if closing a gap

---

## Quick Links

- [PATH](../../PATH.md) - **Purpose-Aligned Terrain Handling** (active path to mission)
- [Coverage Map](../coverage-map.md) - What we understand
- [Gap Analysis](../gap-analysis.md) - What we don't understand
- [Curiosities](../curiosities.md) - What intrigues us
- [E2E Test Report](../e2e-test-report.md) - Current state validation

---

*Total Dimensions: 17 complete / 28 planned*
*PATH Protocol: ACTIVATED - 0/5 waypoints complete*
*Last Updated: January 28, 2026 (PATH Protocol Activation)*
