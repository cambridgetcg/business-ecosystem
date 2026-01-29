# PATH: Data Privacy Service

> **Purpose-Aligned Terrain Handling** - Building the domain backbone from scaffolded structure to production-ready service.

**Mission**: Protect personal data through systematic consent management, rights fulfillment, and breach response

**Status**: Phase 5 Building
**Last Updated**: January 29, 2026

---

## Phase 1: DEFINE (Purpose Definition)

### 1. VISION
The ideal end state:
- **Clean Architecture backbone** implemented across all 8 domain modules
- **CQRS pattern** operational with commands and queries separated
- **Event-driven** privacy events flowing to ecosystem
- **Domain services** encapsulating privacy business logic
- **Repository pattern** abstracting data access
- **API flexibility** (REST operational, GraphQL optional)

### 2. SCOPE

**In scope**:
- Domain model implementation for all 8 modules
- Service layer with privacy business rules
- Repository pattern for data access
- Command/Query separation (CQRS lite)
- Event publishing integration
- Compliance status endpoints

**Out of scope**:
- GraphQL API (future enhancement)
- Webhook consumers (handled by workflow engine)
- External consent platform integrations (stub for now)
- Full event sourcing (overkill for current needs)

### 3. SUCCESS CRITERIA

- [ ] Domain models in all 8 modules have TypeScript implementations
- [ ] Services encapsulate business rules (deadline calculation, severity assessment)
- [ ] Repositories abstract Prisma access
- [ ] Routes use services instead of direct Prisma
- [ ] Events published on all state transitions
- [ ] Compliance status endpoint returns real assessments
- [ ] 80%+ test coverage on domain logic

### 4. CONSTRAINTS

**Technical**:
- Must maintain working routes during refactor
- Must preserve Hono + Prisma + TypeScript stack
- Must stay compatible with ecosystem event patterns

**Business**:
- GDPR compliance logic must be accurate (30-day deadlines, 72-hour breach notification)
- Entity-scoped isolation must be maintained
- Audit logging must capture all changes

### 5. LONGING CHECK

- [x] I've glimpsed the ideal - Clean Architecture with privacy expertise embedded
- [x] I feel the ache of separation - scaffolded folders sit empty while routes grow
- [x] This purpose is worth pursuing - proper structure enables maintainability

---

## Phase 2: ASSESS (Current State)

### 1. PRODUCT STATE

**What exists today**:
| Component | Status | Notes |
|-----------|--------|-------|
| Prisma Schema | COMPLETE | 11 models, comprehensive enums |
| DSAR Routes | WORKING | Full CRUD, workflow states, events |
| Consent Routes | WORKING | Grant/withdraw/query |
| Breach Routes | WORKING | Full lifecycle, severity, events |
| Event Publisher | WORKING | RabbitMQ integration |
| Domain Modules | SCAFFOLDED | 8 empty module structures |
| Application Layer | SCAFFOLDED | Empty commands/queries |
| Infrastructure | SCAFFOLDED | Empty persistence/messaging |

**What works**:
- Complete DSAR workflow (submit → verify → process → complete)
- Consent lifecycle (grant → withdraw → expire)
- Breach management (identify → assess → notify → remediate)
- Event publishing on state changes
- Entity-scoped queries

**What doesn't work**:
- No separation between routes and business logic
- No reusable domain services
- No repository abstraction (direct Prisma in routes)
- Deadline/compliance logic duplicated
- No unit-testable business rules

### 2. CODEBASE STATE

| Area | Files | LOC | Tech Debt |
|------|-------|-----|-----------|
| Routes | 4 | ~800 | Medium - mixed concerns |
| Lib | 3 | ~200 | Low - clean utilities |
| Domain | 0 | 0 | High - empty scaffolds |
| Application | 0 | 0 | High - empty scaffolds |
| Tests | 0 | 0 | Critical - no tests |

### 3. ARCHITECTURE GAP

**Current pattern** (working but not scalable):
```
Route → Prisma → Database
  ↓
Event Publisher
```

**Target pattern** (Clean Architecture):
```
Route → Command/Query Handler
           ↓
       Domain Service
           ↓
       Repository → Prisma → Database
           ↓
       Event Publisher
```

### 4. GAP ANALYSIS

**Distance from current to purpose**: ~30% complete

**Major gaps**:
1. Domain models not implemented (TypeScript classes)
2. Services not extracted from routes
3. Repositories not abstracting Prisma
4. No command/query handlers
5. No tests

**Known territory**:
- Schema is comprehensive and correct
- Routes demonstrate the needed workflows
- Event patterns are established

---

## Phase 3: RECONNOITER (Shine Light Ahead)

