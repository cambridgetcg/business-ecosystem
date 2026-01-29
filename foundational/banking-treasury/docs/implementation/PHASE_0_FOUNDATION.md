# Phase 0: Foundation Enhancement

## Objective

Solidify the domain model and prepare for multi-rail payment architecture. This phase extends existing entities and creates the foundational value objects needed for all subsequent phases.

**Duration**: Weeks 1-4
**Prerequisites**: Current codebase with basic BankAccount and Payment entities

---

## Task Breakdown

### Week 1: Payment Rail Foundation

#### Task 1.1: Create PaymentRail Value Object

**File**: `src/domain/value-objects/payment-rail.ts`

```typescript
export type RailType =
  | 'swift'
  | 'swift_gpi'
  | 'ach'
  | 'same_day_ach'
  | 'rtp'
  | 'fednow'
  | 'wire'
  | 'chaps'
  | 'sepa'
  | 'sepa_instant'
  | 'stablecoin_usdc'
  | 'stablecoin_usdt'
  | 'local';

export interface Corridor {
  sourceCurrency: string;
  destinationCurrency: string;
  sourceCountries: string[];
  destinationCountries: string[];
}

export interface CostStructure {
  fixedFee: Money;
  percentageFee: number;  // Decimal (0.01 = 1%)
  fxSpread?: number;      // Decimal
  minimumFee?: Money;
  maximumFee?: Money;
}

export interface AvailabilitySchedule {
  is24x7: boolean;
  operatingDays?: number[];  // 0=Sunday, 6=Saturday
  operatingHoursStart?: string;  // HH:MM
  operatingHoursEnd?: string;    // HH:MM
  timezone?: string;
}

export interface PaymentRail {
  readonly id: string;
  readonly type: RailType;
  readonly name: string;
  readonly provider?: string;
  readonly corridors: Corridor[];
  readonly costStructure: CostStructure;
  readonly minSettlementMinutes: number;
  readonly maxSettlementMinutes: number;
  readonly availability: AvailabilitySchedule;
  readonly complianceRequirements: string[];
  readonly supportsRecall: boolean;
  readonly supportsTracking: boolean;
  readonly maxAmount?: Money;
  readonly status: 'active' | 'degraded' | 'disabled';
}
```

#### Task 1.2: Create CutoffWindow Value Object

**File**: `src/domain/value-objects/cutoff-window.ts`

```typescript
export interface CutoffWindow {
  readonly id: string;
  readonly bankId: string;
  readonly railId: string;
  readonly currency: string;
  readonly cutoffTime: string;         // HH:MM format
  readonly timezone: string;           // IANA timezone
  readonly stpAdjustmentMinutes: number;  // Earlier cutoff for non-STP
  readonly activeDays: number[];       // 0=Sunday, 6=Saturday
  readonly holidayCalendarId: string;
}

export interface HolidayCalendar {
  readonly id: string;
  readonly name: string;
  readonly countryCode?: string;
  readonly bankCode?: string;
  readonly year: number;
  readonly holidays: Date[];
}
```

#### Task 1.3: Create RoutingDecision Value Object

**File**: `src/domain/value-objects/routing-decision.ts`

```typescript
export interface RailOption {
  railId: string;
  railType: RailType;
  estimatedCost: Money;
  estimatedSettlementMinutes: number;
  availabilityStatus: 'available' | 'degraded' | 'unavailable';
  complianceStatus: 'clear' | 'review_required' | 'blocked';
  costScore: number;     // 0-100
  speedScore: number;    // 0-100
  riskScore: number;     // 0-100
  totalScore: number;    // Weighted combination
  disqualificationReason?: string;
}

export interface RoutingDecision {
  readonly id: string;
  readonly paymentId: string;
  readonly decisionTimestamp: Date;
  readonly urgencyLevel: 'standard' | 'urgent' | 'critical';
  readonly optionsConsidered: RailOption[];
  readonly selectedRailId: string;
  readonly selectionReason: string;
  readonly fallbackRailId?: string;
  readonly scoreWeights: {
    cost: number;
    speed: number;
    risk: number;
  };
}
```

