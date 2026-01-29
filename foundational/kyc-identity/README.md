# KYC & Identity

Know Your Customer (KYC) and identity verification services for the business ecosystem.

## Purpose

The `kyc-identity` domain manages the verification and ongoing monitoring of identities associated with legal entities. This is a critical compliance function that ensures:

1. **Identity Verification** — Confirming individuals and entities are who they claim to be
2. **Risk Assessment** — Evaluating the risk level of relationships
3. **AML Compliance** — Anti-Money Laundering checks and monitoring
4. **Ongoing Due Diligence** — Continuous monitoring for changes in risk

## Domain Model

```
┌─────────────────────────────────────────────────────────────────┐
│                        KYC-IDENTITY                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐     │
│  │  Identity   │──────│  KYC Check  │──────│ Risk Score  │     │
│  │             │      │             │      │             │     │
│  │ - entityId  │      │ - type      │      │ - score     │     │
│  │ - type      │      │ - status    │      │ - factors   │     │
│  │ - documents │      │ - result    │      │ - tier      │     │
│  │ - verified  │      │ - findings  │      │ - reviewDue │     │
│  └─────────────┘      └─────────────┘      └─────────────┘     │
│         │                                                       │
│         │                                                       │
│  ┌──────▼──────┐      ┌─────────────┐      ┌─────────────┐     │
│  │  Document   │      │  Watchlist  │      │   Alert     │     │
│  │             │      │   Match     │      │             │     │
│  │ - type      │      │             │      │ - type      │     │
│  │ - status    │      │ - list      │      │ - severity  │     │
│  │ - verified  │      │ - matchType │      │ - status    │     │
│  └─────────────┘      └─────────────┘      └─────────────┘     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Key Entities

| Entity | Purpose |
|--------|---------|
| **Identity** | Represents an individual or entity requiring verification |
| **KYCCheck** | A verification check (document, sanctions, PEP, etc.) |
| **RiskScore** | Calculated risk assessment with contributing factors |
| **Document** | Identification documents (passport, license, etc.) |
| **WatchlistMatch** | Matches against sanctions/PEP lists |
| **Alert** | Risk events requiring review |

## KYC Check Types

| Type | Description | Frequency |
|------|-------------|-----------|
| `DOCUMENT_VERIFICATION` | ID document authenticity | Onboarding |
| `SANCTIONS_SCREENING` | Global sanctions lists | Continuous |
| `PEP_SCREENING` | Politically Exposed Persons | Continuous |
| `ADVERSE_MEDIA` | Negative news screening | Periodic |
| `PROOF_OF_ADDRESS` | Address verification | Onboarding |
| `BUSINESS_VERIFICATION` | Company registry checks | Onboarding |

## Risk Tiers

| Tier | Score Range | Review Frequency | Enhanced Due Diligence |
|------|-------------|------------------|------------------------|
| LOW | 0-25 | Annual | No |
| MEDIUM | 26-50 | Semi-annual | Optional |
| HIGH | 51-75 | Quarterly | Yes |
| CRITICAL | 76-100 | Monthly | Yes + Senior Review |

## Integration Points

### References (Foundational)

- **entity-governance**: All identities belong to a legal entity

### Referenced By (Operational)

- **contracts-legal**: Verify counterparty before contract execution
- **banking-treasury**: KYC required for bank account operations
- **compliance**: KYC findings feed into compliance status

### Events Published

```typescript
// Identity lifecycle
'identity.created'
'identity.verified'
'identity.verification_failed'
'identity.documents_updated'

// Risk events
'risk_score.calculated'
'risk_score.changed'
'risk_tier.escalated'
'risk_tier.deescalated'

// Alerts
'alert.created'
'alert.resolved'
'watchlist_match.found'
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/identities` | Create new identity for verification |
| GET | `/identities/:id` | Get identity details and status |
| POST | `/identities/:id/checks` | Initiate KYC check |
| GET | `/identities/:id/risk-score` | Get current risk assessment |
| GET | `/identities/:id/alerts` | Get active alerts |
| POST | `/identities/:id/documents` | Upload verification document |
| GET | `/entities/:entityId/identities` | All identities for entity |

## Compliance Requirements

| Regulation | Requirement | Implementation |
|------------|-------------|----------------|
| **AML Directives** | Customer due diligence | Identity verification, ongoing monitoring |
| **FATF** | Risk-based approach | Tiered risk scoring |
| **OFAC** | Sanctions screening | Continuous watchlist checks |
| **KYC Regulations** | Document verification | ID verification workflow |

## Configuration

```bash
# Environment variables
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kyc_identity
REDIS_URL=redis://localhost:6379

# Verification providers
VERIFICATION_PROVIDER=onfido|jumio|trulioo
VERIFICATION_API_KEY=xxx

# Sanctions lists
SANCTIONS_PROVIDER=dow_jones|refinitiv|comply_advantage
SANCTIONS_API_KEY=xxx

# Risk scoring
DEFAULT_REVIEW_PERIOD_DAYS=365
HIGH_RISK_THRESHOLD=50
CRITICAL_RISK_THRESHOLD=75
```

## Development

```bash
# Start service
pnpm dev --filter=kyc-identity

# Run migrations
pnpm --filter=kyc-identity db:migrate

# Run tests
pnpm test --filter=kyc-identity
```

## Related Documentation

- [foundational/README.md](../README.md) - Foundational layer overview
- [compliance/README.md](../compliance/README.md) - Compliance integration
- [entity-governance/README.md](../entity-governance/README.md) - Entity management
