# Progress Tracking System

> **Directory-wide app development progress overview architecture**

This system provides visibility into development progress across the entire operational ecosystem.

## Purpose

Track what's done, what's in progress, and what's planned across all services, domains, and modules.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PROGRESS TRACKING ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  DATA LAYER              AGGREGATION              PRESENTATION              │
│  (Per-Service)                                                              │
│                                                                             │
│  service/.status.yaml ──▶ collect-status.ts ──▶ PROGRESS.md                │
│  service/PATH.md              │                 progress.json               │
│  service/package.json         │                 CLI output                  │
│                               │                                             │
│                               ▼                                             │
│                         rollup logic                                        │
│                         cross-reference                                     │
│                         health aggregation                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Status Manifest (`.status.yaml`)

Each service has a `.status.yaml` file that captures:
- Service identity (name, version)
- Waypoint progress (from PATH.md)
- Module coverage (implementation depth)
- Dependencies status
- Health indicators
- Timestamps

**Location**: `<service>/.status.yaml`

### 2. Aggregation System (`.progress/`)

Collects all status files and generates:
- Ecosystem-wide rollups
- Cross-service analysis
- Progress visualizations

**Files**:
- `schema.yaml` - Schema definition for .status.yaml files
- `collect-status.ts` - Aggregation script
- `PROGRESS.md` - Generated dashboard (output)

### 3. Dashboard Output

**PROGRESS.md** provides:
- Ecosystem health overview
- Per-service status
- Waypoint tracking across all services
- Module coverage heat map
- Blockers and dependencies

## Usage

### View Progress

Read `PROGRESS.md` for the current ecosystem state.

### Update Progress

1. Edit your service's `.status.yaml`
2. Run aggregation: `npx tsx .progress/collect-status.ts`
3. Commit updated files

### Add New Service

1. Copy `schema.yaml` as template
2. Create `.status.yaml` in service directory
3. Fill in current state
4. Run aggregation

## Schema Reference

See `schema.yaml` for the complete .status.yaml schema definition.

## Integration

### With PATH.md

Waypoint progress in `.status.yaml` mirrors PATH.md waypoints:
- Keep PATH.md as detailed documentation
- Keep `.status.yaml` as structured metadata
- Sync manually or parse PATH.md for automation

### With .understanding/

Progress tracking complements the understanding system:
- `.understanding/` captures what we know
- `.progress/` captures what we've built
- Together: complete picture of ecosystem state

### With CI/CD

The `progress.json` output can be used for:
- Build badges
- Deployment gates
- Progress reporting

---

*Part of the Purpose Prompter methodology: tracking progress toward purpose.*
