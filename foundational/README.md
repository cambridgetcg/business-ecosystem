# Foundational Layer

Core business entities and regulatory infrastructure that form the **foundation** upon which all operational activities are built.

## Purpose

The `foundational/` directory contains domains that represent **what the business IS** — the fundamental structures, identities, and compliance frameworks that exist regardless of day-to-day activities:

1. **Legal Structure** — How the business is legally organized
2. **Financial Foundation** — Accounts, ledgers, and financial records
3. **Regulatory Compliance** — Requirements that must always be met
4. **Identity & Security** — Who can do what, and how we know

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         OPERATIONAL LAYER                                    │
│         (contracts, insurance, IP, privacy) - "What the business DOES"      │
│                                    │                                         │
│                                    │ References                              │
│                                    ▼                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                         FOUNDATIONAL LAYER                                   │
│                       "What the business IS"                                │
│                                                                              │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐    │
│  │   Entity    │   │  Accounting │   │   Banking   │   │    Tax      │    │
│  │ Governance  │   │             │   │  Treasury   │   │             │    │
│  │             │   │  (Python)   │   │             │   │             │    │
│  │ FOUNDATION  │◄──┤             │◄──┤             │◄──┤             │    │
│  │  OF ALL     │   │             │   │             │   │             │    │
│  └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘    │
│         ▲                                                                   │
│         │                                                                   │
│  ┌──────┴──────┐   ┌─────────────┐   ┌─────────────┐                       │
│  │ Compliance  │   │     KYC     │   │  Corporate  │                       │
│  │             │◄──┤  Identity   │◄──┤  Security   │                       │
│  └─────────────┘   └─────────────┘   └─────────────┘                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

         Foundational domains DO NOT depend on operational domains
         Operational domains DEPEND ON foundational domains
```

## Domains

| Domain | Purpose | Key Entities | Tech Stack |
|--------|---------|--------------|------------|
| **entity-governance** | Legal entity structure, corporate governance | LegalEntity, Board, Shareholder, Officer | TypeScript, Drizzle |
| **accounting** | Double-entry bookkeeping, financial reporting | Account, JournalEntry, Transaction, Ledger | Python, SQLAlchemy |
| **banking-treasury** | Bank accounts, payments, cash management | BankAccount, Payment, CashForecast | TypeScript, Drizzle |
| **compliance** | Regulatory requirements, audit findings | Policy, Requirement, Finding, Remediation | TypeScript, Drizzle |
| **tax** | Tax returns, provisions, compliance | TaxReturn, TaxLiability, TaxProvision | TypeScript, Drizzle |
| **kyc-identity** | Identity verification, risk assessment | Identity, KYCCheck, RiskScore | TypeScript, Drizzle |
| **corporate-security** | Security policies, access control | AccessPolicy, Incident, SecurityAudit | TypeScript, Drizzle |

## Domain Relationships

```
entity-governance ──────────────────────────────────────┐
       │                                                │
       │ Legal entities are the foundation              │
       │ All other domains reference entities           │
       ▼                                                │
┌──────────────┬──────────────┬──────────────┐         │
│  accounting  │   banking    │     tax      │         │
│              │   treasury   │              │         │
│ Financial    │ Cash mgmt    │ Tax          │         │
│ records for  │ for entity   │ compliance   │         │
│ entity       │              │ for entity   │         │
└──────────────┴──────────────┴──────────────┘         │
                      │                                 │
                      ▼                                 │
              ┌──────────────┐                         │
              │  compliance  │◄────────────────────────┘
              │              │
              │ Regulatory   │
              │ requirements │
              │ for all      │
              └──────────────┘
                      │
                      ▼
        ┌─────────────┴─────────────┐
        │                           │
