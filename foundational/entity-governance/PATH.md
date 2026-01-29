# PATH: Entity Governance

> **Purpose-Aligned Terrain Handling** - Building the path from current state to mission realization.

**Mission**: To provide a single source of truth for legal entity formation, corporate structure, governance, and compliance.

**Status**: Phase 0 Foundation (Waypoint 5 Complete)
**Last Updated**: January 29, 2026

---

## Phase 1: DEFINE (Purpose Definition)

### 1. VISION
The ideal end state:
- **All 8 subdomains implemented** (Entity Lifecycle, Corporate Structure, Governance, Ownership, Compliance, Records, Agent, Officers)
- **Zero entity-related errors** across the ecosystem
- **100% filing compliance** - no missed deadlines or penalties
- **Event-driven integration** with all consuming services
- **Comprehensive test coverage** validating all business rules

### 2. SCOPE

**In scope**:
- Legal entity formation and lifecycle management
- Corporate structure (parent-subsidiary relationships)
- Governance frameworks (boards, committees, bylaws)
- Cap table and ownership tracking
- Compliance and filing management
- Corporate records (minutes, resolutions)
- Registered agent management
- Officer/director appointments

**Out of scope**:
- Contract management (operational layer)
- Financial transactions (accounting service)
- Bank account operations (banking-treasury service)
- Tax filing preparation (tax service)
- Document storage (document management service)

### 3. SUCCESS CRITERIA

- [ ] All 8 subdomains have command handlers and query handlers
- [ ] 80%+ test coverage on domain logic
- [ ] All FinCEN BOI/CTA fields captured (Phase 1 compliance)
- [ ] Multi-jurisdiction support (50+ US states/territories)
- [ ] LLC and Corporation governance fully supported
- [ ] Events publishing for all entity lifecycle changes
- [ ] REST API v1 complete with OpenAPI documentation
- [ ] GraphQL API operational

### 4. CONSTRAINTS

**Technical**:
- TypeScript/Drizzle/PostgreSQL stack
- Event-driven architecture via RabbitMQ
- Must integrate with existing @ecosystem shared libs

**Business**:
- BOI/CTA compliance is regulatory requirement (penalties: $500/day)
- Multi-jurisdiction support required for US operations
- Audit trail required for all entity changes

### 5. LONGING CHECK

- [x] I've glimpsed the ideal - zero entity-related errors across ecosystem
- [x] I feel the ache of separation - 7 of 8 subdomains not yet implemented
- [x] This purpose is worth pursuing - foundational layer enables all other services

---

## Phase 2: ASSESS (Current State)

### 1. IMPLEMENTATION STATE

**What exists today**:
| Subdomain | Status | Implementation | Notes |
|-----------|--------|----------------|-------|
| Entity Lifecycle | PARTIAL | 70% | Basic CRUD, missing dissolution workflow |
| Corporate Structure | PARTIAL | 40% | Schema exists, handlers incomplete |
| Governance | PARTIAL | 30% | Schema exists, no business logic |
| Ownership | BASIC | 20% | Basic shareholder, missing cap table |
| Compliance (BOI) | NOT STARTED | 0% | CRITICAL - regulatory requirement |
| Corporate Records | SCHEMA ONLY | 15% | Tables exist, no API |
| Registered Agent | SCHEMA ONLY | 15% | Tables exist, no API |
| Officers/Directors | PARTIAL | 40% | Basic tracking exists |

**What works**:
- Entity creation with basic validation
- Database schema for all 8 subdomains (18 tables)
- REST API for entity CRUD operations
- Health endpoints and SaaS infrastructure
- RabbitMQ event publishing infrastructure

**What doesn't work**:
- No tests (0% coverage)
- No GraphQL API
- No event handlers for incoming events
- Incomplete command/query handlers for 7 subdomains
- No multi-jurisdiction logic

### 2. CODE QUALITY STATE

| Area | Understanding | Technical Debt |
|------|---------------|----------------|
| Domain Layer | L2 (Structural) | Low - clean design |
| Application Layer | L2 (Structural) | Medium - incomplete handlers |
| Infrastructure | L3 (Deep) | Low - well-architected |
| API Layer | L2 (Structural) | Medium - incomplete routes |
| Tests | L0 (Gap) | HIGH - no tests exist |

