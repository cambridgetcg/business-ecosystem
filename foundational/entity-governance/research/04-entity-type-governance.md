# Entity Type-Specific Governance Requirements

## Knowledge Gap Identified

Our model has entity types (corporation, LLC, LP, LLP, partnership, nonprofit, trust) but treats governance similarly across all types. Different entity types have radically different:
- Required governing documents
- Management structures
- Voting mechanisms
- Formality requirements
- Tax treatments

## Key Findings

### Governance Requirements by Entity Type

#### C-Corporation vs S-Corporation

**Legal Structure**: IDENTICAL (both are corporations)
**Difference**: TAX ELECTION under IRC Subchapter S

| Aspect | C-Corporation | S-Corporation |
|--------|---------------|---------------|
| **Tax Treatment** | Double taxation (corp + shareholder) | Pass-through (shareholder only) |
| **Shareholders** | Unlimited, any type | Max 100, US individuals/trusts only |
| **Share Classes** | Multiple classes allowed | Single class only (voting differences OK) |
| **Ownership** | Foreign owners OK | No foreign owners |
| **Formation** | State filing | State filing + IRS Form 2553 |

```
C-CORP TAXATION              S-CORP TAXATION
─────────────────            ─────────────────
Corp Income: $100,000        Corp Income: $100,000
Corp Tax (21%): -$21,000     Corp Tax: $0 (pass-through)
Net to Distribute: $79,000
                             ↓ Passes to shareholders
Dividend to Shareholder      Shareholder Income: $100,000
Tax (23.8%): -$18,800        Shareholder Tax: -$37,000*

Shareholder Keeps: $60,200   Shareholder Keeps: $63,000
─────────────────            ─────────────────
*Assuming 37% bracket
```

#### LLC (Limited Liability Company)

| Aspect | Member-Managed | Manager-Managed |
|--------|----------------|-----------------|
| **Governing Document** | Operating Agreement | Operating Agreement |
| **Decision Makers** | All Members | Designated Managers |
| **Who Can Bind LLC** | Any Member | Only Managers |
| **Best For** | Active owner-operators | Passive investors + active management |
| **Tax Default** | Partnership (multi) / Disregarded (single) | Same |

#### LP (Limited Partnership)

- **General Partner(s)**: Unlimited liability, manages partnership
- **Limited Partner(s)**: Limited liability, passive investors
- **Governing Document**: Partnership Agreement
- **Tax Treatment**: Pass-through (Form 1065)

```
LIMITED PARTNERSHIP STRUCTURE
─────────────────────────────
        ┌─────────────────┐
        │ General Partner │
        │ (Often an LLC)  │
        │ Manages LP      │
        │ Unlimited       │
        │ Liability       │
        └────────┬────────┘
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
┌───────────────┐ ┌───────────────┐
│   Limited     │ │   Limited     │
│   Partner A   │ │   Partner B   │
│   Passive     │ │   Passive     │
│   Investor    │ │   Investor    │
└───────────────┘ └───────────────┘
```

#### LLP (Limited Liability Partnership)

- **All Partners**: Limited liability for partnership debts
- **Partners**: Each partner liable for OWN negligence, not others'
- **Governing Document**: Partnership Agreement
- **Common Use**: Professional firms (lawyers, accountants, architects)
- **Tax Treatment**: Pass-through

#### Nonprofit Corporation

| Aspect | Nonprofit |
|--------|-----------|
| **Governing Document** | Bylaws + Articles of Incorporation |
| **Ownership** | NO owners/shareholders |
| **Governance** | Board of Directors |
| **Board Size** | Varies by state (often 3+ required) |
| **Distributions** | NONE (net assets to mission) |
| **Tax Status** | Must apply (Form 1023 for 501(c)(3)) |
| **Directors** | Fiduciary duties (care, loyalty, obedience) |

**Nonprofit Board Requirements** (vary by state):
- New Hampshire: Minimum 5 voting directors
- Most states: Minimum 1-3 directors
- Many states: At least 2 officers (President/Secretary often required)

#### Trust

Trusts are fundamentally different - not a separate legal entity in most contexts.

| Component | Role |
|-----------|------|
| **Grantor** | Creates and funds the trust |
| **Trustee** | Manages trust assets (fiduciary duty) |
| **Beneficiary** | Entitled to trust benefits |
| **Trust Agreement** | Governing document |

**Types of Trusts**:
- Revocable Living Trust - Grantor can modify/revoke
- Irrevocable Trust - Cannot be modified
- Business Trust - Used for business operations (less common)
- Statutory Trust - Created under state statute (e.g., Delaware Statutory Trust)

