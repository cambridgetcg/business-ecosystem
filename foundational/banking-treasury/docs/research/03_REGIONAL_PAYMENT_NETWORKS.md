# Regional Payment Networks

## Overview

Regional payment networks provide localized, low-cost, real-time payment infrastructure that bypasses traditional correspondent banking. Essential for true global reach.

---

## Africa

### M-Pesa

**Use Case**: Mobile money access across East and Central Africa

| Metric | Value |
|--------|-------|
| **Coverage** | Kenya (90%+ penetration), Tanzania, DRC, Ghana, Egypt, Ethiopia, Mozambique, Lesotho |
| **Users** | Part of 562M mobile money users across Africa |
| **Annual Volume** | $495B in yearly transactions (continent-wide) |
| **Growth** | 147-166% projected adoption growth |

**How to Access**:
- **Direct API**: M-Pesa Daraja API for Kenya
- **Aggregator**: Thunes, Flutterwave, Paystack for multi-country
- **Partner Bank**: Standard Chartered, UBA for correspondent access

**Use Cases**:
- Pay local contractors and suppliers
- Collect payments from African customers
- Salary disbursements to mobile wallets
- Micro-payment collections

**Considerations**:
- Each country has different M-Pesa implementation
- Regulatory requirements vary by jurisdiction
- FX conversion typically needed (local currency to USD)

