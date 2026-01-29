# Synthesis: Integrated Understanding

This document synthesizes understanding across all domains into a coherent whole.

---

## The Big Picture

The operational layer is a **document-centric, entity-scoped, compliance-aware** system for managing business activities.

```
                         ┌─────────────────────────┐
                         │   LEGAL ENTITIES        │
                         │   (Foundational)        │
                         └───────────┬─────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
            ┌───────▼───────┐ ┌─────▼──────┐ ┌──────▼──────┐
            │   DOCUMENTS   │ │  DEADLINES │ │  COMPLIANCE │
            │   (Lifecycle) │ │  (Tracking)│ │  (Framework)│
            └───────────────┘ └────────────┘ └─────────────┘
                    │                │                │
        ┌───────────┴───────────┬────┴────────────────┤
        ▼                       ▼                     ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ CONTRACTS    │  │ INSURANCE    │  │ INTELLECTUAL │  │ DATA         │
│ LEGAL        │  │              │  │ PROPERTY     │  │ PRIVACY      │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
        │                │                │                │
        └────────────────┴────────────────┴────────────────┘
                                  │
                         ┌───────▼────────┐
                         │    EVENTS      │
                         │   (Messages)   │
                         └───────┬────────┘
                                 │
                         ┌───────▼────────┐
                         │ ORCHESTRATION  │
                         │  (Workflows)   │
                         └────────────────┘
```

---

## Core Thesis

**Everything is a document owned by an entity with a lifecycle and compliance requirements.**

This simple model explains:
- Why entity scoping is mandatory (ownership)
- Why document lifecycle is universal (state management)
- Why compliance is cross-cutting (regulatory reality)
- Why events are preferred (loose coupling for independent lifecycle)

---

## What Unifies the Domains

### Shared Concerns

| Concern | How It's Addressed |
|---------|-------------------|
| Ownership | Every record has `entityId` |
| Lifecycle | Shared state machine (DRAFT → ACTIVE → EXPIRED) |
| Time-sensitivity | Expiration tracking with 7/30/90 day windows |
| Compliance | Framework integration mandatory |
| Audit | All mutations logged |
| Authorization | Entity-scoped permissions |

### Shared Infrastructure

| Infrastructure | Purpose |
|----------------|---------|
| Gateway | Unified API entry point |
| Event bus | Async communication |
| Workflow engine | Cross-domain orchestration |
| Compliance aggregator | Unified compliance view |

---

## What Differentiates the Domains

### Contracts-Legal
- **Unique**: Multi-party agreements, signature workflows
- **Complexity**: Amendment chains, exhibit attachments
- **Integration**: Revenue recognition triggers

### Intellectual Property
- **Unique**: Prosecution tracking, deadline criticality
- **Complexity**: Multiple IP types (patent, trademark, copyright, trade secret)
- **Integration**: External filing systems (USPTO, WIPO)

### Insurance
- **Unique**: Coverage calculations, claims processing
- **Complexity**: Policy modifications (endorsements), certificates
- **Integration**: External insurers, actuarial systems

### Data Privacy
- **Unique**: Subject rights (DSAR), consent tracking
- **Complexity**: Multi-jurisdictional compliance (GDPR, CCPA, HIPAA)
- **Integration**: Data inventory across all systems

---

## Emerging Insights

### Insight 1: Complexity Hides in Integration

Individual domains are relatively straightforward. Complexity emerges at boundaries:
- Contract → Insurance (coverage verification)
- IP → Contracts (license agreements)
- Privacy → Everything (data touches all domains)

### Insight 2: Time is a First-Class Citizen

Unlike typical CRUD apps, time is everywhere:
- Effective dates, expiration dates, renewal dates
- Filing deadlines, notice periods, grace periods
- Compliance calendars, audit schedules

### Insight 3: The Gateway is an Anti-Corruption Layer

The gateway doesn't just aggregate - it normalizes. Each domain can evolve independently while the gateway presents a stable interface.

### Insight 4: Events are the System of Record for Integration

While each domain owns its data, the event stream is the integration truth. Workflows depend on events, not database state.

---

## Open Questions

1. **How does the system behave under partial failure?**
   - Gateway handles it for reads, but what about writes?

2. **What's the consistency model across domains?**
   - Eventual consistency is stated, but what are the SLAs?

3. **How do we handle cross-entity operations?**
   - Joint ventures, mergers, entity restructuring?

4. **Where does reporting/analytics live?**
   - Is there a data warehouse? BI integration?

---

## Mental Models

### Model 1: The Filing Cabinet

Think of each domain as a filing cabinet drawer:
- Entity is the label on the drawer
- Documents are the files inside
- Lifecycle is the file status (active, archived)
- Compliance is the retention schedule

### Model 2: The Assembly Line

Think of workflows as assembly lines:
- Events are products moving down the line
- Each domain is a workstation
- Orchestration is the line supervisor
- Failures trigger rework (compensation)

### Model 3: The Legal Office

Think of the system as a legal office:
- Contracts handles deals
- IP handles innovation protection
- Insurance handles risk
- Privacy handles data governance
- All report to compliance (the general counsel)

---

## Synthesis Evolution

| Date | Major Insight |
|------|---------------|
| Initial | Document-centric, entity-scoped model identified |
| 2026-01-27 | Phase 1 implementation reveals time-driven architecture and audit trail patterns |

---

## Phase 1 Integration Synthesis (January 27, 2026)

### Aha Moments That Changed Understanding

#### 1. Time Drives State, Not Just Tracks It

**Before**: Thought deadlines were passive data fields for reporting.
**After**: GDPR deadlines (30-day DSAR, 72-hour breach) **drive workflow state machines**. Time isn't metadata - it's a state transition trigger.