### Formality Requirements by Entity Type

| Entity Type | Annual Meeting Required | Written Minutes | Annual Report | Board Required |
|-------------|------------------------|-----------------|---------------|----------------|
| C-Corp | Yes | Yes | Yes | Yes |
| S-Corp | Yes | Yes | Yes | Yes |
| LLC | Generally No | Recommended | Varies by state | No (unless manager-managed) |
| LP | No | Recommended | Yes | No |
| LLP | No | Recommended | Yes | No |
| Nonprofit | Yes | Yes | Yes | Yes |
| Trust | No | Recommended | No | No |

### Voting Rights by Entity Type

| Entity Type | Default Voting | Customizable |
|-------------|---------------|--------------|
| Corporation | Per share | Yes (different classes) |
| LLC | Per membership interest or per capita | Highly customizable |
| LP | General partner controls | Limited partner consent for major decisions |
| LLP | Per partner or per capita | Yes |
| Nonprofit | Per director (no shareholders) | Board composition customizable |

## Model Implications

### Current Schema Gaps

1. **No entity-specific governance model** - Same `boards` table for all types
2. **No tax election tracking** - S-Corp status not captured
3. **No GP/LP distinction** - Partnership roles not differentiated
4. **No trust components** - No grantor/trustee/beneficiary model
5. **No formality requirements by type** - Can't generate correct checklists

### Recommended Extensions

```typescript
// Entity-specific governance configuration
export const entityGovernanceConfig = pgTable('entity_governance_config', {
  id: uuid('id').primaryKey(),
  entityId: uuid('entity_id').references(() => legalEntities.id),

  // For LLCs
  managementType: varchar('management_type'), // 'member_managed', 'manager_managed'
  operatingAgreementRequired: boolean('operating_agreement_required'),

  // For Partnerships
  generalPartnerId: uuid('general_partner_id'), // Reference to controlling entity/person

  // For Corporations
  hasSubchapterSElection: boolean('has_s_election'),
  sElectionEffectiveDate: timestamp('s_election_effective_date'),

  // For Nonprofits
  taxExemptStatus: varchar('tax_exempt_status'), // '501c3', '501c4', etc.
  minimumBoardSize: integer('minimum_board_size'),

  // Formality requirements (derived from type + jurisdiction)
  annualMeetingRequired: boolean('annual_meeting_required'),
  boardRequired: boolean('board_required'),

  // ... audit columns
});

// Partnership roles (GP vs LP)
export const partnershipRoles = pgTable('partnership_roles', {
  id: uuid('id').primaryKey(),
  entityId: uuid('entity_id').references(() => legalEntities.id),
  partnerId: uuid('partner_id'), // Person or entity
  roleType: varchar('role_type'), // 'general_partner', 'limited_partner'
  capitalContribution: integer('capital_contribution'),
  profitShare: integer('profit_share'), // basis points
  lossShare: integer('loss_share'), // basis points
  votingRights: boolean('voting_rights'),
  managementRights: boolean('management_rights'),
  effectiveDate: timestamp('effective_date'),
  // ... audit columns
});

// Trust structure
export const trustParties = pgTable('trust_parties', {
  id: uuid('id').primaryKey(),
  entityId: uuid('entity_id').references(() => legalEntities.id), // Trust entity
  partyId: uuid('party_id'), // Person or entity
  roleType: varchar('role_type'), // 'grantor', 'trustee', 'beneficiary', 'successor_trustee'
  isPrimary: boolean('is_primary'),
  beneficiaryInterest: integer('beneficiary_interest'), // basis points, if applicable
  effectiveDate: timestamp('effective_date'),
  // ... audit columns
});
```

## Why This Matters

1. **Compliance Correctness** - Different entities have different legal requirements
2. **User Experience** - System should guide users based on entity type
3. **Integration Accuracy** - Tax service needs to know S-Corp vs C-Corp
4. **Liability Implications** - GP has unlimited liability; this is critical information

## Entity Type Selection Guidance

| If You Need... | Consider |
|----------------|----------|
| Pass-through taxation + liability protection | LLC or S-Corp |
| Raise VC funding | C-Corp (Delaware) |
| Real estate holding | LLC or LP |
| Professional services firm | LLP |
| Charitable mission | Nonprofit 501(c)(3) |
| Estate planning | Trust |
| Passive investors + active management | LP or Manager-managed LLC |

## Questions for Further Research

1. How do we handle hybrid entities (e.g., LLC taxed as S-Corp)?
2. Should we auto-generate formality checklists based on entity type + jurisdiction?
3. How do we model nonprofit board committees with different requirements?
4. What happens when an entity converts from one type to another?
