# Coverage Map: Entity Governance Understanding

This document maps the current state of understanding across the entity-governance codebase.

**Last Updated**: January 29, 2026 (Foundation Phase Complete)

**Legend**:
- **Deep**: Thoroughly understood, well-documented, battle-tested
- **Solid**: Good understanding, documented, may have minor gaps
- **Surface**: Basic understanding, needs deeper exploration
- **Gap**: Not yet understood, needs research

---

## Layer-Level Understanding

### Domain Layer

| Area | Coverage | Notes | Source |
|------|----------|-------|--------|
| LegalEntity aggregate | Solid | Core entity well-designed | `src/domain/entities/legal-entity.ts` |
| Entity value objects | Solid | Address, TaxId, etc. implemented | `src/domain/value-objects/` |
| Domain events | Surface | Defined but not fully utilized | `src/domain/events/` |
| Domain services | Gap | Not yet implemented | - |
| Business rules | Surface | Validation exists, rules incomplete | `src/domain/` |

**Dimension File**: [01-domain-layer.md](dimensions/01-domain-layer.md)

---

### Application Layer

| Area | Coverage | Notes | Source |
|------|----------|-------|--------|
| Command handlers | Surface | Only LegalEntityCommandHandler exists | `src/application/handlers/` |
| Query handlers | Surface | Only LegalEntityQueryHandler exists | `src/application/handlers/` |
| Application services | Gap | Not implemented | - |
| Use cases | Surface | Partial coverage of entity lifecycle | - |

**Dimension File**: [02-application-layer.md](dimensions/02-application-layer.md)

---

### Infrastructure Layer

| Area | Coverage | Notes | Source |
|------|----------|-------|--------|
| Database schema | Deep | 18 tables, comprehensive | `src/infrastructure/persistence/schema.ts` |
| Repository pattern | Solid | DrizzleLegalEntityRepository works | `src/infrastructure/persistence/repositories/` |
| Event publishing | Solid | RabbitMQ publisher ready | `src/infrastructure/integration/event-publisher.ts` |
| Event handlers | Gap | Not wired | `src/infrastructure/integration/event-handlers.ts` |

**Dimension File**: [03-infrastructure-layer.md](dimensions/03-infrastructure-layer.md)

---

### API Layer

| Area | Coverage | Notes | Source |
|------|----------|-------|--------|
| REST routes | Surface | Basic entity routes only | `src/api/rest/routes/legal-entities.ts` |
| GraphQL | Gap | Not implemented | - |
| OpenAPI/Swagger | Solid | Configured with swagger-ui | `src/api/rest/app.ts` |
| Middleware stack | Deep | Full SaaS stack configured | `src/api/rest/app.ts` |

**Dimension File**: [04-api-layer.md](dimensions/04-api-layer.md)

---

## Subdomain Understanding

### Entity Lifecycle (Most Complete)

| Area | Coverage | Notes |
|------|----------|-------|
| Entity creation | Solid | Command + handler working |
| Entity types | Surface | Schema supports, logic incomplete |
| Entity status | Surface | States defined, transitions partial |
| Dissolution | Gap | Not implemented |
| Jurisdiction | Surface | Basic support, multi-context missing |

---

### Corporate Structure

| Area | Coverage | Notes |
|------|----------|-------|
| Parent-subsidiary | Surface | Schema exists, API incomplete |
| Ownership chain | Gap | Not implemented |
| Org hierarchy | Gap | Not implemented |

---

### Governance

| Area | Coverage | Notes |
|------|----------|-------|
| Board composition | Surface | Schema exists, handlers missing |
| Committees | Gap | Schema only |
| Bylaws | Gap | Schema only |
| Meeting minutes | Gap | Schema only |
| Resolutions | Gap | Schema only |

---

### Ownership (Shareholders/Cap Table)

| Area | Coverage | Notes |
|------|----------|-------|
| Shareholder registry | Surface | Basic schema |
| Share classes | Surface | Schema exists |
| Equity grants | Gap | Schema only |
| Cap table calculations | Gap | Not implemented |
| Ownership percentages | Gap | Not implemented |

---

### Compliance (BOI/CTA) - CRITICAL

| Area | Coverage | Notes |
|------|----------|-------|
| Beneficial owners | Gap | Schema exists, no implementation |
| BOI filings | Gap | Not implemented |
| Exemptions | Gap | 23 categories not tracked |
| Threshold monitoring | Gap | 25% logic not implemented |

