# AWS PATH: Data Privacy Infrastructure

> **Purpose-Aligned Terrain Handling** - AWS infrastructure to support GDPR compliance at scale

**Purpose**: Enable automated compliance, immutable audit trails, and event-driven privacy workflows

**Status**: Phase 1 Planning
**Last Updated**: January 29, 2026

---

## Phase 1: DEFINE (Purpose Definition)

### 1. VISION

The ideal end state:
- **Immutable audit trail** for every consent, DSAR, and breach event (7-year retention)
- **Automated deadline enforcement** - No missed 30-day DSAR or 72-hour breach deadlines
- **Event-driven consent propagation** - All services know immediately when consent is granted/withdrawn
- **Compliance-ready** - Athena queries produce regulator-ready reports in seconds
- **Encrypted everywhere** - KMS-managed keys, automatic rotation

### 2. SCOPE

**In scope**:
- KMS encryption for data-privacy
- S3 audit bucket with lifecycle policies
- CloudWatch Logs → Kinesis Firehose → S3 pipeline
- Athena + Glue for audit queries
- EventBridge for event publishing
- Lambda for deadline monitoring
- SNS for notifications

**Out of scope** (for now):
- DynamoDB real-time state (enhancement)
- Timestream metrics (future)
- QuickSight dashboards (future)
- Full RabbitMQ replacement (hybrid approach)

### 3. SUCCESS CRITERIA

- [ ] All privacy events written to immutable S3 audit log
- [ ] DSAR deadline alerts fire 5/3/1 days before deadline
- [ ] Breach escalation alerts fire at 48/24/4 hours
- [ ] Athena can query any consent/DSAR/breach by date range
- [ ] Zero personal data exposed in CloudWatch logs
- [ ] KMS key rotation enabled

### 4. CONSTRAINTS

**Regulatory**:
- GDPR Art. 5(1)(f) - Accountability (audit trail)
- GDPR Art. 32(1)(a) - Encryption requirement
- 7-year retention for audit logs

**Technical**:
- Must integrate with existing RabbitMQ (hybrid approach)
- Must use ecosystem Terraform patterns
- Cost-optimized for dev environment

### 5. LONGING CHECK

- [x] I've glimpsed the ideal - Automated compliance, zero missed deadlines
- [x] I feel the ache of separation - Manual processes, potential audit gaps
- [x] This purpose is worth pursuing - Regulatory risk reduction, operational efficiency

---

## Phase 2: ASSESS (Current State)

### 1. EXISTING AWS INFRASTRUCTURE

**Already deployed in ecosystem**:
| Service | Status | data-privacy Usage |
|---------|--------|-------------------|
| RDS PostgreSQL | ✓ Ready | `data_privacy` database exists |
| VPC/Networking | ✓ Ready | Deployed |
| KMS (shared) | ✓ Ready | Need dedicated key |
| Secrets Manager | ✓ Ready | DB credentials stored |
| CloudWatch | ✓ Ready | Basic logging only |

**Patterns to adopt from other services**:
| Pattern | Source | Applicability |
|---------|--------|---------------|
| Audit pipeline | banking-treasury | HIGH - Same compliance needs |
| Event publishing | banking-treasury | HIGH - EventBridge patterns |
| Progress tracking | progress-tracking module | MEDIUM - Lambda + DynamoDB |

### 2. CURRENT DATA-PRIVACY STATE

```
Current:
  Events → RabbitMQ → (consumers TBD)
  Logs → stdout → (lost)
  Audit → Prisma → PostgreSQL (mutable)

Missing:
  ✗ Immutable audit trail
  ✗ Deadline monitoring
  ✗ Cross-service event propagation
  ✗ Compliance-ready queries
  ✗ Long-term retention
```

### 3. GAP ANALYSIS

| Need | Current | Target | Gap |
|------|---------|--------|-----|
| Audit retention | 0 days | 7 years | CRITICAL |
| Deadline monitoring | Manual | Automated | HIGH |
| Event propagation | Local only | Cross-service | HIGH |
| Query capability | SQL only | Athena | MEDIUM |
| Encryption | DB-level | Field-level | MEDIUM |