#### Task 1.4: Database Migration - Payment Rails

**File**: `migrations/20260127_001_payment_rails.sql`

```sql
-- Payment Rails table
CREATE TABLE banking.payment_rails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  provider VARCHAR(100),
  corridors JSONB NOT NULL DEFAULT '[]',
  cost_fixed_amount DECIMAL(20,4),
  cost_fixed_currency VARCHAR(3),
  cost_percentage DECIMAL(8,6),
  cost_fx_spread DECIMAL(8,6),
  cost_minimum_amount DECIMAL(20,4),
  cost_minimum_currency VARCHAR(3),
  cost_maximum_amount DECIMAL(20,4),
  cost_maximum_currency VARCHAR(3),
  min_settlement_minutes INT NOT NULL,
  max_settlement_minutes INT NOT NULL,
  availability_24x7 BOOLEAN DEFAULT false,
  availability_days INT[],
  availability_hours_start TIME,
  availability_hours_end TIME,
  availability_timezone VARCHAR(50),
  compliance_requirements TEXT[],
  supports_recall BOOLEAN DEFAULT false,
  supports_tracking BOOLEAN DEFAULT false,
  max_amount DECIMAL(20,4),
  max_amount_currency VARCHAR(3),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_rail_type CHECK (type IN (
    'swift', 'swift_gpi', 'ach', 'same_day_ach', 'rtp', 'fednow',
    'wire', 'chaps', 'sepa', 'sepa_instant', 'stablecoin_usdc',
    'stablecoin_usdt', 'local'
  )),
  CONSTRAINT chk_rail_status CHECK (status IN ('active', 'degraded', 'disabled'))
);

CREATE INDEX idx_payment_rails_type ON banking.payment_rails(type);
CREATE INDEX idx_payment_rails_status ON banking.payment_rails(status);

-- Cutoff Windows table
CREATE TABLE banking.cutoff_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID NOT NULL,
  rail_id UUID NOT NULL REFERENCES banking.payment_rails(id),
  currency VARCHAR(3) NOT NULL,
  cutoff_time TIME NOT NULL,
  timezone VARCHAR(50) NOT NULL,
  stp_adjustment_minutes INT NOT NULL DEFAULT 60,
  active_days INT[] NOT NULL DEFAULT '{1,2,3,4,5}',
  holiday_calendar_id UUID,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE(bank_id, rail_id, currency)
);

CREATE INDEX idx_cutoff_windows_bank ON banking.cutoff_windows(bank_id);
CREATE INDEX idx_cutoff_windows_rail ON banking.cutoff_windows(rail_id);

-- Holiday Calendars table
CREATE TABLE banking.holiday_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  country_code VARCHAR(3),
  bank_code VARCHAR(50),
  year INT NOT NULL,
  holidays DATE[] NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE(country_code, bank_code, year)
);

CREATE INDEX idx_holiday_calendars_year ON banking.holiday_calendars(year);

-- Routing Decisions table (audit trail)
CREATE TABLE banking.routing_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL,
  decision_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  urgency_level VARCHAR(20) NOT NULL DEFAULT 'standard',
  options_considered JSONB NOT NULL,
  selected_rail_id UUID REFERENCES banking.payment_rails(id),
  selection_reason TEXT NOT NULL,
  fallback_rail_id UUID REFERENCES banking.payment_rails(id),
  score_weight_cost DECIMAL(3,2) NOT NULL,
  score_weight_speed DECIMAL(3,2) NOT NULL,
  score_weight_risk DECIMAL(3,2) NOT NULL,

  CONSTRAINT chk_urgency CHECK (urgency_level IN ('standard', 'urgent', 'critical'))
);

CREATE INDEX idx_routing_decisions_payment ON banking.routing_decisions(payment_id);
CREATE INDEX idx_routing_decisions_timestamp ON banking.routing_decisions(decision_timestamp);
```

---

### Week 2: Extended Payment Entity

#### Task 2.1: Extend Payment Types

**File**: `src/types/financial.ts` (extend)