---

### Corporate Records

| Area | Coverage | Notes |
|------|----------|-------|
| Minutes | Gap | Schema only |
| Resolutions | Gap | Schema only |
| Statutory registers | Gap | Schema only |

---

### Registered Agent

| Area | Coverage | Notes |
|------|----------|-------|
| Agent assignment | Gap | Schema only |
| Change workflow | Gap | Not implemented |
| Service of process | Gap | Not implemented |

---

### Officers & Directors

| Area | Coverage | Notes |
|------|----------|-------|
| Officer tracking | Surface | Basic in schema |
| Director tracking | Surface | Basic in schema |
| Term management | Gap | Not implemented |
| Appointment workflow | Gap | Not implemented |

---

## Visual Coverage Map

```
Layer           DEEP        SOLID       SURFACE      GAP
                ####        ....        ~~~~        oooo

Domain          ####........~~~~~~~~oooooooooooo
Application     ....~~~~~~~~~~~~~~~~~~~~~~~~oooo
Infrastructure  ############....~~~~~~~~~~~~oooo
API             ########....~~~~~~~~~~~~oooooooo
Tests           oooooooooooooooooooooooooooooooo
```

---

## Summary Statistics

| Layer | Deep | Solid | Surface | Gap | Total Areas |
|-------|------|-------|---------|-----|-------------|
| Domain | 0 | 2 | 2 | 1 | 5 |
| Application | 0 | 0 | 3 | 1 | 4 |
| Infrastructure | 1 | 2 | 0 | 1 | 4 |
| API | 1 | 1 | 1 | 1 | 4 |
| Tests | 0 | 0 | 0 | 3 | 3 |
| **Total** | **2** | **5** | **6** | **7** | **20** |

**Coverage Score**: 35% Deep/Solid, 30% Surface, **35% Gap**

---

## Critical Findings

### Areas with NO Implementation
1. **Test suite** - 0% coverage, no tests exist
2. **GraphQL API** - Not started
3. **BOI/CTA compliance** - Regulatory critical, not implemented
4. **Event handlers** - Events not consumed

### Areas with Partial Implementation
1. **Entity lifecycle** - CRUD works, workflows incomplete
2. **Governance** - Schema exists, no business logic
3. **Ownership** - Basic shareholder, no cap table logic

### Research Documentation Quality
**Good**: 8 research documents covering:
- Jurisdiction complexity
- LLC operating agreements
- BOI/CTA requirements
- Cap table complexity
- Corporate veil formalities
- Multi-jurisdiction compliance
- Holding company structures

**Missing**: Implementation guides derived from research

---

## Priority Areas for Action

Based on coverage analysis:

1. **CRITICAL: Test Suite** - Zero coverage is unsustainable
2. **CRITICAL: BOI/CTA Compliance** - Regulatory requirement
3. **HIGH: Entity Lifecycle Completion** - Core functionality
4. **HIGH: Event Handlers** - Integration enablement
5. **MEDIUM: Governance Implementation** - Business logic needed
6. **MEDIUM: Cap Table Logic** - Ownership calculations
7. **LOW: GraphQL API** - Nice to have, REST sufficient initially

---

## Dimension Files Index

| # | Title | Status |
|---|-------|--------|
| 01 | Domain Layer | Pending |
| 02 | Application Layer | Pending |
| 03 | Infrastructure Layer | Pending |
| 04 | API Layer | Pending |
| 10 | Entity Lifecycle Subdomain | Pending |
| 11 | Corporate Structure Subdomain | Pending |
| 12 | Governance Subdomain | Pending |
| 13 | Ownership Subdomain | Pending |
| 14 | Compliance Subdomain | Pending |
| 15 | Corporate Records Subdomain | Pending |
| 16 | Registered Agent Subdomain | Pending |
| 17 | Officers/Directors Subdomain | Pending |

---

## Understanding Depth Definitions

| Level | Code | Description | Indicators |
|-------|------|-------------|------------|
| **Deep** | L3 | Complete mental model | Can explain why, predict behavior, extend safely |
| **Solid** | L2 | Good working knowledge | Can use effectively, may miss edge cases |
| **Surface** | L1 | Basic awareness | Know it exists, structure understood |
| **Gap** | L0 | Not explored | Unknown territory |

---

*Last updated: January 29, 2026*
*Next review: After Waypoint 1 completion*