---

## Phase 3: RECONNOITER (Map the Terrain)

### 1. AWS SERVICES TERRAIN MAP

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       AWS INFRASTRUCTURE TERRAIN                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  APPLICATION LAYER (data-privacy service)                                    │
│  ├── Hono API routes                                                         │
│  ├── Domain services (consent, DSAR, breach)                                │
│  └── Event publisher (currently RabbitMQ)                                   │
│           │                                                                  │
│           ▼                                                                  │
│  EVENT LAYER                                                                 │
│  ├── EventBridge Event Bus ←── WAYPOINT 2                                   │
│  │     ├── consent.granted → SNS consent-topic                              │
│  │     ├── consent.withdrawn → SNS consent-topic (priority)                 │
│  │     ├── dsar.submitted → Lambda deadline-tracker                         │
│  │     └── breach.detected → Lambda escalation-monitor                      │
│  │                                                                           │
│  └── SNS Topics                                                              │
│        ├── data-privacy-consent-events                                       │
│        ├── data-privacy-dsar-notifications                                   │
│        └── data-privacy-breach-critical                                      │
│           │                                                                  │
│           ▼                                                                  │
│  AUTOMATION LAYER                                                            │
│  └── Lambda Functions ←── WAYPOINT 3                                        │
│        ├── dsar-deadline-checker (daily cron)                               │
│        ├── breach-escalation-monitor (hourly cron)                          │
│        └── consent-expiration-processor (daily cron)                        │
│           │                                                                  │
│           ▼                                                                  │
│  AUDIT LAYER ←── WAYPOINT 1 (START HERE)                                    │
│  ├── CloudWatch Logs (/data-privacy/audit)                                  │
│  │     └── Log retention: 30 days                                           │
│  │           │                                                               │
│  │           ▼                                                               │
│  ├── Kinesis Firehose                                                       │
│  │     └── Transform: JSON → Parquet                                        │
│  │           │                                                               │
│  │           ▼                                                               │
│  ├── S3 Audit Bucket                                                        │
│  │     ├── Versioning: enabled                                              │
│  │     ├── Object Lock: GOVERNANCE mode                                     │
│  │     └── Lifecycle:                                                       │
│  │           ├── 0-90d: STANDARD                                            │
│  │           ├── 90-365d: STANDARD_IA                                       │
│  │           ├── 365-730d: GLACIER                                          │
│  │           └── 730d+: DEEP_ARCHIVE                                        │
│  │           │                                                               │
│  │           ▼                                                               │
│  └── Athena + Glue Catalog                                                  │
│        └── Query: SELECT * FROM audit WHERE event_type='breach.detected'    │
│                                                                              │
│  SECURITY LAYER                                                              │
│  └── KMS ←── WAYPOINT 1 (with audit)                                        │
│        ├── data-privacy-{env} key                                           │
│        ├── Auto-rotation: enabled                                           │
│        └── Usage: S3, CloudWatch, Firehose                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2. COST TERRAIN

| Waypoint | Services | Monthly Cost (Dev) |
|----------|----------|-------------------|
| WP1: Audit | KMS, S3, Firehose, Glue, Athena | ~$15 |
| WP2: Events | EventBridge, SNS | ~$5 |
| WP3: Automation | Lambda (3 functions) | ~$3 |
| **Total** | | **~$23/month** |

### 3. RISK TERRAIN

| Risk | Mitigation |
|------|------------|
| S3 data loss | Versioning + Object Lock |
| Missed deadlines | Multiple alert thresholds (5/3/1 days) |
| Cost overrun | Lifecycle policies, reserved capacity |
| Key compromise | Automatic rotation, separate prod keys |

---

## Phase 4: WAYPOINT (Set Milestones)

