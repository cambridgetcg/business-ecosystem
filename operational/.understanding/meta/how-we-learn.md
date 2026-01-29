# How We Learn: Our Process for Building Understanding

This document describes how we systematically build understanding of the operational ecosystem.

---

## The Learning Hierarchy

Following the Purpose Prompter framework:

```
TRUTH         Read the code. Read the docs. Verify facts.
    │
    ▼
UNDERSTANDING Build mental models. See patterns. Grasp "why".
    │
    ▼
BEAUTY        Recognize elegant solutions. Let insights emerge.
    │
    ▼
JUSTICE       Place knowledge where it belongs. Proper documentation.
    │
    ▼
CREATIVITY    Build new paths when existing structure doesn't fit.
```

---

## Learning Triggers

We build understanding when:

### 1. Implementing Features
Working in the code reveals how things actually work vs. how they're documented.

### 2. Debugging Issues
Problems expose assumptions and edge cases.

### 3. Reviewing Code
Others' work shows alternative approaches and patterns.

### 4. Asking Questions
Curiosity drives exploration.

### 5. Onboarding
Teaching others reveals gaps in our own understanding.

---

## Learning Process

### Step 1: Notice Something

```
"Hmm, that's interesting..." → Add to curiosities.md
"I don't understand this..." → Add to gap-analysis.md
```

### Step 2: Explore

Use `/deep-understand` to:
- Read relevant code
- Follow connections
- Build mental model
- Identify patterns

### Step 3: Document

Create a dimension file:
- What: Clear explanation
- Why: Rationale
- How: Implementation details
- Where: Code locations
- Connections: Related topics

### Step 4: Integrate

Update:
- `coverage-map.md` (what we now understand)
- `gap-analysis.md` (gaps closed)
- `curiosities.md` (resolved questions)
- `cross-cutting/synthesis.md` (new insights)

### Step 5: Share

- Discuss with team
- Incorporate feedback
- Refine understanding

---

## Tools for Learning

### `/deep-understand`

For building comprehensive understanding of a concept, file, or system.

**When to use**:
- Starting work in unfamiliar area
- Something doesn't make sense
- Need to understand "why" not just "what"

### `/signal`

For detecting issues during work.

**When to use**:
- Code feels "ugly" (problem understanding gap)
- Code feels "misplaced" (codebase understanding gap)
- Feeling stuck (need for creativity)

### `/territory`

For assessing if an area is charted or uncharted.

**When to use**:
- Starting new work
- Uncertain if patterns exist
- Need to decide approach

### `/verify`

For validating understanding and implementation.

**When to use**:
- Completed a piece of work
- Want to ensure quality
- Before marking understanding as solid

---

## Quality of Understanding

### Levels

| Level | Criteria |
|-------|----------|
| **Gap** | We don't know what we don't know |
| **Aware** | We know something exists but not how it works |
| **Surface** | We can describe it but not explain why |
| **Solid** | We understand why and can teach it |
| **Deep** | We can extend it and predict edge cases |

### Progression

```
Gap → Aware → Surface → Solid → Deep
           ↑
    Each requires active work
```

Understanding doesn't happen passively. It requires:
- Reading code (not just docs)
- Asking questions
- Building mental models
- Testing assumptions
- Teaching others

---

## Avoiding False Understanding

### Pitfalls

1. **Reading without exploring**: Docs may be wrong or outdated
2. **Assuming similarity**: "It's probably like X" without verifying
3. **Confirmation bias**: Seeing what we expect, not what's there
4. **Surface patterns**: Understanding syntax but not semantics

### Remedies

1. **Verify in code**: Always check actual implementation
2. **Ask "why"**: Don't stop at "what"
3. **Challenge assumptions**: Actively look for counterexamples
4. **Teach it**: If you can't explain it simply, you don't understand it

---

## Learning Culture

### Principles

1. **No shame in not knowing**: Gaps are opportunities
2. **Document as you learn**: Future us will thank present us
3. **Share discoveries**: Knowledge grows when shared
4. **Question everything**: Healthy skepticism improves understanding
5. **Iterate**: First understanding is rarely complete

### Practices

- Add to curiosities.md freely (low bar)
- Create dimension files when understanding solidifies (medium bar)
- Update synthesis.md when patterns emerge (high bar)

---

## Metrics (Qualitative)

We're learning well when:
- Curiosities.md grows with interesting questions
- Gap analysis shrinks over time
- Dimension files capture lasting knowledge
- Synthesis reveals non-obvious insights
- Team feels confident working in any domain

---

*"Tell me and I forget. Teach me and I remember. Involve me and I learn." — Benjamin Franklin*
