# Banking-Treasury Implementation Plan

## Executive Summary

This plan synthesizes 20 research documents (9 primary + 11 operational nuances) into a phased implementation roadmap to realize the mission:

> **To provide centralized cash management, payment processing, and treasury operations** — enabling real-time visibility into liquidity positions, full audit trails, accurate cash flow forecasting, and automated reconciliation.

---

## Current State Assessment

### What Exists

| Component | Status | Capability |
|-----------|--------|------------|
| Domain entities | Basic | BankAccount, Payment (simple CRUD) |
| Database schema | Basic | 4 tables (accounts, payments, forecasts, reconciliations) |
| API | Basic | REST endpoints for accounts/payments |
| Events | Scaffold | Event publisher exists, basic events defined |
| Infrastructure | Basic | PostgreSQL, Redis cache, AWS integration |

### What's Missing (from Research Synthesis)

| Category | Gap | Research Source |
|----------|-----|-----------------|
| **Multi-rail payments** | No rail abstraction | 05, 06, 19 |
| **Cut-off management** | No timing awareness | 10 |
| **Failure handling** | Simple fail() only | 11 |
| **Reconciliation** | No matching engine | 15 |
| **FX management** | No currency handling | 06, 13 |
| **Intercompany** | No netting/pooling | 12 |
| **Compliance** | No AML integration | 09, 16 |
| **Bank connectivity** | No external APIs | 01-04 |
| **Liquidity management** | No stress scenarios | 17 |
| **Payment orchestration** | No routing logic | 19 |

---

## Architecture Vision

### Target Architecture (from Research Integration)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API GATEWAY / INTERFACE LAYER                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   REST API  │  │  GraphQL    │  │   Events    │  │  Webhooks   │        │
│  │ (Internal)  │  │ (Dashboard) │  │ (Pub/Sub)   │  │ (Partners)  │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────┼───────────────────────────────────────┐
│                          APPLICATION SERVICES                                 │
│                                     │                                         │
│  ┌──────────────────────────────────┼──────────────────────────────────┐    │
│  │                    PAYMENT ORCHESTRATION ENGINE                      │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐│    │
│  │  │  Routing    │  │  Cut-off    │  │  Failover   │  │   Float     ││    │
│  │  │  Decision   │  │  Manager    │  │  Handler    │  │ Optimizer   ││    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘│    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                                                               │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐     │
│  │   Cash Management  │  │   Treasury Ops     │  │   Compliance       │     │
│  │  ├─ Position Mgmt  │  │  ├─ Forecasting    │  │  ├─ AML Screening  │     │
│  │  ├─ Pooling        │  │  ├─ FX Management  │  │  ├─ SAR Workflow   │     │
│  │  └─ Netting        │  │  └─ Hedging        │  │  └─ pKYC Triggers  │     │
│  └────────────────────┘  └────────────────────┘  └────────────────────┘     │
│                                                                               │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐     │
│  │   Reconciliation   │  │   Liquidity Mgmt   │  │   Bank Relations   │     │
│  │  ├─ Matching Engine│  │  ├─ Stress Testing │  │  ├─ Fee Tracking   │     │
│  │  ├─ Exception Wkfl │  │  ├─ Facility Mgmt  │  │  ├─ Covenant Mon.  │     │
│  │  └─ Auto-Resolve   │  │  └─ CFP Execution  │  │  └─ Performance    │     │
│  └────────────────────┘  └────────────────────┘  └────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────┼───────────────────────────────────────┐
│                             DOMAIN LAYER                                      │
│                                     │                                         │
│  ┌──────────────────────────────────┴──────────────────────────────────┐    │
│  │                         AGGREGATE ROOTS                              │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐│    │
│  │  │ BankAccount │  │   Payment   │  │ CashPosition│  │Reconciliation│    │
│  │  │ (extended)  │  │ (extended)  │  │   (new)     │  │  (extended) ││    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘│    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐│    │
│  │  │  FXExposure │  │ CreditFac.  │  │  AMLAlert   │  │PaymentInquiry│    │
│  │  │   (new)     │  │   (new)     │  │   (new)     │  │   (new)     ││    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘│    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │                         VALUE OBJECTS                                 │    │
│  │  Money │ CurrencyPair │ PaymentRail │ RoutingDecision │ CutoffWindow │    │
│  │  FXRate │ ReconciliationRule │ MatchResult │ CovenantStatus │ etc.   │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────┼───────────────────────────────────────┐
│                          INFRASTRUCTURE LAYER                                 │
│                                     │                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    PAYMENT RAIL ADAPTERS                             │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  │    │
│  │  │  SWIFT  │  │   ACH   │  │   RTP   │  │  SEPA   │  │Stablecoin│  │    │
│  │  │ Adapter │  │ Adapter │  │ Adapter │  │ Adapter │  │ Adapter  │  │    │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    BANK CONNECTIVITY                                 │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐│    │
│  │  │  J.P.Morgan │  │    Citi     │  │  Mercury    │  │   Plaid     ││    │
│  │  │    API      │  │    API      │  │    API      │  │    API      ││    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘│    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    COMPLIANCE ADAPTERS                               │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │    │
│  │  │   Jumio     │  │  Dow Jones  │  │ Featurespace│                  │    │
│  │  │    KYC      │  │  Screening  │  │     AML     │                  │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  PostgreSQL │ Redis │ EventBridge │ S3 │ Secrets Manager │ CloudWatch │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 0: Foundation Enhancement (Weeks 1-4)

