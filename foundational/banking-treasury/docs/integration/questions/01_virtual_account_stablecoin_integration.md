# Question: How Do Virtual Accounts Integrate With Stablecoin Payments?

## The Gap

Virtual Account Management (VAM) works brilliantly for traditional payment rails because:
1. Payer sends to unique virtual account number
2. Bank routes to master account
3. Sub-ledger automatically allocates

But **stablecoin payments arrive at blockchain addresses**, not bank account numbers.

## The Specific Question

```
When a customer pays USDC to our corporate wallet:
  → How does that payment get mapped to a virtual account structure?
  → Who owns this mapping? Treasury? Bank? Third party?
  → Is there a standard emerging, or is this bespoke per implementation?
```

## Why This Matters

If we're building orchestration that routes across ACH, SWIFT, AND stablecoins, we need unified reconciliation. The payment rail shouldn't determine whether auto-reconciliation works.

## Current Understanding

| Traditional Payment | Stablecoin Payment |
|--------------------|--------------------|
| Bank receives → VAM routes | Wallet receives → ??? |
| Account number = identity | Address = identity (but not segmented) |
| Bank provides sub-ledger | Who provides sub-ledger? |

## Hypotheses to Investigate

### Hypothesis 1: Multiple Receiving Addresses
- Generate unique blockchain address per payer/invoice
- Similar to virtual accounts but on-chain
- Challenge: Address management overhead

### Hypothesis 2: Memo/Reference Fields
- Single address, structured memo field
- Like SWIFT reference fields
- Challenge: Not all stablecoins support rich metadata

### Hypothesis 3: Payment Processor Layer
- Circle, Fireblocks, etc. provide VAM-like abstraction
- They map on-chain to virtual structure
- Challenge: Dependency on third party

### Hypothesis 4: Smart Contract Sub-Accounts
- Contract with sub-account structure built in
- On-chain VAM equivalent
- Challenge: Complexity, gas costs

## Research Directions

1. **Circle Business Account** — Do they offer virtual account-like features?
2. **Fireblocks** — How does their vault structure handle this?
3. **BitGo** — Enterprise wallet segregation capabilities?
4. **ERC-4337 (Account Abstraction)** — Does this enable on-chain VAM?

## The Architectural Decision

This question affects where reconciliation intelligence lives:

```
Option A: Push down (on-chain structure)
  → Blockchain handles segmentation
  → Reconciliation already done at receipt

Option B: Pull up (off-chain mapping)
  → Generic wallet receives all
  → Application layer maps to virtual structure
  → Similar to traditional reconciliation

Option C: Hybrid (processor handles)
  → Payment processor provides abstraction
  → They manage the complexity
  → We integrate to their API
```

## Connected Questions

- How do payment processors report stablecoin transactions for reconciliation?
- What metadata survives cross-chain stablecoin transfers?
- How do DEX/swap transactions complicate this further?

---

*Priority: HIGH — Blocks unified reconciliation architecture*
*Research type: Vendor capability analysis + technical architecture*
