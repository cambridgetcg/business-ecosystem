# Entity Governance Data Partitioning Strategy

## Overview

This document describes the data partitioning approach for the entity-governance service, designed to optimize performance, maintainability, and integration with other ecosystem services.

## Partitioning Architecture

### Single Database, Logical Partitioning

We use a **single PostgreSQL database** with logical partitioning through:

1. **Entity-centric data model**: All subdomain tables reference `entity_id`, enabling efficient joins and queries within an entity context.

2. **Table organization by subdomain**: Tables are grouped logically by their domain:
   - `legal_entities`, `incorporation_documents` - Entity core
   - `parent_subsidiary_relationships` - Corporate structure
   - `boards`, `committees`, `bylaws` - Governance
   - `shareholders`, `share_classes`, `shareholdings`, `equity_grants` - Shareholders
   - `directors`, `officers` - Officers & Directors
   - `meeting_minutes`, `resolutions` - Corporate records
   - `registered_agents` - Registered agent
   - `filing_requirements`, `annual_filings` - Annual filings
   - `entity_governance_audit_log` - Audit trail

3. **Soft delete with `deleted_at`**: All tables support soft deletion for audit compliance.

### Physical Partitioning (Audit Log)

The `entity_governance_audit_log` table uses **time-based partitioning**:

```sql
-- Example: Monthly partitions
CREATE TABLE entity_governance_audit_log (
    ...
) PARTITION BY RANGE (occurred_at);

CREATE TABLE audit_log_2024_01 PARTITION OF entity_governance_audit_log
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

**Benefits**:
- Efficient queries on recent audit data
- Easy archival of old partitions
- Improved vacuum performance

### Index Strategy

```sql
-- Entity-centric queries (most common)
CREATE INDEX idx_legal_entities_status ON legal_entities(status) WHERE deleted_at IS NULL;

-- Subdomain-specific indexes
CREATE INDEX idx_shareholders_entity ON shareholders(entity_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_officers_entity ON officers(entity_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_annual_filings_entity_year ON annual_filings(entity_id, filing_year);

-- Audit log time-based queries
CREATE INDEX idx_audit_log_time ON entity_governance_audit_log(occurred_at);
CREATE INDEX idx_audit_log_entity ON entity_governance_audit_log(entity_id, occurred_at);
```

## Data Flow Integration

### Inbound Integration (other services → entity-governance)

| Source Service | Data Flow | Pattern |
|---------------|-----------|---------|
| Accounting | Financial entity data | Event subscription |
| Tax | Tax ID updates | Event subscription |
| Compliance | Regulatory requirements | Event subscription |

### Outbound Integration (entity-governance → other services)

| Target Service | Events Published | Use Case |
|---------------|------------------|----------|
| Accounting | `entity.created`, `entity.dissolved` | Account setup/closure |
| Tax | `entity.created`, `officer.appointed` | Tax entity registration |
| Compliance | `filing.overdue`, `registered-agent.changed` | Compliance monitoring |
| Banking-Treasury | `shares.issued`, `ownership.changed` | Cap table for financing |

### Event-Driven Integration Pattern

```
┌──────────────────────────┐
│    Entity Governance     │
│                          │
│  ┌──────────────────┐    │
│  │   Domain Event   │────┼──────► Message Bus (RabbitMQ)
│  │    Publisher     │    │              │
│  └──────────────────┘    │              │
│           │              │              ▼
│           ▼              │     ┌────────────────┐
│  ┌──────────────────┐    │     │   Accounting   │
│  │    PostgreSQL    │    │     │   Tax Service  │
│  │   (RDS Aurora)   │    │     │   Compliance   │
│  └──────────────────┘    │     └────────────────┘
└──────────────────────────┘
```

## Multi-Tenancy Considerations

The schema supports multi-tenancy through:

1. **Entity-level isolation**: Each legal entity is the natural boundary.

2. **Row-level security (RLS)**: Can be enabled for tenant isolation:
   ```sql
   ALTER TABLE legal_entities ENABLE ROW LEVEL SECURITY;
   CREATE POLICY tenant_isolation ON legal_entities
       USING (tenant_id = current_setting('app.tenant_id')::uuid);
   ```

3. **Connection pooling**: PgBouncer for efficient connection management across tenants.

## Scaling Considerations

### Vertical Scaling (Default)
- Start with `db.t3.micro` for development
- Scale to `db.r6g.large` for production
- Enable Performance Insights for monitoring

### Horizontal Scaling (Future)
If needed, consider:
1. **Read replicas** for reporting queries
2. **Aurora Serverless v2** for auto-scaling
3. **Separate reporting database** for analytics

### Estimated Data Growth

| Table | Rows/Entity/Year | Notes |
|-------|-----------------|-------|
| legal_entities | 1 | Core entity record |
| shareholders | 5-50 | Varies by entity type |
| annual_filings | 5-10 | Per jurisdiction |
| meeting_minutes | 4-12 | Board/committee meetings |
| audit_log | 100-1000 | High volume, partitioned |

## Backup and Recovery

### RDS Automated Backups
- Retention: 7 days (dev), 30 days (prod)
- Point-in-time recovery enabled
- Automated snapshots daily

### Cross-Region (Production)
- Cross-region read replica for DR
- S3 export for long-term archival

## Security

### Network Isolation
- RDS in private subnets only
- Security group restricts to VPC CIDR
- No public accessibility

### Encryption
- Storage encryption with AWS KMS
- SSL/TLS for connections
- Secrets Manager for credentials

### Access Control
- IAM database authentication
- Separate read/write users
- Audit logging enabled
