# Shared Contracts - Purpose

## Purpose

**To define the type-safe language that domains use to communicate** — ensuring consistent data structures across service boundaries without creating direct dependencies.

---

## What This Module Does

The `shared/contracts` module provides:

1. **Cross-domain type definitions** — Shared interfaces for entities, financial data, documents
2. **Validation schemas** — Zod schemas for runtime validation
3. **API contracts** — Request/response shapes for service communication
4. **Common enums** — Shared enumeration types (statuses, categories)

---

## Why This Exists

Without shared contracts:
- Each service defines its own version of common types
- Data transformation required at every boundary
- Type mismatches discovered at runtime
- Breaking changes propagate unpredictably

With shared contracts:
- Single source of truth for cross-domain types
- Type checking at compile time
- Consistent serialization/deserialization
- Controlled contract evolution with versioning

---

## Contract Categories

| Package | Purpose | Examples |
|---------|---------|----------|
| `contracts-entity` | Legal entity structures | `LegalEntity`, `EntityType`, `Jurisdiction` |
| `contracts-financial` | Financial data | `Money`, `Currency`, `Amount` |
| `contracts-identity` | Identity/KYC data | `VerificationStatus`, `RiskTier` |
| `contracts-document` | Document metadata | `DocumentStatus`, `DocumentType` |
| `contracts-audit` | Audit trail | `AuditEntry`, `AuditAction` |

---

## Usage

```typescript
import { LegalEntity, EntityType } from '@ecosystem/contracts-entity';
import { Money, Currency } from '@ecosystem/contracts-financial';

function processPayment(entity: LegalEntity, amount: Money): void {
  // Type-safe operations
}
```

---

## Key Principles

1. **No business logic** — Contracts define shape, not behavior
2. **Stable interfaces** — Breaking changes require versioning
3. **Validation included** — Every type has a corresponding Zod schema
4. **Documentation inline** — JSDoc comments explain usage

---

## Contract Evolution

When contracts need to change:
1. Add new optional fields (non-breaking)
2. Create v2 types for breaking changes
3. Deprecate old types with timeline
4. Coordinate migration across services

---

*This module establishes the shared vocabulary for ecosystem communication.*
