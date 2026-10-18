# Banking-Treasury → Accounting Integration

This document describes the event-driven integration between the Banking-Treasury and Accounting services.

## Overview

When payments are processed in Banking-Treasury, events are published to the ecosystem event bus. The Accounting service consumes these events and creates corresponding journal entries to maintain real-time GL accuracy.

```
┌─────────────────────┐         ┌─────────────────────┐
│  Banking-Treasury   │         │     Accounting      │
│                     │         │                     │
│  ┌───────────────┐  │  Event  │  ┌───────────────┐  │
│  │   Payment     │──┼────────▶│  │ Event Handler │  │
│  │   Service     │  │   Bus   │  │               │  │
│  └───────────────┘  │         │  └───────┬───────┘  │
│                     │         │          │          │
│  Events Published:  │         │          ▼          │
│  • payment.completed│         │  ┌───────────────┐  │
│  • payment.failed   │         │  │ Posting Svc   │  │
│  • account.balance_ │         │  │               │  │
│    changed          │         │  └───────┬───────┘  │
│                     │         │          │          │
└─────────────────────┘         │          ▼          │
                                │  ┌───────────────┐  │
                                │  │ Journal Entry │  │
                                │  │ (Immutable)   │  │
                                │  └───────────────┘  │
                                └─────────────────────┘
```

## Events Consumed

### `payment.completed`

Published when a payment is successfully processed.

**Source:** Banking-Treasury
**Action:** Create and post journal entry

**Payload:**
```json
{
  "transactionId": "pay_123abc",
  "amount": 5000.00,
  "currency": "USD",
  "sourceAccountId": "acct_456def",
  "processingDuration": 2340,
  "externalReference": "INV-2024-001"
}
```

**GL Entry Created:**

For outbound payments (paying vendors):
```
Dr. Accounts Payable     $5,000.00
    Cr. Bank Account     $5,000.00
```

For inbound payments (customer receipts):
```
Dr. Bank Account         $5,000.00
    Cr. Accounts Receivable  $5,000.00
```

### `payment.failed`

Published when a payment fails after being initiated.

**Source:** Banking-Treasury
**Action:** Reverse journal entry if one exists

**Payload:**
```json
{
  "transactionId": "pay_123abc",
  "failureCode": "INSUFFICIENT_FUNDS",
  "failureReason": "Account balance too low",
  "retryable": true,
  "retryCount": 1
}
```

**GL Entry Created:**

If a journal entry was previously posted, a reversal entry is created:
```
Dr. Bank Account         $5,000.00
    Cr. Accounts Payable $5,000.00
```

### `account.balance_changed`

Published when a bank account balance changes.

**Source:** Banking-Treasury
**Action:** Trigger reconciliation check

**Payload:**
```json
{
  "entityId": "ent_789xyz",
  "previousBalance": 10000.00,
  "newBalance": 5000.00,
  "currency": "USD",
  "changeAmount": -5000.00,
  "reason": "payment",
  "transactionId": "pay_123abc"
}
```

## GL Account Mapping

| Account Type | Default Code | Category |
|--------------|--------------|----------|
| Bank/Cash | 1000 | Asset |
| Accounts Payable | 2000 | Liability |
| Accounts Receivable | 1200 | Asset |
| Payment Processing Fees | 6500 | Expense |

## Implementation Details

### Idempotency

The event handler checks for existing journal entries before creating new ones:

1. Look up existing entry by `source_document` = `transactionId`
2. If found, return existing entry ID
3. If not found, create new entry

This ensures duplicate events don't create duplicate GL entries.

### Error Handling

| Scenario | Behavior |
|----------|----------|
| Account not found | Throw error, event will be retried |
| DB connection error | Throw error, event will be retried |
| Invalid payload | Log error, skip event (dead letter) |
| Already processed | Return existing entry ID |

### Audit Trail

Each journal entry includes metadata linking back to the banking transaction:

```json
{
  "banking_transaction_id": "pay_123abc",
  "external_reference": "INV-2024-001",
  "source_account_id": "acct_456def",
  "correlation_id": "corr_xyz789"
}
```

## Configuration

### Environment Variables

```bash
# Event bus connection
RABBITMQ_URL=amqp://localhost:5672

# Default GL accounts (override per tenant)
DEFAULT_BANK_ACCOUNT=1000
DEFAULT_AP_ACCOUNT=2000
DEFAULT_AR_ACCOUNT=1200
DEFAULT_FEE_ACCOUNT=6500
```

### Handler Registration

```python
from accounting.infrastructure.messaging import register_banking_handlers

handler = register_banking_handlers(
    event_bus=event_bus,
    posting_service=posting_service,
    account_repository=account_repository,
    journal_entry_repository=journal_entry_repository,
)
```

## Testing

### Unit Tests

```python
async def test_payment_completed_creates_journal_entry():
    """Test that payment.completed creates correct GL entry."""
    event = {
        "id": "evt_123",
        "type": "payment.completed",
        "payload": {
            "transactionId": "pay_123",
            "amount": 1000.00,
            "currency": "USD",
        }
    }

    entry_id = await handler.handle_payment_completed(event, {"tenantId": "tenant_1"})

    entry = await journal_entry_repo.find_by_id(entry_id)
    assert entry.total_debits == Decimal("1000.00")
    assert entry.total_credits == Decimal("1000.00")
    assert entry.status == "POSTED"
```

### Integration Tests

```python
async def test_end_to_end_payment_flow():
    """Test full flow from payment to GL posting."""
    # 1. Create payment in Banking-Treasury
    payment = await banking_client.create_payment(...)

    # 2. Wait for event to be processed
    await asyncio.sleep(1)

    # 3. Verify journal entry exists in Accounting
    entries = await accounting_client.get_entries(
        source_document=payment.transaction_id
    )
    assert len(entries) == 1
```

## Monitoring

### Metrics

| Metric | Description |
|--------|-------------|
| `banking_events_processed_total` | Total events processed by type |
| `banking_events_failed_total` | Failed event processing by reason |
| `gl_entries_created_total` | Journal entries created from banking |
| `gl_reversal_entries_total` | Reversal entries from failed payments |

### Alerts

- **High failure rate:** >5% of events failing
- **Processing delay:** >30s between event occurrence and GL posting
- **Unbalanced entries:** Any entry with debits ≠ credits

## Related Documentation

- [Banking-Treasury Domain Events](../foundational/banking-treasury/src/core/events/domain-events.ts)
- [Accounting Journal Entry Model](../foundational/accounting/src/domain/general_ledger/models/journal_entry.py)
- [Event Bus Architecture](../shared/libs/messaging/README.md)
