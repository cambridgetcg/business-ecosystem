# International Banking Infrastructure

## Overview

Global banks provide the foundation for multi-national treasury operations, offering correspondent banking relationships, multi-currency capabilities, and worldwide presence.

---

## Tier 1 Global Banks

### J.P. Morgan Chase

**Use Case**: Primary global banking relationship for Fortune 100-level operations

| Capability | Details |
|------------|---------|
| **Virtual Account Management (VAM)** | Multi-entity structures, POBO/COBO, 24/7 global management |
| **CashPro Platform** | $1T+ payment approvals in 2024, mobile + API + web access |
| **Global Reach** | Presence in 100+ countries, multi-currency notional pooling |
| **Treasury Services** | Liquidity management, automated sweeps, investment options |

**Best For**:
- Multi-entity holding company structures
- Centralized treasury operations
- High-volume international payments

**Source**: [J.P. Morgan VAM](https://www.jpmorgan.com/payments/solutions/treasury/virtual-account-management)

---

### Citi (Citibank)

**Use Case**: Emerging markets coverage and trade finance

| Capability | Details |
|------------|---------|
| **Global Network** | Operations in 160+ countries, strongest emerging market presence |
| **Treasury & Trade Solutions** | End-to-end trade finance, supply chain financing |
| **Cross-Currency Pooling** | Real-time liquidity across currencies |
| **CitiDirect** | Digital banking platform with API connectivity |

**Best For**:
- Emerging market operations (Africa, Asia, LATAM)
- Trade finance and supply chain
- Cross-border liquidity management

---

### HSBC

**Use Case**: Asia-Pacific focus with global reach

| Capability | Details |
|------------|---------|
| **HSBC Net** | Global payment and treasury management platform |
| **Asian Dominance** | Strongest presence in Hong Kong, China, Singapore |
| **Correspondent Banking** | Extensive network for emerging market access |
| **Trade Finance** | Strong letter of credit and documentary collection services |

**Best For**:
- Asia-Pacific heavy operations
- China market access
- Trade finance needs

**Source**: [HSBC Accessing Emerging Markets](https://www.gbm.hsbc.com/en-gb/campaigns/accessing-emerging-markets)

---

### BNY Mellon

**Use Case**: Institutional treasury and asset servicing

| Capability | Details |
|------------|---------|
| **Virtual Account Based Solutions** | Launched January 2024, real-time sub-ledger management |
| **Payments Enablement Platform** | 24/7 USD payments, real-time data delivery |
| **POBO/COBO Structures** | Centralized payment/collection across legal entities |
| **Asset Servicing** | Custody, securities services, FX |

**Best For**:
- Complex multi-entity structures
- Treasury centralization projects
- Asset-heavy organizations

**Source**: [BNY Virtual Account Solutions](https://www.bny.com/corporate/global/en/about-us/newsroom/press-release/bny-mellon-launches-virtual-account-based-solutions-130369.html)

---

### Standard Chartered

**Use Case**: Africa, Middle East, and Asia specialist

| Capability | Details |
|------------|---------|
| **Emerging Markets Focus** | Strong in Africa (15 countries), Middle East, Asia |
| **Stablecoin Exploration** | Actively developing crypto/stablecoin payment capabilities |
| **Trade Finance** | Deep expertise in commodity trade finance |
| **Straight2Bank** | Corporate banking platform |

**Best For**:
- Africa-focused operations
- Middle East expansion
- Commodity trading businesses

---

## Correspondent Banking Considerations

### De-Risking Challenges

Correspondent banking relationships have become more difficult to establish due to regulatory pressure:

- **72%** of emerging market banks face external challenges reducing customer service capabilities
- **Over 1/3** of Sub-Saharan African banks report decreased correspondent relationships
- **Compliance costs** are the most frequently cited barrier

**Source**: [IFC Survey on Correspondent Banking](https://openknowledge.worldbank.org/server/api/core/bitstreams/3789abe3-026c-52a3-b8f6-916740e9428a/content)

### Mitigation Strategies

1. **Establish primary relationship with Tier 1 global bank** - Provides correspondent access to their network
2. **Maintain relationships in multiple currencies** - USD, EUR, GBP as primary
3. **Use BaaS providers for last-mile access** - Thunes, Airwallex for wallet connectivity
4. **Document AML/KYC programs thoroughly** - Reduces due diligence friction

---

## Multi-Bank Strategy

### Recommended Structure for Global Operations

```
Primary Global Bank (J.P. Morgan / Citi)
├── USD Operations (Primary)
├── EUR Operations (SEPA access)
├── GBP Operations (UK clearing)
└── Correspondent Network Access
    ├── Africa (via Standard Chartered or local partners)
    ├── Asia (via HSBC or primary bank)
    └── LATAM (via Citi or primary bank)

Secondary Bank (BNY Mellon / Regional)
├── Treasury Investment Services
├── Custody and Asset Services
└── Backup Payment Rails

Regional Banks (As needed)
├── Local currency accounts
├── Regulatory compliance (some countries require local banking)
└── Specialized services
```

---

## Selection Criteria

| Factor | Weight | Considerations |
|--------|--------|----------------|
| **Global Reach** | 25% | Countries of operation, correspondent network depth |
| **Technology** | 20% | API capabilities, real-time data, integration ease |
| **Pricing** | 15% | Wire fees, FX spreads, account maintenance |
| **Emerging Markets** | 20% | Africa, LATAM, Asia access quality |
| **Treasury Services** | 10% | Cash pooling, investment, liquidity management |
| **Relationship** | 10% | Dedicated support, responsiveness |

---

## Cost Considerations

### Typical Global Bank Pricing

| Service | Range | Notes |
|---------|-------|-------|
| Outgoing Wire (USD) | $25-45 | Volume discounts available |
| Incoming Wire | $10-20 | Often free for large clients |
| SWIFT Transfer | $30-65 | Plus intermediary bank fees |
| FX Spread | 0.1-1.5% | Negotiable based on volume |
| Account Maintenance | $0-500/month | Per account, varies by type |
| API Access | $0-5,000/month | Premium services may have fees |

---

## Next Steps

1. **RFP Process**: Issue RFP to J.P. Morgan, Citi, HSBC for primary relationship
2. **Treasury Assessment**: Evaluate current and projected cash flows by region
3. **Integration Planning**: Assess API requirements for banking-treasury service
4. **Compliance Review**: Ensure AML/KYC programs meet global bank standards

---

*Research Date: January 2026*