**Goal**: Solidify domain model and prepare for multi-rail architecture.

#### 0.1 Domain Model Extensions

**Extend BankAccount aggregate** (from nuance 14, 17):

```typescript
// New properties
interface BankAccountExtension {
  bankId: string;              // Reference to BankRelationship
  swiftBic: string;
  iban?: string;
  routingNumber?: string;
  cutoffWindowId: string;      // Reference to CutoffWindow
  facilityIds: string[];       // Credit facilities linked
  virtualAccountId?: string;   // J.P. Morgan VAM support
  poolParticipant: boolean;
  poolRole?: 'header' | 'participant';
}
```

**Extend Payment aggregate** (from nuances 10, 11, 19):

```typescript
interface PaymentExtension {
  railId: string;              // PaymentRail reference
  routingDecision: RoutingDecision;
  scheduledSettlement: Date;
  actualSettlement?: Date;
  cutoffDeadline: Date;
  gpiUetr?: string;            // SWIFT gpi reference
  failureCode?: string;        // SWIFT/ACH rejection code
  recallId?: string;           // If recall initiated
  inquiryId?: string;          // If inquiry opened
}
```

#### 0.2 New Value Objects

```typescript
// From nuance 10
interface CutoffWindow {
  id: string;
  bankId: string;
  railId: string;
  currency: string;
  cutoffTime: string;          // HH:MM in bank timezone
  timezone: string;
  stpAdjustmentMinutes: number;
  activeDays: DayOfWeek[];
  holidayCalendarId: string;
}

// From nuance 19
interface PaymentRail {
  id: string;
  type: 'swift' | 'ach' | 'rtp' | 'fednow' | 'sepa' | 'sepa_instant' | 'wire' | 'stablecoin' | 'local';
  corridors: Corridor[];
  costStructure: CostStructure;
  settlementSpeed: Duration;
  availabilitySchedule: AvailabilitySchedule;
  complianceRequirements: ComplianceRule[];
}

// From nuance 11
interface RoutingDecision {
  paymentId: string;
  timestamp: Date;
  optionsConsidered: RailOption[];
  selectedRail: string;
  selectionReason: string;
  costScore: number;
  speedScore: number;
  riskScore: number;
  fallbackRail: string;
}
```

#### 0.3 Database Schema Evolution

