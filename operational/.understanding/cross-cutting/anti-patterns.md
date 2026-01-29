# Anti-Patterns: Things to Avoid

Patterns that have caused problems or should be avoided based on learning.

---

## Identified Anti-Patterns

### 1. Direct Cross-Domain API Calls

**What it is**: Domain A directly calling Domain B's API instead of using events.

**Why it's problematic**:
- Creates tight coupling
- Synchronous failures cascade
- Harder to reason about system behavior
- Deployment dependencies

**Correct approach**: Publish events, let consumers react asynchronously.

**Status**: Documented in architecture as prohibition. Need to verify no violations exist.

---

### 2. Storing Derived Data as Source of Truth

**What it is**: Caching aggregated data and treating it as authoritative.

**Why it's problematic**:
- Data drift from source
- Stale reads
- Reconciliation nightmares

**Correct approach**: Derive on read, or clearly mark as cache with TTL.

**Status**: Orchestration layer notes it stores no data except workflow state.

---

### 3. Entity-Agnostic Operations

**What it is**: Creating records without proper entity scoping.

**Why it's problematic**:
- Breaks cross-domain queries
- Compliance aggregation fails
- Authorization model breaks

**Correct approach**: Always require entityId, validate it exists.

**Status**: Architecture enforces this. Watch for edge cases.

---

## Suspected Anti-Patterns

*(Patterns that might be problematic, need investigation)*

### Inconsistent CQRS Adoption

**Observation**: IP uses CQRS, others don't.

**Potential issue**: Inconsistent patterns increase cognitive load.

**To investigate**: Is this intentional or accidental drift?

---

### Research Documentation Inconsistency

**Observation**: Some domains have research docs, others don't.

**Potential issue**: Knowledge silos, uneven documentation depth.

**To investigate**: Should we standardize research documentation?

---

### Hidden vs Visible Directory Conventions

**Observation**: `.orchestration/` is hidden, `.understanding/` is hidden, but `.claude/` is also hidden.

**Potential issue**: Unclear what makes something "hidden-worthy".

**To investigate**: Define when dot-prefix is appropriate.

---

## Avoided Anti-Patterns

*(Anti-patterns we consciously decided against)*

| Anti-Pattern | Decision | Rationale |
|--------------|----------|-----------|
| Monolithic database | Rejected | Domain isolation more important |
| Synchronous orchestration | Rejected | Event-driven better for resilience |
| Shared domain models | Rejected | Each domain owns its types |

---

## Learning from Mistakes

When we discover an anti-pattern in practice:

1. Document it here with context
2. Understand root cause (design flaw? drift? misunderstanding?)
3. Determine remediation (refactor? accept? isolate?)
4. Update relevant dimension files
5. Consider adding to code review checklist

---

*"Learn from the mistakes of others. You can't live long enough to make them all yourself." — Eleanor Roosevelt*
