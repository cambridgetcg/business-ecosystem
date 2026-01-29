# Automated MVP Development Strategy

> **Vision**: Use PP Path Builder, GUA, CPT, and Progress Tracking to orchestrate automated development of the business ecosystem to functional MVP.
>
> **Current State**: 38% complete (13 apps, 3 production-ready)
> **Target State**: Functional MVP with core workflows operational

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    AUTOMATED MVP DEVELOPMENT SYSTEM                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         ORCHESTRATION LAYER                              │   │
│  │                                                                          │   │
│  │   ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐     │   │
│  │   │    MVP       │    │    CPT       │    │   Progress Tracker   │     │   │
│  │   │  Coordinator │◄──►│  Task Queue  │◄──►│   (AWS Lambda)       │     │   │
│  │   │              │    │              │    │                      │     │   │
│  │   │  • Priority  │    │  • P1-P5     │    │  • Sync STATUS.md    │     │   │
│  │   │    ranking   │    │    tasks     │    │  • Track progress    │     │   │
│  │   │  • Blocker   │    │  • Deps      │    │  • Notify milestones │     │   │
│  │   │    detection │    │  • Status    │    │  • Detect stale      │     │   │
│  │   └──────┬───────┘    └──────┬───────┘    └──────────┬───────────┘     │   │
│  │          │                   │                       │                  │   │
│  └──────────┼───────────────────┼───────────────────────┼──────────────────┘   │
│             │                   │                       │                       │
│             ▼                   ▼                       ▼                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         EXECUTION LAYER                                  │   │
│  │                                                                          │   │
│  │   ┌──────────────────────────────────────────────────────────────────┐  │   │
│  │   │                    PP PATH BUILDER                                │  │   │
│  │   │                                                                   │  │   │
│  │   │  For each task:                                                   │  │   │
│  │   │  1. /territory - Assess charted vs uncharted                     │  │   │
│  │   │  2. /deep-understand - Build understanding of codebase           │  │   │
│  │   │  3. /path-define - Define success criteria                       │  │   │
│  │   │  4. /path-build - Create waypoints                               │  │   │
│  │   │  5. Execute waypoints with PP gates                              │  │   │
│  │   │  6. /verify - Validate implementation                            │  │   │
│  │   │  7. Update STATUS.md → triggers progress sync                    │  │   │
│  │   │                                                                   │  │   │
│  │   └──────────────────────────────────────────────────────────────────┘  │   │
│  │                                                                          │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         KNOWLEDGE LAYER                                  │   │
│  │                                                                          │   │
│  │   ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │   │                          GUA                                     │   │   │
│  │   │            Global Understanding Archive                          │   │   │
│  │   │                                                                  │   │   │
│  │   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │   │   │
│  │   │  │   LIGHT.md   │  │   PATH.md    │  │   Stores (JSONL)     │  │   │   │
│  │   │  │              │  │              │  │                      │  │   │   │
│  │   │  │ Accumulated  │  │ Direction    │  │ • research.jsonl     │  │   │   │
│  │   │  │ understanding│  │ forward      │  │ • feedback.jsonl     │  │   │   │
│  │   │  │ from all     │  │              │  │ • insights.jsonl     │  │   │   │
│  │   │  │ sessions     │  │              │  │ • blindspots.md      │  │   │   │
│  │   │  └──────────────┘  └──────────────┘  └──────────────────────┘  │   │   │
│  │   │                                                                  │   │   │
│  │   │  Loaded at session start → Captures during → Persists at end   │   │   │
│  │   └─────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                          │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## MVP Definition

### Scope: Minimum Viable Business Ecosystem

A functional MVP requires **ONE complete vertical slice** that demonstrates:
1. Entity creation with governance
2. Compliance verification
3. Financial transaction processing
4. Contract management
5. Audit trail

### MVP User Story

> As a **business owner**, I can:
> 1. **Create a legal entity** (entity-governance)
> 2. **Verify KYC requirements** (kyc-identity)
> 3. **Process a banking transaction** (banking-treasury)
> 4. **Create and sign a contract** (contracts-legal)
> 5. **See audit trail of all actions** (shared/audit-trail)

### MVP Apps Required

| App | Current | MVP Target | Gap |
|-----|---------|------------|-----|
| entity-governance | 25% | 60% | Core entity CRUD, basic workflows |
| kyc-identity | 85% | 90% | Minor completion |
| banking-treasury | 90% | 95% | Minor completion |
| contracts-legal | 90% | 95% | Minor completion |
| gateway | 40% | 70% | API routing, auth integration |

### MVP Infrastructure Required (from CPT)

