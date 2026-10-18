# Entity Governance Status

**Layer**: Foundational
**Status**: Active

---

## At a Glance

| Metric | Value |
|--------|-------|
| Overall Progress | 95% |
| Current Waypoint | All Routes Complete |
| Blockers | None |
| Last Updated | 2026-01-30 |

---

## Progress Breakdown

| Component | Status |
|-----------|--------|
| Schema/Database | ██████████ 100% |
| Domain Model | ██████████ 100% |
| Repository Layer | █████████░ 90% |
| Command/Query Handlers | █████████░ 90% |
| API/Routes | ██████████ 100% |
| Events | █████████░ 90% |
| Tests | ██████░░░░ 60% |
| Documentation | ███████░░░ 70% |

---

## Subdomain Progress

| Subdomain | Progress | Notes |
|-----------|----------|-------|
| Entity Lifecycle | **100%** | Full CRUD + dissolve + events |
| Corporate Structure | **100%** | Parent/subsidiary complete |
| Governance (Boards/Directors) | **100%** | Full CRUD + resignation |
| Ownership (Shareholders) | **100%** | Shareholder CRUD complete |
| Officers | **100%** | Full officer CRUD + appoint/terminate |
| Annual Filings | **100%** | Requirements + filings + compliance reports |
| Registered Agent | **100%** | Agent management + address changes |
| Corporate Records | **100%** | Meeting minutes + resolutions |
| Share Classes | **100%** | Full CRUD |

**9 of 9 subdomains complete**

---

## Recent Completions (2026-01-29)

- ✅ Boards & Directors routes (full CRUD, resignation workflow)
- ✅ Annual Filings routes (requirements, filings, overdue/upcoming)
- ✅ Registered Agent routes (agent management, address changes)
- ✅ Database schema complete (18 tables)
- ✅ Unit tests for domain models (59 tests)

### Prior Completions
- ✅ External event handlers for KYC verification
- ✅ External event handler for Tax ID assignment
- ✅ Event publisher for entity governance events
- ✅ Officer management: appoint, update, terminate, delete
- ✅ Shareholder management: add, update, remove
- ✅ Event bus integration with RabbitMQ

---

## API Endpoints

### Legal Entities (`/api/v1/entities`)
- GET `/` - List entities
- POST `/` - Create entity
- GET `/:id` - Get entity
- PATCH `/:id` - Update entity
- DELETE `/:id` - Soft delete entity
- POST `/:id/dissolve` - Dissolve entity
- GET `/:id/subsidiaries` - Get subsidiaries
- GET `/:id/parent` - Get parent entity

### Officers (`/api/v1`)
- GET `/entities/:entityId/officers` - List officers
- POST `/entities/:entityId/officers` - Appoint officer
- GET `/officers/:id` - Get officer
- PATCH `/officers/:id` - Update officer
- POST `/officers/:id/terminate` - Terminate officer
- DELETE `/officers/:id` - Delete officer

### Shareholders (`/api/v1`)
- GET `/entities/:entityId/shareholders` - List shareholders
- POST `/entities/:entityId/shareholders` - Add shareholder
- GET `/shareholders/:id` - Get shareholder
- PATCH `/shareholders/:id` - Update shareholder
- DELETE `/shareholders/:id` - Remove shareholder

### Boards & Directors (`/api/v1`)
- GET `/entities/:entityId/boards` - List boards
- POST `/entities/:entityId/boards` - Create board
- GET `/boards/:id` - Get board with directors
- GET `/boards/:boardId/directors` - List directors
- POST `/boards/:boardId/directors` - Appoint director
- GET `/directors/:id` - Get director
- PATCH `/directors/:id` - Update director
- POST `/directors/:id/resign` - Record resignation
- DELETE `/directors/:id` - Delete director

### Filings (`/api/v1`)
- GET `/entities/:entityId/filing-requirements` - List requirements
- POST `/entities/:entityId/filing-requirements` - Create requirement
- GET `/entities/:entityId/filings` - List filings
- POST `/entities/:entityId/filings` - Create filing
- GET `/filings/:id` - Get filing
- PATCH `/filings/:id` - Update filing
- POST `/filings/:id/submit` - Submit filing
- GET `/filings/overdue` - Get overdue filings
- GET `/filings/upcoming` - Get upcoming filings

### Registered Agents (`/api/v1`)
- GET `/entities/:entityId/registered-agents` - List agents (history)
- GET `/entities/:entityId/registered-agent` - Get current agent
- POST `/entities/:entityId/registered-agents` - Add agent
- GET `/registered-agents/:id` - Get agent
- PATCH `/registered-agents/:id` - Update agent
- POST `/registered-agents/:id/change-address` - Change address

---

## Events Published

- `entity-governance.entity.created`
- `entity-governance.entity.updated`
- `entity-governance.entity.dissolved`
- `entity-governance.officer.appointed`
- `entity-governance.officer.terminated`
- `entity-governance.shareholder.added`
- `entity-governance.shareholder.removed`

---

## Database Schema

18 tables defined in Drizzle:
1. `legal_entities` - Core entity records
2. `incorporation_documents` - Formation documents
3. `parent_subsidiary_relationships` - Corporate structure
4. `boards` - Board configuration
5. `committees` - Board committees
6. `bylaws` - Corporate bylaws
7. `shareholders` - Shareholder records
8. `share_classes` - Equity class definitions
9. `shareholdings` - Share ownership
10. `equity_grants` - Stock options/grants
11. `directors` - Board directors
12. `officers` - Corporate officers
13. `meeting_minutes` - Board/shareholder meetings
14. `resolutions` - Corporate resolutions
15. `registered_agents` - Statutory agents
16. `filing_requirements` - Compliance requirements
17. `annual_filings` - Filing records
18. `entity_governance_audit_log` - Change audit

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js + TypeScript |
| Framework | Fastify |
| ORM | Drizzle |
| Database | PostgreSQL |
| Events | RabbitMQ |
| Validation | Zod |

---

## Recent Completions (2026-01-30)

- ✅ Share classes routes (full CRUD)
- ✅ Meeting minutes routes (CRUD + approve workflow)
- ✅ Resolutions routes (CRUD + auto-numbering)
- ✅ Added compliance status tracking fields to entities

---

## Remaining Work

1. [x] Add boards/directors routes
2. [x] Add annual filings routes
3. [x] Add registered agents routes
4. [x] Add share classes routes
5. [x] Add meeting minutes routes
6. [x] Add resolutions routes
7. [ ] Increase integration test coverage

---

*Last updated: 2026-01-30*
