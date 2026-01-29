# Workflow Engine

## Mission

**To orchestrate cross-domain business processes through declarative YAML workflows, ensuring reliable execution, automatic compensation on failure, and complete visibility into multi-step operations.**

---

## Purpose

The Workflow Engine exists to serve as the **coordination layer** for the operational ecosystem. It answers the fundamental orchestration question: *When something happens in one domain, what else needs to happen across other domains?*

This service exists to:

1. **Coordinate Cross-Domain Operations** - Execute multi-step workflows that span contracts, insurance, IP, and data privacy domains
2. **React to Events** - Automatically trigger workflows when domain events occur
3. **Handle Failures Gracefully** - Implement compensation (rollback) when steps fail
4. **Provide Visibility** - Track workflow execution status, timing, and outcomes
5. **Decouple Domains** - Let domains focus on their core logic while the engine handles coordination

---

## Vision

A world where:
- **Business processes are declarative** - Define WHAT should happen, not HOW to orchestrate it
- **Failures are recoverable** - When things go wrong, compensation actions restore consistency
- **Timing is visible** - SLAs are tracked and violations are surfaced
- **Domains remain independent** - Each domain does its job; the engine coordinates

---

## Core Concepts

### 1. Workflow Definition

Workflows are defined in YAML with:
- **Triggers**: What initiates the workflow (event, schedule, manual)
- **Steps**: Ordered actions to execute
- **Dependencies**: Which steps depend on others
- **Compensation**: What to undo if steps fail

```yaml
id: entity-onboarding
name: Entity Onboarding
trigger:
  type: event
  source: entity-governance.entity.created
steps:
  - id: create-contracts
    domain: contracts-legal
    action: createStandardAgreements
  - id: assess-insurance
    domain: insurance
    action: assessCoverageRequirements
    dependsOn: [create-contracts]
compensation:
  - step: create-contracts
    action: deleteAgreements
```

### 2. Event-Driven Execution

The engine subscribes to domain events via RabbitMQ and triggers matching workflows automatically.

### 3. Compensation Pattern

When a step fails and `onFailure: compensate` is set, the engine executes compensation actions in reverse order to restore system consistency.

### 4. Domain Clients

The engine communicates with domains via HTTP clients, calling standardized action endpoints.

---

## Guiding Principles

### 1. Declarative Over Imperative
Business processes are defined in YAML, not code. This enables non-engineers to understand and modify workflows.

### 2. Eventual Consistency
Cross-domain operations may not be immediately consistent. The engine ensures they become consistent through retries and compensation.

### 3. Idempotency Expected
Domain actions should be idempotent. The engine may retry failed steps.

### 4. Observability Built-In
Every workflow execution, step completion, and failure is logged with correlation IDs for tracing.

### 5. Fail Loud, Recover Gracefully
When things go wrong, the engine makes noise (logs, events) but attempts automatic recovery through retries and compensation.

---

## Boundaries

### What We Own
- Workflow definition parsing and validation
- Event subscription and workflow triggering
- Step execution ordering (respecting dependencies)
- Retry logic with backoff
- Compensation execution on failure
- Execution state tracking
- Workflow lifecycle events

### What We Don't Own
- **Domain Logic** - Domains implement their own actions; we just call them
- **Event Publishing** - Domains publish their own events; we just subscribe
- **Business Rules** - Workflow conditions are evaluated, but rules are defined in workflows
- **Persistence** - Currently in-memory; production would use a database

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      WORKFLOW ENGINE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐ │
│  │  YAML Parser    │───▶│ Workflow Store  │◀───│  Trigger    │ │
│  │ (loadWorkflows) │    │ (definitions)   │    │   Index     │ │
│  └─────────────────┘    └────────┬────────┘    └─────────────┘ │
│                                  │                              │
│                                  ▼                              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                     EXECUTOR                                 ││
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   ││
│  │  │ Dep.     │  │ Step     │  │  Retry   │  │ Compen-  │   ││
│  │  │ Resolver │  │ Runner   │  │  Logic   │  │ sation   │   ││
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘   ││
│  └─────────────────────────────────────────────────────────────┘│
│                                  │                              │
│                                  ▼                              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                   DOMAIN CLIENTS                             ││
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   ││
│  │  │contracts │  │insurance │  │    IP    │  │ data-    │   ││
│  │  │-legal    │  │          │  │          │  │ privacy  │   ││
│  │  │ :3011    │  │  :3013   │  │  :3014   │  │  :3012   │   ││
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘   ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└──────────────────────────────────┬──────────────────────────────┘
                                   │
                         ┌─────────▼─────────┐
                         │     RabbitMQ      │
                         │  ecosystem.events │
                         └───────────────────┘
```

---

## Events We Publish

| Event | Trigger | Consumers |
|-------|---------|-----------|
| `WorkflowStarted` | Workflow execution begins | Monitoring, Audit |
| `WorkflowCompleted` | Workflow finishes (success/failure) | Monitoring, Audit |
| `StepCompleted` | Individual step finishes | Debugging, Audit |
| `CompensationTriggered` | Failure triggers rollback | Alerting |

---

## Events We Subscribe To

All domain events can potentially trigger workflows. The engine maintains a **trigger index** mapping event types to workflow definitions.

| Event Pattern | Example Workflows |
|---------------|-------------------|
| `entity-governance.entity.created` | Entity Onboarding |
| `contracts-legal.contract.signed` | Contract Execution |
| `data-privacy.breach.detected` | Breach Response |
| `intellectual-property.patent.granted` | IP Portfolio Update |

---

## Success Metrics

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| **Workflow Success Rate** | >99% | Workflows should complete reliably |
| **Compensation Success Rate** | 100% | Failed workflows must clean up |
| **Average Execution Time** | <SLA | Meet defined service levels |
| **Dead Letter Queue Size** | 0 | No permanently failed messages |

---

## Implementation Status

**Status**: IMPLEMENTED (Phase 1)

**Implemented**:
- YAML workflow parser
- Step execution with dependency resolution
- Domain HTTP clients
- RabbitMQ event subscription
- Basic retry logic
- Compensation execution
- Execution state tracking (in-memory)

**Not Yet Implemented**:
- Persistent execution state (database)
- Scheduled triggers
- Manual triggers via API
- SLA monitoring and alerting
- Workflow versioning
- Distributed execution

---

## Related Documentation

- [31-workflow-orchestration.md](../../.understanding/dimensions/31-workflow-orchestration.md) - Architectural understanding
- [41-message-queue-patterns.md](../../.understanding/dimensions/41-message-queue-patterns.md) - RabbitMQ integration
- [../workflows/](../workflows/) - Workflow definition files

---

*This document defines the purpose and scope of the Workflow Engine within the Business Ecosystem. It should be reviewed when adding new cross-domain capabilities.*