```sql
-- New tables for Phase 0
CREATE TABLE banking.payment_rails (
  id UUID PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  provider VARCHAR(100),
  cost_per_transaction DECIMAL(10,4),
  cost_percentage DECIMAL(5,4),
  min_settlement_minutes INT,
  max_settlement_minutes INT,
  availability_24_7 BOOLEAN DEFAULT false,
  currencies JSONB,
  corridors JSONB,
  compliance_requirements JSONB,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE banking.cutoff_windows (
  id UUID PRIMARY KEY,
  bank_id UUID NOT NULL,
  rail_id UUID REFERENCES banking.payment_rails(id),
  currency VARCHAR(3) NOT NULL,
  cutoff_time TIME NOT NULL,
  timezone VARCHAR(50) NOT NULL,
  stp_adjustment_minutes INT DEFAULT 60,
  active_days INT[] NOT NULL,  -- 0=Sunday, 6=Saturday
  holiday_calendar_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE banking.holiday_calendars (
  id UUID PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  country_code VARCHAR(3),
  bank_code VARCHAR(50),
  year INT NOT NULL,
  holidays DATE[] NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE banking.routing_decisions (
  id UUID PRIMARY KEY,
  payment_id UUID NOT NULL,
  decision_timestamp TIMESTAMP NOT NULL,
  options_considered JSONB NOT NULL,
  selected_rail_id UUID REFERENCES banking.payment_rails(id),
  selection_reason TEXT,
  cost_score DECIMAL(5,2),
  speed_score DECIMAL(5,2),
  risk_score DECIMAL(5,2),
  total_score DECIMAL(5,2),
  fallback_rail_id UUID REFERENCES banking.payment_rails(id)
);

-- Add columns to existing payments table
ALTER TABLE banking.payments ADD COLUMN rail_id UUID REFERENCES banking.payment_rails(id);
ALTER TABLE banking.payments ADD COLUMN routing_decision_id UUID REFERENCES banking.routing_decisions(id);
ALTER TABLE banking.payments ADD COLUMN scheduled_settlement TIMESTAMP;
ALTER TABLE banking.payments ADD COLUMN actual_settlement TIMESTAMP;
ALTER TABLE banking.payments ADD COLUMN cutoff_deadline TIMESTAMP;
ALTER TABLE banking.payments ADD COLUMN gpi_uetr VARCHAR(36);
ALTER TABLE banking.payments ADD COLUMN failure_code VARCHAR(10);
ALTER TABLE banking.payments ADD COLUMN recall_id UUID;
ALTER TABLE banking.payments ADD COLUMN inquiry_id UUID;
```

#### 0.4 Deliverables

| Deliverable | Description | Success Criteria |
|-------------|-------------|------------------|
| Extended domain entities | BankAccount, Payment with new fields | All tests pass |
| New value objects | PaymentRail, CutoffWindow, RoutingDecision | Type-safe, validated |
| Database migrations | Schema changes applied | Backward compatible |
| Seed data | Initial rails and cutoff windows | Common rails configured |

---

### Phase 1: Payment Orchestration (Weeks 5-10)

**Goal**: Build multi-rail payment routing with cut-off awareness.

#### 1.1 Payment Orchestration Engine

From nuance 19 (Multi-Rail Orchestration):

```typescript
interface PaymentOrchestrator {
  // Main routing function
  route(request: PaymentRequest): Promise<RoutingDecision>;

  // Execution with failover
  execute(payment: Payment, decision: RoutingDecision): Promise<PaymentResult>;

  // Cut-off checking
  checkCutoff(rail: PaymentRail, currency: string): CutoffStatus;

  // Failover handling
  handleFailure(payment: Payment, failure: PaymentFailure): Promise<RecoveryAction>;
}

class PaymentOrchestrationEngine implements PaymentOrchestrator {

  async route(request: PaymentRequest): Promise<RoutingDecision> {
    // 1. Filter by compliance
    const compliantRails = await this.filterByCompliance(request);

    // 2. Filter by capability
    const capableRails = this.filterByCapability(compliantRails, request);

    // 3. Filter by cut-off
    const availableRails = this.filterByCutoff(capableRails, request);

    // 4. Score remaining options
    const scoredOptions = this.scoreOptions(availableRails, request);

    // 5. Select best and prepare fallback
    return this.selectWithFallback(scoredOptions, request);
  }

  private scoreOptions(rails: PaymentRail[], request: PaymentRequest): RailOption[] {
    return rails.map(rail => ({
      railId: rail.id,
      costScore: this.calculateCostScore(rail, request),
      speedScore: this.calculateSpeedScore(rail, request),
      riskScore: this.calculateRiskScore(rail, request),
      totalScore: this.calculateTotalScore(rail, request),
    }));
  }
}
```

