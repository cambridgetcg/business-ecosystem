# Multi-Entity Transaction Patterns

**Research Date**: 2026-01-26  
**Knowledge Gap**: How to handle transactions spanning multiple legal entities in entity-centric architecture

---

## Overview

The business ecosystem architecture is entity-centric—every operational record belongs to a legal entity. But real business operations often span multiple entities:
- Inter-company transactions (parent ↔ subsidiary)
- Shared contracts (multiple parties from same corporate group)
- Consolidated compliance reporting
- Transfer pricing across jurisdictions

---

## The Challenge

```
┌─────────────────────────────────────────────────────────────┐
│           CURRENT ENTITY-CENTRIC MODEL                       │
│                                                              │
│  Entity A                         Entity B                   │
│  ┌─────────────┐                 ┌─────────────┐            │
│  │ Contract X  │ ←── Related ──► │ Contract Y  │            │
│  │ (entityId=A)│                 │ (entityId=B)│            │
│  └─────────────┘                 └─────────────┘            │
│                                                              │
│  Problem: How do we represent the RELATIONSHIP?             │
│  Problem: How do we reconcile inter-company transactions?   │
│  Problem: How do we consolidate for reporting?              │
└─────────────────────────────────────────────────────────────┘
```

---

## Inter-Company Transaction Types

| Type | Example | Accounting Impact |
|------|---------|-------------------|
| **Revenue/Cost** | Subsidiary provides services to parent | Eliminate on consolidation |
| **Asset Transfer** | Equipment transferred between entities | Eliminate unrealized gains |
| **Loans** | Parent loans funds to subsidiary | Eliminate intercompany debt |
| **Dividends** | Subsidiary distributes to parent | Eliminate dividend income |
| **Licensing** | IP licensed from parent to subsidiary | Transfer pricing rules apply |

---

## Recommended Patterns

### 1. Intercompany Agreement Registry

Create a cross-entity relationship layer:

```sql
-- Intercompany agreement linking multiple entity records
CREATE TABLE intercompany_agreements (
  id UUID PRIMARY KEY,
  agreement_type VARCHAR(50) NOT NULL,  -- 'SERVICE', 'LOAN', 'LICENSING', 'COST_SHARING'
  status VARCHAR(20) NOT NULL,
  
  -- Transfer pricing
  pricing_method VARCHAR(50),  -- 'COST_PLUS', 'MARKET_RATE', 'RESALE_MINUS'
  arm_length_documentation TEXT,
  
  effective_date DATE NOT NULL,
  expiration_date DATE,
  
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

-- Parties to the intercompany agreement
CREATE TABLE intercompany_agreement_parties (
  id UUID PRIMARY KEY,
  agreement_id UUID REFERENCES intercompany_agreements(id),
  entity_id UUID NOT NULL,  -- References entity-governance.legal_entities
  role VARCHAR(50) NOT NULL,  -- 'PROVIDER', 'RECIPIENT', 'LICENSOR', 'LICENSEE'
  
  -- Link to domain-specific records
  domain VARCHAR(50) NOT NULL,  -- 'contracts-legal', 'accounting'
  domain_record_id UUID NOT NULL
);

-- Index for finding all agreements for an entity
CREATE INDEX idx_ic_parties_entity ON intercompany_agreement_parties(entity_id);
```

### 2. Dual-Entry Intercompany Transactions

Every intercompany transaction creates records in BOTH entities:

```typescript
interface IntercompanyTransaction {
  id: string;
  agreementId: string;
  transactionDate: Date;
  
  // Source entity
  sourceEntityId: string;
  sourceAccountId: string;  // Intercompany receivable
  sourceAmount: Money;
  
  // Target entity  
  targetEntityId: string;
  targetAccountId: string;  // Intercompany payable
  targetAmount: Money;
  
  // Reconciliation
  reconciliationStatus: 'PENDING' | 'MATCHED' | 'DISPUTED' | 'ELIMINATED';
  matchedAt?: Date;
  eliminatedInPeriod?: string;  // '2025-Q4'
}
```

### 3. Automated Reconciliation

```typescript
async function reconcileIntercompany(period: string): Promise<ReconciliationResult> {
  // Find all intercompany transactions for period
  const transactions = await db.query(`
    SELECT * FROM intercompany_transactions
    WHERE period = $1 AND reconciliation_status = 'PENDING'
  `, [period]);
  
  const matches: Match[] = [];
  const disputes: Dispute[] = [];
  
  for (const tx of transactions) {
    // Find matching transaction on other side
    const counterparty = await findCounterpartyTransaction(tx);
    
    if (counterparty) {
      if (amountsMatch(tx, counterparty)) {
        matches.push({ tx, counterparty });
        await markMatched(tx.id, counterparty.id);
      } else {
        disputes.push({
          tx,
          counterparty,
          difference: tx.sourceAmount.subtract(counterparty.targetAmount),
        });
      }
    }
  }
  
  return { matches, disputes, unmatchedCount: transactions.length - matches.length };
}
```

---

## Consolidation Patterns

### 1. Chart of Accounts Standardization

All entities must use a standardized chart of accounts:

```typescript
interface StandardizedAccount {
  // Entity-specific
  entityId: string;
  localAccountCode: string;
  localAccountName: string;
  
  // Consolidated mapping
  consolidatedAccountCode: string;  // Standard across all entities
  consolidatedAccountName: string;
  
  // Intercompany indicator
  isIntercompanyAccount: boolean;
  intercompanyCounterparty?: string;  // For automatic elimination
}
```

### 2. Elimination Entries

