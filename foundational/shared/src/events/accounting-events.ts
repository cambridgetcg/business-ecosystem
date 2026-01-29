import { DomainEvent, createDomainEvent } from './base.js';
import { Money, CurrencyCode } from '../value-objects/index.js';

// ============================================================
// Account Events
// ============================================================

export interface AccountCreatedPayload {
  accountNumber: string;
  accountName: string;
  accountType: AccountType;
  normalBalance: 'debit' | 'credit';
  parentAccountId?: string;
  currency: CurrencyCode;
  isActive: boolean;
}

export type AccountType =
  | 'asset'
  | 'liability'
  | 'equity'
  | 'revenue'
  | 'expense'
  | 'contra_asset'
  | 'contra_liability'
  | 'contra_equity'
  | 'contra_revenue'
  | 'contra_expense';

export type AccountCreatedEvent = DomainEvent<'account.created', AccountCreatedPayload>;

// ---

export interface AccountUpdatedPayload {
  changes: {
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }[];
}

export type AccountUpdatedEvent = DomainEvent<'account.updated', AccountUpdatedPayload>;

// ---

export interface AccountDeactivatedPayload {
  reason: string;
  effectiveDate: string; // ISO date
  finalBalance: Money;
}

export type AccountDeactivatedEvent = DomainEvent<'account.deactivated', AccountDeactivatedPayload>;

// ============================================================
// Journal Entry Events
// ============================================================

export interface JournalEntryPostedPayload {
  entryNumber: string;
  entryDate: string; // ISO date
  postingDate: string; // ISO date
  description: string;
  lines: JournalEntryLine[];
  totalDebits: Money;
  totalCredits: Money;
  sourceDocument?: SourceDocumentReference;
  isReversing: boolean;
  reversesEntryId?: string;
}

export interface JournalEntryLine {
  accountId: string;
  accountNumber: string;
  debit?: Money;
  credit?: Money;
  memo?: string;
  dimensions?: Record<string, string>; // Cost center, department, project, etc.
}

export interface SourceDocumentReference {
  documentType: string;
  documentId: string;
  documentDate: string; // ISO date
}

export type JournalEntryPostedEvent = DomainEvent<'journal_entry.posted', JournalEntryPostedPayload>;

// ---

export interface JournalEntryReversedPayload {
  originalEntryId: string;
  originalEntryNumber: string;
  reversalDate: string; // ISO date
  reason: string;
}

export type JournalEntryReversedEvent = DomainEvent<'journal_entry.reversed', JournalEntryReversedPayload>;

// ============================================================
// Period Events
// ============================================================

export interface PeriodOpenedPayload {
  periodId: string;
  periodName: string;
  periodType: 'month' | 'quarter' | 'year';
  startDate: string; // ISO date
  endDate: string; // ISO date
  fiscalYear: number;
  fiscalPeriod: number;
}

export type PeriodOpenedEvent = DomainEvent<'period.opened', PeriodOpenedPayload>;

// ---

export interface PeriodClosedPayload {
  periodId: string;
  periodName: string;
  closedAt: string; // ISO timestamp
  closedBy: string;
  trialBalanceSnapshot?: TrialBalanceSnapshot;
}

export interface TrialBalanceSnapshot {
  asOfDate: string; // ISO date
  accounts: Array<{
    accountId: string;
    accountNumber: string;
    accountName: string;
    debitBalance: Money;
    creditBalance: Money;
  }>;
  totalDebits: Money;
  totalCredits: Money;
}

export type PeriodClosedEvent = DomainEvent<'period.closed', PeriodClosedPayload>;

// ---

export interface PeriodReopenedPayload {
  periodId: string;
  periodName: string;
  reopenedBy: string;
  reason: string;
  approvedBy?: string;
}

export type PeriodReopenedEvent = DomainEvent<'period.reopened', PeriodReopenedPayload>;

// ============================================================
// Reconciliation Events
// ============================================================

export interface ReconciliationCompletedPayload {
  accountId: string;
  accountNumber: string;
  reconciliationType: 'bank' | 'intercompany' | 'subledger' | 'manual';
  reconciliationDate: string; // ISO date
  periodEndDate: string; // ISO date
  bookBalance: Money;
  statementBalance?: Money;
  reconciledBalance: Money;
  outstandingItems: number;
  varianceAmount?: Money;
  varianceExplained: boolean;
}

export type ReconciliationCompletedEvent = DomainEvent<'reconciliation.completed', ReconciliationCompletedPayload>;

// ---

export interface ReconciliationVarianceDetectedPayload {
  accountId: string;
  accountNumber: string;
  reconciliationDate: string; // ISO date
  varianceAmount: Money;
  varianceType: 'timing' | 'error' | 'unidentified';
  requiresInvestigation: boolean;
}

export type ReconciliationVarianceDetectedEvent = DomainEvent<'reconciliation.variance_detected', ReconciliationVarianceDetectedPayload>;

// ============================================================
// Intercompany Events (supports transfer pricing)
// ============================================================

export interface IntercompanyTransactionRecordedPayload {
  transactionType: IntercompanyTransactionType;
  fromEntityId: string;
  toEntityId: string;
  amount: Money;
  transactionDate: string; // ISO date
  description: string;
  transferPricingPolicyId?: string;
  armsLengthValidated: boolean;
}

export type IntercompanyTransactionType =
  | 'service_fee'
  | 'royalty'
  | 'interest'
  | 'dividend'
  | 'cost_allocation'
  | 'management_fee'
  | 'loan_principal'
  | 'goods_sale';

export type IntercompanyTransactionRecordedEvent = DomainEvent<'intercompany.transaction_recorded', IntercompanyTransactionRecordedPayload>;

// ---

export interface IntercompanyBalanceChangedPayload {
  fromEntityId: string;
  toEntityId: string;
  previousBalance: Money;
  newBalance: Money;
  changeAmount: Money;
  settlementRequired: boolean;
}

export type IntercompanyBalanceChangedEvent = DomainEvent<'intercompany.balance_changed', IntercompanyBalanceChangedPayload>;

// ============================================================
// All Accounting Events Union
// ============================================================

export type AccountingEvent =
  | AccountCreatedEvent
  | AccountUpdatedEvent
  | AccountDeactivatedEvent
  | JournalEntryPostedEvent
  | JournalEntryReversedEvent
  | PeriodOpenedEvent
  | PeriodClosedEvent
  | PeriodReopenedEvent
  | ReconciliationCompletedEvent
  | ReconciliationVarianceDetectedEvent
  | IntercompanyTransactionRecordedEvent
  | IntercompanyBalanceChangedEvent;

export const ACCOUNTING_EVENT_TYPES = [
  'account.created',
  'account.updated',
  'account.deactivated',
  'journal_entry.posted',
  'journal_entry.reversed',
  'period.opened',
  'period.closed',
  'period.reopened',
  'reconciliation.completed',
  'reconciliation.variance_detected',
  'intercompany.transaction_recorded',
  'intercompany.balance_changed',
] as const;
