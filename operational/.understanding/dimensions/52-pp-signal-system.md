# Dimension 52: PP Signal System

**Discovery Source**: GUA Knowledge Seeding - UNIFIED_MODEL.md, EMOTIONS.md exploration
**Understanding Level**: ENABLED
**Last Updated**: January 27, 2026

---

## Aha Moment

> All three signals (ugliness, injustice, stagnation) are manifestations of **ONE LONGING** - the unified ache toward the ideal. Each signal indicates a SPECIFIC type of incomplete understanding, not just "something wrong."

---

## What This Is

The PP Signal System is a diagnostic framework for identifying why code or solutions feel wrong:

```
                    LONGING
                 (unified ache)
                       │
          ┌───────────┼───────────┐
          │           │           │
          ▼           ▼           ▼
     UGLINESS    INJUSTICE   STAGNATION
     (longing    (longing    (longing
     for beauty) for justice) for creation)
```

Each signal has a specific cause and a specific remedy.

---

## Mental Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SIGNAL DIAGNOSIS FLOW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  "Something feels wrong with this code/solution"                            │
│                         │                                                   │
│                         ▼                                                   │
│               ┌─────────────────┐                                          │
│               │  What's the     │                                          │
│               │  sensation?     │                                          │
│               └────────┬────────┘                                          │
│                        │                                                    │
│         ┌──────────────┼──────────────┐                                    │
│         │              │              │                                    │
│         ▼              ▼              ▼                                    │
│    ┌─────────┐    ┌─────────┐    ┌─────────┐                              │
│    │ "This   │    │ "This   │    │ "Can't  │                              │
│    │ looks/  │    │ doesn't │    │ make it │                              │
│    │ feels   │    │ belong  │    │ fit /   │                              │
│    │ ugly"   │    │ here"   │    │ stuck"  │                              │
│    └────┬────┘    └────┬────┘    └────┬────┘                              │
│         │              │              │                                    │
│         ▼              ▼              ▼                                    │
│    UGLINESS       INJUSTICE      STAGNATION                               │
│         │              │              │                                    │
│         ▼              ▼              ▼                                    │
│    Problem NOT    Codebase NOT    Structure                                │
│    understood     understood      insufficient                             │
│         │              │              │                                    │
│         ▼              ▼              ▼                                    │
│    Understand     Understand      Build the                                │
│    PROBLEM        CODEBASE        PATH first                               │
│    deeper         deeper                                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Concepts

### 1. UGLINESS Signal

**Felt quality**: Disgust, revulsion, a visceral "no"

**What it indicates**: The PROBLEM is not fully understood

**Wrong responses**:
- Polishing (adding decoration to ugly code)
- Ignoring ("it works, ship it")
- Over-engineering (adding complexity to hide ugliness)

**Right response**: Understand the problem deeper until beautiful solution EMERGES

```
WRONG:
  Ugly solution → Add comments, rename vars → Still ugly (but fancy)

RIGHT:
  Ugly solution → Feel the longing for beauty → Understand problem → Beauty emerges
```

**Signs of ugliness**:
- Forced fit (solution imposed on context)
- Over-complexity (uncertainty covered by excess)
- Under-built (missing requirements)
- Incoherence (patchwork without whole view)
- Obscurity (not understanding well enough to explain)

### 2. INJUSTICE Signal

**Felt quality**: Dissonance, "this doesn't belong here"

**What it indicates**: The CODEBASE is not fully understood

**Wrong responses**:
- Leaving it (accumulating technical debt)
- Convenient placement (put where easy, not right)
- God class creation (one component owns everything)

**Right response**: Understand the codebase deeper, find the RIGHTFUL place

```
WRONG:
  Misplaced solution → Leave it → Technical debt grows

RIGHT:
  Misplaced solution → Feel longing for justice → Understand codebase → Find right place
```

**Signs of injustice**:
- "Why is this here?" (wrong placement)
- "This doesn't belong to us" (wrong ownership)
- "This layer shouldn't do this" (wrong responsibility)
- "This breaks the pattern" (wrong balance)

### 3. STAGNATION Signal

**Felt quality**: Frustration, blocked, stuck

**What it indicates**: Existing STRUCTURE is insufficient - need CREATIVITY