```
Deadline approaches → Priority escalates → Status changes → Notification triggers
```

See: [42-gdpr-compliance-architecture.md](../dimensions/42-gdpr-compliance-architecture.md)

#### 2. Audit Trail IS Domain Model

**Before**: Expected logging to be infrastructure concern.
**After**: Activity records are **first-class domain entities** created in the same transaction as state changes. The audit trail IS the evidence for compliance, not a side effect.

```typescript
// Not: update() then log()
// But: update() WITH activity creation - atomic
```

See: [43-audit-trail-patterns.md](../dimensions/43-audit-trail-patterns.md)

#### 3. Compliance is Fan-Out Query

**Before**: Expected a central compliance database.
**After**: Each domain **owns its compliance definition**. The aggregator just collects and synthesizes. No domain knows about other domains' compliance rules.

```
Aggregator fans out → Domains return their status → Aggregator synthesizes
```

See: [44-compliance-aggregation.md](../dimensions/44-compliance-aggregation.md)

#### 4. Dead Letter Exchange Prevents Catastrophe

**Before**: Assumed message queue would just retry failures.
**After**: Without DLX, failed messages either retry infinitely (system crash) or are lost (no debugging). DLX provides the critical middle ground.

See: [41-message-queue-patterns.md](../dimensions/41-message-queue-patterns.md)

#### 5. ESM is a Minefield

**Before**: TypeScript types are truth.
**After**: ESM imports don't match TypeScript types for CommonJS libraries. Runtime detection required.

See: [45-esm-compatibility-patterns.md](../dimensions/45-esm-compatibility-patterns.md)

---

### Integrated Architecture (Updated)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      OPERATIONAL ECOSYSTEM (Post Phase 1)                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                          API GATEWAY (3020)                           │ │
│  │  Unified entry point • Partial failure handling • Compliance proxy    │ │
│  └────────────────────────────────────┬──────────────────────────────────┘ │
│                                       │                                     │
│  ┌────────────────────────────────────┼──────────────────────────────────┐ │
│  │                    DOMAIN SERVICES LAYER                              │ │
│  │                                                                       │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐ │ │
│  │  │ contracts-  │ │  insurance  │ │     IP      │ │  data-privacy   │ │ │
│  │  │ legal:3011  │ │    :3013    │ │   :3014     │ │     :3012       │ │ │
│  │  │             │ │             │ │             │ │                 │ │ │
│  │  │  [MATURE]   │ │   [STUB]    │ │  [MATURE]   │ │  [MVP] ✓        │ │ │
│  │  │             │ │             │ │             │ │                 │ │ │
│  │  │ Prisma+Hono │ │ Health only │ │ CQRS+Events │ │ Consent, DSAR,  │ │ │
│  │  │ 7 subdomains│ │             │ │             │ │ Breach + comply │ │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────────┘ │ │
│  │        │               │               │               │              │ │
│  │        └───────────────┴───────────────┴───────────────┘              │ │
│  │                                │                                       │ │
│  │                    /compliance-status/:entityId                        │ │
│  │                    (each domain exposes, aggregator consumes)          │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐│
│  │                    ORCHESTRATION LAYER                                 ││
│  │                                                                        ││
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐    ││
│  │  │ workflow-engine  │  │   compliance-    │  │    reporting     │    ││
│  │  │     :3020        │  │   aggregator:3021│  │     :3022        │    ││
│  │  │                  │  │                  │  │                  │    ││
│  │  │ YAML workflows   │  │ Fan-out query    │  │ (TODO: distrib.) │    ││
│  │  │ RabbitMQ sub ✓   │  │ Real + Mock      │  │                  │    ││
│  │  │ Event handler ✓  │  │ clients          │  │                  │    ││
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘    ││
│  └────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐│
│  │                    MESSAGE INFRASTRUCTURE                              ││
│  │                                                                        ││
│  │  ┌──────────────────────────────────────────────────────────────────┐ ││
│  │  │                        RabbitMQ                                   │ ││
│  │  │                                                                   │ ││
│  │  │  ┌─────────────────────┐    ┌─────────────────────┐            │ ││
│  │  │  │  ecosystem.events   │    │ ecosystem.events.dlx │            │ ││
│  │  │  │  (topic exchange)   │    │  (dead letter)       │            │ ││
│  │  │  └─────────┬───────────┘    └──────────────────────┘            │ ││
│  │  │            │                                                     │ ││
│  │  │  ┌─────────▼───────────┐                                        │ ││
│  │  │  │  workflow-engine    │  ← Consumer connected ✓                │ ││
│  │  │  │  (queue)            │                                        │ ││
│  │  │  └─────────────────────┘                                        │ ││
│  │  │                                                                   │ ││
│  │  │  ⚠️ GAP: No publishers - domains don't emit events yet          │ ││
│  │  └──────────────────────────────────────────────────────────────────┘ ││
│  └────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Questions Phase 1 Raised

| Question | Context | Priority |
|----------|---------|----------|
| Who publishes events? | Subscriber exists, no publisher | HIGH |
| How to monitor DLX? | Failed messages need alerting | MEDIUM |
| Should activities survive deletion? | Audit trail vs data minimization | MEDIUM |
| What about compliance caching? | Every request fans out | LOW |
| ESM interop - platform fix coming? | Workarounds feel fragile | LOW |

---

### What We Now Know We Don't Know

1. **Event Schema**: No standard event contract across domains
2. **Publisher Pattern**: No example of domain emitting events
3. **Compliance History**: How to track status over time
4. **Cross-Border GDPR**: Different rules, no implementation
5. **Notification Delivery**: We track deadlines but don't send notifications

---

*"The more you know, the more you know you don't know." - Phase 1 proved this.*

