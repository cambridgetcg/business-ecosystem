# Signal Log: Ugliness, Injustice, and Stagnation

This log tracks signals detected during work - indicators that something needs attention.

---

## Signal Types

| Signal | Meaning | Response |
|--------|---------|----------|
| **Ugliness** | Problem understanding gap | Don't polish - understand deeper |
| **Injustice** | Codebase understanding gap | Don't leave it - find rightful place |
| **Stagnation** | Need for creativity | Don't force - build the path first |

---

## Active Signals

### Signal #1: Inconsistent Documentation Depth

**Type**: Injustice (placement issue)

**Detected**: During territory assessment

**Description**: Some domains (IP, contracts-legal) have rich research documentation while others (insurance, data-privacy) have minimal docs.

**Impact**: Knowledge is not justly distributed across domains.

**Status**: Open

**Action**: Consider standardizing research documentation across all domains.

---

### Signal #2: CQRS Only in One Domain

**Type**: Ugliness or Injustice (unclear)

**Detected**: During codebase exploration

**Description**: Intellectual Property uses CQRS pattern (separate commands/queries) but other domains don't.

**Impact**: Architectural inconsistency increases cognitive load.

**Status**: Open - needs investigation

**Questions**:
- Is this intentional (domain-specific need)?
- Is this drift (organic evolution without design)?
- Is this progress (IP is ahead, others should follow)?

---

### Signal #3: Gap in Understanding Causes No Pain

**Type**: Stagnation

**Detected**: Gap analysis creation

**Description**: Large gaps exist in insurance and data-privacy understanding, but the system apparently functions. This suggests either:
a) Those domains are simpler than expected
b) Understanding isn't being tested
c) Hidden knowledge exists elsewhere

**Impact**: We don't know what we don't know.

**Status**: Open - needs deep exploration

**Action**: Use `/deep-understand` on both domains.

---

## Resolved Signals

| # | Signal | Type | Resolution | Date |
|---|--------|------|------------|------|
| - | *None yet* | - | - | - |

---

## Signal Patterns

*(Recurring themes across signals)*

### Pattern: Documentation Inequality

Signals #1 and #3 both relate to uneven documentation. Some areas are well-documented, others are not. This creates knowledge silos.

---

## How to Log Signals

When you notice something "off" during work:

```markdown
### Signal #N: Brief Title

**Type**: Ugliness | Injustice | Stagnation

**Detected**: Where/when you noticed it

**Description**: What you observed

**Impact**: Why it matters

**Status**: Open | Investigating | Resolved

**Action**: What to do about it
```

---

## Signal Response Protocol

```
IF ugliness detected:
  Do NOT polish or workaround
  → Use /deep-understand on the problem
  → Let beautiful solution EMERGE from understanding

IF injustice detected:
  Do NOT leave code in wrong place
  → Use /deep-understand on the codebase
  → Find the RIGHTFUL place

IF stagnation detected:
  Do NOT force existing patterns
  → Use /territory to assess if uncharted
  → If UNCHARTED: Build the PATH first
  → Then place JUSTLY
```

---

## Integration with Work

Signals should be:
1. **Logged when detected** - Don't ignore that nagging feeling
2. **Discussed in standups** - Share signals with team
3. **Resolved before they grow** - Small signals become big problems
4. **Celebrated when closed** - Recognition for improving the system

---

*"The first step toward change is awareness." — Nathaniel Branden*