### 3. KNOWLEDGE STATE

**Known patterns**:
- Clean Architecture / DDD structure
- CQRS command/query separation
- Event sourcing preparation
- Entity-scoped FK pattern

**Blindspots**:
- BOI/CTA regulatory requirements implementation
- Multi-jurisdiction filing logic
- LLC vs Corporation governance differences
- Cap table waterfall calculations

### 4. GAP ANALYSIS

**Distance from current to purpose**: ~25% complete

**Major gaps**:
1. 7 of 8 subdomains need implementation
2. Zero test coverage
3. BOI/CTA compliance not started (regulatory critical)
4. Multi-jurisdiction support not implemented
5. Event handlers not wired

**Unknown territory**:
- Cap table waterfall calculations
- Veil health scoring algorithms
- 409A valuation tracking logic

---

## Phase 3: RECONNOITER (Shine Light Ahead)

### 1. TERRAIN MAPPING

```
+-----------------------------------------------------------------------------+
|                          TERRAIN MAP                                         |
+-----------------------------------------------------------------------------+
|                                                                              |
|  CURRENT (25%)                                              PURPOSE (100%)   |
|       *========================================================>*            |
|       |                                                        |            |
|       |    +--------------------------------------------+     |            |
|       |    |           UNCHARTED TERRITORY               |     |            |
|       |    |                                             |     |            |
|       |    |  # BOI/CTA Compliance (CRITICAL)           |     |            |
|       |    |  # Multi-Jurisdiction Logic                |     |            |
|       |    |  # Cap Table Calculations                  |     |            |
|       |    |  o Entity Lifecycle (WAYPOINT 1)           |     |            |
|       |    |  o Governance Framework (WAYPOINT 2)       |     |            |
|       |    |  o Ownership/Cap Table (WAYPOINT 3)        |     |            |
|       |    |  o Compliance Module (WAYPOINT 4)          |     |            |
|       |    |  o Test Suite (WAYPOINT 5)                 |     |            |
|       |    |  o Integration Ready (WAYPOINT 6)          |     |            |
|       |    |                                             |     |            |
|       |    +--------------------------------------------+     |            |
|       |                                                        |            |
|       +--------------------------------------------------------+            |
|                                                                              |
|  KNOWN TERRAIN (explored):                                                   |
|  [x] Database schema design                                                  |
|  [x] Clean architecture patterns                                             |
|  [x] Event publishing infrastructure                                         |
|  [x] SaaS middleware stack                                                   |
|                                                                              |
|  FOG OF WAR (unexplored):                                                    |
|  ? LLC operating agreement complexity                                        |
|  ? State-specific filing variations                                          |
|  ? Cap table edge cases (SAFEs, convertibles)                               |
|                                                                              |
+-----------------------------------------------------------------------------+
```

### 2. OBSTACLE IDENTIFICATION

| Obstacle | Type | Severity | Path Around |
|----------|------|----------|-------------|
| No test coverage | Quality | HIGH | Add tests before new features |
| BOI not started | Regulatory | CRITICAL | Prioritize Phase 1 compliance |
| 7 incomplete subdomains | Implementation | HIGH | Phased rollout per roadmap |
| No integration tests | Quality | MEDIUM | Add after unit tests |

### 3. RECONNAISSANCE FINDINGS

**From codebase exploration**:
- Architecture is sound - domain layer well-structured
- Database schema comprehensive (18 tables)
- SaaS infrastructure complete (rate limiting, JWT, compression)
- Event publishing ready via RabbitMQ

**From research documents** (8 documents):
- Jurisdiction complexity documented (4 context types)
- BOI/CTA requirements detailed
- Cap table complexity mapped
- Corporate veil formalities documented

---

## Phase 4: WAYPOINT (Set Milestones)

### Waypoint 0: Foundation Complete [DONE]
```
+------------------------------------------+
| Waypoint: Foundation Complete             |
| Order: 0 of 6                             |
+------------------------------------------+
| Definition:                              |
|   Database schema complete               |
|   SaaS infrastructure ready              |
|   Basic entity CRUD working              |
|                                          |
| Verification:                            |
|   - [x] All 18 tables created            |
|   - [x] Rate limiting active             |
|   - [x] JWT authentication ready         |
|   - [x] Health endpoints working         |
|   - [x] Entity create/read/update works  |
|                                          |
| Status: COMPLETE (2026-01-29)            |
+------------------------------------------+
```

