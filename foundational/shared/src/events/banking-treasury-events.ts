import { DomainEvent, createDomainEvent } from './base.js';
import { Money, CurrencyCode, Jurisdiction } from '../value-objects/index.js';

// ============================================================
// Bank Account Events
// ============================================================

export interface BankAccountOpenedPayload {
  accountNumber: string;
  accountName: string;
  accountType: BankAccountType;
  bankId: string;
  bankName: string;
  currency: CurrencyCode;
  jurisdiction: Jurisdiction;
  openingDate: string; // ISO date
  signatories: string[];
  isBaaSAccount: boolean;
  baaSProviderId?: string;
}

export type BankAccountType =
  | 'operating'
  | 'payroll'
  | 'tax'
  | 'escrow'
  | 'investment'
  | 'foreign_currency'
  | 'zero_balance'      // For cash pooling
  | 'concentration';    // Master account for pooling

export type BankAccountOpenedEvent = DomainEvent<'bank_account.opened', BankAccountOpenedPayload>;

// ---

export interface BankAccountClosedPayload {
  closingDate: string; // ISO date
  reason: string;
  finalBalance: Money;
  fundsTransferredTo?: string; // Account ID
  closureType: 'voluntary' | 'bank_initiated' | 'regulatory';
}

export type BankAccountClosedEvent = DomainEvent<'bank_account.closed', BankAccountClosedPayload>;

// ---

export interface BankAccountUpdatedPayload {
  changes: {
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }[];
}

export type BankAccountUpdatedEvent = DomainEvent<'bank_account.updated', BankAccountUpdatedPayload>;

// ============================================================
// Payment Events
// ============================================================

export interface PaymentInitiatedPayload {
  paymentType: PaymentType;
  amount: Money;
  fromAccountId: string;
  toAccountId?: string;
  beneficiaryName?: string;
  beneficiaryAccountNumber?: string;
  beneficiaryBankCode?: string; // SWIFT/BIC or routing number
  paymentDate: string; // ISO date
  valueDate: string; // ISO date
  reference: string;
  remittanceInfo?: string;
  isIntercompany: boolean;
  relatedEntityId?: string; // For intercompany
}

export type PaymentType =
  | 'wire_domestic'
  | 'wire_international'
  | 'ach'
  | 'check'
  | 'internal_transfer'
  | 'intercompany'
  | 'payroll'
  | 'tax_payment'
  | 'vendor_payment';

export type PaymentInitiatedEvent = DomainEvent<'payment.initiated', PaymentInitiatedPayload>;

// ---

export interface PaymentCompletedPayload {
  status: 'completed' | 'settled';
  completedAt: string; // ISO timestamp
  confirmationNumber?: string;
  actualValueDate: string; // ISO date
  fees?: Money;
  exchangeRate?: string; // Decimal as string, if FX involved
}

export type PaymentCompletedEvent = DomainEvent<'payment.completed', PaymentCompletedPayload>;

// ---

export interface PaymentFailedPayload {
  failureReason: string;
  failureCode?: string;
  failedAt: string; // ISO timestamp
  isRetryable: boolean;
  nextRetryAt?: string; // ISO timestamp
}

export type PaymentFailedEvent = DomainEvent<'payment.failed', PaymentFailedPayload>;

// ---

export interface PaymentCancelledPayload {
  cancelledBy: string;
  cancelledAt: string; // ISO timestamp
  reason: string;
  refundInitiated: boolean;
}

export type PaymentCancelledEvent = DomainEvent<'payment.cancelled', PaymentCancelledPayload>;

// ============================================================
// Cash Position Events
// ============================================================

export interface CashPositionUpdatedPayload {
  asOfDate: string; // ISO date
  asOfTime: string; // ISO timestamp
  positions: CashPosition[];
  totalPosition: Money;
  consolidatedCurrency: CurrencyCode;
}

export interface CashPosition {
  accountId: string;
  accountName: string;
  bankName: string;
  currency: CurrencyCode;
  ledgerBalance: Money;
  availableBalance: Money;
  pendingCredits: Money;
  pendingDebits: Money;
}

export type CashPositionUpdatedEvent = DomainEvent<'cash_position.updated', CashPositionUpdatedPayload>;

// ============================================================
// Cash Pooling Events
// ============================================================

/**
 * Research insight: Physical pooling creates ACTUAL intercompany loans,
 * requiring interest calculations and transfer pricing documentation.
 * Notional pooling is interest offset only - no actual fund movement.
 */
export interface CashPoolSweepExecutedPayload {
  poolId: string;
  poolType: 'physical' | 'notional';
  sweepDate: string; // ISO date
  participantAccountId: string;
  participantEntityId: string;
  concentrationAccountId: string;
  sweepDirection: 'to_concentration' | 'from_concentration';
  sweepAmount: Money;
  createsIntercompanyLoan: boolean;
  loanTerms?: {
    interestRate: string; // Decimal as string
    rateType: 'fixed' | 'variable';
    benchmark?: string; // e.g., 'SOFR', 'EURIBOR'
    spread?: string; // Decimal as string
  };
}

