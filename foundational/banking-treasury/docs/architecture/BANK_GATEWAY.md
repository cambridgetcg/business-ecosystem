# Bank Gateway Architecture

## Overview

The Bank Gateway is the abstraction layer that enables banking-treasury to interact with external banking systems uniformly, regardless of the underlying provider (Plaid, Modern Treasury, direct bank APIs, SWIFT, etc.).

---

## Design Principles

### 1. Provider Agnosticism

Code that uses the gateway should not care whether balances come from Plaid, J.P. Morgan's API, or a SWIFT message.

```typescript
// Good: Provider-agnostic
const balance = await gateway.balances.getBalance(connectionId);

// Bad: Provider-specific
const balance = await plaidClient.getBalance(accessToken);
```

### 2. Capability-Based Access

Not all connections support all operations. The gateway exposes capabilities and gracefully handles unsupported operations.

```typescript
const capabilities = await gateway.connections.getCapabilities(connectionId);

if (capabilities.paymentInitiation) {
  await gateway.payments.submitPayment(instruction);
} else {
  throw new Error('Payment initiation not supported for this connection');
}
```

### 3. Freshness-Aware Data

Balance and transaction data carry freshness metadata. Consumers can decide how stale is acceptable.

```typescript
const position = await gateway.balances.getBalance(connectionId, {
  minFreshness: 'near_real_time',  // Reject if >5 minutes old
});

console.log(`Balance: ${position.availableBalance.amount}`);
console.log(`As of: ${position.asOfTimestamp}`);
console.log(`Freshness: ${position.freshness}`);
```

### 4. Compliance-First

Every payment passes through compliance screening before execution.

```typescript
const screeningResult = await gateway.compliance.screenPayment({
  paymentId: instruction.instructionId,
  parties: [instruction.beneficiary],
  amount: instruction.amount,
  // ...
});

if (screeningResult.status === 'cleared') {
  await gateway.payments.submitPayment(instruction, screeningResult);
}
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BANK GATEWAY                                    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        ORCHESTRATOR (IBankGateway)                   │   │
│  │                                                                      │   │
│  │   • Coordinates all services                                        │   │
│  │   • Provides unified payment execution flow                         │   │
│  │   • Aggregates health/status across connections                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│         ┌────────────────┬─────────┼─────────┬────────────────┐            │
│         │                │         │         │                │            │
│         ▼                ▼         ▼         ▼                ▼            │
│  ┌─────────────┐  ┌─────────────┐  │  ┌─────────────┐  ┌─────────────┐    │
│  │   BALANCE   │  │   PAYMENT   │  │  │     FX      │  │ COMPLIANCE  │    │
│  │ AGGREGATOR  │  │  EXECUTOR   │  │  │   SERVICE   │  │  SCREENER   │    │
│  │             │  │             │  │  │             │  │             │    │
│  │ • getBalance│  │ • submit    │  │  │ • getQuote  │  │ • screen    │    │
│  │ • aggregate │  │ • status    │  │  │ • execute   │  │ • alert     │    │
│  │ • subscribe │  │ • recall    │  │  │ • exposure  │  │ • override  │    │
│  └─────────────┘  └─────────────┘  │  └─────────────┘  └─────────────┘    │
│                                    │                                        │
│                         ┌──────────┴──────────┐                            │
│                         │                     │                            │
│                         ▼                     ▼                            │
│                  ┌─────────────┐       ┌─────────────┐                     │
│                  │  STATEMENT  │       │  INBOUND    │                     │
│                  │   SERVICE   │       │  RECEIVER   │                     │
│                  │             │       │             │                     │
│                  │ • retrieve  │       │ • notify    │                     │
│                  │ • search    │       │ • acknowledge│                    │
│                  └─────────────┘       └─────────────┘                     │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     CONNECTION MANAGER                               │   │
│  │                                                                      │   │
│  │   • Add/remove bank connections                                     │   │
│  │   • Health monitoring                                               │   │
│  │   • Credential refresh                                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│         ┌────────────────┬─────────┴─────────┬────────────────┐            │
│         │                │                   │                │            │
│         ▼                ▼                   ▼                ▼            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │   PLAID     │  │   MODERN    │  │  JPMORGAN   │  │   MANUAL    │       │
│  │  ADAPTER    │  │  TREASURY   │  │   DIRECT    │  │  ADAPTER    │       │
│  │             │  │   ADAPTER   │  │   ADAPTER   │  │             │       │
│  │ Read-only   │  │ Full ops    │  │ Real-time   │  │ SFTP/batch  │       │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘       │
│         │                │                │                │               │
└─────────┼────────────────┼────────────────┼────────────────┼───────────────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │  Plaid   │    │  Modern  │    │J.P.Morgan│    │   SFTP   │
    │   API    │    │ Treasury │    │   API    │    │  Server  │
    │          │    │   API    │    │          │    │          │
    └──────────┘    └──────────┘    └──────────┘    └──────────┘
```