#### 1.2 Cut-off Manager

From nuance 10 (Payment Timing & Cut-offs):

```typescript
interface CutoffManager {
  // Get cutoff for specific rail/currency/bank
  getCutoff(railId: string, currency: string, bankId: string): CutoffWindow;

  // Check if payment can make cutoff
  canMakeCutoff(payment: Payment, cutoff: CutoffWindow): boolean;

  // Get next available window
  getNextWindow(railId: string, currency: string): CutoffWindow;

  // Holiday awareness
  isBusinessDay(date: Date, calendarId: string): boolean;
}

class CutoffManagerService implements CutoffManager {

  canMakeCutoff(payment: Payment, cutoff: CutoffWindow): boolean {
    const now = new Date();
    const cutoffTime = this.getCutoffDateTime(cutoff, now);

    // Account for STP vs non-STP
    const adjustedCutoff = payment.requiresManualReview
      ? subMinutes(cutoffTime, cutoff.stpAdjustmentMinutes)
      : cutoffTime;

    // Build in safety buffer
    const safeDeadline = subMinutes(adjustedCutoff, 30);

    return now < safeDeadline;
  }
}
```

#### 1.3 Payment Rail Adapters

Create adapter interface and implementations:

```typescript
interface PaymentRailAdapter {
  // Capabilities
  readonly railType: RailType;
  readonly supportedCurrencies: string[];
  readonly supportedCorridors: Corridor[];

  // Operations
  initiate(payment: Payment): Promise<InitiationResult>;
  getStatus(reference: string): Promise<PaymentStatus>;
  recall(reference: string, reason: string): Promise<RecallResult>;

  // Cut-off info
  getCutoffs(currency: string): CutoffWindow[];
}

// Implementations for each rail
class SwiftGpiAdapter implements PaymentRailAdapter { /* ... */ }
class AchAdapter implements PaymentRailAdapter { /* ... */ }
class RtpAdapter implements PaymentRailAdapter { /* ... */ }
class SepaAdapter implements PaymentRailAdapter { /* ... */ }
class StablecoinAdapter implements PaymentRailAdapter { /* ... */ }
```

#### 1.4 Deliverables

| Deliverable | Description | Success Criteria |
|-------------|-------------|------------------|
| Orchestration engine | Route + execute + failover | >99% routing success |
| Cut-off manager | Cut-off checking + holiday awareness | Prevents late submissions |
| Rail adapters | SWIFT, ACH, RTP, SEPA, Stablecoin | All rails operational |
| Admin API | Configure rails, cutoffs, calendars | Full CRUD operations |

---

### Phase 2: Cash Management & Reconciliation (Weeks 11-16)

**Goal**: Real-time cash visibility and automated reconciliation.

#### 2.1 Cash Position Service

From PURPOSE.md + nuance 17:

```typescript
interface CashPositionService {
  // Real-time position
  getPosition(entityId: string): Promise<CashPosition>;
  getConsolidatedPosition(entityIds: string[]): Promise<ConsolidatedPosition>;

  // Projections
  projectPosition(entityId: string, horizon: Duration): Promise<ProjectedPosition>;

  // Alerts
  checkLiquidityAlerts(position: CashPosition): LiquidityAlert[];
}

interface CashPosition {
  entityId: string;
  timestamp: Date;
  balancesByCurrency: Map<string, Money>;
  balancesByBank: Map<string, Money>;
  balancesByAccount: Map<string, Money>;
  totalInBaseCurrency: Money;
  baseCurrency: string;
  fxRatesUsed: FXRate[];
}
```

