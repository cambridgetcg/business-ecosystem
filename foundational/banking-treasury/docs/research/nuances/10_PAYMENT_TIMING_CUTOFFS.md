# Payment Timing & Cut-Off Nuances

## Overview

Payment cut-off times are the hidden operational complexity that separates theoretical payment capability from actual execution. Missing a cut-off can delay payments by 24+ hours, impact cash positioning, and create downstream reconciliation issues.

---

## The Problem Most Research Ignores

Current documentation lists payment rails and their theoretical settlement times, but operational reality involves:
- **Bank-specific cut-off variations** (not standardized)
- **Currency-dependent processing windows**
- **Time zone complications** for global operations
- **Holiday calendars** that differ by country, bank, and clearing system
- **STP vs non-STP cut-off differences** (manual repairs cut off 1 hour earlier)

---

## SWIFT Payment Cut-Offs

### General Rules

| Factor | Impact on Cut-Off |
|--------|------------------|
| **Destination country** | Each country has different clearing hours |
| **Payment currency** | USD, EUR, GBP have different windows |
| **Sending bank** | Each bank sets its own internal deadlines |
| **STP capability** | Non-STP payments cut off 1 hour earlier |

### Representative Cut-Off Times (UK Banks)

| Bank | SWIFT Cut-Off | SEPA Cut-Off | Notes |
|------|---------------|--------------|-------|
| **Coutts** | 14:30 GMT/BST | 14:00 GMT/BST | International payments |
| **HSBC** | Varies by currency | Varies | Non-STP cuts off 1 hour earlier |

### SWIFT gpi Performance Reality

| Metric | Performance |
|--------|-------------|
| Settlement < 30 minutes | ~60% of gpi payments |
| Settlement < 24 hours | ~100% of gpi payments |
| Legacy SWIFT (non-gpi) | 3-5 business days |

**Source**: [Swift GPI](https://www.swift.com/products/swift-gpi)

---

## Regional Payment System Cut-Offs

### US Payment Rails

| Rail | Cut-Off Time (ET) | Settlement | Notes |
|------|-------------------|------------|-------|
| **Fedwire** | 18:00 (standard), 18:30 (extended) | Same-day | Must fund before cut-off |
| **Same-Day ACH** | Multiple windows: 10:30, 14:45, 16:45 | Same-day | Three processing windows |
| **Next-Day ACH** | 20:00 | Next business day | Traditional ACH |
| **CHIPS** | 17:00 | Same-day | High-value USD |

### Europe (SEPA)

| System | Cut-Off | Settlement |
|--------|---------|------------|
| **SEPA Instant** | 24/7/365 | < 10 seconds |
| **SEPA Credit Transfer** | Bank-dependent | 1-3 business days |
| **TARGET2** | 17:00 CET | Same-day RTGS |

### UK

| System | Cut-Off | Settlement |
|--------|---------|------------|
| **Faster Payments** | 24/7 | Typically seconds |
| **CHAPS** | 17:40 GMT | Same-day |
| **BACS** | 22:00 | 3 business days |

---

## 2025 Regulatory Changes

### November 2025 SWIFT Requirements

All international payment messages must include:
- **Structured data** (city and country of bank)
- **ISO 20022 CAMT message formats** (replacing MT formats)
- **Hybrid postal addressing** (fully unstructured addresses deprecated by November 2026)

**Implication**: Payments with incomplete structured data may be rejected or delayed.

**Source**: [APEX Analytics SWIFT Requirements 2025](https://www.apexanalytix.com/resources/blog/swift-payment-requirements-2025/)

### July 2025 Federal Reserve Update

Wire transfers must include:
- **Full legal name** of recipient
- **Home address** of recipient
- Incomplete/mismatched data = automatic rejection (1-2 week return)

**Source**: [JoinAdro International Wire Transfers 2025](https://www.joinadro.com/blog/international-wire-transfers-in-2025-what-you-must-know)

---

## Operational Implications

### What Happens When You Miss a Cut-Off

1. **Same-day becomes next-day** - 24+ hour delay
2. **Weekend complications** - Potentially 72+ hour delay
3. **Month-end/quarter-end impacts** - Financial reporting affected
4. **FX exposure** - Rate locked but settlement delayed
5. **Liquidity mismatch** - Funds tied up longer than planned

### Best Practices

1. **Build 2-hour buffers** before published cut-offs
2. **Monitor STP rates** - Non-STP payments need earlier submission
3. **Maintain holiday calendars** for all active corridors
4. **Set internal alerts** at T-3 hours, T-1 hour, T-30 minutes
5. **Have backup payment rails** for urgent transactions

---

## Holiday Calendar Complexity

### Hidden Operational Risk

Different systems observe different holidays:
- **Bank holidays** (country-specific)
- **Clearing system holidays** (may differ from bank holidays)
- **Currency holidays** (USD doesn't clear on US holidays regardless of sender location)

### Example: A US Company Paying UK Supplier

| Date | US Status | UK Status | Payment Outcome |
|------|-----------|-----------|-----------------|
| US Thanksgiving | Holiday | Working | Payment stuck at US bank |
| UK Boxing Day | Working | Holiday | Payment stuck at UK bank |
| Good Friday | Holiday | Holiday | No movement anywhere |

---

## Recommendations for Banking-Treasury System

### Required Capabilities

1. **Cut-off time database** by bank, currency, and corridor
2. **Holiday calendar integration** (multi-jurisdiction)
3. **Payment scheduling engine** that respects cut-offs
4. **Alert system** for approaching cut-offs
5. **Fallback routing** when preferred rail is closed

### Data Model Considerations

```
PaymentWindow {
  bank_id: string
  currency: Currency
  destination_country: ISO3166
  cut_off_time: Time (UTC)
  settlement_type: enum [SAME_DAY, NEXT_DAY, T_PLUS_2]
  stp_adjustment_minutes: number  // Earlier cut-off for non-STP
  active_days: DayOfWeek[]
  holiday_calendar_id: string
}
```

---

## Key Sources

- [Fiscal Treasury Payment Cut-Off](https://fiscal.treasury.gov/sps/payments-cut-off.html)
- [Coutts International Payment Cut-Offs](https://www.coutts.com/help-centre/my-coutts/payments/international-payments/What-are-the-cut-off-times-and-credit-value-dates-for-international-payments.html)
- [HSBC Cut-Off Times](https://www.hsbcinnovationbanking.com/-/media/hinv/pdf/regulations/payments-and-fx-cutoff-times)
- [Banking Circle Currency Cut-Offs](https://www.bankingcircle.com/currencies-and-cut-off-times/)
- [EWG Payment Cut-Off Times](https://www.ewggroup.com/resources/payment-cut-off-times/)

---

*Research Date: January 2026*
*Gap Addressed: Operational timing nuances not present in provider documentation*
