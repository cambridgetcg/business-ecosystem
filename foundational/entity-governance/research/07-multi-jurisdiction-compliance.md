# Multi-Jurisdiction Compliance

## Knowledge Gap Identified

Our model tracks formation jurisdiction only. When an entity formed in Delaware operates in California, it must "foreign qualify" in California and comply with California's ongoing requirements. This creates a 1:N relationship between entities and jurisdictions that our current model doesn't capture.

## Key Findings

### Formation vs. Qualification

```
                         ENTITY
                           │
   Formation Jurisdiction: Delaware (Domestic)
   ├── Certificate of Incorporation filed
   ├── Delaware Registered Agent required
   ├── Delaware Annual Franchise Tax due
   └── "Home" state - entity legally exists here

   Foreign Qualifications: (Where entity "does business")
   ├── California (Foreign Corp)
   │   ├── Statement of Information filed
   │   ├── CA Registered Agent required
   │   └── CA $800 minimum franchise tax
   │
   ├── New York (Foreign Corp)
   │   ├── Application for Authority filed
   │   ├── NY Registered Agent required
   │   └── NY Biennial Statement due
   │
   └── Texas (Foreign Corp)
       ├── Application for Registration filed
       ├── TX Registered Agent required
       └── TX Franchise Tax (margin tax) due

        ONE ENTITY → MULTIPLE COMPLIANCE REGIMES
```

### "Doing Business" - What Triggers Foreign Qualification

**Generally REQUIRES Foreign Qualification**:
| Activity | Why It Triggers |
|----------|-----------------|
| Physical office or place of business | Permanent presence |
| Employees working in state | Employment relationship |
| Inventory or equipment stored | Tangible property |
| Sales staff soliciting orders | Regular commercial activity |
| Manufacturing or production | Core business operations |
| Owning real property | Direct state interest |

**Generally Does NOT Require Foreign Qualification**:
| Activity | Why It's Protected |
|----------|-------------------|
| Maintaining bank accounts | Financial convenience |
| Holding board meetings | Corporate governance |
| Isolated/occasional transactions | No regular course |
| Collecting debts | Incident to prior transactions |
| Conducting litigation | Court access rights |
| Interstate commerce only | Commerce Clause protection |
| Owning stock in a domestic corp | Passive investment |

### Tax Nexus vs. Foreign Qualification Nexus

**Critical Distinction**: These are SEPARATE concepts with DIFFERENT triggers.

```
FOREIGN QUALIFICATION NEXUS         │    TAX NEXUS
(Secretary of State concern)        │    (Dept of Revenue concern)
                                    │
Purpose: Legal authorization to     │    Purpose: State's right to
conduct business in state           │    tax income/transactions
                                    │
Threshold: Generally HIGHER         │    Threshold: Generally LOWER
(physical presence typically req'd) │    (economic presence sufficient)
                                    │
Triggers:                           │    Triggers:
• Physical office                   │    • Physical presence
• Employees present                 │    • Economic presence
• Inventory stored                  │    • Sales into state
• Property owned                    │    • Employees (even remote)
                                    │    • Payroll
Post-Wayfair (2018):                │    • Factor presence tests
Qualification not affected          │    • Market-based sourcing
                                    │
You can have TAX NEXUS without      │
QUALIFICATION NEXUS                 │
```

**Wayfair Impact (2018)**: States can impose sales tax collection based purely on economic presence (sales volume), WITHOUT physical presence. This does NOT automatically trigger foreign qualification.

### Foreign Qualification Process

```
1. PREPARE APPLICATION
   ├── Entity name (may need assumed name if taken)
   ├── Formation jurisdiction and date
   ├── Principal office address
   ├── Registered agent name and address
   ├── Officers/directors (if required)
   └── Certificate of Good Standing from formation state

2. FILE WITH SECRETARY OF STATE
   ├── Application for Authority (or similar form)
   ├── Filing fee ($100-1,000 varies by state)
   ├── Certified copy of charter documents (some states)
   └── Additional state-specific requirements

3. ONGOING COMPLIANCE BEGINS
   ├── Annual/biennial report requirements
   ├── Franchise tax obligations
   ├── Registered agent maintenance
   ├── Change reporting (address, officers, etc.)
   └── State-specific filings
```

### Annual Reports and Franchise Taxes by State

| State | Annual Report | Filing Fee | Franchise Tax Notes |
|-------|--------------|------------|---------------------|
| **Delaware** | Annual Franchise Tax Report | $300 (LLC), $225+ (Corp) | Based on authorized shares or assumed par value |
| **California** | Statement of Info (annual Corp, biennial LLC) | $25 (Corp), $20 (LLC) | $800 minimum + income tax |
| **New York** | Biennial Statement | $9 | No franchise tax, income tax based on apportionment |
| **Texas** | Annual Franchise Tax Report | $0 | Margin-based, >$1.23M threshold |
| **Nevada** | Annual List of Officers | $150 | No corporate income tax |
| **Florida** | Annual Report | $138.75 | Corporate income tax |
| **Wyoming** | Annual Report | $50 minimum | No state income tax |

**Due Date Patterns**:
- Formation anniversary date (CA, TX, FL)
- Calendar year end (DE for franchise tax)
- Fiscal year end (varies)
- Specific month (varies by state)

### Penalties for Doing Business Without Qualification

