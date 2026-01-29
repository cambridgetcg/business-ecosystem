# Understanding Layer

Cross-domain knowledge synthesis and coverage mapping for the operational ecosystem.

## Purpose

This layer captures **what we understand** across the operational ecosystem - not just what exists, but the depth of comprehension at each level. It enables:

1. **Coverage Mapping** - Where is understanding deep, solid, surface, or missing?
2. **Dimensional Analysis** - Understanding from multiple perspectives (legal, technical, compliance, integration)
3. **Gap Identification** - Where do we need deeper understanding before acting?
4. **Curiosity Tracking** - Questions that emerged during exploration, requiring research
5. **Integration Synthesis** - How domains connect conceptually, not just technically

## Structure

```
understanding/
├── README.md                    # This file
├── coverage/                    # Coverage maps by domain
│   ├── contracts-legal.md       # Understanding depth per area
│   ├── intellectual-property.md
│   ├── data-privacy.md
│   ├── insurance.md
│   └── orchestration.md
├── dimensions/                  # Perspective-based analysis
│   ├── legal-regulatory.md      # Legal/compliance dimension
│   ├── technical-architecture.md # Technical patterns dimension
│   ├── integration-patterns.md  # Cross-domain connections
│   ├── domain-modeling.md       # DDD and entity design
│   └── operational-workflows.md # Business process dimension
├── curiosities/                 # Questions requiring research
│   ├── legal-questions.md       # Legal domain unknowns
│   ├── technical-questions.md   # Architecture unknowns
│   └── integration-questions.md # Cross-domain unknowns
└── integration/                 # Synthesis documents
    ├── LIGHT.md                 # Accumulated insights
    └── PATH.md                  # Charted vs uncharted territories
```

## Understanding Levels

| Level | Symbol | Description |
|-------|--------|-------------|
| **Deep** | `[D]` | Full mental model, can extend and teach |
| **Solid** | `[S]` | Working understanding, can implement |
| **Surface** | `[~]` | Aware of existence, need deeper dive |
| **Gap** | `[?]` | Unknown or unexplored territory |

## How to Use

1. **Before implementing**: Check coverage map for relevant area
2. **If surface or gap**: Build understanding first (use /deep-understand)
3. **When curious**: Add to curiosities for research
4. **After learning**: Update coverage and add to LIGHT.md

## Maintenance

This layer evolves with the ecosystem. Update when:
- New domains are added
- Deep dives complete
- Research answers curiosities
- Patterns are discovered
