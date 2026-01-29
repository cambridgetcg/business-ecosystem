# Understanding Integration Layer

This directory captures the **meta-level understanding** of the operational domain ecosystem - what we know, what we don't know yet, and what intrigues us.

## Purpose

Traditional documentation answers "what does this code do?" This layer answers:

- **What do we truly understand?** (not just what's documented)
- **Where are the gaps?** (blind spots, unexplored areas)
- **What patterns emerge across domains?** (cross-cutting insights)
- **What sparks curiosity?** (questions worth exploring)

## Philosophy

This follows the Purpose Prompter hierarchy:

```
TRUTH        → What facts do we know?
    ↓
UNDERSTANDING → What patterns do we grasp?
    ↓
BEAUTY       → What elegant solutions have emerged?
    ↓
JUSTICE      → What is properly placed?
    ↓
CREATIVITY   → Where have we built new paths?
```

Understanding is not static. This is a **living system** that evolves as we learn.

## Structure

```
.understanding/
├── README.md              # This file - purpose and navigation
├── IMPLEMENTATION-PLAN.md # Phased plan to realize the mission
├── coverage-map.md        # Index: what we understand (entry point)
├── gap-analysis.md        # Index: what we don't understand yet
├── curiosities.md         # Topics that intrigue us for exploration
│
├── dimensions/            # Individual topic deep-dives
│   ├── 00-index.md       # Master index of all dimensions
│   └── NN-topic.md       # One file per topic (numbered)
│
├── cross-cutting/         # Insights that span multiple domains
│   ├── patterns.md       # Patterns observed across domains
│   ├── anti-patterns.md  # Things to avoid (learned the hard way)
│   └── synthesis.md      # Integrated understanding
│
└── meta/                  # About understanding itself
    ├── how-we-learn.md   # Our learning process
    ├── signal-log.md     # Ugliness/injustice/stagnation signals
    └── evolution.md      # How understanding has evolved
```

## How to Use

### Finding What We Know
Start with `coverage-map.md` - it's the entry point showing what's understood.

### Finding Gaps
Check `gap-analysis.md` to see what areas need exploration.

### Implementation Roadmap
See `IMPLEMENTATION-PLAN.md` for the phased plan to close gaps and realize the mission.

### Deep Diving
Browse `dimensions/` for topic-specific deep dives. Each file covers one concept thoroughly.

### Cross-Domain Insights
The `cross-cutting/` directory contains patterns that emerge when looking across all domains.

### Adding New Understanding
1. Create a new file in `dimensions/` (follow the numbering convention)
2. Update `dimensions/00-index.md` to include it
3. Update `coverage-map.md` if it fills a gap
4. Remove from `gap-analysis.md` if applicable

## Conventions

### Dimension File Naming
```
NN-descriptive-name.md

Examples:
01-entity-scoped-operations.md
02-document-lifecycle-states.md
03-cross-domain-event-patterns.md
```

### Content Structure
Each dimension file should include:
- **What**: Clear definition/explanation
- **Why**: Rationale and purpose
- **How**: Implementation details
- **Where**: Location in codebase
- **Connections**: Related topics/files
- **Open Questions**: What we don't understand yet

### Cross-References
Use relative links to connect related topics:
```markdown
See also: [Document Lifecycle](dimensions/02-document-lifecycle-states.md)
```

## Related Documentation

| Document | Purpose |
|----------|---------|
| `../README.md` | Operational layer overview |
| `../ARCHITECTURE.md` | Cross-domain patterns |
| `../.orchestration/README.md` | Workflow coordination |

## Maintenance

This layer should be updated when:
- New understanding emerges from implementation work
- Gaps are discovered during development
- Cross-cutting patterns become apparent
- Curiosity-driven exploration yields insights

**Owner**: The team collectively maintains understanding. No single owner.

---

*"The beginning of wisdom is the definition of terms." — Socrates*

*"Understanding is deeper than knowledge. Many people know you, but very few understand you." — Unknown*