---

## Core Components

### 1. IBankGateway (Orchestrator)

The main entry point that coordinates all gateway services.

```typescript
interface IBankGateway {
  // Connection management
  readonly connections: IConnectionManager;

  // Core services
  readonly balances: IBalanceAggregator;
  readonly payments: IPaymentExecutor;
  readonly inbound: IPaymentReceiver;
  readonly fx: IFXService;
  readonly compliance: IComplianceScreener;
  readonly statements: IStatementService;

  // High-level operations
  executePayment(instruction: PaymentInstruction): Promise<PaymentSubmissionResult>;
  getPositionReport(entityId?: string): Promise<PositionReport>;
  healthCheck(): Promise<GatewayHealthReport>;
}
```

### 2. IBalanceAggregator

Provides unified balance access across all connections with freshness tracking.

**Key Concepts**:

| Concept | Description |
|---------|-------------|
| **Ledger Balance** | All posted transactions |
| **Available Balance** | Ledger - holds + pending credits |
| **Pending Credits** | Inbound not yet posted |
| **Pending Debits** | Outbound not yet posted |
| **Holds** | Funds reserved but not debited |
| **Freshness** | How current the data is |

**Freshness Levels**:

| Level | Age | Source |
|-------|-----|--------|
| `real_time` | <1 min | Webhooks, real-time API |
| `near_real_time` | 1-5 min | Polling |
| `recent` | 5-60 min | Infrequent polling |
| `stale` | >1 hour | Batch/manual |

### 3. IPaymentExecutor

Handles outbound payment lifecycle.

**Payment Flow**:

```
┌────────────────┐
│  Instruction   │
│   Created      │
└───────┬────────┘
        │
        ▼
┌────────────────┐     ┌────────────────┐
│   Validate     │────►│   REJECTED     │
│  Instruction   │     │                │
└───────┬────────┘     └────────────────┘
        │ valid
        ▼
┌────────────────┐     ┌────────────────┐
│   Compliance   │────►│   BLOCKED      │
│   Screening    │     │                │
└───────┬────────┘     └────────────────┘
        │ cleared
        ▼
┌────────────────┐
│  Select Rail   │
│  & Submit      │
└───────┬────────┘
        │
        ▼
┌────────────────┐
│   PROCESSING   │
│  (in flight)   │
└───────┬────────┘
        │
   ┌────┴────┐
   │         │
   ▼         ▼
┌──────┐  ┌──────┐
│COMPLT│  │FAILED│
└──────┘  └──────┘
```

### 4. IFXService

Handles foreign exchange operations.

**Key Operations**:

| Operation | Description |
|-----------|-------------|
| `getIndicativeRate` | Non-executable market rate |
| `requestQuote` | Executable quote with validity window |
| `executeFX` | Execute against quote or at market |
| `getExposures` | Track FX exposure by entity/currency |
| `getNetExposure` | Calculate net exposure for hedging |

**FX Settlement Alignment** (per research 13):

```
Day 1: FX trade executed
        │
        ├──► Same-day payment initiated
        │
Day 3: FX settles + Payment executes simultaneously
        │
        └──► Exposure window: 0 days (matched)
```

### 5. IComplianceScreener

Integrates AML, sanctions, and fraud screening.

**Screening Layers** (per research 09):

| Layer | When | What |
|-------|------|------|
| Onboarding | Account opening | Full screening |
| Transaction | Each payment | Real-time |
| Periodic | Daily/Weekly | Batch re-screening |
| Event-Driven | List updates | Immediate |

**Risk-Based Approach**:

| Risk Level | CDD Level | Monitoring |
|------------|-----------|------------|
| Low | Simplified | Standard rules |
| Medium | Standard | Enhanced rules |
| High | Enhanced | Real-time + ML |
| Prohibited | Decline | N/A |

---

## Bank Adapters

### Adapter Interface

Every bank provider implements the `IBankAdapter` interface:

```typescript
interface IBankAdapter {
  readonly provider: BankProvider;

  // Lifecycle
  connect(credentials: BankCredentials): Promise<BankConnection>;
  disconnect(connectionId: BankConnectionId): Promise<void>;
  checkHealth(connectionId: BankConnectionId): Promise<ConnectionHealthCheck>;
  refreshCredentials(connectionId: BankConnectionId): Promise<void>;

  // Core operations
  getCapabilities(connectionId: BankConnectionId): Promise<BankCapabilities>;
  getBalance(connectionId: BankConnectionId): Promise<BalancePosition>;
  submitPayment(connectionId, instruction): Promise<PaymentSubmissionResult>;
  getPaymentStatus(connectionId, reference): Promise<PaymentStatusUpdate>;
  getStatement(connectionId, startDate, endDate): Promise<BankStatement>;

  // Optional FX
  getFXQuote?(connectionId, request): Promise<FXQuote>;
  executeFX?(connectionId, request): Promise<FXExecution>;
}
```

### Provider Capabilities Matrix

| Provider | Balance | Payments | Real-time | FX | Statements |
|----------|---------|----------|-----------|-----|-----------|
| **Plaid** | ✓ | ✗ | ✓ | ✗ | ✗ |
| **Modern Treasury** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **J.P. Morgan Direct** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Mercury** | ✓ | ✓ | ✓ | ✗ | ✓ |
| **SWIFT** | ✗ | ✓ | ✗ | ✓ | ✓ |
| **Manual/SFTP** | ✓ | ✗ | ✗ | ✗ | ✓ |

### Hybrid Strategy (per RF-03)

```
┌─────────────────────────────────────────────────────────────┐
│                    BALANCE AGGREGATOR                        │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  REAL-TIME      │  │  POLLING        │  │  BATCH          │
│  HANDLER        │  │  HANDLER        │  │  HANDLER        │
│                 │  │                 │  │                 │
│  • Webhooks     │  │  • 30s interval │  │  • File import  │
│  • J.P. Morgan  │  │  • Plaid        │  │  • SFTP watch   │
│  • Push events  │  │  • Mercury      │  │  • Parse + load │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## Data Models

### Balance Position

```typescript
interface BalancePosition {
  connectionId: BankConnectionId;
  accountId: string;

  // Balances
  ledgerBalance: Money;
  availableBalance: Money;
  pendingCredits: Money;
  pendingDebits: Money;
  totalHolds: Money;
  holds: BalanceHold[];

  // Timing
  asOfTimestamp: Date;      // Bank's time
  fetchedAt: Date;          // Our fetch time
  freshness: BalanceFreshness;
  nextUpdateExpected?: Date;
}
```

### Payment Instruction

```typescript
interface PaymentInstruction {
  instructionId: string;
  sourceAccountId: string;
  amount: Money;
  beneficiary: PaymentParty;
  preferredRail?: string;
  urgency: 'standard' | 'urgent' | 'critical';
  valueDate?: Date;
  reference: string;
  remittanceInfo?: string;
  purposeCode?: string;
  chargeBearer?: 'OUR' | 'BEN' | 'SHA';
  fxQuoteId?: string;
  metadata: Record<string, unknown>;
}
```

### Screening Result

```typescript
interface ScreeningResult {
  screeningId: string;
  paymentId: string;
  status: 'pending' | 'cleared' | 'flagged' | 'blocked' | 'escalated';
  screenedAt: Date;
  provider: string;
  checks: ComplianceCheck[];
  overallRiskScore: number;      // 0-100
  requiresManualReview: boolean;
  blockedReason?: string;
  expiresAt: Date;
}
```

---

## Usage Patterns

### Execute a Payment (Full Flow)

```typescript
// 1. Create instruction
const instruction: PaymentInstruction = {
  instructionId: uuid(),
  sourceAccountId: 'acct_123',
  amount: { amount: 10000, currency: 'USD' },
  beneficiary: {
    name: 'ACME Corp',
    accountNumber: '123456789',
    routingNumber: '021000021',
    bankName: 'Chase',
    partyType: 'business',
    countryCode: 'US',
  },
  urgency: 'standard',
  reference: 'INV-2025-001',
  metadata: { invoiceId: 'inv_456' },
};

// 2. Gateway handles: validation → screening → rail selection → execution
const result = await gateway.executePayment(instruction);

// 3. Track status
gateway.payments.subscribeToStatusUpdates([instruction.instructionId], (update) => {
  console.log(`Payment ${update.instructionId}: ${update.currentStatus}`);
});
```

### Get Aggregated Position

```typescript
// Get all positions for an entity
const report = await gateway.getPositionReport('entity_123');

console.log('Total by currency:');
for (const [currency, amount] of report.totalByCurrency) {
  console.log(`  ${currency}: ${amount.amount}`);
}

console.log('Freshness:');
for (const [connId, freshness] of report.dataFreshness) {
  console.log(`  ${connId}: ${freshness}`);
}
```

### Handle FX Conversion

```typescript
// 1. Get quote
const quote = await gateway.fx.requestQuote({
  sourceCurrency: 'USD',
  targetCurrency: 'EUR',
  amount: { amount: 100000, currency: 'USD' },
  direction: 'sell',
  valueDate: new Date('2025-02-01'),
});

