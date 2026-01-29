# Operational Orchestration

Cross-domain coordination layer for operational services.

## Purpose

This directory contains configuration and definitions for cross-operational coordination that spans multiple domains. Unlike individual domain services, orchestration concerns are:

1. **Cross-cutting** - Involve multiple operational domains
2. **Aggregate** - Combine data/events from multiple sources
3. **Workflow-based** - Define multi-step processes across domains
4. **Directory-scoped** - Owned by operational layer, not individual apps

## Directory Structure

```
.orchestration/
├── README.md              # This file
├── workflows/             # Multi-domain workflow definitions
├── compliance/            # Cross-operational compliance aggregation
└── reporting/             # Unified operational reporting
```

## Workflows (`workflows/`)

Declarative workflow definitions that orchestrate actions across operational domains.

**Example workflows**:
- `entity-onboarding.yaml` - New entity setup across all operational domains
- `contract-execution.yaml` - Contract signing → insurance verification → compliance check
- `ip-licensing.yaml` - License creation → contract → royalty setup
- `compliance-remediation.yaml` - Finding → action items across domains

**Workflow execution**: Workflows are triggered by events from the message queue (RabbitMQ) and executed by a workflow engine that calls domain APIs.

## Compliance (`compliance/`)

Aggregated compliance status and regulatory mappings across operational domains.

**Contents**:
- `regulatory-mappings/` - Maps regulations to domain requirements
- `status-aggregators/` - Combines compliance status from all domains
- `reporting-templates/` - Templates for unified compliance reports

## Reporting (`reporting/`)

Cross-operational report definitions and generators.

**Report types**:
- Entity operations summary
- Compliance status dashboard
- Expiration forecast
- Document inventory
- Regulatory calendar

## Integration Points

### Event Subscriptions

Orchestration subscribes to events from all operational domains:
- `contracts-legal.*`
- `insurance.*`
- `intellectual-property.*`
- `data-privacy.*`

### API Endpoints

Orchestration exposes unified query endpoints (typically via API gateway):
- `GET /operational/entities/{id}/overview`
- `GET /operational/entities/{id}/compliance`
- `GET /operational/entities/{id}/pending-actions`
- `GET /operational/entities/{id}/expiring`

## Implementation Notes

- Orchestration does NOT own business data - it queries/aggregates from domains
- Workflows use idempotent actions with compensation for failures
- All cross-operational state is derived, not stored (except workflow execution state)
- Prefer eventual consistency over distributed transactions
