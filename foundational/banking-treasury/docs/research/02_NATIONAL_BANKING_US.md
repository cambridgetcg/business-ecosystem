# US National Banking Options

## Overview

US banking infrastructure forms the foundation for domestic operations, treasury management, and serves as the hub for global fund flows through USD corridors.

---

## Fintech-First Banking

### Mercury

**Use Case**: Primary operating account for tech-forward holding companies

| Capability | Details |
|------------|---------|
| **Revenue** | $650M annualized (September 2025) |
| **Deposits** | ~$20B in customer deposits |
| **Treasury** | Requires $250K minimum; $20M+ for highest yields |
| **API** | Full API access for automation |
| **FDIC Coverage** | Via partner banks (not a bank itself) |

**Pros**:
- Developer-friendly APIs
- Clean UI for multi-entity management
- No minimum balance requirements for basic accounts
- Automated accounting integrations

**Cons**:
- Not technically a bank (partner bank model)
- No physical branches
- Treasury yields require high minimums
- Email-based support (no dedicated rep for smaller accounts)

**Best For**: Startups to growth-stage companies with $1M-$50M in deposits

**Source**: [Mercury via Sacra](https://sacra.com/c/mercury/)

---

### Brex

**Use Case**: Enterprise fintech with global capabilities

| Capability | Details |
|------------|---------|
| **Treasury Yield** | 4.90% variable via BNY Mellon money market fund |
| **Global Cards** | Local currency issuance in 50+ countries |
| **Reimbursements** | Employee reimbursements in 60+ countries |
| **Target Market** | Venture-backed startups and enterprises |

**Pros**:
- Built for scale (enterprise features)
- Strong spend management
- Global card issuance
- High treasury yields without minimum

**Cons**:
- Strict qualification requirements (venture-backed or revenue thresholds)
- Limited to larger businesses
- Less flexibility for smaller entities

**Best For**: Venture-backed companies with international employees and spend

**Source**: [Brex vs Mercury](https://www.brex.com/spend-trends/business-banking/mercury-alternatives-and-competitors)

---

### Rho

**Use Case**: High-growth companies needing white-glove service

| Capability | Details |
|------------|---------|
| **Support Model** | Dedicated specialist 24/7 for every customer |
| **Treasury** | Strong cash management tools |
| **Target Market** | SMBs, mid-market, startups |
| **FDIC** | Via partner banks |

**Pros**:
- Best-in-class customer support
- Strong for companies that need responsive banking
- Good cash management features

**Cons**:
- Not a bank (partner model)
- Smaller than Mercury/Brex

**Best For**: Companies prioritizing relationship banking with modern tools

---

## Traditional Banks

### First Citizens Bank (SVB Division)

**Use Case**: Venture-backed companies, innovation economy

| Capability | Details |
|------------|---------|
| **Heritage** | Former Silicon Valley Bank, now under First Citizens |
| **Focus** | Technology companies, life sciences, venture capital |
| **Services** | Full commercial banking, lending, treasury |
| **Relationship** | Dedicated bankers for qualified clients |

**Pros**:
- Deep understanding of venture-backed companies
- Full bank services (lending, lines of credit)
- Physical presence
- FDIC insured directly

**Cons**:
- Legacy of 2023 collapse (reputational)
- Less cutting-edge technology than fintechs

**Best For**: Established companies needing traditional banking relationship

**Source**: [SVB Competitors](https://www.brex.com/spend-trends/business-banking/silicon-valley-bank-competitors-and-alternatives)

---

### Grasshopper Bank

**Use Case**: Startups wanting a real bank (FDIC-insured directly)

| Capability | Details |
|------------|---------|
| **Type** | Actual FDIC-insured digital bank (not partner model) |
| **Founded** | 2019 |
| **Wires** | $10 domestic outgoing |
| **Insured Sweep** | Up to $125M via insured cash sweep |

**Pros**:
- Directly FDIC-insured (not partner bank)
- Low wire fees
- High sweep coverage ($125M)
- Online-only (modern UX)

**Cons**:
- Smaller, less established
- Fewer integrations than Mercury/Brex

**Best For**: Companies wanting FDIC-direct relationship with modern features

---

## Treasury Yield Comparison

| Provider | Yield | Minimum | Vehicle | Access |
|----------|-------|---------|---------|--------|
| **Brex** | 4.90% | None | BNY Mellon MMF | Instant |
| **Mercury** | 4.5-5.1% | $250K (basic), $20M (highest) | Treasury-backed | Next-day |
| **Meow** | 4.5-5.0% | None | Direct T-Bills | Ladder management |
| **Bluevine** | 1.30%+ | None | Checking balance | Instant |
| **Rho** | ~4.5% | Varies | Treasury product | Varies |

---

## Holding Company Structure Recommendations

### Multi-Entity Banking Architecture

```
Holding Company (Parent)
├── Primary Operating Account (Mercury or Brex)
│   ├── Main payroll funding
│   ├── Vendor payments
│   └── Treasury/yield account
│
├── Traditional Bank Relationship (First Citizens or Grasshopper)
│   ├── Credit facilities
│   ├── Letters of credit
│   └── Large wire transfers
│
└── Subsidiary Accounts
    ├── Entity 1 → Sub-account or separate Mercury account
    ├── Entity 2 → Sub-account or separate Mercury account
    └── Entity N → Virtual accounts or separate accounts
```

### Hybrid Approach Benefits

1. **Fintech for daily operations**: Mercury/Brex for speed, APIs, modern UX
2. **Traditional bank for credit**: Lines of credit, term loans, LOCs
3. **High-yield treasury**: Brex Treasury or Meow for idle cash optimization
4. **FDIC diversification**: Spread deposits across institutions for coverage

---

## Selection Matrix

| Requirement | Mercury | Brex | Rho | First Citizens | Grasshopper |
|-------------|---------|------|-----|----------------|-------------|
| Multi-entity management | ✓ | ✓ | ✓ | ✓ | Limited |
| API access | ✓✓✓ | ✓✓ | ✓✓ | ✓ | ✓ |
| Treasury yield | ✓ (high min) | ✓✓✓ | ✓✓ | ✓ | ✓ |
| Credit facilities | ✗ | ✓ | ✗ | ✓✓✓ | ✗ |
| Direct FDIC | ✗ | ✗ | ✗ | ✓✓✓ | ✓✓✓ |
| Global capabilities | ✓ | ✓✓✓ | ✓ | ✓ | ✗ |
| Startup-friendly | ✓✓✓ | ✓✓ | ✓✓ | ✓✓ | ✓✓ |

---

## Recommended Setup for $100M+/year Operations

### Immediate (0-6 months)

1. **Mercury** - Primary operating accounts for all entities
2. **Brex Treasury** - Idle cash optimization (4.90% yield)
3. **First Citizens** - Credit relationship establishment

### Growth (6-18 months)

4. **Meow** - Direct T-Bill laddering for larger treasury
5. **Grasshopper** - Secondary FDIC-direct relationship
6. **Global bank relationship** - J.P. Morgan or Citi for international

---

*Research Date: January 2026*