```typescript
// Add to existing types
export type PaymentMethod =
  | 'bank_transfer'
  | 'ach'
  | 'same_day_ach'
  | 'wire'
  | 'swift'
  | 'swift_gpi'
  | 'rtp'
  | 'fednow'
  | 'sepa'
  | 'sepa_instant'
  | 'chaps'
  | 'stablecoin'
  | 'check'
  | 'credit_card'
  | 'debit_card';

export type PaymentUrgency = 'standard' | 'urgent' | 'critical';

export type PaymentFailureCode =
  | 'AC04'  // Account closed
  | 'AM04'  // Insufficient funds
  | 'BE04'  // Missing creditor address
  | 'RC01'  // Bank identifier incorrect
  | 'CUST'  // Customer request
  | 'NARR'  // Narrative/other
  | 'TECH'  // Technical failure
  | 'COMP'  // Compliance block
  | 'CUTOFF'  // Missed cutoff
  | 'TIMEOUT';  // Processing timeout
```

#### Task 2.2: Create Extended Payment Entity

**File**: `src/domain/entities/payment-extended.ts`

```typescript
import type { Money, PaymentMethod, PaymentUrgency, PaymentFailureCode } from '../../types/index.js';
import type { DomainEvent } from '../events/domain-event.js';
import type { RoutingDecision } from '../value-objects/routing-decision.js';

export type PaymentStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'pending'
  | 'routing'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'recalled'
  | 'reversed';

export interface PaymentProps {
  id: string;
  transactionId: string;
  sourceAccountId?: string;
  destinationAccountId?: string;
  amount: Money;
  method: PaymentMethod;
  urgency: PaymentUrgency;
  invoiceId?: string;
  description?: string;

  // Rail and routing
  railId?: string;
  routingDecisionId?: string;

  // Timing
  requestedExecutionDate?: Date;
  scheduledSettlement?: Date;
  cutoffDeadline?: Date;
  actualSettlement?: Date;

  // Tracking
  gpiUetr?: string;           // SWIFT gpi unique reference
  externalReference?: string;  // Bank reference

  // Status
  status: PaymentStatus;
  failureCode?: PaymentFailureCode;
  failureReason?: string;

  // Recovery
  recallId?: string;
  inquiryId?: string;

  // Audit
  createdAt: Date;
  createdBy?: string;
  approvedAt?: Date;
  approvedBy?: string;
  processedAt?: Date;
  completedAt?: Date;
}

export class PaymentExtended {
  private readonly _props: PaymentProps;
  private readonly _domainEvents: DomainEvent[] = [];

  constructor(props: PaymentProps) {
    this._props = { ...props };
  }

  // === State Transitions ===

  submitForApproval(): void {
    this.assertStatus(['draft'], 'Can only submit draft payments for approval');
    this._props.status = 'pending_approval';
    this.addEvent('payment.submitted_for_approval');
  }

  approve(approvedBy: string): void {
    this.assertStatus(['pending_approval'], 'Can only approve pending payments');
    this._props.status = 'approved';
    this._props.approvedAt = new Date();
    this._props.approvedBy = approvedBy;
    this.addEvent('payment.approved', { approvedBy });
  }

  reject(reason: string, rejectedBy: string): void {
    this.assertStatus(['pending_approval'], 'Can only reject pending payments');
    this._props.status = 'cancelled';
    this._props.failureReason = reason;
    this.addEvent('payment.rejected', { reason, rejectedBy });
  }

  assignRouting(decision: RoutingDecision): void {
    this.assertStatus(['approved', 'pending'], 'Can only route approved/pending payments');
    this._props.status = 'routing';
    this._props.railId = decision.selectedRailId;
    this._props.routingDecisionId = decision.id;
    this.addEvent('payment.routing_assigned', {
      railId: decision.selectedRailId,
      fallbackRailId: decision.fallbackRailId,
    });
  }

  startProcessing(
    scheduledSettlement: Date,
    cutoffDeadline: Date,
    externalReference?: string,
    gpiUetr?: string
  ): void {
    this.assertStatus(['routing'], 'Can only process routed payments');
    this._props.status = 'processing';
    this._props.processedAt = new Date();
    this._props.scheduledSettlement = scheduledSettlement;
    this._props.cutoffDeadline = cutoffDeadline;
    this._props.externalReference = externalReference;
    this._props.gpiUetr = gpiUetr;
    this.addEvent('payment.processing_started', {
      railId: this._props.railId,
      scheduledSettlement,
      externalReference,
      gpiUetr,
    });
  }

  complete(actualSettlement?: Date): void {
    this.assertStatus(['processing'], 'Can only complete processing payments');
    this._props.status = 'completed';
    this._props.completedAt = new Date();
    this._props.actualSettlement = actualSettlement ?? new Date();
    this.addEvent('payment.completed', {
      amount: this._props.amount,
      actualSettlement: this._props.actualSettlement,
    });
  }

  fail(code: PaymentFailureCode, reason: string): void {
    this.assertStatus(['routing', 'processing'], 'Can only fail routing/processing payments');
    this._props.status = 'failed';
    this._props.failureCode = code;
    this._props.failureReason = reason;
    this.addEvent('payment.failed', { code, reason });
  }

  initiateRecall(recallId: string, reason: string): void {
    this.assertStatus(['processing', 'completed'], 'Can only recall processing/completed payments');
    this._props.recallId = recallId;
    this.addEvent('payment.recall_initiated', { recallId, reason });
  }

  markRecalled(): void {
    if (!this._props.recallId) {
      throw new Error('No recall in progress');
    }
    this._props.status = 'recalled';
    this.addEvent('payment.recalled', { recallId: this._props.recallId });
  }

  openInquiry(inquiryId: string): void {
    this._props.inquiryId = inquiryId;
    this.addEvent('payment.inquiry_opened', { inquiryId });
  }

  // === Helpers ===

  private assertStatus(allowed: PaymentStatus[], message: string): void {
    if (!allowed.includes(this._props.status)) {
      throw new Error(`${message}. Current status: ${this._props.status}`);
    }
  }

  private addEvent(type: string, payload: Record<string, unknown> = {}): void {
    this._domainEvents.push({
      type,
      aggregateId: this._props.id,
      aggregateType: 'Payment',
      payload: { ...payload, paymentId: this._props.id, transactionId: this._props.transactionId },
      occurredAt: new Date(),
    });
  }

  pullDomainEvents(): DomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents.length = 0;
    return events;
  }

  // === Queries ===

  canMakeCutoff(now: Date = new Date()): boolean {
    if (!this._props.cutoffDeadline) return true;
    const buffer = 30 * 60 * 1000; // 30 minutes
    return now.getTime() < this._props.cutoffDeadline.getTime() - buffer;
  }

  get isTerminal(): boolean {
    return ['completed', 'failed', 'cancelled', 'recalled', 'reversed'].includes(this._props.status);
  }

  get requiresApproval(): boolean {
    // Implement approval logic based on amount/entity
    return this._props.amount.amount > 10000;
  }

  // === Getters ===
  get id(): string { return this._props.id; }
  get transactionId(): string { return this._props.transactionId; }
  get amount(): Money { return { ...this._props.amount }; }
  get method(): PaymentMethod { return this._props.method; }
  get urgency(): PaymentUrgency { return this._props.urgency; }
  get status(): PaymentStatus { return this._props.status; }
  get railId(): string | undefined { return this._props.railId; }
  get routingDecisionId(): string | undefined { return this._props.routingDecisionId; }
  get scheduledSettlement(): Date | undefined { return this._props.scheduledSettlement; }
  get cutoffDeadline(): Date | undefined { return this._props.cutoffDeadline; }
  get actualSettlement(): Date | undefined { return this._props.actualSettlement; }
  get gpiUetr(): string | undefined { return this._props.gpiUetr; }
  get externalReference(): string | undefined { return this._props.externalReference; }
  get failureCode(): PaymentFailureCode | undefined { return this._props.failureCode; }
  get failureReason(): string | undefined { return this._props.failureReason; }
  get recallId(): string | undefined { return this._props.recallId; }
  get inquiryId(): string | undefined { return this._props.inquiryId; }
  get createdAt(): Date { return this._props.createdAt; }
}
```

