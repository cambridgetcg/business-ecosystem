# Multi-Currency Accounting

> Research findings on IAS 21, ASC 830, functional currency determination, and foreign exchange translation requirements.

## Executive Summary

Multi-currency accounting requires determining a functional currency for each entity, translating foreign currency transactions, and handling exchange differences appropriately. IAS 21 (IFRS) and ASC 830 (US GAAP) provide the frameworks, with largely similar requirements but some nuanced differences.

---

## Regulatory Framework

### IAS 21 - The Effects of Changes in Foreign Exchange Rates

**Scope**: Prescribes how to account for foreign currency transactions and translate financial statements into a presentation currency.

**Key Concepts**:
- **Functional Currency**: Currency of primary economic environment
- **Presentation Currency**: Currency in which financial statements are presented
- **Foreign Currency**: Any currency other than the functional currency

### ASC 830 - Foreign Currency Matters (US GAAP)

Similar framework to IAS 21 with the same core concepts but some differences in application.

---

## Functional Currency Determination

### Primary Factors (IAS 21)

| Factor | What to Consider |
|--------|------------------|
| **Sales Currency** | Currency that mainly influences sales prices |
| **Cost Currency** | Currency that mainly influences labor, materials, and other costs |

### Secondary Factors

| Factor | What to Consider |
|--------|------------------|
| **Financing Currency** | Currency in which funds from financing are generated |
| **Operating Currency** | Currency in which receipts from operating activities are retained |

### Hierarchy for Determination

```
1. Primary indicators (sales & costs) are most important
2. If primary indicators are mixed, consider secondary factors
3. If still unclear, consider:
   - Currency of competitive forces
   - Parent company's functional currency
   - Management judgment (documented)
```

### Example Analysis

```
Entity: European subsidiary of US parent
Sales: 70% EUR, 30% USD
Costs: 90% EUR, 10% USD
Financing: 100% USD (intercompany)
Cash retention: EUR

Analysis:
- Primary: EUR (dominant in sales and costs)
- Secondary: Mixed (USD financing, EUR operations)
- Conclusion: Functional currency = EUR
```

---

## Transaction Translation

### Initial Recognition

Foreign currency transactions are recorded at the **spot exchange rate** on the transaction date.

```python
class ForeignCurrencyTransaction:
    def record(self, amount: Decimal, currency: str, date: date):
        spot_rate = self.get_exchange_rate(currency, self.functional_currency, date)
        functional_amount = amount * spot_rate
        
        # Record in functional currency
        return JournalEntry(
            lines=[
                JournalLine(account="Accounts Receivable", debit=functional_amount),
                JournalLine(account="Sales Revenue", credit=functional_amount)
            ],
            metadata={
                "original_currency": currency,
                "original_amount": amount,
                "exchange_rate": spot_rate
            }
        )
```

### Subsequent Measurement

| Item Type | Measurement | Rate Used |
|-----------|-------------|-----------|
| **Monetary** (cash, receivables, payables) | Retranslate each period | Closing rate |
| **Non-monetary at historical cost** | No retranslation | Historical rate |
| **Non-monetary at fair value** | Retranslate | Rate at fair value date |

### Exchange Differences

| Situation | Treatment |
|-----------|-----------|
| **Settlement of monetary items** | Recognize in P&L |
| **Translation of monetary items** | Recognize in P&L |
| **Non-monetary items at fair value through OCI** | Recognize in OCI |
| **Translation of foreign operations** | Recognize in OCI (FCTR) |

---

## Foreign Operation Translation

When consolidating a foreign subsidiary with different functional currency:

### Translation Method (Current Rate Method)

| Item | Exchange Rate |
|------|---------------|
| **Assets** | Closing rate |
| **Liabilities** | Closing rate |
| **Equity** | Historical rates |
| **Revenue/Expenses** | Rate at transaction date (average acceptable) |

### Exchange Differences

```
Translation difference = 
  Net assets at closing rate
  - Net assets at historical/average rates
  
→ Recognized in OCI as Foreign Currency Translation Reserve (FCTR)
→ Recycled to P&L on disposal of foreign operation
```

---

## Implementation Requirements

### Exchange Rate Management

```sql
CREATE TABLE exchange_rates (
    id UUID PRIMARY KEY,
    from_currency CHAR(3) NOT NULL,
    to_currency CHAR(3) NOT NULL,
    rate_date DATE NOT NULL,
    rate_type VARCHAR(20) NOT NULL,  -- SPOT, AVERAGE, CLOSING
    rate DECIMAL(20, 10) NOT NULL,
    source VARCHAR(100),
    
    UNIQUE (from_currency, to_currency, rate_date, rate_type)
);

-- Example rates
INSERT INTO exchange_rates VALUES
    (uuid(), 'EUR', 'USD', '2026-01-26', 'SPOT', 1.0850, 'ECB'),
    (uuid(), 'EUR', 'USD', '2026-01', 'AVERAGE', 1.0823, 'Calculated'),
    (uuid(), 'EUR', 'USD', '2025-12-31', 'CLOSING', 1.0790, 'ECB');
```