**Wrong responses**:
- Forcing it (hacking around limitations)
- Workarounds (creating technical debt)
- Giving up (despair)

**Right response**: Recognize UNCHARTED territory, BUILD THE PATH first

```
WRONG:
  Can't place in existing → Force it → Hack around → Technical debt

RIGHT:
  Can't place in existing → Feel longing for creation → Build new path → Then place justly
```

**Signs of stagnation**:
- "There's no place for this" (territory missing)
- "We can't do that with our current architecture" (path missing)
- "We keep hacking around this limitation" (structure missing)

---

## Signal Response Protocol

### Quick Check

```
When something feels wrong:

1. IDENTIFY the sensation
   - Ugly? → Problem understanding gap
   - Misplaced? → Codebase understanding gap
   - Stuck? → Need for creativity

2. DO NOT proceed with wrong response
   - Don't polish ugliness
   - Don't ignore injustice
   - Don't hack around stagnation

3. ADDRESS the root cause
   - Ugly → /deep-understand [the problem]
   - Misplaced → /deep-understand [the codebase]
   - Stuck → /territory [the requirement]
```

### When Multiple Signals Present

Signals can compound. Address in order:

1. **First**: Stagnation (if present) - Can't place beauty in non-existent structure
2. **Then**: Ugliness - Need beautiful solution before placing
3. **Finally**: Injustice - Place the beauty justly

---

## The Emotional Mapping

| Signal | Cognitive Description | Felt Experience |
|--------|----------------------|-----------------|
| **Ugliness** | "Problem not understood" | Disgust, revulsion, "ugh" |
| **Injustice** | "Codebase not understood" | Dissonance, wrongness, "this doesn't belong" |
| **Stagnation** | "Need new structure" | Frustration, blocked, "can't make it fit" |

**All are manifestations of longing**:
- Ugliness = longing for beauty
- Injustice = longing for justice
- Stagnation = longing for creation

---

## Signal Detection in Practice

### Code Review
```
Reading code → Notice sensation → Diagnose signal → Respond appropriately

"This function is confusing" → Ugliness → Author didn't understand problem?
"Why is this util in the controller?" → Injustice → Find rightful place
"We need a whole new module for this" → Stagnation → Build the path first
```

### PR Review
```
/signal this PR

Checks for:
- Forced fits (ugliness)
- Misplaced code (injustice)
- Hacks around limitations (stagnation)
```

### Self-Check During Implementation
```
Pause periodically:
- Does this feel ugly? → Stop, understand problem deeper
- Does this feel misplaced? → Stop, understand codebase deeper
- Does this feel forced? → Stop, maybe need new structure first
```

---

## Anti-Patterns to Avoid

### The Polish Anti-Pattern
```
Signal: Ugliness
Wrong: "Let me add some comments and better variable names"
Result: Still ugly, now just fancy ugly

Right: "Let me understand the problem more deeply"
Result: Beautiful solution emerges
```

### The Convenience Anti-Pattern
```
Signal: Injustice
Wrong: "I'll just put it here for now, we can move it later"
Result: Technical debt, "later" never comes

Right: "Where does this rightfully belong?"
Result: Code in its proper place
```

### The Hack Anti-Pattern
```
Signal: Stagnation
Wrong: "I'll add a special case to make it work"
Result: Fragile, hard to maintain, more hacks needed

Right: "The territory doesn't exist - let me build the path first"
Result: Clean extension, future features fit naturally
```

---

## Related Patterns

- [50-purpose-prompter-philosophy.md](50-purpose-prompter-philosophy.md) - The full PP hierarchy
- [43-audit-trail-patterns.md](43-audit-trail-patterns.md) - Activity as domain model (rightful ownership)
- [44-compliance-aggregation.md](44-compliance-aggregation.md) - Each domain owns its definition (justice)

---

## Now You Can

With this understanding, you can:
1. Diagnose why code "feels wrong" specifically
2. Avoid wrong responses (polishing, ignoring, hacking)
3. Take the right action based on signal type
4. Recognize emotional correlates of each signal
5. Use `/signal` command to automate detection

---

*"Signals are not obstacles to clear thinking - they are the felt quality of incomplete understanding guiding us toward the ideal."*
