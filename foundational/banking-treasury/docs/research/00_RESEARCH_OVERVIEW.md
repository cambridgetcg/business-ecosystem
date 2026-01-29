# Banking & Financial Infrastructure Research

## Research Context

**Business Vision**: A global, decentralized corporate structure - fluid as water yet powerful as tsunami - that extracts value and provides services across every dimension of business, from external to internal use. A novel corporate form never seen before.

**Requirements**:
- **Geographic Scope**: Global (all regions)
- **Payment Capabilities**: All (ACH, Wire, Real-time, International, FX)
- **Volume**: $100M+/year (enterprise scale)

---

## Research Documents

| Document | Focus Area | Key Decisions |
|----------|------------|---------------|
| [01_INTERNATIONAL_BANKING.md](./01_INTERNATIONAL_BANKING.md) | Global banks, correspondent banking, cross-border | Primary global banking relationships |
| [02_NATIONAL_BANKING_US.md](./02_NATIONAL_BANKING_US.md) | US banking options for holding companies | Domestic treasury infrastructure |
| [03_REGIONAL_PAYMENT_NETWORKS.md](./03_REGIONAL_PAYMENT_NETWORKS.md) | Africa, Asia, LATAM, Europe payment rails | Regional accessibility |
| [04_BAAS_PROVIDERS.md](./04_BAAS_PROVIDERS.md) | Banking-as-a-Service platforms | Embedded finance capabilities |
| [05_PAYMENT_PROCESSORS.md](./05_PAYMENT_PROCESSORS.md) | Stripe, Adyen, global processors | Payment acceptance layer |
| [06_CROSS_BORDER_RAILS.md](./06_CROSS_BORDER_RAILS.md) | SWIFT, alternatives, FX | International transfer infrastructure |
| [07_STABLECOIN_CRYPTO.md](./07_STABLECOIN_CRYPTO.md) | USDC, USDT, digital treasury | Emerging payment rails |
| [08_TREASURY_TECHNOLOGY.md](./08_TREASURY_TECHNOLOGY.md) | TMS, virtual accounts, multi-currency | Treasury management systems |
| [09_COMPLIANCE_REGULATORY.md](./09_COMPLIANCE_REGULATORY.md) | AML, KYC, multi-jurisdiction | Regulatory framework |

---

## Executive Summary

### Recommended Infrastructure Layers

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         GLOBAL TREASURY LAYER                            │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  Treasury Management System (TMS)                                   ││
│  │  • J.P. Morgan VAM / BNY Mellon / Bank of America CashPro           ││
│  │  • Multi-entity virtual accounts, POBO/COBO structures              ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
│  GLOBAL BANKING   │   │  REGIONAL RAILS   │   │  DIGITAL RAILS    │
│  • J.P. Morgan    │   │  • SEPA (Europe)  │   │  • USDC/USDT      │
│  • HSBC           │   │  • PIX (Brazil)   │   │  • Circle         │
│  • Citi           │   │  • M-Pesa (Africa)│   │  • Thunes         │
│  • Standard Char. │   │  • UPI (India)    │   │  • Blockchain     │
│  • BNY Mellon     │   │  • Alipay (China) │   │                   │
└───────────────────┘   └───────────────────┘   └───────────────────┘
        │                           │                           │
        └───────────────────────────┼───────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          PAYMENT PROCESSING                              │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  • Stripe (primary) / Adyen (enterprise)                            ││
│  │  • 195+ countries, 135+ currencies, local payment methods           ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         US OPERATING LAYER                               │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐ │
│  │  Mercury/Brex      │  │  Traditional Bank  │  │  Treasury Yield    │ │
│  │  (Tech banking)    │  │  (First Citizens)  │  │  (T-Bills, MMF)    │ │
│  └────────────────────┘  └────────────────────┘  └────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Recommendations by Layer

1. **Global Banking**: J.P. Morgan or Citi for primary relationship (Fortune 100 coverage, VAM capabilities)
2. **Regional Access**: Thunes network for 7B+ wallet connections globally
3. **Payment Processing**: Stripe for flexibility, Adyen for enterprise unified commerce
4. **US Banking**: Mercury + Traditional bank hybrid approach
5. **Digital Treasury**: USDC for regulated stablecoin operations
6. **Compliance**: Multi-jurisdiction AML/KYC platform (Jumio, Sumsub)

---

## Market Statistics

| Metric | Value | Source |
|--------|-------|--------|
| Global cross-border payments market | $212.5B (2024) → $320.7B (2030) | McKinsey |
| BaaS market size | $18.6B (2024), 15.1% CAGR | GMInsights |
| Stablecoin market cap | $250B total (USDT + USDC = 75%) | S&P Global |
| Stripe TPV | $1.4T (2024), 38% YoY growth | Stripe |
| Adyen processed volume | €1.29T (2024), 33% YoY growth | Adyen |
| SWIFT gpi daily volume | $300B (50% settled in 30 min) | SWIFT |
| Africa mobile money users | 562M users, $495B yearly | CoinLaw |

---

## Research Date

**Conducted**: January 2026
**Valid Through**: Q2 2026 (recommend quarterly refresh)

---

*This research supports the PURPOSE.md mission of providing centralized cash management, payment processing, and treasury operations for a global business ecosystem.*
