# MVP Execution Checklist

> Quick reference for automated development sessions

---

## Pre-Session Checklist

```
□ Load GUA understanding (if exists)
□ Check CPT task queue
□ Review current PROGRESS.md
□ Identify target task
□ Verify no blockers
```

---

## Task Priority Queue

### 🔴 Priority 1: CRITICAL (Do First)

| # | Task | Location | Status | Blocks |
|---|------|----------|--------|--------|
| 1.3 | Repository Pattern | `/shared/libs/repository/` | ✅ Complete | All data access |
| 1.1 | Event Bus Broker | `/shared/libs/messaging/` | ✅ Complete | All events |
| 1.2 | Message Queue | `/shared/libs/messaging/` | ✅ Complete (via messaging) | Async ops |

### 🟠 Priority 2: HIGH (Production Readiness)

| # | Task | Location | Status | Blocks |
|---|------|----------|--------|--------|
| 2.2 | Auth Complete | `/shared/libs/auth/` | 🟡 Partial | Protected routes |
| 2.1 | Audit Trail | `/shared/libs/audit-trail/` | ⬜ Not started | Compliance |
| 2.3 | Rate Limiting | `/shared/libs/rate-limiting/` | ⬜ Not started | API protection |
| 2.4 | Caching | `/shared/libs/caching/` | ⬜ Not started | Performance |

### 🟡 Priority 3: MEDIUM (Features)

| # | Task | Location | Status | Blocks |
|---|------|----------|--------|--------|
| 3.1 | File Storage | `/shared/libs/file-storage/` | ⬜ Not started | Document mgmt |
| 3.2 | Notifications | `/shared/libs/notification/` | ⬜ Not started | User alerts |
| 3.3 | Feature Flags | `/shared/libs/feature-flags/` | 🟡 Partial | Safe rollouts |

---

## MVP Apps Status

| App | Progress | MVP Target | Gap |
|-----|----------|------------|-----|
| banking-treasury | 90% | 95% | ✅ Nearly done |
| contracts-legal | 90% | 95% | ✅ Nearly done |
| kyc-identity | 85% | 90% | ✅ Nearly done |
| gateway | 85% | 90% | ✅ Nearly done |
| entity-governance | 50% | 60% | ✅ Nearly done |

---

## Session Commands

### Start Session
```
# Load context and select task
/pp Load GUA, check CPT queue, select highest priority unblocked task
```

### Execute Task
```
# Full PP execution
/pp Execute [task description] with full PP protocol:
    territory → deep-understand → path-build → verify
```

### Complete Task
```
# Update status and persist
/pp Update STATUS.md with new progress, commit, push to trigger sync
```

### Capture Learning
```
# Persist to GUA
/pp-feedback [dimension] [rating] [what was learned]
```

---

## Quick Commands Reference

| Command | Purpose |
|---------|---------|
| `/territory [task]` | Assess if charted/uncharted |
| `/deep-understand [area]` | Build understanding |
| `/signal [code]` | Check for ugliness/injustice |
| `/verify [result]` | Run 30-gate verification |
| `/pp-health` | Check PP system status |

---

## Definition of Done

For each task:

- [ ] Code implemented following existing patterns
- [ ] TypeScript strict mode passes
- [ ] Zod validation for all inputs
- [ ] Unit tests written and passing
- [ ] Integration tests if applicable
- [ ] Multi-tenant isolation verified
- [ ] Audit trail integration (if state change)
- [ ] STATUS.md updated
- [ ] Changes pushed (triggers progress sync)
- [ ] No new blockers introduced

---

## Progress Sync Flow

```
Complete Task
     │
     ▼
Update STATUS.md
     │
     ▼
git commit && git push
     │
     ▼
GitHub Actions triggers
     │
     ▼
Lambda syncs to DynamoDB/S3
     │
     ▼
CloudWatch metrics updated
     │
     ▼
SNS notification (if milestone)
```

---

## Emergency Commands

```bash
# Force sync all progress
aws lambda invoke --function-name ecosystem-progress-dev-sync \
  --payload '{"action":"full_sync"}' response.json

# Check current ecosystem status
aws dynamodb get-item --table-name ecosystem-progress-dev-state \
  --key '{"pk":{"S":"ECOSYSTEM"},"sk":{"S":"STATUS"}}'

# View recent milestones
aws dynamodb query --table-name ecosystem-progress-dev-milestones \
  --key-condition-expression "pk = :pk" \
  --expression-attribute-values '{":pk":{"S":"ECOSYSTEM"}}'
```