#### 2.2 Reconciliation Engine

From nuance 15 (Reconciliation Edge Cases):

```typescript
interface ReconciliationEngine {
  // Import and parse
  importStatement(statement: BankStatement): Promise<ImportResult>;

  // Matching
  runMatching(accountId: string, statementId: string): Promise<MatchingResult>;

  // Exception handling
  getExceptions(accountId: string): Promise<ReconciliationException[]>;
  resolveException(exceptionId: string, resolution: ExceptionResolution): Promise<void>;
}

interface MatchingRule {
  id: string;
  priority: number;
  strategy: 'one_to_one' | 'many_to_one' | 'one_to_many' | 'many_to_many';
  criteria: MatchCriteria[];
  tolerance: ToleranceSpec;
  autoReconcile: boolean;
}

interface MatchCriteria {
  field: string;
  matchType: 'exact' | 'contains' | 'pattern' | 'fuzzy' | 'within_tolerance';
  toleranceValue?: number;
  toleranceUnit?: 'absolute' | 'percentage' | 'days';
}
```

#### 2.3 Intercompany Netting

From nuance 12 (Intercompany Settlement):

```typescript
interface NettingEngine {
  // Calculate net positions
  calculateNet(entityIds: string[], period: DateRange): Promise<NettingResult>;

  // Execute settlement
  executeSettlement(nettingId: string): Promise<SettlementResult>;

  // Transfer pricing
  calculateInterestCharges(positions: IntercompanyPosition[]): Promise<InterestCalculation>;
}

interface NettingResult {
  nettingId: string;
  period: DateRange;
  grossPayables: Money;
  grossReceivables: Money;
  netPositionsByEntity: Map<string, Money>;
  transactionReduction: number;  // Percentage
  fxSavings: Money;
}
```

#### 2.4 Deliverables

| Deliverable | Description | Success Criteria |
|-------------|-------------|------------------|
| Cash position service | Real-time + projected | <1 min freshness |
| Reconciliation engine | Matching + exceptions | >95% auto-match |
| Statement import | Multi-format parser | MT940, BAI2, CSV, ISO 20022 |
| Netting engine | Intercompany settlement | Tax-compliant, documented |

---

### Phase 3: FX & Treasury Operations (Weeks 17-22)

**Goal**: FX exposure management and treasury forecasting.

#### 3.1 FX Exposure Management

From nuance 13 (FX Execution Timing):

```typescript
interface FXExposureService {
  // Exposure tracking
  aggregateExposures(entityIds: string[]): Promise<ExposureAggregation>;

  // Natural hedging
  identifyNaturalHedges(exposures: FXExposure[]): Promise<HedgeOpportunity[]>;

  // Hedge execution
  executeHedge(exposure: FXExposure, policy: HedgePolicy): Promise<HedgeResult>;
}

interface FXExposure {
  entityId: string;
  currencyPair: CurrencyPair;
  exposureType: 'receivable' | 'payable' | 'forecast';
  amount: Money;
  expectedSettlementDate: Date;
  certaintyLevel: 'committed' | 'forecast' | 'estimate';
  hedgeDesignation?: string;
  naturalHedgeMatchId?: string;
}
```

#### 3.2 Cash Forecasting

From PURPOSE.md success metrics:

```typescript
interface ForecastingService {
  // Generate forecast
  generateForecast(entityId: string, params: ForecastParams): Promise<CashForecast>;

  // Scenario analysis
  runScenario(forecastId: string, scenario: Scenario): Promise<ScenarioResult>;

  // Accuracy tracking
  measureAccuracy(forecastId: string): Promise<AccuracyMetrics>;
}

interface CashForecast {
  entityId: string;
  period: DateRange;
  granularity: 'daily' | 'weekly' | 'monthly';
  projectedInflows: TimeSeriesData;
  projectedOutflows: TimeSeriesData;
  projectedBalance: TimeSeriesData;
  confidence: number;
  assumptions: ForecastAssumption[];
}
```