### 1. TERRAIN MAPPING

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TERRAIN MAP                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  CURRENT (30%)                                              PURPOSE (100%)   │
│       ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━★            │
│       │                                                        │            │
│       │    ┌────────────────────────────────────────────┐     │            │
│       │    │           DOMAIN MODULES                    │     │            │
│       │    │                                             │     │            │
│       │    │  ○ consent-management (WP1)                │     │            │
│       │    │  ○ data-subject-rights (WP2)               │     │            │
│       │    │  ○ breach-management (WP3)                 │     │            │
│       │    │  ○ privacy-impact (WP4)                    │     │            │
│       │    │  ○ data-inventory (WP5)                    │     │            │
│       │    │  ○ vendor-privacy (WP6)                    │     │            │
│       │    │  ○ cross-border-transfer (WP7)             │     │            │
│       │    │  ○ privacy-program (WP8)                   │     │            │
│       │    │                                             │     │            │
│       │    │  ◇ refactor routes to use services         │     │            │
│       │    │  ◇ add test coverage                       │     │            │
│       │    │                                             │     │            │
│       │    └────────────────────────────────────────────┘     │            │
│       │                                                        │            │
│       └────────────────────────────────────────────────────────┘            │
│                                                                              │
│  KNOWN TERRAIN (from working routes):                                        │
│  ✓ DSAR workflow states and transitions                                      │
│  ✓ Consent lifecycle and lawful bases                                        │
│  ✓ Breach severity assessment and notification                               │
│  ✓ Event publishing patterns                                                 │
│                                                                              │
│  FOG OF WAR (needs research):                                                │
│  ? DPIA risk scoring algorithms                                              │
│  ? Cross-border transfer adequacy rules                                      │
│  ? Retention policy automation                                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2. OBSTACLE IDENTIFICATION

| Obstacle | Type | Severity | Path Around |
|----------|------|----------|-------------|
| Empty domain modules | Implementation | MEDIUM | Implement incrementally, core 3 first |
| Business logic in routes | Technical Debt | MEDIUM | Extract to services, routes delegate |
| No tests | Quality | HIGH | Add tests as services are extracted |
| DPIA complexity | Knowledge | LOW | Stub scoring, enhance later |

### 3. PRIORITY MATRIX

**Core Modules** (implement first - highest business value):
1. `consent-management` - Foundation for lawful processing
2. `data-subject-rights` - DSAR handling (highest volume)
3. `breach-management` - Regulatory risk (72-hour rule)

**Support Modules** (implement second):
4. `privacy-impact` - DPIA management
5. `data-inventory` - Processing activities
6. `vendor-privacy` - Third-party processors

**Program Modules** (implement third):
7. `cross-border-transfer` - International transfers
8. `privacy-program` - Program-level metrics

---

## Phase 4: WAYPOINT (Set Milestones)

### Waypoint 1: Consent Management Module
```
┌──────────────────────────────────────────┐
│ Waypoint: consent-management             │
│ Order: 1 of 8                            │
├──────────────────────────────────────────┤
│ Definition:                              │
│   Domain models for ConsentRecord        │
│   ConsentService with business rules     │
│   ConsentRepository abstracting Prisma   │
│   Routes refactored to use service       │
│                                          │
│ Verification:                            │
│   - [ ] ConsentRecord.ts model           │
│   - [ ] consent.service.ts with rules    │
│   - [ ] consent.repository.ts            │
│   - [ ] consent.routes.ts uses service   │
│   - [ ] Unit tests for service           │
│                                          │
│ Value delivered:                         │
│   Pattern established for all modules    │
│                                          │
│ Dependencies:                            │
│   Previous waypoint: START               │
│   Blockers: None                         │
│                                          │
│ Effort: M                                │
└──────────────────────────────────────────┘
```

### Waypoint 2: Data Subject Rights Module
```
┌──────────────────────────────────────────┐
│ Waypoint: data-subject-rights            │
│ Order: 2 of 8                            │
├──────────────────────────────────────────┤
│ Definition:                              │
│   DSARRequest model with deadline logic  │
│   DSARService with workflow rules        │
│   DSARRepository abstracting Prisma      │
│   Deadline calculator (30/90 day rules)  │
│                                          │
│ Verification:                            │
│   - [ ] DSAR model with deadline calc    │
│   - [ ] dsar.service.ts with workflow    │
│   - [ ] dsar.repository.ts               │
│   - [ ] dsar.routes.ts uses service      │
│   - [ ] Tests for deadline calculations  │
│                                          │
│ Value delivered:                         │
│   Core GDPR compliance logic isolated    │
│                                          │
│ Dependencies:                            │
│   Previous waypoint: WP1 (pattern)       │
│   Blockers: None                         │
│                                          │
│ Effort: L                                │
└──────────────────────────────────────────┘
```