| Component | Priority | Status | Blocks |
|-----------|----------|--------|--------|
| Event Bus (RabbitMQ) | P1 | Not started | All event-driven workflows |
| Repository Pattern | P1 | Not started | All data access |
| Auth Complete | P2 | Partial | Gateway, all protected routes |
| Audit Trail | P2 | Not started | Compliance, MVP demo |

---

## Execution Strategy

### Phase 0: Infrastructure Foundation (Current → P1 Complete)

```
OBJECTIVE: Enable apps to communicate and persist data

TASKS (from CPT Priority 1):
├── Task 1.1: Event Bus Implementation
│   ├── Waypoint 1: Design message schema
│   ├── Waypoint 2: Implement RabbitMQ adapter
│   ├── Waypoint 3: Implement outbox pattern
│   ├── Waypoint 4: Add dead letter handling
│   └── Waypoint 5: Integration tests
│
├── Task 1.2: Message Queue Implementation
│   └── (follows event bus pattern choice)
│
└── Task 1.3: Repository Pattern
    ├── Waypoint 1: Define interfaces
    ├── Waypoint 2: Implement base repository
    ├── Waypoint 3: Add unit of work
    └── Waypoint 4: Add multi-tenant scoping

COMPLETION CRITERIA:
- [ ] Apps can publish events
- [ ] Apps can consume events
- [ ] Apps use standardized data access
- [ ] All queries scope by tenant
```

### Phase 1: MVP Vertical Slice (P1 Complete → MVP Demo)

```
OBJECTIVE: One complete workflow end-to-end

PARALLEL TRACKS:

Track A: Infrastructure Completion
├── Auth library completion
├── Audit trail service
└── Gateway API routing

Track B: App Enhancement
├── entity-governance: Entity CRUD + basic governance
├── kyc-identity: Hook into entity creation
├── banking-treasury: Transaction processing
└── contracts-legal: Basic contract workflow

INTEGRATION:
└── Workflow: Entity Onboarding
    1. Create entity → EntityCreatedEvent
    2. Trigger KYC check → KycCompletedEvent
    3. Enable banking → BankAccountCreatedEvent
    4. Ready for contracts → EntityActivatedEvent
```

### Phase 2: Production Hardening (MVP → Production Ready)

```
OBJECTIVE: Make MVP production-deployable

TASKS:
├── Rate limiting
├── Caching layer
├── File storage (for KYC documents)
├── Notifications
└── Monitoring & alerting
```

---

## Automation Protocol

### Session Start Protocol

```markdown
## When starting a development session:

1. LOAD GUA
   - Read ~/.claude/purpose_prompter/archive/LIGHT.md
   - Read ~/.claude/purpose_prompter/archive/blindspots.md
   - Load project understanding if exists

2. CHECK CPT STATUS
   - Read /docs/CROSS_PROJECT_TASKS.md
   - Identify highest priority unblocked task
   - Check dependencies

3. CHECK PROGRESS
   - Read /PROGRESS.md or query DynamoDB
   - Identify apps needing attention
   - Check for stale STATUS.md files

4. SELECT TASK
   - Prioritize: Blockers > P1 > P2 > P3 > App completion
   - Verify no dependencies block the task

5. EXECUTE WITH PP
   - /territory [task]
   - /deep-understand [relevant codebase area]
   - /path-build [task]
   - Execute waypoints with full PP gates
   - /verify [result]

6. UPDATE STATUS
   - Update app's STATUS.md
   - Commit and push → triggers AWS sync
   - Update CPT task status if complete

7. CAPTURE TO GUA
   - Log research discoveries
   - Log insights gained
   - Note any blindspots discovered
```

### Task Execution Protocol

```markdown
## For each CPT task:

### 1. UNDERSTAND
/deep-understand [task context]
- Read existing code in target location
- Understand contracts/interfaces involved
- Map dependencies

### 2. PLAN
/path-define
- Define success criteria
- Identify waypoints
- Estimate complexity

### 3. BUILD
For each waypoint:
  a. /territory - Is this charted?
  b. If charted: Follow existing patterns
  c. If uncharted:
     - Research similar solutions
     - Design with PP beauty gates
     - Build with justice placement
  d. Write code
  e. Write tests
  f. /signal - Check for ugliness/injustice

### 4. VERIFY
/verify [implementation]
- All 30 PP gates pass
- Tests pass
- Integration works
- Follows existing patterns

### 5. DOCUMENT
- Update STATUS.md with new progress
- Add to LIGHT.md if learnings found
- Update CPT task status
```

### Progress Tracking Integration

