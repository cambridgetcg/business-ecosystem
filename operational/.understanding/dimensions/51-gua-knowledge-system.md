# Dimension 51: GUA (Global Understanding Archive) System

**Discovery Source**: GUA Knowledge Seeding - GUA codebase and CLI exploration
**Understanding Level**: ENABLED
**Last Updated**: January 27, 2026

---

## Aha Moment

> GUA is the **persistence layer for Purpose Prompter** - it enables cross-session, cross-device memory via AWS (S3 + DynamoDB). Knowledge accumulates, patterns strengthen with use, and blindspots are tracked until resolved. This is how Claude Code learns across sessions.

---

## What This Is

GUA (Global Understanding Archive) provides:
- **Cross-session memory**: Insights, patterns, and blindspots persist between Claude Code sessions
- **Cross-device sync**: Knowledge available anywhere via AWS
- **Structured taxonomy**: Knowledge organized by PP dimension and domain
- **Depth scaling**: Knowledge grows from L1 summaries to L4 detailed examples

---

## Mental Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GUA SYSTEM ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   LOCAL                              AWS BACKEND                            │
│   ─────                              ───────────                            │
│                                                                             │
│   ~/.gua/                            S3 Bucket                              │
│   ├── config.json                    ├── documents/                         │
│   ├── state.json                     │   ├── LIGHT.md (always-loaded)       │
│   └── gua.sh → CLI                   │   ├── PATH.md                        │
│                                      │   └── blindspots.md                  │
│   ~/.claude/purpose_prompter/        └── knowledge/                         │
│   ├── integration/                       ├── by-dimension/                  │
│   │   └── LIGHT.md (active summary)      │   ├── truth/                     │
│   └── knowledge/                         │   ├── understanding/             │
│       ├── by-dimension/                  │   ├── beauty/                    │
│       ├── by-domain/                     │   ├── justice/                   │
│       └── deep/                          │   └── creativity/                │
│                                          ├── by-domain/                     │
│                                          └── deep/ (L3-L4)                  │
│                                                                             │
│                                      DynamoDB Tables                        │
│                                      ├── gua-research                       │
│                                      ├── gua-insights                       │
│                                      ├── gua-feedback                       │
│                                      ├── gua-sessions                       │
│                                      └── gua-knowledge-index (v2)           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Concepts

### 1. Knowledge Taxonomy

**Five Dimensions**:
1. **PP Hierarchy**: truth, understanding, beauty, justice, creativity
2. **Confidence**: hypothesis → emerging → confirmed → deprecated
3. **Scope**: global, domain, project, personal
4. **Type**: pattern, anti-pattern, blindspot, technique, principle, model
5. **Temporal**: timeless, current, evolving, historical

