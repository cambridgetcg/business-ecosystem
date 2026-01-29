# Domain Modeling Dimension

Understanding of domain-driven design patterns, entity modeling, and business logic organization across the operational ecosystem.

---

## Overview

The operational ecosystem applies Domain-Driven Design (DDD) principles with varying degrees of purity across domains. Some domains implement full aggregate patterns while others use simpler service-repository layers.

---

## Aggregate Design

### Understanding Level: [D] Deep

**IP Domain - Full Aggregate Pattern**:

```typescript
// Aggregate Root with domain behavior
class Patent extends AggregateRoot {
  private events: DomainEvent[] = [];

  // Factory method for new patents
  static create(props: CreatePatentProps): Patent {
    const patent = new Patent({
      id: generateId(),
      status: 'draft',
      ...props,
    });
    patent.addEvent(new PatentCreatedEvent(patent));
    return patent;
  }

  // Reconstitute from persistence
  static reconstitute(data: PatentData): Patent {
    return new Patent(data);
  }

  // Domain operations encapsulate business rules
  file(applicationNumber: string, filingDate: Date): void {
    if (!['draft', 'provisional'].includes(this.status)) {
      throw new InvalidStateError('Can only file draft or provisional patents');
    }
    this.applicationNumber = applicationNumber;
    this.filingDate = filingDate;
    this.status = 'pending';
    this.addEvent(new PatentFiledEvent(this));
  }

  grant(patentNumber: string, grantDate: Date): void {
    if (!['pending', 'published'].includes(this.status)) {
      throw new InvalidStateError('Can only grant pending or published patents');
    }
    this.patentNumber = patentNumber;
    this.grantDate = grantDate;
    this.status = 'granted';
    this.addEvent(new PatentGrantedEvent(this));
  }

  // Events pulled after save
  pullDomainEvents(): DomainEvent[] {
    const events = [...this.events];
    this.events = [];
    return events;
  }
}
```

**Contracts-Legal - Service-Repository Pattern**:

```typescript
// Service contains business logic
class ContractService {
  constructor(private repo: ContractRepository) {}

  async signContract(contractId: string, partyId: string, signature: SignatureData) {
    const contract = await this.repo.findById(contractId);
    if (!contract) throw new NotFoundError('Contract');
    if (contract.status !== 'PENDING_SIGNATURE') {
      throw new ContractStatusError('Contract must be pending signature');
    }

    // Update party signature
    await this.repo.updatePartySignature(contractId, partyId, signature);

    // Check if all parties signed
    const allSigned = await this.repo.areAllPartiesSigned(contractId);
    if (allSigned) {
      await this.repo.updateStatus(contractId, 'ACTIVE');
      await this.eventPublisher.publish({ type: 'contract.signed', ... });
    }
  }
}
```

---

## Entity Lifecycle States

### Understanding Level: [D] Deep

**Document Lifecycle (Shared Pattern)**:
```
┌─────────┐
│  DRAFT  │
└────┬────┘
     │ submit
     ▼
┌──────────────────────┐
│   PENDING_REVIEW     │
└──────────┬───────────┘
      approve │ reject
  ┌──────────┴──────────┐
  ▼                     ▼
┌──────────┐      ┌──────────┐
│ APPROVED │      │ REJECTED │ ─────► DRAFT
└────┬─────┘      └──────────┘
     │ execute
     ▼
┌──────────┐
│  ACTIVE  │
└────┬─────┘
     │ expire/terminate
┌────┴─────┐
▼          ▼
EXPIRED    TERMINATED
```

**Contract-Specific States**:
```
DRAFT → PENDING_REVIEW → IN_NEGOTIATION → PENDING_APPROVAL
    → PENDING_SIGNATURE → ACTIVE → SUSPENDED/EXPIRED/TERMINATED/RENEWED/ARCHIVED
```

**Patent States**:
```
draft → provisional → pending → published → granted → abandoned/expired/lapsed
```

**Trademark States**:
```
draft → pending → published → opposed → registered → cancelled/expired/abandoned
```

**License States**:
```
draft → active → suspended → terminated/expired
```

---

## Bounded Contexts

### Understanding Level: [S] Solid

