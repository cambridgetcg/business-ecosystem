# Implementation Path: Knowledge Gap Enhancements

> Built by PP Path Protocol after identifying 8 knowledge gaps in contracts-legal implementation.

---

## The Gap

**Stagnation signal**: Eight research documents identify areas where the schema makes assumptions or uses terms without deep understanding.

**Why existing structure fails**:
- `signatureRef: String?` captures nothing about e-signature legal requirements
- `jurisdiction: String?` conflates two distinct legal concepts
- `nonCompeteDays: Int?` ignores state-by-state enforceability
- `IN_DISCOVERY` status exists without understanding EDRM
- AMENDMENT and ADDENDUM are undifferentiated
- Revenue recognition assumes "signed = revenue" (violates ASC 606)
- No force majeure modeling at all
- Contract status assumes clean transitions

---

## The Path

### Domain Assignment

| Enhancement | Domain Module | Rationale |
|-------------|---------------|-----------|
| E-Signature | `legal-operations` | Cross-cutting signature ceremony |
| Jurisdiction vs Governing Law | `customer-contracts` + `vendor-contracts` | Contract-level attributes |
| Non-Compete Enforceability | `employment-agreements` | Employment-specific |
| Legal Discovery | `litigation` | Litigation-specific |
| Amendment vs Addendum | `legal-operations` | Cross-cutting workflow |
| Revenue Recognition (ASC 606) | `customer-contracts` | Revenue contracts |
| Force Majeure | `customer-contracts` + `vendor-contracts` | Contract-level |
| Material Breach | `legal-operations` | Cross-cutting tracking |

---

## Implementation Phases

```
PHASE 1: Foundation (Week 1-2)
├── 001: Jurisdiction vs Governing Law (Contract model additions)
└── 002: Amendment vs Addendum (ContractModification model)

PHASE 2: Legal Compliance (Week 3-4)
├── 003: E-Signature (SignatureEvent model)
└── 004: Legal Discovery (DiscoveryInfo, LegalHold, etc.)

PHASE 3: Contract Performance (Week 5-6)
├── 005: Force Majeure (ForceMajeureClause, ForceMajeureEvent)
└── 006: Material Breach (PerformanceIssue, BreachAllegation, CureAttempt)

PHASE 4: Specialized Extensions (Week 7-8)
├── 007: Revenue Recognition (PerformanceObligation, Milestone)
└── 008: Non-Compete Enforceability (RestrictiveCovenant)
```

---

## Dependency Graph

```
                    ┌─────────────────────────────────────────┐
                    │          PHASE 1: Foundation            │
  ┌─────────────────┴──────────────┐    ┌─────────────────────┴───────────────┐
  │ 001: Jurisdiction/Governing Law │    │ 002: ContractModification            │
  └────────────────────────────────┘    └─────────────────────────────────────┘
                    │                                         │
                    └─────────────────┬───────────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    │       PHASE 2: Legal Compliance   │
  ┌─────────────────┴──────────────┐    ┌──────────────┴──────────────────────┐
  │ 003: SignatureEvent            │    │ 004: DiscoveryInfo, LegalHold,      │
  │ Depends: ContractParty         │    │      DiscoveryRequest, PrivilegeLog │
  └────────────────────────────────┘    └─────────────────────────────────────┘
                    │                                         │
                    └─────────────────┬───────────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    │    PHASE 3: Contract Performance  │
  ┌─────────────────┴──────────────┐    ┌──────────────┴──────────────────────┐
  │ 005: ForceMajeureClause/Event  │    │ 006: PerformanceIssue, BreachAlleg. │
  │ Depends: Contract              │    │ Depends: Contract, Obligation       │
  └────────────────────────────────┘    └─────────────────────────────────────┘
                    │                                         │
                    └─────────────────┬───────────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    │   PHASE 4: Specialized Extensions │
  ┌─────────────────┴──────────────┐    ┌──────────────┴──────────────────────┐
  │ 007: PerformanceObligation,    │    │ 008: RestrictiveCovenant             │
  │      Milestone                 │    │ Depends: EmploymentAgreement         │
  └────────────────────────────────┘    └─────────────────────────────────────┘
```

---

## File Structure