```
1. DENIAL OF COURT ACCESS
   ├── Cannot bring lawsuits in state courts
   ├── May be able to defend (sued) without qualification
   ├── Usually curable by qualifying before judgment
   └── MOST COMMON and MOST IMPACTFUL penalty

2. MONETARY PENALTIES
   ├── Fines: $100 - $1,000+ per year unqualified
   ├── Back fees: All years of fees as if qualified
   ├── Interest: On unpaid fees and taxes
   └── Varies significantly by state

3. PERSONAL LIABILITY
   ├── Officers/directors may become personally liable
   ├── Loss of corporate shield protection
   └── Rare but serious consequence

4. CONTRACT UNENFORCEABILITY
   ├── Contracts may be voidable
   ├── State-specific rules vary widely
   └── Usually curable by qualifying

5. TAX CONSEQUENCES
   ├── Back taxes with penalties and interest
   ├── Denial of deductions
   └── Audit triggers
```

**Cure Process**: Most penalties can be cured by:
1. Filing for foreign qualification
2. Paying all back fees and penalties
3. Coming current with tax obligations
4. Maintaining ongoing compliance

### Holding Company Considerations

```
              ┌─────────────────────┐
              │  PARENT HOLDCO      │
              │  (Delaware Corp)    │
              │                     │
              │  Activities:        │
              │  • Owns subsidiaries│
              │  • Receives dividends
              │  • No operations    │
              │                     │
              │  Qualification:     │
              │  LIKELY NOT NEEDED  │
              │  in subsidiary states
              └──────────┬──────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
  ┌────────────┐  ┌────────────┐  ┌────────────┐
  │ OPCO - CA  │  │ OPCO - NY  │  │ OPCO - TX  │
  │ (DE Corp)  │  │ (DE Corp)  │  │ (DE Corp)  │
  │            │  │            │  │            │
  │ Qualified: │  │ Qualified: │  │ Qualified: │
  │ California │  │ New York   │  │ Texas      │
  └────────────┘  └────────────┘  └────────────┘
```

**Key Points**:
1. **Passive Holding Companies** generally do NOT need foreign qualification where subsidiaries operate
2. **Active Holding Companies** that manage subsidiaries or provide services MAY need qualification
3. **Tax Planning**: Holding company location affects state tax apportionment, combined reporting

## Model Implications

### Current Schema Gap

```sql
-- CURRENT: Only tracks formation jurisdiction
legal_entities (
  jurisdiction_country VARCHAR(2),   -- Formation country
  jurisdiction_state VARCHAR(100)    -- Formation state
)

-- MISSING: Foreign qualifications tracking
```

### Recommended Schema Extension

```typescript
// Foreign Qualifications - Where entity is authorized to do business
export const foreignQualifications = pgTable('foreign_qualifications', {
  id: uuid('id').primaryKey(),
  entityId: uuid('entity_id').references(() => legalEntities.id),
  jurisdictionCountry: varchar('jurisdiction_country', { length: 2 }),
  jurisdictionState: varchar('jurisdiction_state', { length: 100 }),
  qualificationType: varchar('qualification_type'), // 'foreign_corp', 'foreign_llc'
  status: varchar('status'), // 'pending', 'active', 'withdrawn', 'revoked', 'suspended'
  qualificationDate: timestamp('qualification_date'),
  effectiveDate: timestamp('effective_date'),
  registrationNumber: varchar('registration_number'),
  assumedName: varchar('assumed_name'), // If different from legal name
  withdrawalDate: timestamp('withdrawal_date'),
  // ... audit columns
});

// Per-qualification registered agent
export const qualificationRegisteredAgents = pgTable('qualification_registered_agents', {
  id: uuid('id').primaryKey(),
  qualificationId: uuid('qualification_id').references(() => foreignQualifications.id),
  agentName: varchar('agent_name'),
  agentType: varchar('agent_type'),
  address: jsonb('address'),
  effectiveDate: timestamp('effective_date'),
  endDate: timestamp('end_date'),
  // ... audit columns
});

// Per-qualification filing requirements
export const qualificationFilingRequirements = pgTable('qualification_filing_requirements', {
  id: uuid('id').primaryKey(),
  qualificationId: uuid('qualification_id').references(() => foreignQualifications.id),
  filingType: varchar('filing_type'), // 'annual_report', 'statement_of_information'
  frequency: varchar('frequency'), // 'annual', 'biennial'
  dueDateRule: jsonb('due_date_rule'),
  fee: integer('fee'),
  stateFormNumber: varchar('state_form_number'),
  // ... audit columns
});
```

### Events to Publish

```typescript
export const QualificationEventTypes = {
  FOREIGN_QUALIFICATION_FILED: 'entity-governance.qualification.filed',
  FOREIGN_QUALIFICATION_APPROVED: 'entity-governance.qualification.approved',
  FOREIGN_QUALIFICATION_SUSPENDED: 'entity-governance.qualification.suspended',
  FOREIGN_QUALIFICATION_WITHDRAWN: 'entity-governance.qualification.withdrawn',
  QUALIFICATION_FILING_DUE: 'entity-governance.qualification.filing-due',
  QUALIFICATION_FILING_OVERDUE: 'entity-governance.qualification.filing-overdue',
} as const;
```

## Why This Matters

1. **Court access** - Can't sue in state courts without qualification
2. **Penalty avoidance** - Fines and back fees accumulate
3. **Filing calendar** - Each qualification has its own deadlines
4. **Registered agent management** - Need one per qualified state
5. **Tax compliance** - Qualification often triggers tax obligations
6. **Good standing** - Required for many business transactions

## Questions for Further Research

1. How do we track tax nexus separately from qualification nexus?
2. Should we auto-detect qualification requirements based on employee locations?
3. How do we handle withdrawal when ceasing business in a state?
4. What triggers should prompt qualification analysis?