```sql
-- Elimination entries generated during consolidation
CREATE TABLE consolidation_eliminations (
  id UUID PRIMARY KEY,
  consolidation_period VARCHAR(10) NOT NULL,  -- '2025-Q4'
  
  elimination_type VARCHAR(50) NOT NULL,
  -- 'INTERCOMPANY_REVENUE', 'INTERCOMPANY_DEBT', 
  -- 'UNREALIZED_PROFIT', 'DIVIDEND'
  
  source_entity_id UUID NOT NULL,
  target_entity_id UUID NOT NULL,
  
  debit_account VARCHAR(50) NOT NULL,
  credit_account VARCHAR(50) NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  
  source_transaction_ids UUID[] NOT NULL,  -- Original transactions eliminated
  
  created_at TIMESTAMPTZ NOT NULL
);
```

### 3. Consolidated View Query

```sql
-- Consolidated trial balance with eliminations
WITH entity_balances AS (
  SELECT 
    consolidated_account_code,
    SUM(balance) as total_balance
  FROM account_balances ab
  JOIN account_mappings am ON ab.account_id = am.local_account_id
  WHERE period = '2025-Q4'
  GROUP BY consolidated_account_code
),
elimination_adjustments AS (
  SELECT
    debit_account as account_code,
    SUM(amount) as adjustment
  FROM consolidation_eliminations
  WHERE consolidation_period = '2025-Q4'
  GROUP BY debit_account
  UNION ALL
  SELECT
    credit_account as account_code,
    -SUM(amount) as adjustment
  FROM consolidation_eliminations
  WHERE consolidation_period = '2025-Q4'
  GROUP BY credit_account
)
SELECT
  eb.consolidated_account_code,
  eb.total_balance,
  COALESCE(ea.adjustment, 0) as eliminations,
  eb.total_balance + COALESCE(ea.adjustment, 0) as consolidated_balance
FROM entity_balances eb
LEFT JOIN elimination_adjustments ea 
  ON eb.consolidated_account_code = ea.account_code
ORDER BY consolidated_account_code;
```

---

## Shared Contracts Pattern

When a contract involves multiple entities from the same corporate group:

```typescript
interface SharedContract {
  id: string;
  
  // Primary contract record (lives in contracts-legal domain)
  primaryContractId: string;
  primaryEntityId: string;  // Lead entity
  
  // Other participating entities
  participatingEntities: {
    entityId: string;
    role: 'CO_PARTY' | 'GUARANTOR' | 'BENEFICIARY';
    responsibilities: string[];
    revenueSharePercent?: number;
    costSharePercent?: number;
  }[];
  
  // For cross-entity compliance
  complianceLeadEntityId: string;
  
  // For consolidated reporting
  includeInConsolidatedReporting: boolean;
}
```

---

## Compliance Aggregation Across Entities

```typescript
interface ConsolidatedComplianceStatus {
  consolidationGroupId: string;
  period: string;
  
  // Per-entity status
  entityStatuses: {
    entityId: string;
    entityName: string;
    jurisdiction: string;
    status: 'COMPLIANT' | 'NON_COMPLIANT' | 'PENDING';
    issues: ComplianceIssue[];
  }[];
  
  // Consolidated issues (affect multiple entities)
  groupIssues: {
    issue: string;
    affectedEntities: string[];
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    remediation: string;
  }[];
  
  // Group-level metrics
  overallStatus: 'COMPLIANT' | 'NON_COMPLIANT' | 'PENDING';
  complianceRate: number;  // % of entities compliant
}
```

---

## Application to Business Ecosystem

### Extend Entity Governance Domain

```typescript
// New aggregate: Corporate Group
interface CorporateGroup {
  id: string;
  name: string;
  ultimateParentId: string;  // Root entity
  
  members: {
    entityId: string;
    ownershipPercent: number;
    consolidationMethod: 'FULL' | 'PROPORTIONAL' | 'EQUITY';
    reportingCurrency: string;
  }[];
  
  intercompanyAgreements: string[];  // Agreement IDs
}
```

### New Orchestration Workflow

```yaml
workflow: intercompany-reconciliation
trigger:
  type: schedule
  cron: "0 0 1 * *"  # Monthly on 1st
  
steps:
  - id: gather-transactions
    parallel:
      - domain: accounting
        action: getIntercompanyTransactions
        params:
          period: "${currentPeriod}"
      - domain: contracts-legal
        action: getSharedContracts
        params:
          status: ACTIVE
          
  - id: reconcile
    action: reconcileIntercompany
    input:
      transactions: "${gather-transactions.accounting}"
      contracts: "${gather-transactions.contracts-legal}"
      
  - id: generate-eliminations
    condition: "${reconcile.disputes.length == 0}"
    domain: accounting
    action: generateEliminationEntries
    
  - id: notify-disputes
    condition: "${reconcile.disputes.length > 0}"
    action: notifyReconciliationDisputes
```

---

## Sources

- [QuickBooks - Intercompany Transactions Best Practices](https://quickbooks.intuit.com/r/bookkeeping/intercompany-transactions/)
- [Numeric - Intercompany Reconciliation Guide](https://www.numeric.io/blog/intercompany-reconciliation)
- [Upflow - Intercompany Accounting Guide 2025](https://upflow.io/blog/accounting-software/intercompany-accounting)
- [NetSuite - What Is Intercompany Accounting](https://www.netsuite.com/portal/resource/articles/accounting/intercompany-accounting.shtml)
- [Ramp - What Is Multi-Entity Accounting](https://ramp.com/blog/multi-entity-accounting)
- [Reach Reporting - Financial Consolidation Best Practices](https://reachreporting.com/blog/best-practices-for-financial-consolidation-in-multi-entity-accounting)
