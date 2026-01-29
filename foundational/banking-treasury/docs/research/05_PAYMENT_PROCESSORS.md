# Global Payment Processors

## Overview

Payment processors enable collection of funds from customers and disbursement to vendors/contractors globally. The payment acceptance layer of the financial infrastructure.

---

## Market Leaders

### Stripe

**Use Case**: Primary payment processor for digital-first operations

| Metric | Value |
|--------|-------|
| **TPV (2024)** | $1.4 trillion (38% YoY growth) |
| **Global GDP Share** | ~1.3% of global GDP processed |
| **Countries** | 195+ countries |
| **Currencies** | 135+ currencies |
| **Fortune 100** | 50% use Stripe in some capacity |

**Core Capabilities**:

| Capability | Details |
|------------|---------|
| **Payments** | Cards, bank transfers, wallets, BNPL |
| **Local Methods** | PIX, SPEI, SEPA, iDEAL, Alipay, etc. |
| **Real-Time Rails** | FedNow (US), UPI (India), PIX (Brazil) |
| **Billing** | $500M revenue run rate, 300K+ companies |
| **Connect** | Marketplace/platform payments |
| **Atlas** | Company incorporation |
| **Issuing** | Virtual/physical card creation |

**Developer Experience**:
- Best-in-class documentation
- SDKs for every major language
- Extensive sandbox environment
- Strong API design

**Pricing** (US):
- Cards: 2.9% + $0.30
- ACH: 0.8%, capped at $5
- Wire: $8 per transfer
- International: +1.5% for currency conversion

**Best For**:
- Digital-first businesses
- Platforms/marketplaces
- Subscription businesses
- Global expansion

