# Revenue Recognition Standards

> Research findings on ASC 606 (US GAAP) and IFRS 15 revenue recognition requirements, the five-step model, and key differences.

## Executive Summary

ASC 606 and IFRS 15 were developed jointly by FASB and IASB to create a unified revenue recognition framework. Both standards use a five-step model to determine when and how revenue is recognized. While largely converged, important differences exist in application guidance.

---

## The Five-Step Model

Both standards follow the same core model:

```
Step 1: Identify the contract with the customer
    ↓
Step 2: Identify the performance obligations
    ↓
Step 3: Determine the transaction price
    ↓
Step 4: Allocate the transaction price
    ↓
Step 5: Recognize revenue when obligations are satisfied
```

---

## Step-by-Step Requirements

### Step 1: Identify the Contract

**Contract Criteria** (must meet ALL):
- [x] Parties have approved the contract
- [x] Rights of each party can be identified
- [x] Payment terms can be identified
- [x] Contract has commercial substance
- [x] Collection is **probable**

**Probability Threshold Difference:**

| Standard | Probability | Interpretation |
|----------|-------------|----------------|
| **ASC 606** | ~75-80% | Higher threshold |
| **IFRS 15** | >50% | "More likely than not" |

### Step 2: Identify Performance Obligations

A performance obligation is a promise to transfer a distinct good or service.

**Distinct Criteria:**
1. Customer can benefit from the good/service on its own (or with readily available resources)
2. Promise is separately identifiable from other promises in the contract

**Examples:**

| Scenario | Single or Multiple Obligations |
|----------|-------------------------------|
| Software + 1 year support | Two (software + support) |
| Custom manufacturing | Usually one (combined) |
| Phone + service plan | Two (phone + service) |
| Installation + equipment | Depends on integration |

### Step 3: Determine Transaction Price

**Components:**
- Fixed consideration
- Variable consideration (bonuses, penalties, returns)
- Significant financing component
- Non-cash consideration
- Consideration payable to customer

**Variable Consideration Methods:**

| Method | When to Use |
|--------|-------------|
| **Expected Value** | Large number of similar contracts |
| **Most Likely Amount** | Binary outcomes (bonus or not) |

**Constraint on Variable Consideration:**
Include variable consideration only to extent it is **highly probable** (IFRS) / **probable** (GAAP) that a significant revenue reversal will not occur.

### Step 4: Allocate Transaction Price

Allocate based on **standalone selling prices (SSP)**.

**SSP Determination Hierarchy:**
1. Observable price (sold separately)
2. Adjusted market assessment approach
3. Expected cost plus margin approach
4. Residual approach (limited circumstances)

### Step 5: Recognize Revenue

**Point in Time** vs **Over Time**:

| Recognize Over Time If: | Otherwise: |
|-------------------------|------------|
| Customer receives benefit as entity performs | Point in time |
| Entity's performance creates/enhances customer asset | Point in time |
| Asset has no alternative use AND entity has right to payment | Point in time |

**Over-Time Methods:**
- **Output methods**: Units delivered, milestones achieved
- **Input methods**: Costs incurred, labor hours, time elapsed

---

## Key Differences: ASC 606 vs IFRS 15

| Area | ASC 606 (US GAAP) | IFRS 15 |
|------|-------------------|---------|
| **Collectibility threshold** | ~75-80% probable | >50% probable |
| **Impairment reversal** | Not allowed | Required |
| **Sales tax policy election** | Allowed to exclude | No policy election |
| **License renewals** | Cannot recognize before renewal period | Less restrictive |
| **Performance obligations** | More detailed guidance | Less detailed |
| **Contract costs** | Allows capitalization | More stringent test |
| **Intellectual property** | Symbolic vs functional IP approach | Different determination method |

---

## Journal Entry Examples

### Simple Sale (Point in Time)

```
Contract: Sell equipment for $10,000
Delivery: Single point when control transfers

At delivery:
  DR  Accounts Receivable    $10,000
  CR  Revenue                $10,000
```

### Multiple Performance Obligations

```
Contract: Software license ($8,000) + 1-year support ($4,000)
Total price: $10,000 (bundle discount)
SSP: Software $8,000, Support $5,000 (total SSP = $13,000)

Allocation:
  Software: $10,000 × ($8,000/$13,000) = $6,154
  Support:  $10,000 × ($5,000/$13,000) = $3,846

At software delivery:
  DR  Accounts Receivable    $10,000
  CR  Revenue - Software      $6,154
  CR  Deferred Revenue        $3,846

Monthly (support recognized over 12 months):
  DR  Deferred Revenue          $321
  CR  Revenue - Support         $321
```