#### 3.3 Deliverables

| Deliverable | Description | Success Criteria |
|-------------|-------------|------------------|
| FX exposure service | Aggregation + natural hedging | Real-time exposure view |
| Hedge management | Policy enforcement + execution | Audit-ready documentation |
| Forecasting engine | Multi-horizon projections | <5% variance at 30 days |
| Scenario modeling | What-if analysis | Stress scenarios defined |

---

### Phase 4: Compliance & Risk (Weeks 23-28)

**Goal**: AML integration and regulatory compliance.

#### 4.1 AML/Compliance Service

From nuances 09, 16 (Compliance & SAR Operations):

```typescript
interface ComplianceService {
  // Screening
  screenPayment(payment: Payment): Promise<ScreeningResult>;
  screenCounterparty(party: Counterparty): Promise<ScreeningResult>;

  // Alert management
  createAlert(trigger: AlertTrigger): Promise<AMLAlert>;
  investigateAlert(alertId: string): Promise<InvestigationResult>;

  // SAR workflow
  decideSAR(alertId: string, decision: SARDecision): Promise<void>;
  fileSAR(sarId: string, filing: SARFiling): Promise<FilingResult>;
}

interface AMLAlert {
  alertId: string;
  triggerRule: string;
  customerId: string;
  transactions: Transaction[];
  totalAmount: Money;
  riskScore: number;
  status: 'new' | 'assigned' | 'investigating' | 'closed_no_sar' | 'sar_filed';
  assignedTo?: string;
  decisionRationale?: string;
}
```

#### 4.2 Liquidity Risk Management

From nuance 17 (Liquidity Stress Management):

```typescript
interface LiquidityRiskService {
  // Facility management
  trackFacility(facility: CreditFacility): Promise<void>;
  calculateAvailability(facilityId: string): Promise<FacilityAvailability>;

  // Covenant monitoring
  checkCovenants(facilityId: string): Promise<CovenantStatus[]>;

  // Stress testing
  runStressScenario(scenario: StressScenario): Promise<StressResult>;

  // Contingency
  activateCFP(scenario: string): Promise<CFPActivation>;
}

interface CreditFacility {
  facilityId: string;
  facilityType: 'revolver' | 'term' | 'swing' | 'loc';
  committedAmount: Money;
  outstandingAmount: Money;
  availableAmount: Money;
  maturityDate: Date;
  covenants: Covenant[];
  drawNoticeDays: number;
  minimumDraw: Money;
  lenders: Lender[];
}
```

#### 4.3 Deliverables

| Deliverable | Description | Success Criteria |
|-------------|-------------|------------------|
| Screening integration | Real-time sanctions/PEP | <1 sec response |
| Alert management | Workflow + documentation | FinCEN compliant |
| SAR workflow | Decision support + filing | 30-day filing window |
| Facility tracker | Availability + covenants | Real-time monitoring |
| Stress testing | Scenario modeling | CFP procedures tested |

---

### Phase 5: Bank Connectivity (Weeks 29-34)

**Goal**: Direct bank API integrations.

#### 5.1 Bank Adapter Framework

From nuances 01-04, 14:

```typescript
interface BankAdapter {
  // Identity
  readonly bankId: string;
  readonly bankName: string;

  // Capabilities
  readonly supportedOperations: BankOperation[];
  readonly supportedRails: RailType[];

  // Balance & Statements
  getBalances(accountIds: string[]): Promise<Balance[]>;
  getStatements(accountId: string, dateRange: DateRange): Promise<Statement[]>;

  // Payments
  initiatePayment(payment: PaymentRequest): Promise<PaymentInitiation>;
  getPaymentStatus(reference: string): Promise<PaymentStatus>;

  // Virtual Accounts (where supported)
  createVirtualAccount?(params: VAMParams): Promise<VirtualAccount>;
}

// Implementations
class JPMorganAdapter implements BankAdapter { /* ... */ }
class MercuryAdapter implements BankAdapter { /* ... */ }
class PlaidAdapter implements BankAdapter { /* ... */ }  // Aggregator
```