#### Task 2.3: Database Migration - Payment Extensions

**File**: `migrations/20260127_002_payment_extensions.sql`

```sql
-- Extend payments table
ALTER TABLE banking.payments
  ADD COLUMN IF NOT EXISTS urgency VARCHAR(20) DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS source_account_id UUID,
  ADD COLUMN IF NOT EXISTS destination_account_id UUID,
  ADD COLUMN IF NOT EXISTS rail_id UUID REFERENCES banking.payment_rails(id),
  ADD COLUMN IF NOT EXISTS routing_decision_id UUID REFERENCES banking.routing_decisions(id),
  ADD COLUMN IF NOT EXISTS requested_execution_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS scheduled_settlement TIMESTAMP,
  ADD COLUMN IF NOT EXISTS cutoff_deadline TIMESTAMP,
  ADD COLUMN IF NOT EXISTS actual_settlement TIMESTAMP,
  ADD COLUMN IF NOT EXISTS gpi_uetr VARCHAR(36),
  ADD COLUMN IF NOT EXISTS external_reference VARCHAR(100),
  ADD COLUMN IF NOT EXISTS failure_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS recall_id UUID,
  ADD COLUMN IF NOT EXISTS inquiry_id UUID,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS approved_by UUID,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

-- Add new status values
ALTER TABLE banking.payments
  DROP CONSTRAINT IF EXISTS chk_payment_status;

ALTER TABLE banking.payments
  ADD CONSTRAINT chk_payment_status CHECK (
    status IN (
      'draft', 'pending_approval', 'approved', 'pending',
      'routing', 'processing', 'completed', 'failed',
      'cancelled', 'recalled', 'reversed'
    )
  );

-- Add urgency constraint
ALTER TABLE banking.payments
  ADD CONSTRAINT chk_payment_urgency CHECK (
    urgency IN ('standard', 'urgent', 'critical')
  );

-- New indexes
CREATE INDEX IF NOT EXISTS idx_payments_rail ON banking.payments(rail_id);
CREATE INDEX IF NOT EXISTS idx_payments_urgency ON banking.payments(urgency);
CREATE INDEX IF NOT EXISTS idx_payments_scheduled_settlement ON banking.payments(scheduled_settlement);
CREATE INDEX IF NOT EXISTS idx_payments_gpi_uetr ON banking.payments(gpi_uetr);
CREATE INDEX IF NOT EXISTS idx_payments_external_ref ON banking.payments(external_reference);
```