**Source**: [Stripe vs Adyen Performance](https://business.bitso.com/en/blog/stripe-vs-adyen-comparing-their-performance-in-2024)

---

### Adyen

**Use Case**: Enterprise unified commerce (online + in-store)

| Metric | Value |
|--------|-------|
| **Processed Volume (2024)** | €1.29 trillion (33% YoY) |
| **EBITDA** | €992.3M (50% margin) |
| **Net Income** | €925.2M (32% YoY) |
| **Currencies** | 150+ currencies |

**Core Capabilities**:

| Capability | Details |
|------------|---------|
| **Unified Commerce** | Single platform for online + POS |
| **Acquiring Licenses** | Direct licenses (not dependent on partners) |
| **Banking Licenses** | EU, UK banking licenses |
| **Real-Time Rails** | Faster Payments (UK), FedNow (US) |
| **Adyen Uplift** | AI-powered authorization optimization (+6% conversion) |

**Enterprise Features**:
- Direct bank connections (no intermediaries)
- In-house risk management
- Single integration for 250+ payment methods
- Real-time data and reporting

**Pricing**: Custom enterprise pricing (typically lower than Stripe at scale)

**Best For**:
- Large enterprises ($100M+ volume)
- Omnichannel retail
- Companies needing direct acquiring relationships
- High-volume, margin-sensitive operations

**Source**: [Fintech Wrapup Stripe vs Adyen](https://www.fintechwrapup.com/p/deep-dive-stripe-vs-adyen-comparing)

---

## Comparison: Stripe vs Adyen

| Factor | Stripe | Adyen |
|--------|--------|-------|
| **Target Market** | Startups → Enterprise | Mid-market → Enterprise |
| **Approach** | Bottom-up (developers) | Top-down (enterprise) |
| **Pricing** | Transparent, published | Custom, negotiated |
| **Integration** | Easiest, best docs | More complex, powerful |
| **Acquiring** | Aggregator model | Direct acquiring licenses |
| **POS/In-Store** | Terminal (growing) | Strong unified commerce |
| **Profitability** | Achieved 2024 | Consistently 50% EBITDA |
| **Best For** | Digital-native | Omnichannel enterprise |

---

## Regional Specialists

### EBANX (Latin America)

**Use Case**: LATAM payment expertise

| Capability | Details |
|------------|---------|
| **Countries** | Brazil, Mexico, Colombia, Chile, Peru, Argentina |
| **Methods** | PIX, Boleto, OXXO, local cards |
| **Specialty** | Understanding of LATAM compliance and tax |

**Best For**: Companies prioritizing LATAM expansion

---

### dLocal (Emerging Markets)

**Use Case**: Single integration for emerging markets

| Capability | Details |
|------------|---------|
| **Countries** | 40+ emerging market countries |
| **Regions** | LATAM, Africa, Asia |
| **Methods** | 700+ local payment methods |
| **Payouts** | Mass payouts to emerging markets |

**Best For**: Emerging market focus across multiple regions

---

### Checkout.com

**Use Case**: Enterprise payments with strong acquiring

| Capability | Details |
|------------|---------|
| **TPV** | $250B+ annually |
| **Customers** | Netflix, Grab, Sony |
| **Acquiring** | Direct acquiring in key markets |
| **API** | Modern, developer-friendly |

**Best For**: High-volume enterprises wanting alternative to Adyen

---

### Worldpay (FIS)

**Use Case**: Traditional enterprise acquiring

| Capability | Details |
|------------|---------|
| **Legacy** | One of oldest processors |
| **Coverage** | 140+ countries |
| **Specialty** | Large retail, hospitality |

**Best For**: Traditional enterprises with existing Worldpay relationships

---

## Payment Method Coverage

### By Region

| Region | Key Methods | Processor Coverage |
|--------|-------------|-------------------|
| **US** | Cards, ACH, Apple Pay, Google Pay | All |
| **Europe** | Cards, SEPA, iDEAL, Bancontact, Klarna | All |
| **UK** | Cards, Faster Payments, Open Banking | All |
| **Brazil** | PIX, Boleto, local cards | Stripe, EBANX, dLocal |
| **Mexico** | Cards, SPEI, OXXO | Stripe, dLocal, EBANX |
| **India** | UPI, cards, wallets | Stripe, Razorpay |
| **China** | Alipay, WeChat Pay | Adyen (limited), Airwallex |
| **Africa** | M-Pesa, cards | dLocal, Flutterwave, Paystack |
| **SE Asia** | GrabPay, GCash, cards | Stripe, Adyen |

---

## Implementation Strategy

### Recommended Architecture

```
                    ┌─────────────────────────────────────┐
                    │      Payment Orchestration Layer     │
                    │   (Your banking-treasury service)    │
                    └────────────────┬────────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         │                           │                           │
         ▼                           ▼                           ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     Stripe      │       │     Adyen       │       │   Specialists   │
│                 │       │                 │       │                 │
│ • Primary PSP   │       │ • Enterprise    │       │ • dLocal (EM)   │
│ • Digital flows │       │ • High volume   │       │ • EBANX (LATAM) │
│ • Subscriptions │       │ • Unified       │       │ • Razorpay (IN) │
└─────────────────┘       └─────────────────┘       └─────────────────┘
```

### Phased Rollout

**Phase 1: Foundation**
- Stripe as primary (fastest to implement)
- US, Europe, UK, basic global

**Phase 2: Optimization**
- Add Adyen for high-volume routes
- Implement smart routing

**Phase 3: Expansion**
- Regional specialists for LATAM, Africa, Asia
- Local acquiring relationships

---

## Cost Optimization

### Strategies

1. **Volume negotiation**: Both Stripe and Adyen offer significant discounts at scale
2. **Smart routing**: Route transactions to lowest-cost processor
3. **Direct acquiring**: Adyen's direct licenses avoid intermediary fees
4. **Local acquiring**: Process in local currency to avoid cross-border fees
5. **ACH/bank transfers**: Use for high-value B2B (0.8% vs 2.9%)

### Cost Comparison (Illustrative at $100M volume)

| Processor | Blended Rate | Annual Cost |
|-----------|--------------|-------------|
| Stripe (standard) | 2.7% | $2.7M |
| Stripe (negotiated) | 2.2% | $2.2M |
| Adyen (enterprise) | 1.8-2.0% | $1.8-2.0M |
| Hybrid approach | 1.9% | $1.9M |

---

## Integration Considerations

| Factor | Stripe | Adyen |
|--------|--------|-------|
| **Time to first payment** | Hours | Days-Weeks |
| **Documentation** | Excellent | Good |
| **Sandbox** | Full-featured | Good |
| **SDKs** | Every language | Major languages |
| **Support** | Email/chat | Dedicated (enterprise) |
| **Webhooks** | Reliable | Reliable |
| **API versioning** | Excellent | Good |

---

*Research Date: January 2026*