**Contracts-Legal Subdomains**:
| Context | Responsibility | Key Entities |
|---------|----------------|--------------|
| customer-contracts | Revenue agreements | Contract, Party, Obligation |
| vendor-contracts | Procurement | Contract, Vendor |
| employment-agreements | HR contracts | EmploymentAgreement |
| contract-templates | Reusable formats | ContractTemplate, TemplateClause |
| litigation | Legal disputes | LegalMatter, MatterActivity |
| real-estate | Property management | Property, Lease |
| legal-operations | Cross-cutting | AuditLog, Notification |

**IP Subdomains**:
| Context | Responsibility | Key Entities |
|---------|----------------|--------------|
| patents | Patent portfolio | Patent, Claim, Inventor |
| trademarks | Brand protection | Trademark, NiceClass |
| copyrights | Creative works | Copyright, Author |
| licensing | IP monetization | License, RoyaltyTerms |
| trade-secrets | (Missing!) | TradeSecret, AccessLog |

**Insurance Subdomains**:
| Context | Responsibility | Key Entities |
|---------|----------------|--------------|
| policy-management | Policy tracking | Policy, Coverage, Endorsement |
| claims-management | Claim lifecycle | Claim, Reserve, Settlement |
| general-liability | GL coverage | GLPolicy, COI |
| professional-liability | E&O, D&O | ProfessionalPolicy |
| property-insurance | Assets, BI | PropertyPolicy |
| workers-compensation | Employee coverage | WCPolicy, ClassCode |
| cyber-insurance | Data breach | CyberPolicy |
| product-liability | Product defects | ProductPolicy |

**Data-Privacy Subdomains** (Planned):
| Context | Responsibility | Key Entities |
|---------|----------------|--------------|
| consent-management | Consent tracking | ConsentRecord |
| data-subject-rights | DSAR handling | DSARRequest |
| breach-management | Incident response | DataBreach |
| privacy-impact | Risk assessment | DPIA |
| data-inventory | Data mapping | ProcessingActivity |
| cross-border-transfer | International | TransferRecord |
| vendor-privacy | Third-party | VendorAssessment |

---

## Value Objects

### Understanding Level: [S] Solid

**Territory (License)**:
```typescript
interface Territory {
  includedCountries: string[];
  excludedCountries: string[];
  worldwide: boolean;
}
```

**RoyaltyTerms (License)**:
```typescript
interface RoyaltyTerms {
  type: 'percentage' | 'fixed' | 'tiered' | 'minimum_guarantee';
  rate?: number;
  fixedAmount?: number;
  minimumAnnual?: number;
  paymentFrequency: 'monthly' | 'quarterly' | 'annually';
  currency: string;
}
```

**Author (Copyright)**:
```typescript
interface Author {
  name: string;
  contribution: string;
  isWorkForHire: boolean;
  nationality: string;
}
```

**Party Role**:
```typescript
type PartyRole =
  | 'BUYER' | 'SELLER'
  | 'EMPLOYER' | 'EMPLOYEE'
  | 'LANDLORD' | 'TENANT'
  | 'LICENSOR' | 'LICENSEE';
```

---

## Entity Relationships

### Understanding Level: [S] Solid

**Contract Relationships**:
```
Contract
    │
    ├──► ContractParty[] (join with Party)
    │         └──► Party (external entity reference)
    │
    ├──► Obligation[]
    │         └──► reminder schedule
    │
    ├──► Document[]
    │         └──► S3 storage reference
    │
    ├──► ContractVersion[]
    │         └──► snapshot at each change
    │
    └──► ContractActivity[]
              └──► audit trail
```

**License Relationships**:
```
License
    │
    ├──► IP Asset (patent, trademark, etc.)
    │
    ├──► Licensor (entity reference)
    │
    ├──► Licensee (entity reference)
    │
    ├──► Parent License (for sublicenses)
    │
    └──► Territory, RoyaltyTerms (value objects)
```

---

## Domain Events

### Understanding Level: [S] Solid

**Event Design Pattern**:
```typescript
interface DomainEvent {
  eventId: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  occurredAt: Date;
  payload: Record<string, unknown>;
  metadata: {
    correlationId: string;
    causationId?: string;
    userId?: string;
  };
}
```

**Event Examples**:

| Domain | Event | Trigger | Consumers |
|--------|-------|---------|-----------|
| contracts-legal | contract.created | New contract | Insurance (coverage check) |
| contracts-legal | contract.signed | All parties sign | Accounting (revenue) |
| contracts-legal | contract.expiring | 30 days before | Workflow (renewal) |
| IP | patent.filed | Application filed | Compliance (deadline) |
| IP | patent.granted | Patent granted | Accounting (capitalize) |
| IP | trademark.registered | Registration complete | Entity Governance |
| IP | license.activated | License starts | Contracts-Legal |
| insurance | policy.renewed | Policy renewed | Compliance |
| insurance | claim.filed | New claim | Contracts (check indemnity) |
| privacy | consent.granted | User consents | Processing activities |
| privacy | breach.detected | Breach found | Insurance (cyber claim) |

---

## Validation Patterns

### Understanding Level: [S] Solid

**Zod Schema Validation**:
```typescript
const CreateContractSchema = z.object({
  type: ContractTypeEnum,
  entityId: z.string().uuid(),
  parties: z.array(PartySchema).min(2),
  effectiveDate: z.date(),
  expiryDate: z.date(),
  value: z.number().positive().optional(),
  currency: z.string().length(3).default('USD'),
}).refine(
  (data) => data.expiryDate > data.effectiveDate,
  { message: 'Expiry date must be after effective date' }
);
```

**Business Rule Validation**:
```typescript
// In service layer
if (contract.status !== 'DRAFT' && contract.status !== 'PENDING_REVIEW') {
  throw new BusinessRuleError('Can only modify draft or pending contracts');
}

if (existingAgreement && existingAgreement.status === 'ACTIVE') {
  throw new ConflictError('Employee already has active agreement');
}
```

---

## Persistence Mapping

### Understanding Level: [S] Solid

**Domain ↔ Persistence Mapping**:
```typescript
// Repository handles mapping
class DrizzlePatentRepository implements PatentRepository {
  async save(patent: Patent): Promise<void> {
    const data = this.toPersistence(patent);
    await db.insert(patents)
      .values(data)
      .onConflictDoUpdate({ target: patents.id, set: data });
  }

  async findById(id: string): Promise<Patent | null> {
    const row = await db.query.patents.findFirst({
      where: eq(patents.id, id)
    });
    return row ? this.toDomain(row) : null;
  }

  private toDomain(row: PatentRow): Patent {
    return Patent.reconstitute({
      id: row.id,
      status: row.status,
      // Dates reconstructed from timestamps
      filingDate: row.filingDate ? new Date(row.filingDate) : undefined,
      // JSONB parsed to typed arrays
      inventors: row.inventors as Inventor[],
    });
  }

  private toPersistence(patent: Patent): PatentInsert {
    return {
      id: patent.id,
      status: patent.status,
      inventors: patent.inventors, // Stored as JSONB
    };
  }
}
```

---

## Missing Domain Models (Gaps)

### Understanding Level: [S] Solid

**Identified Gaps from Research**:

| Domain | Missing Model | Why Needed |
|--------|---------------|------------|
| contracts-legal | SignatureEvent | E-signature legal requirements |
| contracts-legal | RestrictiveCovenant | Non-compete enforceability |
| contracts-legal | LegalHold | Discovery process |
| contracts-legal | ContractModification | Amendment vs addendum |
| contracts-legal | PerformanceObligation | ASC 606 revenue |
| contracts-legal | ForceMajeure | Force majeure tracking |
| contracts-legal | BreachAllegation | Breach/cure tracking |
| IP | PatentFamily | Continuation relationships |
| IP | MaintenanceFee | Fee tracking |
| IP | TradeSecret | **CRITICAL** - entire entity missing |
| IP | MadridRegistration | International trademarks |

---

## Key Domain Modeling Insights

1. **Aggregates protect invariants** - Business rules enforced at aggregate boundary
2. **Events capture intent** - "What happened" not "what changed"
3. **Soft deletes universal** - Legal defensibility requires history
4. **Status machines are central** - Lifecycle transitions are core business logic
5. **JSONB for flexibility** - Complex nested data without schema migrations
6. **Validation at boundaries** - Zod at API, business rules in domain
7. **Repository abstracts persistence** - Domain doesn't know about database