### Waypoint 3: Breach Management Module
```
┌──────────────────────────────────────────┐
│ Waypoint: breach-management              │
│ Order: 3 of 8                            │
├──────────────────────────────────────────┤
│ Definition:                              │
│   DataBreach model with severity rules   │
│   BreachService with notification logic  │
│   BreachRepository abstracting Prisma    │
│   72-hour notification deadline tracking │
│                                          │
│ Verification:                            │
│   - [ ] DataBreach model                 │
│   - [ ] breach.service.ts with rules     │
│   - [ ] breach.repository.ts             │
│   - [ ] breach.routes.ts uses service    │
│   - [ ] Tests for severity assessment    │
│                                          │
│ Value delivered:                         │
│   Breach response logic centralized      │
│                                          │
│ Dependencies:                            │
│   Previous waypoint: WP2                 │
│   Blockers: None                         │
│                                          │
│ Effort: M                                │
└──────────────────────────────────────────┘
```

### Waypoint 4: Privacy Impact Module
```
┌──────────────────────────────────────────┐
│ Waypoint: privacy-impact                 │
│ Order: 4 of 8                            │
├──────────────────────────────────────────┤
│ Definition:                              │
│   PrivacyImpactAssessment model          │
│   PIAService with risk scoring           │
│   PIARepository abstracting Prisma       │
│   DPIA workflow states                   │
│                                          │
│ Verification:                            │
│   - [ ] PIA model with risk types        │
│   - [ ] pia.service.ts with workflow     │
│   - [ ] pia.repository.ts                │
│   - [ ] Routes for DPIA CRUD             │
│   - [ ] Tests for risk scoring           │
│                                          │
│ Value delivered:                         │
│   DPIA management operational            │
│                                          │
│ Dependencies:                            │
│   Previous waypoint: WP3                 │
│   Blockers: Risk scoring research        │
│                                          │
│ Effort: M                                │
└──────────────────────────────────────────┘
```

### Waypoint 5: Data Inventory Module
```
┌──────────────────────────────────────────┐
│ Waypoint: data-inventory                 │
│ Order: 5 of 8                            │
├──────────────────────────────────────────┤
│ Definition:                              │
│   ProcessingActivity model               │
│   Article 30 records management          │
│   Data flow mapping                      │
│                                          │
│ Verification:                            │
│   - [ ] ProcessingActivity model         │
│   - [ ] inventory.service.ts             │
│   - [ ] inventory.repository.ts          │
│   - [ ] Routes for Art. 30 records       │
│   - [ ] Tests for lawful basis rules     │
│                                          │
│ Value delivered:                         │
│   GDPR Article 30 compliance             │
│                                          │
│ Dependencies:                            │
│   Previous waypoint: WP4                 │
│   Blockers: None                         │
│                                          │
│ Effort: S                                │
└──────────────────────────────────────────┘
```

### Waypoint 6: Vendor Privacy Module
```
┌──────────────────────────────────────────┐
│ Waypoint: vendor-privacy                 │
│ Order: 6 of 8                            │
├──────────────────────────────────────────┤
│ Definition:                              │
│   DataProcessor model                    │
│   DPA tracking and expiry alerts         │
│   Sub-processor management               │
│                                          │
│ Verification:                            │
│   - [ ] DataProcessor model              │
│   - [ ] vendor.service.ts                │
│   - [ ] vendor.repository.ts             │
│   - [ ] DPA expiry notifications         │
│   - [ ] Tests for processor rules        │
│                                          │
│ Value delivered:                         │
│   Third-party processor oversight        │
│                                          │
│ Dependencies:                            │
│   Previous waypoint: WP5                 │
│   Blockers: None                         │
│                                          │
│ Effort: S                                │
└──────────────────────────────────────────┘
```

### Waypoint 7: Cross-Border Transfer Module
```
┌──────────────────────────────────────────┐
│ Waypoint: cross-border-transfer          │
│ Order: 7 of 8                            │
├──────────────────────────────────────────┤
│ Definition:                              │
│   Transfer mechanism tracking            │
│   Adequacy decision reference            │
│   SCC management                         │
│                                          │
│ Verification:                            │
│   - [ ] Transfer models                  │
│   - [ ] transfer.service.ts              │
│   - [ ] transfer.repository.ts           │
│   - [ ] Adequacy status lookup           │
│   - [ ] Tests for transfer rules         │
│                                          │
│ Value delivered:                         │
│   International transfer compliance      │
│                                          │
│ Dependencies:                            │
│   Previous waypoint: WP6                 │
│   Blockers: Adequacy list research       │
│                                          │
│ Effort: M                                │
└──────────────────────────────────────────┘
```