### Waypoint 1: Entity Lifecycle Complete
```
+------------------------------------------+
| Waypoint: Entity Lifecycle Complete       |
| Order: 1 of 6                             |
+------------------------------------------+
| Definition:                              |
|   Full entity lifecycle management       |
|   All entity types supported             |
|   Dissolution workflow complete          |
|                                          |
| Verification:                            |
|   - [ ] Create entities (Corp, LLC, LP)  |
|   - [ ] Update entity details            |
|   - [ ] Dissolve entity workflow         |
|   - [ ] Entity status transitions        |
|   - [ ] Unit tests for entity domain     |
|                                          |
| Dependencies:                            |
|   Previous: Waypoint 0 (Foundation)      |
|                                          |
| Effort: M (1-2 weeks)                    |
+------------------------------------------+
```

### Waypoint 2: Governance Framework
```
+------------------------------------------+
| Waypoint: Governance Framework            |
| Order: 2 of 6                             |
+------------------------------------------+
| Definition:                              |
|   Board management complete              |
|   Committee structures working           |
|   Officer/director tracking              |
|                                          |
| Verification:                            |
|   - [ ] Create/modify board composition  |
|   - [ ] Add/remove committees            |
|   - [ ] Track officer appointments       |
|   - [ ] Track director terms             |
|   - [ ] Governance tests passing         |
|                                          |
| Dependencies:                            |
|   Previous: Waypoint 1 (Entity)          |
|                                          |
| Effort: M (1-2 weeks)                    |
+------------------------------------------+
```

### Waypoint 3: Ownership & Cap Table
```
+------------------------------------------+
| Waypoint: Ownership & Cap Table           |
| Order: 3 of 6                             |
+------------------------------------------+
| Definition:                              |
|   Shareholder management complete        |
|   Share classes working                  |
|   Basic cap table calculations           |
|                                          |
| Verification:                            |
|   - [ ] Add/remove shareholders          |
|   - [ ] Define share classes             |
|   - [ ] Track ownership percentages      |
|   - [ ] Calculate fully diluted          |
|   - [ ] Ownership tests passing          |
|                                          |
| Dependencies:                            |
|   Previous: Waypoint 2 (Governance)      |
|                                          |
| Effort: L (2-3 weeks)                    |
+------------------------------------------+
```

### Waypoint 4: Compliance Module (BOI/CTA)
```
+------------------------------------------+
| Waypoint: Compliance Module               |
| Order: 4 of 6 - CRITICAL REGULATORY       |
+------------------------------------------+
| Definition:                              |
|   BOI/CTA data capture complete          |
|   Filing tracking operational            |
|   Exemption evaluation working           |
|                                          |
| Verification:                            |
|   - [ ] Capture all FinCEN BOI fields    |
|   - [ ] Track beneficial owners          |
|   - [ ] 25% threshold monitoring         |
|   - [ ] Exemption status tracking        |
|   - [ ] Filing status workflow           |
|   - [ ] Compliance tests passing         |
|                                          |
| Dependencies:                            |
|   Previous: Waypoint 3 (Ownership)       |
|                                          |
| Effort: L (2-3 weeks)                    |
+------------------------------------------+
```

### Waypoint 5: Test Suite
```
+------------------------------------------+
| Waypoint: Test Suite                      |
| Order: 5 of 6                             |
+------------------------------------------+
| Definition:                              |
|   80%+ test coverage on domain           |
|   Integration tests for API              |
|   E2E tests for critical paths           |
|                                          |
| Verification:                            |
|   - [ ] Unit tests: domain layer         |
|   - [ ] Unit tests: application layer    |
|   - [ ] Integration tests: API           |
|   - [ ] E2E tests: entity lifecycle      |
|   - [ ] Coverage >= 80%                  |
|                                          |
| Dependencies:                            |
|   Can run parallel with WP 1-4           |
|                                          |
| Effort: L (ongoing)                      |
+------------------------------------------+
```