### Over-Time Recognition (Input Method)

```
Contract: Construction project, $1,000,000 fixed price
Estimated cost: $800,000
Method: Cost-to-cost (input method)

At 25% completion ($200,000 costs incurred):
  % Complete = $200,000 / $800,000 = 25%
  Revenue = $1,000,000 × 25% = $250,000
  
  DR  Contract Asset         $250,000
  CR  Revenue                $250,000
  
  DR  Cost of Revenue        $200,000
  CR  Materials/Labor/etc    $200,000
```

---

## Implementation Requirements

### Contract Database

```sql
CREATE TABLE revenue_contracts (
    id UUID PRIMARY KEY,
    customer_id UUID NOT NULL,
    contract_number VARCHAR(50) UNIQUE,
    contract_date DATE NOT NULL,
    total_transaction_price DECIMAL(19,4),
    currency CHAR(3),
    status VARCHAR(20),  -- DRAFT, ACTIVE, COMPLETED, CANCELLED
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE performance_obligations (
    id UUID PRIMARY KEY,
    contract_id UUID REFERENCES revenue_contracts(id),
    description TEXT NOT NULL,
    standalone_selling_price DECIMAL(19,4),
    allocated_price DECIMAL(19,4),
    recognition_method VARCHAR(20),  -- POINT_IN_TIME, OVER_TIME
    satisfaction_date DATE,
    percent_complete DECIMAL(5,2),
    revenue_recognized DECIMAL(19,4) DEFAULT 0
);
```

### Revenue Recognition Engine

```python
class RevenueRecognitionEngine:
    def process_contract(self, contract: Contract) -> List[JournalEntry]:
        entries = []
        
        for obligation in contract.performance_obligations:
            if obligation.recognition_method == 'POINT_IN_TIME':
                if obligation.is_satisfied():
                    entries.append(self.recognize_point_in_time(obligation))
            else:  # OVER_TIME
                progress = obligation.calculate_progress()
                revenue = obligation.allocated_price * progress
                already_recognized = obligation.revenue_recognized
                to_recognize = revenue - already_recognized
                
                if to_recognize > 0:
                    entries.append(self.recognize_over_time(
                        obligation, to_recognize
                    ))
        
        return entries
```

---

## Disclosure Requirements

Both standards require extensive disclosures:

| Disclosure | Requirement |
|------------|-------------|
| **Disaggregation of revenue** | By type, geography, timing, etc. |
| **Contract balances** | Receivables, contract assets, contract liabilities |
| **Performance obligations** | When typically satisfied, payment terms |
| **Significant judgments** | Methods, assumptions, changes |
| **Costs to obtain/fulfill** | Capitalized amounts, amortization |

---

## Best Practices

### 1. Document Judgment Calls
- SSP determination methodology
- Over-time vs point-in-time decisions
- Variable consideration estimates
- Progress measurement methods

### 2. Automate Where Possible
- SSP calculations
- Progress measurements
- Revenue schedules
- Disclosure aggregations

### 3. Establish Review Process
- New contract review for complex arrangements
- Quarterly estimate updates
- Annual policy review

### 4. Maintain Audit Trail
- Contract modifications tracked
- Estimate changes documented
- Recognition events logged

---

## References

- [ASC 606 and IFRS 15: 5 Steps - Certinia](https://www.certinia.com/resources/industry-101/complying-with-asc-606-and-ifrs-15/)
- [Comparison of Topic 606 and IFRS 15 - FASB](https://storage.fasb.org/Comparison%20of%20Topic%20606%20and%20IFRS%2015.pdf)
- [ASC 606 vs IFRS 15 - RightRev](https://www.rightrev.com/asc-606-vs-ifrs-15/)
- [Revenue Recognition - Stripe](https://stripe.com/resources/more/asc-606-and-ifrs-15)
- [Revenue Recognition - GAAP Dynamics](https://www.gaapdynamics.com/insights/accounting-topics/revenue-recognition-accounting-resources-for-asc-606-and-ifrs-15/)
- [ASC 606 vs IFRS 15 - HubiFi](https://www.hubifi.com/blog/asc-606-vs-ifrs-15)

---

*Research conducted: January 2026*
*Applicable to: MISSION.md Domain Scope - Transaction Recording*