export type CashPoolSweepExecutedEvent = DomainEvent<'cash_pool.sweep_executed', CashPoolSweepExecutedPayload>;

// ---

export interface CashPoolInterestCalculatedPayload {
  poolId: string;
  calculationDate: string; // ISO date
  periodStart: string; // ISO date
  periodEnd: string; // ISO date
  participantInterest: Array<{
    entityId: string;
    accountId: string;
    averageBalance: Money;
    interestAmount: Money;
    isPayable: boolean; // true = owes interest, false = earns interest
  }>;
  netInterest: Money;
  interestRate: string; // Decimal as string
  requiresTransferPricingDoc: boolean;
}

export type CashPoolInterestCalculatedEvent = DomainEvent<'cash_pool.interest_calculated', CashPoolInterestCalculatedPayload>;

// ============================================================
// Bank Reconciliation Events
// ============================================================

export interface BankStatementReceivedPayload {
  accountId: string;
  statementDate: string; // ISO date
  periodStart: string; // ISO date
  periodEnd: string; // ISO date
  openingBalance: Money;
  closingBalance: Money;
  transactionCount: number;
  source: 'manual' | 'api' | 'file_import';
}

export type BankStatementReceivedEvent = DomainEvent<'bank_statement.received', BankStatementReceivedPayload>;

// ============================================================
// De-Risking Events
// ============================================================

/**
 * Research insight: Banks can and do terminate relationships based on
 * profitability, risk appetite, or regulatory pressure. De-risking
 * signals include: increased documentation requests, fee increases,
 * service restrictions, or explicit relationship review notices.
 */
export interface DeRiskingAlertRaisedPayload {
  bankId: string;
  bankName: string;
  alertType: DeRiskingSignalType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detectedAt: string; // ISO timestamp
  affectedAccounts: string[];
  recommendedActions: string[];
  contingencyAccountsAvailable: number;
}

export type DeRiskingSignalType =
  | 'increased_documentation_requests'
  | 'fee_increase_notice'
  | 'service_restriction'
  | 'relationship_review_notice'
  | 'account_closure_notice'
  | 'compliance_inquiry'
  | 'activity_monitoring_increase';

export type DeRiskingAlertRaisedEvent = DomainEvent<'derisking.alert_raised', DeRiskingAlertRaisedPayload>;

// ---

export interface DeRiskingAlertResolvedPayload {
  alertId: string;
  resolution: 'maintained' | 'restricted' | 'terminated' | 'false_alarm';
  resolvedAt: string; // ISO timestamp
  notes: string;
  contingencyActivated: boolean;
}

export type DeRiskingAlertResolvedEvent = DomainEvent<'derisking.alert_resolved', DeRiskingAlertResolvedPayload>;

// ============================================================
// BaaS Events
// ============================================================

/**
 * Research insight: Middleware creates single point of failure risk.
 * Synapse collapse showed depositors can lose access to funds when
 * middleware fails, even if underlying bank is solvent.
 */
export interface BaaSProviderStatusChangedPayload {
  providerId: string;
  providerName: string;
  previousStatus: BaaSProviderStatus;
  newStatus: BaaSProviderStatus;
  affectedAccounts: string[];
  estimatedImpact?: string;
  mitigationRequired: boolean;
}

export type BaaSProviderStatus =
  | 'operational'
  | 'degraded'
  | 'maintenance'
  | 'incident'
  | 'critical'
  | 'terminated';

export type BaaSProviderStatusChangedEvent = DomainEvent<'baas_provider.status_changed', BaaSProviderStatusChangedPayload>;

// ============================================================
// All Banking-Treasury Events Union
// ============================================================

export type BankingTreasuryEvent =
  | BankAccountOpenedEvent
  | BankAccountClosedEvent
  | BankAccountUpdatedEvent
  | PaymentInitiatedEvent
  | PaymentCompletedEvent
  | PaymentFailedEvent
  | PaymentCancelledEvent
  | CashPositionUpdatedEvent
  | CashPoolSweepExecutedEvent
  | CashPoolInterestCalculatedEvent
  | BankStatementReceivedEvent
  | DeRiskingAlertRaisedEvent
  | DeRiskingAlertResolvedEvent
  | BaaSProviderStatusChangedEvent;

export const BANKING_TREASURY_EVENT_TYPES = [
  'bank_account.opened',
  'bank_account.closed',
  'bank_account.updated',
  'payment.initiated',
  'payment.completed',
  'payment.failed',
  'payment.cancelled',
  'cash_position.updated',
  'cash_pool.sweep_executed',
  'cash_pool.interest_calculated',
  'bank_statement.received',
  'derisking.alert_raised',
  'derisking.alert_resolved',
  'baas_provider.status_changed',
] as const;