┌───────▼──────┐           ┌───────▼──────┐
│ kyc-identity │           │  corporate   │
│              │           │  security    │
│ Who is this  │           │ Who can do   │
│ entity?      │           │ what?        │
└──────────────┘           └──────────────┘
```

## Key Characteristics

### 1. Entity-Centric

Every foundational domain ultimately relates to a **legal entity** from entity-governance:

```typescript
// All foundational records reference an entity
interface FoundationalRecord {
  entityId: string;  // References entity-governance.legal_entities.id
  // ...domain-specific fields
}
```

### 2. Stable Over Time

Foundational data changes infrequently compared to operational data:
- Entities are formed and dissolved (rare)
- Accounts are created and closed (infrequent)
- Compliance requirements change with regulations (periodic)

### 3. Source of Truth

Operational domains **reference** foundational data, never duplicate it:

```typescript
// CORRECT: Reference entity by ID
const contract = {
  entityId: 'uuid',  // Reference
  // ...contract fields
};

// WRONG: Don't duplicate entity data
const contract = {
  entityName: 'Acme Corp',  // Duplicated!
  entityJurisdiction: 'DE', // Duplicated!
};
```

### 4. Audit Everything

All foundational mutations generate audit entries:

```typescript
{
  action: 'entity.updated',
  entityType: 'LegalEntity',
  entityId: 'uuid',
  actor: 'user-uuid',
  timestamp: '2024-01-26T...',
  changes: {
    name: { from: 'Acme Corp', to: 'Acme Corporation' }
  }
}
```

## Service Ports

| Domain | Port | Health Endpoint |
|--------|------|-----------------|
| entity-governance | 3001 | `/health` |
| accounting | 3002 | `/health` |
| banking-treasury | 3003 | `/health` |
| compliance | 3004 | `/health` |
| tax | 3005 | `/health` |
| kyc-identity | 3006 | `/health` |
| corporate-security | 3007 | `/health` |

## Events Published

Foundational domains publish events consumed by operational domains:

| Domain | Events |
|--------|--------|
| entity-governance | `entity.created`, `entity.updated`, `entity.dissolved` |
| accounting | `account.created`, `journal_entry.posted`, `period.closed` |
| banking-treasury | `bank_account.opened`, `payment.completed`, `reconciliation.completed` |
| compliance | `requirement.added`, `finding.created`, `remediation.completed` |
| kyc-identity | `kyc.completed`, `risk_score.updated`, `identity.verified` |

## Development

### Running All Foundational Services

```bash
pnpm dev --filter='./foundational/**'
```

### Running Individual Services

```bash
pnpm dev --filter=entity-governance
pnpm dev --filter=accounting
pnpm dev --filter=banking-treasury
```

### Database Migrations

```bash
# TypeScript services (Drizzle)
pnpm --filter=entity-governance db:migrate

# Python services (Alembic)
cd foundational/accounting
alembic upgrade head
```

### Testing

```bash
# All foundational tests
pnpm test --filter='./foundational/**'

# Integration tests
pnpm test:integration --filter='./foundational/**'
```

## Adding New Foundational Domains

A domain belongs in `foundational/` if it:

1. **Represents business structure**, not activity
2. **Is referenced by** operational domains (never the reverse)
3. **Changes infrequently** (entity lifecycle, not transaction lifecycle)
4. **Is required for compliance** regardless of business activities
5. **Would exist** even if the business had no operations

### Checklist

- [ ] Define domain purpose and bounded context
- [ ] Identify relationship to entity-governance
- [ ] Map compliance requirements
- [ ] Define events published
- [ ] Follow [BACKBONE.md](../docs/BACKBONE.md) initialization
- [ ] Add to this README

## Related Documentation

- [docs/BACKBONE.md](../docs/BACKBONE.md) - Architecture and app initialization
- [docs/MISSION.md](../docs/MISSION.md) - Mission and guiding principles
- [operational/README.md](../operational/README.md) - Operational layer (depends on foundational)
- [shared/README.md](../shared/README.md) - Shared contracts and events
