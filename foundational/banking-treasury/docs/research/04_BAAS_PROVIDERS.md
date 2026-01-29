# Banking-as-a-Service (BaaS) Providers

## Overview

BaaS enables embedding banking capabilities directly into business operations without becoming a bank. Critical for the "fluid" corporate structure vision.

---

## Market Context

| Metric | Value |
|--------|-------|
| **Market Size (2024)** | $18.6 billion |
| **Projected Growth** | 15.1% CAGR through 2034 |
| **2028 Revenue Forecast** | $94 billion globally |
| **Large Enterprise Share** | 62% of market (2024) |
| **Payment Gateway Share** | 33.56% of BaaS market |

**Source**: [GMInsights BaaS Market](https://www.gminsights.com/industry-analysis/banking-as-a-service-market)

---

## Tier 1: Enterprise BaaS

### BNY Mellon Banking-as-a-Service

**Use Case**: Institutional-grade embedded banking for large enterprises

| Capability | Details |
|------------|---------|
| **Target** | Large corporates, institutional clients |
| **Services** | Account management, payments, FX, custody |
| **Compliance** | Built-in regulatory compliance, risk management |
| **Integration** | APIs for treasury systems integration |

**Best For**:
- Multi-entity holding companies
- Institutional-grade treasury operations
- Companies needing custody services

**Source**: [BNY BaaS Solutions](https://www.bny.com/corporate/global/en/solutions/platforms/global-payments-trade/banking-as-a-service-solutions.html)

---

### J.P. Morgan Embedded Banking

**Use Case**: Enterprise payments and treasury embedded in ERP/TMS

| Capability | Details |
|------------|---------|
| **APIs** | Payment initiation, account info, FX |
| **Virtual Accounts** | Multi-entity structures embedded |
| **Integration** | SAP, Oracle, custom TMS |
| **Coverage** | Global footprint |

**Best For**:
- Fortune 500 companies
- ERP-integrated treasury
- Complex multi-entity structures

---

## Tier 2: Fintech BaaS

### Railsbank (Now Railsr)

**Use Case**: Full-stack BaaS for embedded finance

| Capability | Details |
|------------|---------|
| **Services** | Cards, accounts, payments, lending |
| **Coverage** | US, UK, EU |
| **Licensing** | Uses own licenses and partner banks |
| **Target** | Fintechs, platforms, marketplaces |

**Considerations**: Company has faced financial challenges; due diligence recommended.

---

### Marqeta

**Use Case**: Card issuing platform

| Capability | Details |
|------------|---------|
| **Specialty** | Modern card issuing, virtual cards |
| **Customers** | DoorDash, Square, Instacart |
| **Capabilities** | Just-in-time funding, dynamic spend controls |
| **Global** | 40+ countries |

**Best For**:
- Employee expense cards
- Contractor payments
- Virtual card programs
- Marketplace payouts

---

### Unlimit

**Use Case**: Global payment embedding with multi-currency

| Capability | Details |
|------------|---------|
| **Coverage** | London to Singapore |
| **Services** | Multi-currency accounts, branded cards |
| **API-Driven** | Configurable payment embedding |
| **Use Cases** | Global payouts, collections, FX |

**Source**: [SDK.finance BaaS Companies](https://sdk.finance/blog/top-banking-as-a-service-companies/)

---

### Treasury Prime

**Use Case**: US-focused BaaS with bank partnerships

| Capability | Details |
|------------|---------|
| **Model** | Connects fintechs to partner banks |
| **Services** | Checking, savings, card issuing |
| **Focus** | Compliance-first approach |
| **Banks** | Multiple partner bank options |

**Best For**:
- US-focused operations
- Fintechs needing bank partnerships
- Compliance-sensitive use cases

---

### Column

**Use Case**: Developer-focused bank infrastructure

| Capability | Details |
|------------|---------|
| **Type** | Actual bank (nationally chartered) |
| **API** | Full banking API |
| **Services** | Accounts, payments, lending |
| **Compliance** | Built-in |

**Best For**:
- Engineering-first organizations
- Companies wanting bank-grade APIs
- Embedded finance products

---

## Tier 3: Specialized BaaS

### Airwallex

**Use Case**: Global treasury and multi-currency accounts

| Capability | Details |
|------------|---------|
| **Collections** | 70+ countries |
| **Payouts** | 120+ countries |
| **Currencies** | 60+ currencies |
| **Accounts** | Multi-currency borderless accounts |

**Best For**:
- Global payroll
- Marketplace payouts
- Multi-currency treasury

**Source**: [Airwallex Global Treasury](https://www.airwallex.com/us/platform-api-and-embedded-finance/global-treasury)

---

### Fides Treasury Services

**Use Case**: Multi-bank connectivity for treasury

| Capability | Details |
|------------|---------|
| **ONEHub Platform** | Bank-agnostic treasury connectivity |
| **Volume** | $6 trillion+ annually processed |
| **Connectivity** | 13,000+ banks globally |
| **Clients** | 4,000+ corporates |
| **ISO 20022** | Ready (achieved 2024) |

**Best For**:
- Multi-bank treasury operations
- SWIFT replacement/augmentation
- Bank-agnostic payment hub

**Source**: [Global Finance Treasury Awards](https://gfmag.com/award/award-winners/worlds-best-treasury-and-cash-management-providers-2025/)

---

## BaaS Selection Framework

### Evaluation Criteria

| Factor | Weight | Questions |
|--------|--------|-----------|
| **Geographic Coverage** | 25% | Which regions do they cover? License status? |
| **Services Offered** | 20% | Accounts, payments, cards, lending? |
| **API Quality** | 15% | Documentation? SDKs? Sandbox? |
| **Compliance** | 15% | Built-in AML/KYC? Regulatory handling? |
| **Pricing** | 10% | Per-transaction? Monthly? Volume discounts? |
| **Stability** | 10% | Financial health? Years in operation? |
| **Support** | 5% | Dedicated support? SLAs? |

---

## Implementation Patterns

### Pattern 1: Single BaaS Provider

```
Your Platform
     │
     ▼
Single BaaS (e.g., Airwallex)
     │
     ├── Multi-currency accounts
     ├── Global payouts
     ├── Card issuing
     └── FX
```

**Pros**: Simplicity, single vendor
**Cons**: Vendor lock-in, capability gaps

### Pattern 2: Best-of-Breed

```
Your Platform
     │
     ├── Treasury: J.P. Morgan/BNY
     ├── Cards: Marqeta
     ├── Global Payouts: Airwallex
     └── Regional: Thunes
```

**Pros**: Best capabilities in each area
**Cons**: Integration complexity, multiple vendors

### Pattern 3: Hybrid

```
Your Platform
     │
     ├── Core Banking: Traditional Bank
     │         │
     │         └── SWIFT, wires, credit
     │
     └── Embedded Finance: BaaS
               │
               ├── Cards (Marqeta)
               ├── Payouts (Airwallex)
               └── Wallets (Thunes)
```

**Pros**: Stability + innovation
**Cons**: More complex architecture

---

## Recommended BaaS Stack

### For Global Decentralized Corporation

| Layer | Provider | Purpose |
|-------|----------|---------|
| **Treasury Core** | J.P. Morgan or BNY | Multi-entity accounts, liquidity |
| **Global Payouts** | Airwallex | 120+ country payouts |
| **Card Issuing** | Marqeta | Employee/contractor cards |
| **Wallet Connectivity** | Thunes | M-Pesa, Alipay, etc. |
| **Multi-Bank Connectivity** | Fides | Bank-agnostic payments |

---

## Key 2024 Developments

1. **J.P. Morgan acquired WePay** - Enhanced BaaS capabilities for SMBs
2. **FIS launched embedded finance platform** - Incumbent vendor pivoting to BaaS
3. **Bunq + Mastercard + NVIDIA** - AI-enhanced open banking
4. **Large enterprises now 62% of BaaS market** - No longer just fintech startups

---

*Research Date: January 2026*