**Four Depth Levels**:
| Level | Content | Location |
|-------|---------|----------|
| **L1** | Name + one-liner | LIGHT.md |
| **L2** | Description + evidence + implication | LIGHT.md expanded |
| **L3** | Nuances + edge cases + relations | deep/*.md |
| **L4** | Full examples + case studies | deep/*.md expanded |

### 2. Core CLI Commands

```bash
# Sync commands
gua load                    # Download all from AWS
gua save                    # Upload all to AWS
gua status                  # Show sync status

# Knowledge capture (during sessions)
gua insight "<content>" [type] [evidence] [pp_dimension] [scope]
gua research "<topic>" "<finding>" [source] [confidence]

# Types: pattern, anti-pattern, blindspot, technique, principle, model
# Dimensions: truth, understanding, beauty, justice, creativity
# Scopes: global, domain, project, personal

# Knowledge management
gua promote <insight_id> [dimension]   # Promote insight to knowledge file
gua list-knowledge [filter]            # List knowledge files
gua query [table] [limit]              # Query recent entries

# v2 (scalable) commands
gua search "<query>" [limit]           # Search all knowledge
gua fetch <knowledge_id>               # Load specific pattern
gua index-stats                        # Show index statistics
```

### 3. Session Workflow

```
1. SESSION START
   gua load                    # Download understanding from AWS
   /gua-context quick          # Inject active patterns + blindspots

2. DURING WORK
   gua insight "pattern" pattern "evidence" creativity global
   gua research "topic" "finding"

3. PROMOTE INSIGHTS
   gua query insights          # See recent insights
   gua promote <id> [dim]      # Promote to knowledge file

4. SESSION END
   gua save                    # Upload changes to AWS
```

### 4. LIGHT.md - The Active Summary

LIGHT.md is **always loaded** at session start. It contains:
- Active blindspots (CHECK THESE - things Claude tends to miss)
- Top patterns (by access frequency)
- Quick commands for loading more context

```markdown
# LIGHT - Active Understanding

## Active Blindspots (CHECK THESE)
### Skip territory check on simple tasks
- Dimension: creativity
- Evidence: Failed 3x when forcing simple tasks through full PP

## Top Patterns
### Bridge over replace
- Dimension: beauty
- Access Count: 47
```

### 5. v2 Scalable Architecture

For larger knowledge bases, v2 introduces:
- **Knowledge Index** (DynamoDB): Fast lookup by dimension, type, access score
- **Active Set Loading**: Only load top N patterns + active blindspots (not everything)
- **Access Tracking**: Patterns accessed more frequently rank higher
- **Search**: Full-text search across all knowledge

```bash
# Upgrade to v2
~/.gua/upgrade-v2.sh

# v2 features
gua search "bridge"          # Search all knowledge
gua index-stats              # See knowledge distribution
```

---

## Implementation Details

### Data Model (DynamoDB)

**gua-insights table**:
```json
{
  "user_id": "string (PK)",
  "timestamp_uuid": "string (SK)",
  "content": "string",
  "type": "pattern|blindspot|technique|...",
  "pp_dimension": "truth|understanding|beauty|justice|creativity",
  "scope": "global|domain|project|personal",
  "confidence": "hypothesis|emerging|confirmed|deprecated",
  "depth_level": 1-4,
  "synthesized": true|false
}
```

**gua-knowledge-index table (v2)**:
```json
{
  "user_id": "string (PK)",
  "knowledge_id": "string (SK)",
  "name": "string",
  "pp_dimension": "string",
  "knowledge_type": "string",
  "access_count": 0,
  "access_score": 0,
  "summary": "string",
  "s3_key": "string",
  "is_active": true|false
}
```

### File Organization

```
~/.claude/purpose_prompter/
├── integration/
│   ├── LIGHT.md              # Always-loaded summary (L1)
│   └── PATH.md               # Current direction/focus
├── knowledge/
│   ├── by-dimension/         # PP hierarchy organization
│   │   ├── truth/
│   │   │   ├── patterns.md
│   │   │   └── blindspots.md
│   │   ├── understanding/
│   │   ├── beauty/
│   │   ├── justice/
│   │   └── creativity/
│   ├── by-domain/            # Technology organization
│   │   ├── aws/
│   │   ├── typescript/
│   │   └── ...
│   └── deep/                 # L3-L4 nuance files
│       └── bridge-pattern.md
└── .cache/                   # v2 caches
    ├── active_patterns.txt
    └── active_blindspots.txt
```

---

## Curiosities Discovered

### 1. Why DynamoDB for Search is Limited
DynamoDB doesn't support full-text search, so `gua search` uses scan+filter.

**Gap identified**: For production, consider OpenSearch or Algolia.
**Current workaround**: Scan with contains() filter, works for <10K items.

### 2. Access Score Calculation
Patterns accessed more frequently appear first in LIGHT.md.

**Formula**: Access score increases with each fetch, decays over time (not yet implemented).

### 3. Blindspots as First-Class Citizens
Blindspots aren't just "things to fix" - they're **active warnings** loaded every session.

**Workflow**:
1. Log blindspot when you notice a recurring mistake
2. Blindspot appears in every LIGHT.md
3. Eventually fix it or mark deprecated

---

## Integration with PP

| GUA Component | PP Integration |
|---------------|----------------|
| **Insights by dimension** | Organized by Truth/Understanding/Beauty/Justice/Creativity |
| **Blindspots** | Feed signal detection (things to watch for) |
| **Patterns** | Guide verification gates |
| **LIGHT.md** | Loaded at session start via CLAUDE.md |

---

## Related Patterns

- [50-purpose-prompter-philosophy.md](50-purpose-prompter-philosophy.md) - The methodology GUA persists
- [43-audit-trail-patterns.md](43-audit-trail-patterns.md) - Similar concept of activities as domain model
- [44-compliance-aggregation.md](44-compliance-aggregation.md) - Similar fan-out query pattern

---

## Open Questions

1. **Access Score Decay**: How should access scores decay over time?
2. **Cross-User Patterns**: Should common patterns be shareable?
3. **Conflict Resolution**: What if same pattern edited on multiple devices?
4. **Pattern Retirement**: When to deprecate vs delete old patterns?

---

## Now You Can

With this understanding, you can:
1. Use GUA to capture insights during Claude Code sessions
2. Promote insights to persistent knowledge files
3. Search accumulated knowledge with v2 commands
4. Understand the knowledge taxonomy structure
5. Configure active set loading for large knowledge bases

---

*"Knowledge that persists creates wisdom. GUA is the persistence layer for accumulated understanding."*