#### 5.2 Bank Relationship Management

From nuance 14:

```typescript
interface BankRelationshipService {
  // Relationship tracking
  trackRelationship(relationship: BankRelationship): Promise<void>;

  // Fee analysis
  analyzeFees(bankId: string, period: DateRange): Promise<FeeAnalysis>;

  // Performance benchmarking
  benchmarkPerformance(bankIds: string[]): Promise<PerformanceBenchmark>;

  // Contract management
  trackContract(contract: BankContract): Promise<void>;
  alertExpiringContracts(days: number): Promise<ExpiringContract[]>;
}
```

#### 5.3 Deliverables

| Deliverable | Description | Success Criteria |
|-------------|-------------|------------------|
| Bank adapter framework | Plugin architecture | <1 week per new bank |
| J.P. Morgan integration | VAM, payments, statements | Full functionality |
| Mercury integration | Modern banking APIs | Full functionality |
| Plaid integration | Multi-bank aggregation | Balance & transaction sync |
| Relationship dashboard | Fees, performance, contracts | Actionable insights |

---

### Phase 6: Inquiry & Operations (Weeks 35-40)

**Goal**: Payment investigations and operational workflows.

#### 6.1 Inquiry Management

From nuance 20 (Payment Inquiry & Escalation):

```typescript
interface InquiryService {
  // Create and manage
  createInquiry(payment: Payment, type: InquiryType): Promise<PaymentInquiry>;
  updateInquiry(inquiryId: string, update: InquiryUpdate): Promise<void>;

  // Communication
  sendMessage(inquiryId: string, message: InquiryMessage): Promise<void>;
  receiveMessage(reference: string, message: InboundMessage): Promise<void>;

  // Escalation
  escalate(inquiryId: string, level: EscalationLevel): Promise<void>;

  // Resolution
  resolveInquiry(inquiryId: string, resolution: InquiryResolution): Promise<void>;
}

interface PaymentInquiry {
  inquiryId: string;
  paymentId: string;
  inquiryType: 'trace' | 'discrepancy' | 'fraud' | 'compliance' | 'info';
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'pending_response' | 'escalated' | 'resolved';
  slaDeadline: Date;
  escalationLevel: number;
  communications: Communication[];
  resolution?: InquiryResolution;
}
```

#### 6.2 Operational Dashboards

```typescript
interface OperationalMetrics {
  // Payment metrics
  paymentSuccessRate: Percentage;
  averageSettlementTime: Duration;
  exceptionRate: Percentage;

  // Reconciliation metrics
  autoMatchRate: Percentage;
  exceptionAging: Map<AgeRange, number>;

  // Liquidity metrics
  cashPositionVsTarget: Percentage;
  forecastAccuracy: Percentage;
  covenantHeadroom: Map<string, Percentage>;

  // Compliance metrics
  screeningLatency: Duration;
  alertResolutionTime: Duration;
  falsePositiveRate: Percentage;
}
```

#### 6.3 Deliverables

| Deliverable | Description | Success Criteria |
|-------------|-------------|------------------|
| Inquiry system | SWIFT MT199 + ISO 20022 | SLA tracking |
| Escalation workflow | Multi-level, timed | <5 day resolution avg |
| Operations dashboard | Real-time metrics | All KPIs visible |
| Alerting system | Threshold-based alerts | Proactive notification |

---

## Data Model Summary

### New Entities (from Research)