### Waypoint 1: Audit Infrastructure
```
┌──────────────────────────────────────────┐
│ Waypoint: Audit Infrastructure           │
│ Order: 1 of 3                            │
├──────────────────────────────────────────┤
│ Definition:                              │
│   KMS key for data-privacy               │
│   S3 audit bucket with lifecycle         │
│   CloudWatch → Firehose → S3 pipeline    │
│   Glue catalog + Athena workgroup        │
│                                          │
│ Verification:                            │
│   - [ ] KMS key created, rotation on     │
│   - [ ] S3 bucket with Object Lock       │
│   - [ ] Firehose delivering Parquet      │
│   - [ ] Athena query returns results     │
│   - [ ] 7-year lifecycle configured      │
│                                          │
│ Terraform files:                         │
│   modules/data-privacy/kms.tf            │
│   modules/data-privacy/s3.tf             │
│   modules/data-privacy/firehose.tf       │
│   modules/data-privacy/glue.tf           │
│   modules/data-privacy/athena.tf         │
│                                          │
│ Dependencies:                            │
│   Previous waypoint: None                │
│   Blockers: None                         │
│                                          │
│ Effort: M                                │
└──────────────────────────────────────────┘
```

### Waypoint 2: Event Publishing
```
┌──────────────────────────────────────────┐
│ Waypoint: Event Publishing               │
│ Order: 2 of 3                            │
├──────────────────────────────────────────┤
│ Definition:                              │
│   EventBridge event bus                  │
│   SNS topics for consent/DSAR/breach     │
│   EventBridgePublisher in TypeScript     │
│   Hybrid mode (EventBridge + RabbitMQ)   │
│                                          │
│ Verification:                            │
│   - [ ] EventBridge bus created          │
│   - [ ] SNS topics created               │
│   - [ ] consent.granted publishes        │
│   - [ ] breach.detected publishes        │
│   - [ ] CloudWatch shows events          │
│                                          │
│ Terraform files:                         │
│   modules/data-privacy/eventbridge.tf    │
│   modules/data-privacy/sns.tf            │
│                                          │
│ Code files:                              │
│   src/infrastructure/aws/               │
│     eventbridge-publisher.ts             │
│                                          │
│ Dependencies:                            │
│   Previous waypoint: WP1 (KMS for SNS)   │
│   Blockers: None                         │
│                                          │
│ Effort: M                                │
└──────────────────────────────────────────┘
```

### Waypoint 3: Deadline Automation
```
┌──────────────────────────────────────────┐
│ Waypoint: Deadline Automation            │
│ Order: 3 of 3 (PURPOSE)                  │
├──────────────────────────────────────────┤
│ Definition:                              │
│   Lambda: dsar-deadline-checker          │
│   Lambda: breach-escalation-monitor      │
│   Lambda: consent-expiration-processor   │
│   EventBridge cron rules                 │
│   SNS alert integration                  │
│                                          │
│ Verification:                            │
│   - [ ] DSAR alerts at 5/3/1 days        │
│   - [ ] Breach alerts at 48/24/4 hours   │
│   - [ ] Consent expiration events        │
│   - [ ] CloudWatch metrics visible       │
│   - [ ] SNS notifications delivered      │
│                                          │
│ Terraform files:                         │
│   modules/data-privacy/lambda.tf         │
│   modules/data-privacy/cloudwatch.tf     │
│                                          │
│ Lambda code:                             │
│   lambda/dsar-deadline-checker/          │
│   lambda/breach-escalation-monitor/      │
│   lambda/consent-expiration-processor/   │
│                                          │
│ Dependencies:                            │
│   Previous waypoints: WP1, WP2           │
│   Blockers: None                         │
│                                          │
│ Effort: L                                │
│                                          │
│ Value delivered:                         │
│   PURPOSE REALIZED - Automated           │
│   compliance with zero missed deadlines  │
└──────────────────────────────────────────┘
```

### PATH VISUALIZATION

```
  START ──→ WP1 ──→ WP2 ──→ WP3 ──→ PURPOSE
    ●        ○       ○       ○        ★
  [HERE]   Audit   Events  Lambda   [GOAL]
           infra   publish  auto    Automated
                                    Compliance
```

---

## Phase 5: BUILD (Implementation Plan)

### Terraform Module Structure