---

### Week 3: Extended Bank Account & Repository

#### Task 3.1: Extend Bank Account Entity

**File**: `src/domain/entities/bank-account-extended.ts`

```typescript
import type { Money, BankAccountType, BankAccountStatus } from '../../types/index.js';
import type { DomainEvent } from '../events/domain-event.js';

export interface BankAccountExtendedProps {
  id: string;
  entityId: string;
  accountName: string;
  accountType: BankAccountType;

  // Bank identification
  bankId: string;           // Reference to BankRelationship
  bankName: string;
  swiftBic?: string;
  iban?: string;
  accountNumber: string;
  routingNumber?: string;
  sortCode?: string;        // UK

  // Balance
  currency: string;
  balance: Money;
  availableBalance?: Money;  // May differ from balance

  // Virtual accounts (J.P. Morgan VAM support)
  virtualAccountId?: string;
  parentAccountId?: string;  // If this is a virtual account

  // Cash pooling
  poolParticipant: boolean;
  poolRole?: 'header' | 'participant';
  poolId?: string;

  // Operations
  cutoffWindowId?: string;
  defaultRailId?: string;

  // Status
  status: BankAccountStatus;
  isPrimary: boolean;

  // Audit
  createdAt: Date;
  updatedAt: Date;
}

export class BankAccountExtended {
  private readonly _props: BankAccountExtendedProps;
  private readonly _domainEvents: DomainEvent[] = [];

  constructor(props: BankAccountExtendedProps) {
    this._props = { ...props };
  }

  // ... (existing methods from BankAccount)

  // === New Methods ===

  joinPool(poolId: string, role: 'header' | 'participant'): void {
    if (this._props.poolParticipant) {
      throw new Error('Account already in a pool');
    }
    this._props.poolParticipant = true;
    this._props.poolRole = role;
    this._props.poolId = poolId;
    this.addEvent('account.joined_pool', { poolId, role });
  }

  leavePool(): void {
    if (!this._props.poolParticipant) {
      throw new Error('Account not in a pool');
    }
    const poolId = this._props.poolId;
    this._props.poolParticipant = false;
    this._props.poolRole = undefined;
    this._props.poolId = undefined;
    this.addEvent('account.left_pool', { poolId });
  }

  assignCutoffWindow(windowId: string): void {
    this._props.cutoffWindowId = windowId;
    this.addEvent('account.cutoff_assigned', { windowId });
  }

  assignDefaultRail(railId: string): void {
    this._props.defaultRailId = railId;
    this.addEvent('account.default_rail_assigned', { railId });
  }

  updateAvailableBalance(available: Money): void {
    if (available.currency !== this._props.currency) {
      throw new Error('Currency mismatch');
    }
    this._props.availableBalance = available;
    this.addEvent('account.available_balance_updated', { available });
  }

  // ... (helpers and getters)
}
```