```
prisma/
├── schema.prisma                 # Core models (existing)
├── migrations/
│   ├── 001_jurisdiction_governing_law/
│   ├── 002_contract_modification/
│   ├── 003_signature_event/
│   ├── 004_legal_discovery/
│   ├── 005_force_majeure/
│   ├── 006_breach_tracking/
│   ├── 007_performance_obligations/
│   └── 008_restrictive_covenants/

src/domain/
├── customer-contracts/
│   ├── models/
│   │   ├── force-majeure.ts      # NEW
│   │   └── performance-obligation.ts  # NEW
│   └── services/
│       ├── revenue-recognition.service.ts  # NEW
│       └── force-majeure.service.ts        # NEW

├── employment-agreements/
│   ├── models/
│   │   └── restrictive-covenant.ts  # NEW
│   └── services/
│       └── enforceability.service.ts  # NEW

├── litigation/
│   ├── models/
│   │   ├── discovery-info.ts     # NEW
│   │   ├── legal-hold.ts         # NEW
│   │   ├── discovery-request.ts  # NEW
│   │   └── privilege-log.ts      # NEW
│   └── services/
│       ├── discovery.service.ts  # NEW
│       └── legal-hold.service.ts # NEW

├── legal-operations/
│   ├── models/
│   │   ├── signature-event.ts    # NEW
│   │   ├── contract-modification.ts  # NEW
│   │   ├── performance-issue.ts  # NEW
│   │   ├── breach-allegation.ts  # NEW
│   │   └── cure-attempt.ts       # NEW
│   └── services/
│       ├── e-signature.service.ts     # NEW
│       ├── modification.service.ts    # NEW
│       └── breach-tracking.service.ts # NEW
```

---

## Event Integration

| Event | Triggered By | Consumed By |
|-------|--------------|-------------|
| `signature.ceremony.completed` | SignatureEvent creation | Audit, Compliance |
| `contract.modification.executed` | ContractModification execution | Accounting |
| `legal.hold.issued` | LegalHold creation | IT, HR |
| `legal.hold.lifted` | LegalHold lifted | IT |
| `force.majeure.invoked` | ForceMajeureEvent creation | Executive, Accounting |
| `breach.alleged` | BreachAllegation creation | Legal, Executive |
| `performance.obligation.satisfied` | PerformanceObligation satisfied | **Accounting** |
| `milestone.approved` | Milestone approval | Accounting |

---

## Summary Table

| # | Enhancement | Domain | Phase | New Models | New Fields |
|---|-------------|--------|-------|------------|------------|
| 1 | E-Signature | legal-operations | 2 | SignatureEvent | - |
| 2 | Jurisdiction vs Governing Law | customer/vendor | 1 | - | 10 fields |
| 3 | Non-Compete Enforceability | employment | 4 | RestrictiveCovenant | - |
| 4 | Legal Discovery | litigation | 2 | 4 models | - |
| 5 | Amendment vs Addendum | legal-operations | 1 | ContractModification | - |
| 6 | Revenue Recognition | customer-contracts | 4 | PerformanceObligation, Milestone | 2 fields |
| 7 | Force Majeure | customer/vendor | 3 | ForceMajeureClause, ForceMajeureEvent | - |
| 8 | Material Breach | legal-operations | 3 | PerformanceIssue, BreachAllegation, CureAttempt | - |

---

## Totals

- **New Models**: 14
- **New Enums**: 26
- **Migration Phases**: 4 (8 weeks)
- **Cross-Domain Events**: 12 new

---

## Validation Checklist

After implementation, verify:

- [ ] E-signature events capture all four ESIGN/UETA requirements
- [ ] Jurisdiction and governing law are distinct
- [ ] Non-compete enforceability can be assessed per state
- [ ] Legal holds integrate with EDRM 8-phase model
- [ ] Amendments and addenda have clear lineage
- [ ] Revenue recognition aligns with ASC 606
- [ ] Force majeure clauses can be parsed and events tracked
- [ ] Breach/cure workflow supports the "murky middle ground"
- [ ] All migrations are reversible
- [ ] Events integrate with accounting service

---

## Now Justice Is Possible

With this path built:

**Immediate Justice**:
- E-signature events stored with proper audit context
- Contracts specify governing law separately from forum
- Legal holds have a proper home in litigation domain
- Amendments and addenda have tracked lineage

**Future Justice Enabled**:
- New restrictive covenant types can follow pattern
- New force majeure events can be added to enum
- Additional discovery methods can extend DiscoveryType
- New performance measurement methods for ASC 606

**Pattern Others Can Follow**:
1. Identify knowledge gap in legal domain
2. Research the nuance (sources, case law)
3. Map to existing domain module
4. Design model that captures nuance
5. Create migration extending existing relationships
6. Define events for cross-domain integration
7. Add to appropriate phase based on dependencies