| Entity | Source | Purpose |
|--------|--------|---------|
| `PaymentRail` | Nuance 19 | Rail capabilities and costs |
| `CutoffWindow` | Nuance 10 | Bank/rail cut-off times |
| `HolidayCalendar` | Nuance 10 | Holiday schedules |
| `RoutingDecision` | Nuance 19 | Routing audit trail |
| `ReconciliationRule` | Nuance 15 | Matching criteria |
| `ReconciliationException` | Nuance 15 | Unmatched items |
| `FXExposure` | Nuance 13 | Currency exposure |
| `HedgePolicy` | Nuance 13 | Hedging rules |
| `IntercompanyAgreement` | Nuance 12 | IC loan terms |
| `CreditFacility` | Nuance 17 | Facility details |
| `Covenant` | Nuance 17 | Facility covenants |
| `AMLAlert` | Nuance 16 | Compliance alerts |
| `SARFiling` | Nuance 16 | SAR records |
| `PaymentInquiry` | Nuance 20 | Investigation tracking |
| `BankRelationship` | Nuance 14 | Bank relationship data |
| `BankContract` | Nuance 14 | Fee agreements |

### Entity Relationship Diagram (Key Relationships)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  BankAccount │────▶│    Payment   │────▶│RoutingDecision│
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │
       │                    │                    ▼
       │                    │            ┌──────────────┐
       │                    │            │ PaymentRail  │
       │                    │            └──────────────┘
       │                    │                    │
       │                    ▼                    ▼
       │            ┌──────────────┐     ┌──────────────┐
       │            │PaymentInquiry│     │ CutoffWindow │
       │            └──────────────┘     └──────────────┘
       │                                         │
       ▼                                         ▼
┌──────────────┐                         ┌──────────────┐
│BankRelation- │                         │HolidayCalendar│
│    ship      │                         └──────────────┘
└──────────────┘
       │
       ▼
┌──────────────┐
│CreditFacility│
└──────────────┘
       │
       ▼
┌──────────────┐
│  Covenant    │
└──────────────┘
```

---

## Success Metrics (from PURPOSE.md)

### Operational Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Cash position accuracy | 99.99% | System vs actual |
| Payment success rate | >99.5% | Completed / Initiated |
| Reconciliation automation | >95% | Auto-matched / Total |
| Event delivery latency | <100ms | Transaction to event |
| Cash position freshness | <1 minute | Last update age |

### Business Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Idle cash reduction | Deployed <24hrs | Excess identified to deployed |
| Payment processing | Same-day | Standard method execution |
| Audit readiness | Zero gaps | Month-end reconciliation |
| Compliance score | 100% | Transactions with required metadata |
| Forecast accuracy | Within 5% | 30-day projection vs actual |

---

## Risk Considerations

### Technical Risks

| Risk | Mitigation |
|------|------------|
| Bank API instability | Fallback adapters, retry logic |
| Cut-off misses | 2-hour buffers, alerts |
| Data consistency | Event sourcing, saga patterns |
| Performance at scale | Read replicas, caching, partitioning |

### Operational Risks

| Risk | Mitigation |
|------|------------|
| Compliance violations | Automated screening, audit trails |
| Liquidity stress | CFP procedures, facility monitoring |
| FX exposure | Natural hedging, policy enforcement |
| Bank relationship | Multi-bank strategy, performance tracking |

---

## Timeline Summary

| Phase | Weeks | Focus | Key Deliverables |
|-------|-------|-------|------------------|
| **0** | 1-4 | Foundation | Extended entities, new value objects |
| **1** | 5-10 | Orchestration | Multi-rail routing, cut-off management |
| **2** | 11-16 | Cash & Recon | Position service, matching engine |
| **3** | 17-22 | FX & Treasury | Exposure management, forecasting |
| **4** | 23-28 | Compliance | AML integration, liquidity risk |
| **5** | 29-34 | Connectivity | Bank adapters, relationship management |
| **6** | 35-40 | Operations | Inquiry system, dashboards |

**Total Timeline**: 40 weeks (~10 months)

---

## Next Steps

1. **Review this plan** with stakeholders
2. **Prioritize phases** based on business needs
3. **Begin Phase 0** with domain model extensions
4. **Establish CI/CD** for incremental deployment
5. **Plan bank partnerships** for Phase 5 integrations

---

*Generated: January 2026*
*Based on: 20 research documents (9 primary + 11 operational nuances)*
*Synthesized using Purpose Prompter methodology*