#### Task 3.2: Create Repository Interfaces

**File**: `src/domain/repositories/payment-rail.repository.ts`

```typescript
import type { PaymentRail, RailType } from '../value-objects/payment-rail.js';

export interface PaymentRailRepository {
  findById(id: string): Promise<PaymentRail | null>;
  findByType(type: RailType): Promise<PaymentRail[]>;
  findByCorridor(
    sourceCurrency: string,
    destCurrency: string,
    sourceCountry?: string,
    destCountry?: string
  ): Promise<PaymentRail[]>;
  findActive(): Promise<PaymentRail[]>;
  save(rail: PaymentRail): Promise<void>;
  updateStatus(id: string, status: PaymentRail['status']): Promise<void>;
}
```

**File**: `src/domain/repositories/cutoff-window.repository.ts`

```typescript
import type { CutoffWindow, HolidayCalendar } from '../value-objects/cutoff-window.js';

export interface CutoffWindowRepository {
  findByBankAndRail(bankId: string, railId: string, currency: string): Promise<CutoffWindow | null>;
  findByBank(bankId: string): Promise<CutoffWindow[]>;
  save(window: CutoffWindow): Promise<void>;
}

export interface HolidayCalendarRepository {
  findById(id: string): Promise<HolidayCalendar | null>;
  findByCountryAndYear(countryCode: string, year: number): Promise<HolidayCalendar | null>;
  findByBankAndYear(bankCode: string, year: number): Promise<HolidayCalendar | null>;
  save(calendar: HolidayCalendar): Promise<void>;
}
```

---

### Week 4: Seed Data & Testing

#### Task 4.1: Seed Payment Rails

**File**: `src/infrastructure/seeds/payment-rails.seed.ts`