**Source**: [Thunes M-Pesa Partnership](https://developingtelecoms.com/telecom-technology/financial-services/17699-m-pesa-africa-and-thunes-to-enable-m-pesa-payments-in-china.html)

---

### Other African Networks

| Network | Countries | Use Case |
|---------|-----------|----------|
| **MTN Mobile Money** | Nigeria, Ghana, Uganda, Cameroon | West/Central Africa payments |
| **Airtel Money** | 14 African countries | Alternative to M-Pesa |
| **Orange Money** | Senegal, Côte d'Ivoire, Mali | Francophone Africa |
| **Flutterwave** | 34 African countries | Payment gateway aggregator |
| **Paystack** | Nigeria, Ghana, South Africa, Kenya | Stripe-like for Africa |

---

## Asia-Pacific

### China: Alipay & WeChat Pay

**Use Case**: China market access and Chinese customer/supplier payments

| Metric | Value |
|--------|-------|
| **Alipay Users** | 980 million |
| **WeChat Pay Users** | 1.38 billion (WeChat total) |
| **Market Share** | 95% of China's mobile payments combined |
| **Transaction Volume** | $20.1 trillion (2025) |

**How to Access**:
- **For accepting payments**: Partner with licensed PSP (Adyen, Stripe in limited scope)
- **For payouts**: Use Thunes, Airwallex, or licensed Chinese bank partner
- **Cross-border**: CIPS (Cross-Border Interbank Payment System) for RMB

**Regulatory Notes**:
- Foreign companies need licensed partner for China payments
- RMB cross-border requires specific licenses
- Alipay/WeChat expanding globally (tourist payments)

---

### India: UPI (Unified Payments Interface)

**Use Case**: India market access, real-time payments

| Metric | Value |
|--------|-------|
| **Monthly Transactions** | 10+ billion |
| **Real-time** | Yes, 24/7/365 |
| **Cost** | Near-zero for users |
| **Interoperability** | Linked with Singapore PayNow |

**How to Access**:
- **Direct**: Partner with Indian bank (requires local entity)
- **Aggregator**: Razorpay, PayU, Cashfree
- **Cross-border**: UPI-PayNow link for Singapore-India corridor

---

### Southeast Asia

| Network | Countries | Details |
|---------|-----------|---------|
| **GrabPay** | Singapore, Malaysia, Philippines, Indonesia, Vietnam, Thailand | Super-app wallet |
| **GCash** | Philippines | 90M+ users |
| **Dana** | Indonesia | Major e-wallet |
| **TouchnGo** | Malaysia | Payment + transit |
| **PromptPay** | Thailand | National real-time system |

**Aggregator Access**: Thunes, Airwallex connect to all major SE Asian wallets

---

## Latin America

### Brazil: PIX

**Use Case**: Brazil market access, instant payments

| Metric | Value |
|--------|-------|
| **Transactions (2024)** | 40+ billion |
| **Adoption** | 70%+ of adult population |
| **E-commerce Share** | 40% of volume |
| **Speed** | Instant, 24/7/365 |
| **Cost** | Free for individuals, low for businesses |

**How to Access**:
- **Direct**: Brazilian bank account + PIX key registration
- **Aggregator**: EBANX, dLocal, Stripe (Brazil)
- **BaaS**: Neon, Nubank APIs for embedded finance

**Why PIX Matters**:
- Replaced boleto and credit cards for many use cases
- Real-time settlement (no float)
- Central bank operated (high trust)

---

### Other LATAM Networks

| Network | Countries | Use Case |
|---------|-----------|----------|
| **SPEI** | Mexico | Real-time peso transfers |
| **CoDi** | Mexico | QR-based payments on SPEI |
| **Transferencias 3.0** | Argentina | Interoperable payments |
| **PSE** | Colombia | Bank transfer system |
| **dLocal** | 40+ countries | LATAM payment aggregator |
| **EBANX** | Brazil, Mexico, Colombia, Chile, Peru | Regional gateway |

---

## Europe

### SEPA (Single Euro Payments Area)

**Use Case**: Europe-wide EUR transfers

| Metric | Value |
|--------|-------|
| **Countries** | 36 countries (EU + EEA + UK for some) |
| **SEPA Instant** | <10 seconds, 24/7/365 |
| **Cost** | Same as domestic transfers |
| **Limit** | €100,000 per transaction (SEPA Instant) |

**How to Access**:
- Any EU/EEA bank account with IBAN
- BaaS providers (Banking Circle, ClearBank, Modulr)
- Payment processors (Adyen, Stripe) for collections

**Source**: [BVNK SWIFT Alternatives](https://bvnk.com/blog/swift-alternatives)

---

### UK: Faster Payments

| Metric | Value |
|--------|-------|
| **Speed** | Typically <2 hours, often seconds |
| **Availability** | 24/7/365 |
| **Limit** | Up to £1M (varies by bank) |

**Access**: UK bank account or BaaS provider (ClearBank, Modulr)

---

## Middle East

| Network | Countries | Notes |
|---------|-----------|-------|
| **UAE IPP** | UAE | Instant Payment Platform |
| **SADAD** | Saudi Arabia | Bill payment system |
| **Fawry** | Egypt | Payment aggregator |
| **Benefit Pay** | Bahrain | National mobile wallet |

---

## Global Aggregator: Thunes

**Use Case**: Single integration for 130+ countries and 7B+ wallets

| Capability | Details |
|------------|---------|
| **Network** | 130 countries, 120+ digital wallets, 60+ real-time payment systems |
| **Connectivity** | M-Pesa, Alipay, WeChat Pay, GCash, major wallets |
| **SmartX Treasury** | Multi-currency settlement in real-time |
| **Card Networks** | All major card networks included |

**Integration Approach**:
- Single API for global wallet/bank payouts
- Handles FX conversion
- Compliance and licensing managed by Thunes

**Source**: [Thunes SmartX](https://www.thunes.com/insights/learn/smartx-treasury-management-system/)

---

## Regional Strategy Matrix

| Region | Primary Rail | Backup Rail | Aggregator |
|--------|--------------|-------------|------------|
| **Africa** | M-Pesa | Bank transfer | Thunes, Flutterwave |
| **China** | Alipay/WeChat | CIPS (RMB) | Airwallex, Thunes |
| **India** | UPI | NEFT/RTGS | Razorpay, Thunes |
| **SE Asia** | Local wallets | Bank transfer | Thunes, Airwallex |
| **Brazil** | PIX | TED | EBANX, dLocal |
| **Mexico** | SPEI | Card | dLocal, Stripe |
| **Europe** | SEPA Instant | SWIFT | Adyen, Banking Circle |
| **UK** | Faster Payments | BACS | Modulr, ClearBank |
| **Middle East** | Local systems | SWIFT | Thunes |

---

## Recommended Implementation

### Phase 1: Core Markets
- US: ACH, Fedwire, RTP
- Europe: SEPA Instant
- UK: Faster Payments

### Phase 2: Growth Markets
- Brazil: PIX
- Mexico: SPEI
- India: UPI

### Phase 3: Frontier Markets
- Africa: M-Pesa via Thunes
- SE Asia: Wallets via Thunes
- China: Alipay/WeChat via licensed partner

---

*Research Date: January 2026*
