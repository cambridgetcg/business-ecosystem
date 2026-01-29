# Dimension 01: Entity-Scoped Operations

## What

Every operational record in the ecosystem is **anchored to a legal entity** via an `entityId` field. This is a universal pattern enforced across all domains.

```typescript
interface OperationalRecord {
  id: string;
  entityId: string;              // FK to entity-governance.legal_entity
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
  version: number;
}
```

## Why

Entity scoping enables:
- **Cross-domain queries by entity**: "Show me everything for Entity X"
- **Entity-level compliance aggregation**: Roll up compliance status across all domains
- **Unified audit trails**: All actions traceable to an entity
- **Authorization boundaries**: Permissions tied to entity access

The foundational principle: **entities OWN operational records, not the other way around**.

## How

### Enforcement Points

1. **Database Schema**: All tables have `entity_id` column with FK to `legal_entities`
2. **API Validation**: Entity ID required in creation requests
3. **Query Scoping**: All list endpoints filter by entity ID
4. **Authorization**: Permissions checked at entity level

### Cross-Domain Data Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FOUNDATIONAL                                  │
│  ┌─────────────────┐                                                │
│  │  legal_entity   │◄──────────────────────────────────────────┐    │
│  │  (entity-gov)   │                                           │    │
│  └────────┬────────┘                                           │    │
└───────────┼────────────────────────────────────────────────────┼────┘
            │ entityId (FK)                                      │
┌───────────┼────────────────────────────────────────────────────┼────┐
│           │              OPERATIONAL                           │    │
│   ┌───────┴────────┬──────────────┬───────────────┐           │    │
│   ▼                ▼              ▼               ▼           │    │
│ ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌─────────────┐      │    │
│ │contracts │ │insurance │ │intellectual│ │data_privacy │      │    │
│ │          │ │_policies │ │_property   │ │_records     │      │    │
│ └────┬─────┘ └────┬─────┘ └─────┬──────┘ └──────┬──────┘      │    │
│      └────────────┴─────────────┴───────────────┘              │    │
│                          │                                     │    │
│                 ┌────────▼────────┐                            │    │
│                 │operational_audit│────────────────────────────┘    │
│                 └─────────────────┘                                 │
└─────────────────────────────────────────────────────────────────────┘
```

### Gateway Aggregation

The gateway uses entity scoping for unified views:

```typescript
// Single API call returns cross-domain data for one entity
GET /operational/entities/{entityId}/overview

{
  "entityId": "uuid",
  "domains": {
    "contracts-legal": { "activeCount": 12, "pendingCount": 3 },
    "insurance": { "activeCount": 5, "pendingCount": 1 },
    "intellectual-property": { "activeCount": 8, "pendingCount": 0 },
    "data-privacy": { "activeCount": 2, "pendingCount": 1 }
  }
}
```

## Where

- **ARCHITECTURE.md:17-38**: Pattern definition
- **Every domain's Prisma/Drizzle schema**: `entityId` field
- **Gateway aggregator**: Entity-based data fetching
- **Compliance aggregator**: Entity-level status rollup

## Connections

- [Document Lifecycle](02-document-lifecycle-states.md): Documents are entity-scoped
- [Compliance Integration](04-compliance-integration.md): Compliance rolled up by entity
- [Gateway Architecture](30-gateway-architecture.md): Entity-centric queries

## Open Questions

1. **Multi-entity records?** How do you handle a contract between two entities you manage?
2. **System-level records?** Are there any records NOT scoped to an entity?
3. **Entity deletion cascade?** What happens to operational records when entity is dissolved?
4. **Cross-entity queries?** How do you query across entities (e.g., all contracts for a holding company)?

## Edge Cases Discovered

During exploration, no explicit handling was found for:
- Joint ventures between entities
- Subsidiary rollup to parent entity
- Entity restructuring (mergers, acquisitions)
- Admin/superuser entity-agnostic views

---

*Understanding Level: DEEP*
*This is a universal, well-enforced pattern across all domains*