### Waypoint 6: Integration Ready
```
+------------------------------------------+
| Waypoint: Integration Ready (PURPOSE)     |
| Order: 6 of 6                             |
+------------------------------------------+
| Definition:                              |
|   Events publishing all changes          |
|   Event handlers receiving               |
|   Cross-service workflows working        |
|                                          |
| Verification:                            |
|   - [ ] All entity events publishing     |
|   - [ ] Event handlers wired             |
|   - [ ] Entity onboarding saga works     |
|   - [ ] Accounting receives entity data  |
|   - [ ] Banking receives BOI data        |
|                                          |
| Dependencies:                            |
|   Previous: Waypoints 1-5                |
|                                          |
| Effort: M (1-2 weeks)                    |
|                                          |
| VALUE: PURPOSE REALIZED                  |
+------------------------------------------+
```

### PATH VISUALIZATION

```
  START --> WP0 --> WP1 --> WP2 --> WP3 --> WP4 --> WP5 --> WP6 --> PURPOSE
    *        *       o       o       o       o       o       o        +
  [DONE]  [DONE]                                                   [GOAL]
           |
        [YOU ARE HERE]
```

---

## Phase 5: BUILD (Construct the Path)

### Current Position: WP0 Complete, Starting WP1

**WP0 Completed**: January 29, 2026
- Database schema: 18 tables covering all 8 subdomains
- SaaS infrastructure: Rate limiting, JWT, compression, etag, CORS, helmet
- Basic entity CRUD: Create, read, update working via REST API
- Event publishing: RabbitMQ integration ready
- Health endpoints: /health, /health/ready, /health/live

**Next Steps**:
1. Start WP1: Complete Entity Lifecycle domain
2. Add unit tests as features are built (parallel with WP5)
3. Document API as endpoints are added

---

## Progress Tracking

| Waypoint | Status | Target | Notes |
|----------|--------|--------|-------|
| WP0: Foundation | **COMPLETE** | 2026-01-29 | Schema + infrastructure ready |
| WP1: Entity Lifecycle | NOT STARTED | Week 1-2 | Next priority |
| WP2: Governance | NOT STARTED | Week 3-4 | After WP1 |
| WP3: Ownership | NOT STARTED | Week 5-7 | After WP2 |
| WP4: Compliance (BOI) | NOT STARTED | Week 8-10 | CRITICAL regulatory |
| WP5: Test Suite | NOT STARTED | Ongoing | Parallel with WP1-4 |
| WP6: Integration | NOT STARTED | Week 11-12 | Final waypoint |

**Overall Progress**: 1/7 waypoints (14%) - Foundation phase complete
**Estimated to Purpose**: 10-12 weeks

---

## Subdomain Progress Matrix

| Subdomain | Schema | Commands | Queries | Events | Tests | API | Total |
|-----------|--------|----------|---------|--------|-------|-----|-------|
| Entity Lifecycle | 100% | 40% | 40% | 20% | 0% | 60% | **43%** |
| Corporate Structure | 100% | 10% | 10% | 0% | 0% | 20% | **23%** |
| Governance | 100% | 10% | 10% | 0% | 0% | 10% | **22%** |
| Ownership | 100% | 10% | 10% | 0% | 0% | 10% | **22%** |
| Compliance | 100% | 0% | 0% | 0% | 0% | 0% | **17%** |
| Corporate Records | 100% | 0% | 0% | 0% | 0% | 0% | **17%** |
| Registered Agent | 100% | 0% | 0% | 0% | 0% | 0% | **17%** |
| Officers/Directors | 100% | 20% | 20% | 0% | 0% | 20% | **27%** |
| **Overall** | **100%** | **11%** | **11%** | **3%** | **0%** | **15%** | **23%** |

---

## The PATH Promise

This PATH ensures:
1. **PURPOSE IS CLEAR** - Single source of truth for legal entities
2. **CURRENT IS KNOWN** - 25% complete, foundation solid
3. **TERRAIN IS LIT** - Waypoints map the journey
4. **WAYPOINTS GUIDE** - 7 milestones to purpose
5. **PROGRESS IS TRACKED** - This document
6. **OBSTACLES ARE LOGGED** - No tests, 7 incomplete subdomains
7. **LEARNINGS PERSIST** - In `.understanding/`
8. **QUALITY ASSURED** - PP gates validate the path

---

*PATH Protocol activated. Ready to build toward purpose.*