```markdown
## After completing a task:

1. Update the app's STATUS.md:
   - Increment progress percentage
   - Update current waypoint
   - Clear completed blockers
   - Update last activity date

2. Git commit and push:
   - This triggers GitHub Actions
   - Which triggers Lambda sync
   - Which updates DynamoDB and CloudWatch

3. Check for milestones:
   - 25%, 50%, 75%, 100% progress → SNS notification
   - Waypoint completion → Milestone recorded
   - Blocker cleared → Notification sent
```

---

## Recommended Execution Order

### Week 1-2: Infrastructure Foundation

```
Day 1-2:  Task 1.3 - Repository Pattern
          (Enables all subsequent data work)

Day 3-5:  Task 1.1 - Event Bus (RabbitMQ)
          (Core infrastructure)

Day 6-7:  Task 1.2 - Message Queue
          (Complements event bus)
```

### Week 3-4: Auth & Audit

```
Day 8-10: Task 2.2 - Complete Auth Library
          (Unblocks gateway and protected routes)

Day 11-14: Task 2.1 - Audit Trail Service
           (Required for compliance demo)
```

### Week 5-6: MVP Apps

```
Day 15-17: entity-governance enhancement
           (Core entity management)

Day 18-20: Gateway API completion
           (Expose all endpoints)

Day 21-24: Integration testing
           (End-to-end workflow)
```

### Week 7-8: Polish & Deploy

```
Day 25-28: Bug fixes, edge cases
Day 29-32: Production deployment
```

---

## Success Metrics

### MVP Complete When:

- [ ] Entity can be created via API
- [ ] KYC check triggers automatically on entity creation
- [ ] Bank account can be linked to entity
- [ ] Contract can be created for entity
- [ ] All actions appear in audit trail
- [ ] Gateway authenticates and routes all requests
- [ ] E2E test passes for complete workflow

### Progress Tracking Metrics:

| Metric | Current | MVP Target |
|--------|---------|------------|
| Overall Progress | 38% | 65% |
| Production Ready Apps | 3 | 5 |
| P1 Tasks Complete | 0/3 | 3/3 |
| P2 Tasks Complete | 0/4 | 2/4 |
| Active Blockers | ? | 0 |

---

## How to Start

### Option A: Fully Automated (Recommended)

```bash
# Start a new Claude Code session with:
claude --resume-from gua

# Then execute:
/pp Check CPT status, identify highest priority unblocked task,
    and execute it using full PP protocol. Update STATUS.md when done.
```

### Option B: Semi-Automated

```bash
# 1. Check current status
cat /docs/CROSS_PROJECT_TASKS.md | head -100
cat PROGRESS.md

# 2. Start PP session for specific task
/pp Implement Task 1.3 (Repository Pattern) following CPT spec

# 3. After completion, update tracking
git add -A && git commit -m "Complete Task 1.3: Repository Pattern"
git push  # Triggers progress sync
```

### Option C: Manual with PP Guidance

```markdown
1. Read this document
2. Pick a task from CPT Priority 1
3. Use PP for implementation:
   - /territory [task]
   - /deep-understand [codebase area]
   - Implement with PP gates
   - /verify [result]
4. Update STATUS.md manually
5. Push to trigger sync
```

---

## GUA Integration

### What GUA Captures:

```
Research:
- API patterns discovered
- Library comparisons made
- Architecture decisions

Insights:
- What worked well
- What didn't work
- Patterns to repeat

Blindspots:
- Areas where mistakes were made
- Knowledge gaps identified
- Things to watch for
```

### How GUA Helps:

```
Session N:   Implement Event Bus
             → Research RabbitMQ vs Redis Streams
             → Discover transactional outbox pattern
             → Capture to GUA

Session N+1: Implement Message Queue
             → Load GUA
             → Already knows broker choice (RabbitMQ)
             → Already understands outbox pattern
             → Faster implementation
```

---

## Next Steps

To begin automated MVP development:

1. **Initialize GUA** (if not already):
   ```bash
   mkdir -p ~/.claude/purpose_prompter/archive/stores
   touch ~/.claude/purpose_prompter/archive/LIGHT.md
   touch ~/.claude/purpose_prompter/archive/PATH.md
   ```

2. **Start first task**:
   ```
   /pp Implement CPT Task 1.3 (Repository Pattern) - this is the highest
       priority unblocked task that enables all subsequent development.
   ```

3. **Let progress tracking work**:
   - Each completed task → STATUS.md update → Git push → AWS sync
   - Dashboard shows real-time progress
   - Notifications on milestones

The system is designed to be **self-sustaining**: each session builds on previous sessions through GUA, progress is tracked automatically, and PP ensures quality throughout.