### Waypoint 8: Privacy Program Module
```
┌──────────────────────────────────────────┐
│ Waypoint: privacy-program (PURPOSE)      │
│ Order: 8 of 8                            │
├──────────────────────────────────────────┤
│ Definition:                              │
│   Program-level metrics aggregation      │
│   Compliance dashboard data              │
│   Privacy KPIs                           │
│                                          │
│ Verification:                            │
│   - [ ] Program metrics service          │
│   - [ ] Compliance status aggregation    │
│   - [ ] /compliance-status endpoint      │
│   - [ ] Dashboard data endpoint          │
│   - [ ] Tests for metric calculations    │
│                                          │
│ Value delivered:                         │
│   PURPOSE REALIZED - full domain         │
│   backbone with privacy program view     │
│                                          │
│ Dependencies:                            │
│   Previous waypoints: WP1-WP7            │
│   Blockers: None                         │
│                                          │
│ Effort: M                                │
└──────────────────────────────────────────┘
```

### PATH VISUALIZATION

```
  START ──→ WP1 ──→ WP2 ──→ WP3 ──→ WP4 ──→ WP5 ──→ WP6 ──→ WP7 ──→ WP8 ──→ PURPOSE
    ✓        ✓       ✓       ✓       ○       ○       ○       ○       ○        ★
  [DONE]  consent  dsar   breach   pia   inventory vendor  xfer   program  [GOAL]
          [DONE]  [DONE]  [DONE]  [NEXT]
             │       │       │
             └───────┴───────┘
              CORE 3 COMPLETE
```

---

## Phase 5: BUILD (Construct the Path)

### Current Position: START → WP1

**Ready to begin**: January 29, 2026

**Build Order**:
1. Establish base patterns in `consent-management` (WP1)
2. Apply patterns to high-volume `data-subject-rights` (WP2)
3. Complete core with `breach-management` (WP3)
4. Expand to remaining modules (WP4-WP8)

**Pattern to follow** (per module):
```typescript
// 1. Domain Model (models/consent-record.ts)
export interface ConsentRecord {
  id: string;
  entityId: string;
  subjectId: string;
  purpose: string;
  lawfulBasis: LawfulBasis;
  status: ConsentStatus;
  grantedAt: Date;
  withdrawnAt?: Date;
  expiresAt?: Date;
}

// 2. Repository Interface (repositories/consent.repository.ts)
export interface ConsentRepository {
  findById(id: string): Promise<ConsentRecord | null>;
  findBySubject(subjectId: string): Promise<ConsentRecord[]>;
  save(consent: ConsentRecord): Promise<ConsentRecord>;
  withdraw(id: string): Promise<ConsentRecord>;
}

// 3. Service (services/consent.service.ts)
export class ConsentService {
  constructor(private repo: ConsentRepository, private events: EventPublisher) {}

  async grantConsent(input: GrantConsentInput): Promise<ConsentRecord> {
    // Business rules: validate purpose, check existing, set expiry
  }

  async withdrawConsent(id: string): Promise<ConsentRecord> {
    // Business rules: mark withdrawn, publish event
  }

  async checkConsent(subjectId: string, purpose: string): Promise<boolean> {
    // Business rules: find valid, check expiry, check withdrawal
  }
}
```

---

## Progress Tracking

| Waypoint | Status | Reached | Notes |
|----------|--------|---------|-------|
| WP1: consent-management | **COMPLETE** | 2026-01-29 | Model, Repository, Service, Routes refactored |
| WP2: data-subject-rights | **COMPLETE** | 2026-01-29 | GDPR deadline logic, workflow states |
| WP3: breach-management | **COMPLETE** | 2026-01-29 | 72-hour notification, severity assessment |
| WP4: privacy-impact | PENDING | - | DPIA workflow |
| WP5: data-inventory | PENDING | - | Art. 30 records |
| WP6: vendor-privacy | PENDING | - | Processor management |
| WP7: cross-border-transfer | PENDING | - | Transfer compliance |
| WP8: privacy-program | PENDING | - | Program metrics |

**Overall Progress**: 3/8 waypoints (37.5%)
**Foundation Complete**: Schema ✓, Routes ✓, Events ✓
**Backbone Progress**: 37.5% (CORE 3 complete)

---

## The PATH Promise

This PATH ensures:
1. **PURPOSE IS CLEAR** - Domain backbone with privacy expertise embedded
2. **CURRENT IS KNOWN** - Working routes, empty domain modules
3. **TERRAIN IS LIT** - 8 modules mapped with priorities
4. **WAYPOINTS GUIDE** - Core 3 first, then support, then program
5. **PROGRESS IS TRACKED** - This document
6. **OBSTACLES ARE LOGGED** - Risk scoring research needed
7. **LEARNINGS PERSIST** - Pattern from WP1 applies to all
8. **QUALITY ASSURED** - Tests required at each waypoint

---

*PATH Protocol activated for data-privacy backbone. Ready to build toward purpose.*