console.log(`Rate: ${quote.rate}, valid until: ${quote.validUntil}`);

// 2. Execute (if acceptable)
if (quote.spread < 0.005) { // <0.5% spread
  const execution = await gateway.fx.executeFX({
    quoteId: quote.quoteId,
    sourceCurrency: 'USD',
    targetCurrency: 'EUR',
    sourceAmount: { amount: 100000, currency: 'USD' },
    valueDate: new Date('2025-02-01'),
    reference: 'FX-001',
  });
}
```

---

## Error Handling

### Connection Errors

```typescript
interface BankConnectionError {
  code: string;
  message: string;
  occurredAt: Date;
  isRetryable: boolean;
  retryAfter?: Date;
}
```

**Circuit Breaker Pattern**:

```typescript
// After 3 consecutive failures, circuit opens
if (connection.consecutiveFailures >= 3) {
  connection.circuitOpen = true;
  connection.status = 'down';
  alertOperations(connection);
  scheduleRetry(connection, exponentialBackoff(failures));
}
```

### Fallback Strategies

| Failure | Fallback | User Communication |
|---------|----------|-------------------|
| API timeout | Use cached + flag stale | "Balance as of X" |
| Auth failure | Alert ops, use cached | "Authentication issue" |
| Rate limited | Reduce poll frequency | "Delayed updates" |
| Bank down | Last known + warning | "Bank connectivity issue" |

---

## Security Considerations

### Credential Storage

- API keys stored in AWS Secrets Manager
- Access tokens encrypted at rest
- No credentials in logs or error messages
- Automatic rotation where supported

### Data Protection

- Account numbers masked in logs (last 4 only)
- PII encrypted in transit and at rest
- Audit trail for all operations
- Data retention per compliance requirements

### Access Control

- Role-based access to connections
- Separate permissions for read vs. write operations
- Audit logging for sensitive operations

---

## Monitoring & Observability

### Health Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Connection uptime | 99.9% | <99% over 1 hour |
| Balance freshness | <1 min | >5 min for real-time |
| Payment success rate | >99.5% | <98% over 1 hour |
| API latency (p95) | <500ms | >1s |

### Dashboards

- Connection status by provider
- Balance freshness heatmap
- Payment volume and success rates
- Compliance screening metrics
- FX execution volume

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)

1. Core types and interfaces
2. Plaid adapter (read-only)
3. Balance aggregation service
4. Redis caching layer

### Phase 2: Payments (Weeks 3-4)

1. Modern Treasury adapter
2. Payment executor service
3. Compliance screening integration
4. Status webhook handling

### Phase 3: Full Operations (Weeks 5-6)

1. Direct bank adapters (J.P. Morgan)
2. FX service
3. Statement service
4. Reconciliation integration

### Phase 4: Production Hardening (Weeks 7-8)

1. Circuit breaker implementation
2. Monitoring and alerting
3. Runbook documentation
4. Load testing

---

## File Structure

```
src/domain/gateway/
├── types.ts                    # Core type definitions
├── interfaces.ts               # Service interfaces
├── index.ts                    # Module exports
└── adapters/
    ├── base-adapter.ts         # Abstract base adapter
    ├── plaid-adapter.ts        # Plaid implementation
    ├── modern-treasury-adapter.ts  # Modern Treasury implementation
    ├── jpmorgan-adapter.ts     # J.P. Morgan direct (future)
    └── manual-adapter.ts       # SFTP/batch (future)

src/infrastructure/gateway/
├── connection-manager.ts       # Connection lifecycle
├── balance-aggregator.ts       # Balance aggregation
├── payment-executor.ts         # Payment orchestration
├── fx-service.ts              # FX operations
├── compliance-screener.ts     # Compliance integration
├── statement-service.ts       # Statement retrieval
└── gateway.ts                 # Main orchestrator
```

---

## References

- [RF-03: Bank API Capabilities](../integration/research-findings/RF-03_bank_api_capabilities.md)
- [13: FX Execution Timing](../research/nuances/13_FX_EXECUTION_TIMING.md)
- [09: Compliance & Regulatory](../research/09_COMPLIANCE_REGULATORY.md)
- [16: SAR Compliance Operations](../research/nuances/16_SAR_COMPLIANCE_OPERATIONS.md)
- [19: Multi-Rail Orchestration](../research/nuances/19_MULTI_RAIL_ORCHESTRATION.md)

---

*Architecture Version: 1.0*
*Created: January 2026*
*Status: Design Complete, Implementation Pending*