```typescript
import type { PaymentRail } from '../../domain/value-objects/payment-rail.js';

export const defaultPaymentRails: Omit<PaymentRail, 'id'>[] = [
  {
    type: 'ach',
    name: 'ACH Standard',
    provider: 'Federal Reserve',
    corridors: [
      { sourceCurrency: 'USD', destinationCurrency: 'USD', sourceCountries: ['US'], destinationCountries: ['US'] }
    ],
    costStructure: { fixedFee: { amount: 0.25, currency: 'USD' }, percentageFee: 0 },
    minSettlementMinutes: 1440,  // 1 day
    maxSettlementMinutes: 2880,  // 2 days
    availability: { is24x7: false, operatingDays: [1,2,3,4,5], timezone: 'America/New_York' },
    complianceRequirements: ['BSA', 'OFAC'],
    supportsRecall: true,
    supportsTracking: false,
    status: 'active',
  },
  {
    type: 'same_day_ach',
    name: 'Same Day ACH',
    provider: 'Federal Reserve',
    corridors: [
      { sourceCurrency: 'USD', destinationCurrency: 'USD', sourceCountries: ['US'], destinationCountries: ['US'] }
    ],
    costStructure: { fixedFee: { amount: 1.00, currency: 'USD' }, percentageFee: 0 },
    minSettlementMinutes: 60,
    maxSettlementMinutes: 480,  // Same day
    availability: { is24x7: false, operatingDays: [1,2,3,4,5], timezone: 'America/New_York' },
    complianceRequirements: ['BSA', 'OFAC'],
    supportsRecall: true,
    supportsTracking: false,
    maxAmount: { amount: 1000000, currency: 'USD' },
    status: 'active',
  },
  {
    type: 'wire',
    name: 'Fedwire',
    provider: 'Federal Reserve',
    corridors: [
      { sourceCurrency: 'USD', destinationCurrency: 'USD', sourceCountries: ['US'], destinationCountries: ['US'] }
    ],
    costStructure: { fixedFee: { amount: 25.00, currency: 'USD' }, percentageFee: 0 },
    minSettlementMinutes: 0,
    maxSettlementMinutes: 60,
    availability: { is24x7: false, operatingDays: [1,2,3,4,5], operatingHoursStart: '09:00', operatingHoursEnd: '18:30', timezone: 'America/New_York' },
    complianceRequirements: ['BSA', 'OFAC'],
    supportsRecall: false,
    supportsTracking: true,
    status: 'active',
  },
  {
    type: 'swift_gpi',
    name: 'SWIFT gpi',
    provider: 'SWIFT',
    corridors: [
      { sourceCurrency: 'USD', destinationCurrency: '*', sourceCountries: ['*'], destinationCountries: ['*'] }
    ],
    costStructure: { fixedFee: { amount: 35.00, currency: 'USD' }, percentageFee: 0, fxSpread: 0.01 },
    minSettlementMinutes: 30,
    maxSettlementMinutes: 2880,
    availability: { is24x7: false, operatingDays: [1,2,3,4,5], timezone: 'UTC' },
    complianceRequirements: ['BSA', 'OFAC', 'FATF'],
    supportsRecall: true,
    supportsTracking: true,
    status: 'active',
  },
  {
    type: 'rtp',
    name: 'RTP (Real-Time Payments)',
    provider: 'The Clearing House',
    corridors: [
      { sourceCurrency: 'USD', destinationCurrency: 'USD', sourceCountries: ['US'], destinationCountries: ['US'] }
    ],
    costStructure: { fixedFee: { amount: 0.50, currency: 'USD' }, percentageFee: 0 },
    minSettlementMinutes: 0,
    maxSettlementMinutes: 1,
    availability: { is24x7: true },
    complianceRequirements: ['BSA', 'OFAC'],
    supportsRecall: false,
    supportsTracking: true,
    maxAmount: { amount: 1000000, currency: 'USD' },
    status: 'active',
  },
  {
    type: 'sepa_instant',
    name: 'SEPA Instant',
    provider: 'EBA Clearing',
    corridors: [
      { sourceCurrency: 'EUR', destinationCurrency: 'EUR', sourceCountries: ['EU', 'EEA'], destinationCountries: ['EU', 'EEA'] }
    ],
    costStructure: { fixedFee: { amount: 0.20, currency: 'EUR' }, percentageFee: 0 },
    minSettlementMinutes: 0,
    maxSettlementMinutes: 1,
    availability: { is24x7: true },
    complianceRequirements: ['AMLD6', 'PSD2'],
    supportsRecall: true,
    supportsTracking: true,
    maxAmount: { amount: 100000, currency: 'EUR' },
    status: 'active',
  },
  {
    type: 'stablecoin_usdc',
    name: 'USDC Transfer',
    provider: 'Circle',
    corridors: [
      { sourceCurrency: 'USD', destinationCurrency: 'USD', sourceCountries: ['*'], destinationCountries: ['*'] }
    ],
    costStructure: { fixedFee: { amount: 1.00, currency: 'USD' }, percentageFee: 0 },
    minSettlementMinutes: 1,
    maxSettlementMinutes: 15,
    availability: { is24x7: true },
    complianceRequirements: ['BSA', 'OFAC', 'GENIUS_ACT'],
    supportsRecall: false,  // Irreversible
    supportsTracking: true,
    status: 'active',
  },
];
```