### Multi-Currency Journal Entry

```python
@dataclass
class MultiCurrencyEntry:
    transaction_currency: str
    transaction_amount: Decimal
    functional_currency: str
    functional_amount: Decimal
    exchange_rate: Decimal
    rate_date: date
    rate_type: str

class JournalEntry:
    lines: List[JournalEntryLine]
    multi_currency: Optional[MultiCurrencyEntry]
    
    def validate(self):
        # Debits = Credits in FUNCTIONAL currency
        total_debits = sum(l.functional_debit for l in self.lines)
        total_credits = sum(l.functional_credit for l in self.lines)
        
        if total_debits != total_credits:
            raise UnbalancedEntryError()
```

### Revaluation Process

```python
def revalue_monetary_items(as_of_date: date, closing_rate: Decimal):
    """
    Revalue all foreign currency monetary items at period end.
    """
    monetary_accounts = get_monetary_accounts_with_fc_balance()
    
    entries = []
    for account in monetary_accounts:
        current_fc_balance = account.foreign_currency_balance
        current_rate = closing_rate
        new_functional_balance = current_fc_balance * current_rate
        
        exchange_difference = new_functional_balance - account.functional_balance
        
        if exchange_difference != 0:
            entries.append(JournalEntry(
                description=f"FX revaluation - {account.code}",
                lines=[
                    JournalLine(account=account, amount=exchange_difference),
                    JournalLine(
                        account="Unrealized FX Gain/Loss",
                        amount=-exchange_difference
                    )
                ]
            ))
    
    return entries
```

---

## GAAP vs IFRS Differences

| Area | US GAAP (ASC 830) | IFRS (IAS 21) |
|------|-------------------|---------------|
| **Highly inflationary** | >100% cumulative inflation in 3 years | IAS 29 applies |
| **Intercompany loans** | May be part of net investment | Similar, more guidance |
| **Change in functional currency** | Prospective | Prospective |
| **Disposal of foreign operation** | Recycle entire FCTR | Recycle proportionate FCTR |

### 2023 Amendment: Lack of Exchangeability

IAS 21 was amended to address situations where currency cannot be exchanged:
- Apply consistent approach to assess exchangeability
- Use observable rate or estimate if not exchangeable
- Enhanced disclosure requirements

---

## Best Practices

### 1. Functional Currency Documentation
Document functional currency determination for each entity with:
- Analysis of primary and secondary factors
- Conclusion and rationale
- Review date and approver

### 2. Rate Source Management
- Use single authoritative source (e.g., ECB, Federal Reserve)
- Document rate source in policies
- Automate rate imports
- Audit rate accuracy

### 3. Exposure Monitoring
Track foreign currency exposure:
```sql
SELECT 
    currency,
    SUM(CASE WHEN account_type = 'ASSET' THEN balance ELSE 0 END) as assets,
    SUM(CASE WHEN account_type = 'LIABILITY' THEN balance ELSE 0 END) as liabilities,
    SUM(CASE WHEN account_type = 'ASSET' THEN balance ELSE -balance END) as net_exposure
FROM account_balances
WHERE currency != functional_currency
GROUP BY currency;
```

### 4. Hedging Considerations
While not covered by IAS 21 (see IFRS 9/ASC 815):
- Consider hedge accounting for material exposures
- Document hedge relationships
- Test hedge effectiveness

### 5. Intercompany Transactions
- Eliminate in consolidation
- Track in both currencies
- Handle timing differences in rates

---

## References

- [IAS 21 - IFRS Foundation](https://www.ifrs.org/issued-standards/list-of-standards/ias-21-the-effects-of-changes-in-foreign-exchange-rates/)
- [IAS 21 Full Text (PDF)](https://www.ifrs.org/content/dam/ifrs/publications/pdf-standards/english/2022/issued/part-a/ias-21-the-effects-of-changes-in-foreign-exchange-rates.pdf)
- [IAS 21 Summary - CPDbox](https://www.cpdbox.com/ifrs/ias-21/)
- [Foreign Currency Matters - GAAP Dynamics](https://www.gaapdynamics.com/insights/accounting-topics/foreign-currency-matters-accounting-resources-for-asc-830-and-ias-21/)
- [IAS 21 - ICAEW](https://www.icaew.com/technical/corporate-reporting/ifrs/ifrs-accounting-standards-tracker/ias-21-the-effects-of-changes-in-foreign-exchange-rates)

---

*Research conducted: January 2026*
*Applicable to: MISSION.md Domain Scope - Multi-Currency Support (Implied)*
