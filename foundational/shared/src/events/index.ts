// Base event infrastructure
export {
  type DomainEvent,
  type EventEnvelope,
  type EventHandler,
  type EventSubscriber,
  type EventPublisher,
  generateEventId,
  createDomainEvent,
} from './base.js';

// Entity Governance Events
export {
  type EntityCreatedPayload,
  type EntityCreatedEvent,
  createEntityCreatedEvent,
  type EntityUpdatedPayload,
  type EntityUpdatedEvent,
  type EntityDissolvedPayload,
  type EntityDissolvedEvent,
  type EntityStatusChangedPayload,
  type EntityStatusChangedEvent,
  type JurisdictionAddedPayload,
  type JurisdictionAddedEvent,
  type JurisdictionRemovedPayload,
  type JurisdictionRemovedEvent,
  type CapTableChangedPayload,
  type CapTableChangeType,
  type CapTableChangeDetails,
  type CapTableChangedEvent,
  type ValuationTriggeredPayload,
  type ValuationTriggeredEvent,
  type GovernanceActionRecordedPayload,
  type GovernanceActionType,
  type GovernanceActionRecordedEvent,
  type VeilProtectionAlertPayload,
  type VeilProtectionAlertType,
  type VeilProtectionAlertEvent,
  type BeneficialOwnershipChangedPayload,
  type BeneficialOwnershipChangedEvent,
  type EntityGovernanceEvent,
  ENTITY_GOVERNANCE_EVENT_TYPES,
} from './entity-governance-events.js';

// Accounting Events
export {
  type AccountCreatedPayload,
  type AccountType,
  type AccountCreatedEvent,
  type AccountUpdatedPayload,
  type AccountUpdatedEvent,
  type AccountDeactivatedPayload,
  type AccountDeactivatedEvent,
  type JournalEntryPostedPayload,
  type JournalEntryLine,
  type SourceDocumentReference,
  type JournalEntryPostedEvent,
  type JournalEntryReversedPayload,
  type JournalEntryReversedEvent,
  type PeriodOpenedPayload,
  type PeriodOpenedEvent,
  type PeriodClosedPayload,
  type TrialBalanceSnapshot,
  type PeriodClosedEvent,
  type PeriodReopenedPayload,
  type PeriodReopenedEvent,
  type ReconciliationCompletedPayload,
  type ReconciliationCompletedEvent,
  type ReconciliationVarianceDetectedPayload,
  type ReconciliationVarianceDetectedEvent,
  type IntercompanyTransactionRecordedPayload,
  type IntercompanyTransactionType,
  type IntercompanyTransactionRecordedEvent,
  type IntercompanyBalanceChangedPayload,
  type IntercompanyBalanceChangedEvent,
  type AccountingEvent,
  ACCOUNTING_EVENT_TYPES,
} from './accounting-events.js';

// Banking-Treasury Events
export {
  type BankAccountOpenedPayload,
  type BankAccountType,
  type BankAccountOpenedEvent,
  type BankAccountClosedPayload,
  type BankAccountClosedEvent,
  type BankAccountUpdatedPayload,
  type BankAccountUpdatedEvent,
  type PaymentInitiatedPayload,
  type PaymentType,
  type PaymentInitiatedEvent,
  type PaymentCompletedPayload,
  type PaymentCompletedEvent,
  type PaymentFailedPayload,
  type PaymentFailedEvent,
  type PaymentCancelledPayload,
  type PaymentCancelledEvent,
  type CashPositionUpdatedPayload,
  type CashPosition,
  type CashPositionUpdatedEvent,
  type CashPoolSweepExecutedPayload,
  type CashPoolSweepExecutedEvent,
  type CashPoolInterestCalculatedPayload,
  type CashPoolInterestCalculatedEvent,
  type BankStatementReceivedPayload,
  type BankStatementReceivedEvent,
  type DeRiskingAlertRaisedPayload,
  type DeRiskingSignalType,
  type DeRiskingAlertRaisedEvent,
  type DeRiskingAlertResolvedPayload,
  type DeRiskingAlertResolvedEvent,
  type BaaSProviderStatusChangedPayload,
  type BaaSProviderStatus,
  type BaaSProviderStatusChangedEvent,
  type BankingTreasuryEvent,
  BANKING_TREASURY_EVENT_TYPES,
} from './banking-treasury-events.js';

// Import event type arrays for combination
import { ENTITY_GOVERNANCE_EVENT_TYPES as EG_EVENTS } from './entity-governance-events.js';
import { ACCOUNTING_EVENT_TYPES as ACC_EVENTS } from './accounting-events.js';
import { BANKING_TREASURY_EVENT_TYPES as BT_EVENTS } from './banking-treasury-events.js';

// Union of all foundational events
export type FoundationalEvent =
  | import('./entity-governance-events.js').EntityGovernanceEvent
  | import('./accounting-events.js').AccountingEvent
  | import('./banking-treasury-events.js').BankingTreasuryEvent;

// All event types combined
export const ALL_FOUNDATIONAL_EVENT_TYPES = [
  ...EG_EVENTS,
  ...ACC_EVENTS,
  ...BT_EVENTS,
] as const;