#### Task 4.2: Integration Tests

**File**: `tests/integration/payment-routing.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { PaymentOrchestrationEngine } from '../../src/application/services/payment-orchestration.js';

describe('Payment Routing', () => {
  let orchestrator: PaymentOrchestrationEngine;

  beforeAll(async () => {
    // Setup test database and seed rails
    orchestrator = new PaymentOrchestrationEngine(/* dependencies */);
  });

  it('should select ACH for small domestic USD payments', async () => {
    const request = {
      amount: { amount: 500, currency: 'USD' },
      sourceCountry: 'US',
      destCountry: 'US',
      urgency: 'standard',
    };

    const decision = await orchestrator.route(request);

    expect(decision.selectedRailId).toBeDefined();
    expect(['ach', 'same_day_ach']).toContain(
      decision.optionsConsidered.find(o => o.railId === decision.selectedRailId)?.railType
    );
  });

  it('should select wire for urgent large domestic payments', async () => {
    const request = {
      amount: { amount: 500000, currency: 'USD' },
      sourceCountry: 'US',
      destCountry: 'US',
      urgency: 'critical',
    };

    const decision = await orchestrator.route(request);

    const selectedOption = decision.optionsConsidered.find(
      o => o.railId === decision.selectedRailId
    );
    expect(selectedOption?.railType).toBe('wire');
  });

  it('should select SWIFT gpi for international payments', async () => {
    const request = {
      amount: { amount: 10000, currency: 'USD' },
      sourceCountry: 'US',
      destCountry: 'GB',
      urgency: 'standard',
    };

    const decision = await orchestrator.route(request);

    const selectedOption = decision.optionsConsidered.find(
      o => o.railId === decision.selectedRailId
    );
    expect(selectedOption?.railType).toBe('swift_gpi');
  });

  it('should provide fallback rail', async () => {
    const request = {
      amount: { amount: 1000, currency: 'USD' },
      sourceCountry: 'US',
      destCountry: 'US',
      urgency: 'standard',
    };

    const decision = await orchestrator.route(request);

    expect(decision.fallbackRailId).toBeDefined();
    expect(decision.fallbackRailId).not.toBe(decision.selectedRailId);
  });
});
```

---

## Deliverables Checklist

### Week 1
- [ ] PaymentRail value object created
- [ ] CutoffWindow value object created
- [ ] RoutingDecision value object created
- [ ] Database migration for payment_rails table
- [ ] Database migration for cutoff_windows table
- [ ] Database migration for holiday_calendars table
- [ ] Database migration for routing_decisions table

### Week 2
- [ ] Extended payment types defined
- [ ] PaymentExtended entity created
- [ ] Payment database migration applied
- [ ] Payment repository updated

### Week 3
- [ ] BankAccountExtended entity created
- [ ] PaymentRailRepository interface created
- [ ] CutoffWindowRepository interface created
- [ ] Repository implementations created

### Week 4
- [ ] Default payment rails seeded
- [ ] Default cutoff windows seeded
- [ ] US holiday calendar seeded
- [ ] Integration tests passing
- [ ] Unit tests for new entities
- [ ] Documentation updated

---

## Success Criteria

| Criteria | Measurement |
|----------|-------------|
| All migrations run successfully | `npm run migrate` completes |
| Seed data loads correctly | Rails and cutoffs queryable |
| Extended entities work | Unit tests pass |
| Repository operations work | Integration tests pass |
| Backward compatible | Existing tests still pass |

---

## Dependencies for Phase 1

Phase 0 creates the foundation for Phase 1 (Payment Orchestration):

| Phase 0 Output | Phase 1 Input |
|----------------|---------------|
| PaymentRail value object | Rail selection logic |
| CutoffWindow value object | Cutoff checking |
| RoutingDecision value object | Decision recording |
| PaymentExtended entity | Orchestration state machine |
| Repositories | Data access layer |

---

*Generated: January 2026*
*Next Phase: [PHASE_1_ORCHESTRATION.md](./PHASE_1_ORCHESTRATION.md)*