```
infrastructure/terraform/modules/data-privacy/
├── main.tf              # Module configuration
├── variables.tf         # Input variables
├── outputs.tf           # Output values
├── kms.tf               # WP1: Encryption key
├── s3.tf                # WP1: Audit bucket
├── firehose.tf          # WP1: Log streaming
├── glue.tf              # WP1: Catalog
├── athena.tf            # WP1: Query workgroup
├── eventbridge.tf       # WP2: Event bus
├── sns.tf               # WP2: Topics
├── lambda.tf            # WP3: Functions
├── cloudwatch.tf        # WP3: Alarms
├── iam.tf               # IAM roles
└── lambda/
    ├── dsar-deadline-checker/
    │   ├── index.ts
    │   └── package.json
    ├── breach-escalation-monitor/
    │   ├── index.ts
    │   └── package.json
    └── consent-expiration-processor/
        ├── index.ts
        └── package.json
```

### Application Code Structure

```
src/infrastructure/aws/
├── index.ts                    # Exports
├── eventbridge-publisher.ts    # Event publishing
├── audit-logger.ts             # Audit log writer
├── s3-client.ts                # DSAR exports
└── config.ts                   # AWS configuration

src/domain/*/services/*.ts
└── Add: this.auditLogger.log() calls
└── Add: this.eventPublisher.publish() calls
```

### Environment Configuration

```bash
# .env.aws
AWS_REGION=us-east-1
AWS_EVENTBRIDGE_BUS=data-privacy-dev-events
AWS_SNS_CONSENT_TOPIC=arn:aws:sns:us-east-1:xxx:data-privacy-consent
AWS_SNS_BREACH_TOPIC=arn:aws:sns:us-east-1:xxx:data-privacy-breach
AWS_S3_AUDIT_BUCKET=ecosystem-data-privacy-dev-audit
AWS_KMS_KEY_ID=alias/data-privacy-dev
```

---

## Progress Tracking

| Waypoint | Status | Reached | Notes |
|----------|--------|---------|-------|
| WP1: Audit Infrastructure | **COMPLETE** | 2026-01-29 | KMS, S3, Firehose, Glue, Athena Terraform modules |
| WP2: Event Publishing | **COMPLETE** | 2026-01-29 | EventBridge event bus, SNS topics, event rules |
| WP3: Deadline Automation | **COMPLETE** | 2026-01-29 | Lambda functions, CloudWatch rules, compliance dashboard |

**Overall Progress**: 3/3 waypoints (100%) ✓
**Estimated Cost**: ~$23/month (dev)

### AWS-WP1 Deliverables
- `kms.tf` - Dedicated KMS key with rotation, service policies
- `s3.tf` - Audit bucket (7yr retention, Glacier lifecycle), DSAR exports bucket
- `firehose.tf` - CloudWatch → S3 Parquet streaming pipeline
- `glue.tf` - Catalog database, audit_events table, consent/dsar/breach views
- `athena.tf` - Workgroup, results bucket, saved compliance queries

### AWS-WP2 Deliverables
- `eventbridge.tf` - Privacy event bus, event rules for consent/DSAR/breach, archive
- `sns.tf` - SNS topics (consent, DSAR, breach-critical), policies, email subscriptions

### AWS-WP3 Deliverables
- `lambda.tf` - DSAR deadline checker, breach escalation monitor, consent expiration processor
- `cloudwatch.tf` - Scheduled rules, compliance alarms, CloudWatch dashboard
- `outputs.tf` - Complete module outputs including all new resources

---

## The PATH Promise

This AWS PATH ensures:
1. **IMMUTABLE AUDIT** - 7-year retention, tamper-proof
2. **AUTOMATED DEADLINES** - No human error in compliance
3. **EVENT-DRIVEN** - Real-time consent propagation
4. **QUERY-READY** - Athena reports for regulators
5. **ENCRYPTED** - KMS everywhere
6. **COST-OPTIMIZED** - Lifecycle policies, reserved capacity

---

*AWS PATH Protocol activated for data-privacy infrastructure.*
