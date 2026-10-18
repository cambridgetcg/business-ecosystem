/**
 * Contract Domain Events
 *
 * Event definitions for contract lifecycle, following the ecosystem messaging standards
 */

import { nanoid } from 'nanoid';
import type { DomainEvent, EventMetadata } from '@ecosystem/messaging';

// Event Types
export const CONTRACT_EVENTS = {
  CREATED: 'Contract.Created',
  UPDATED: 'Contract.Updated',
  SUBMITTED_FOR_REVIEW: 'Contract.SubmittedForReview',
  APPROVED: 'Contract.Approved',
  REJECTED: 'Contract.Rejected',
  SIGNED: 'Contract.Signed',
  ACTIVATED: 'Contract.Activated',
  SUSPENDED: 'Contract.Suspended',
  RESUMED: 'Contract.Resumed',
  TERMINATED: 'Contract.Terminated',
  EXPIRED: 'Contract.Expired',
  EXPIRING: 'Contract.Expiring',
  RENEWED: 'Contract.Renewed',
  ARCHIVED: 'Contract.Archived',
} as const;

export const OBLIGATION_EVENTS = {
  CREATED: 'Obligation.Created',
  DUE: 'Obligation.Due',
  OVERDUE: 'Obligation.Overdue',
  COMPLETED: 'Obligation.Completed',
  WAIVED: 'Obligation.Waived',
} as const;

export const MATTER_EVENTS = {
  OPENED: 'Matter.Opened',
  UPDATED: 'Matter.Updated',
  STATUS_CHANGED: 'Matter.StatusChanged',
  CLOSED: 'Matter.Closed',
} as const;

// Event Payload Types
export interface ContractCreatedPayload {
  contractId: string;
  contractNumber: string;
  type: string;
  title: string;
  partyIds: string[];
  value?: number;
  currency: string;
  effectiveDate?: string;
  expiryDate?: string;
}

export interface ContractSignedPayload {
  contractId: string;
  contractNumber: string;
  type: string;
  title: string;
  signedDate: string;
  partyIds: string[];
  value?: number;
  currency: string;
  effectiveDate?: string;
  expiryDate?: string;
  // For downstream consumers
  revenueRecognitionMethod?: string;
  performanceObligations?: Array<{
    id: string;
    name: string;
    allocatedPrice: number;
    satisfactionTiming: string;
  }>;
}

export interface ContractExpiringPayload {
  contractId: string;
  contractNumber: string;
  title: string;
  expiryDate: string;
  daysUntilExpiry: number;
  autoRenewal: boolean;
  renewalNoticeDays?: number;
  partyIds: string[];
}

export interface ContractTerminatedPayload {
  contractId: string;
  contractNumber: string;
  title: string;
  terminatedDate: string;
  terminationReason?: string;
  partyIds: string[];
}

export interface ContractRenewedPayload {
  contractId: string;
  contractNumber: string;
  title: string;
  previousExpiryDate: string;
  newExpiryDate: string;
  partyIds: string[];
}

export interface ContractStatusChangedPayload {
  contractId: string;
  contractNumber: string;
  previousStatus: string;
  newStatus: string;
  action: string;
  reason?: string;
}

export interface ObligationDuePayload {
  obligationId: string;
  contractId: string;
  contractNumber: string;
  type: string;
  description: string;
  dueDate: string;
  daysUntilDue: number;
  responsiblePartyId?: string;
}

export interface MatterOpenedPayload {
  matterId: string;
  matterNumber: string;
  type: string;
  title: string;
  priority: string;
  contractIds: string[];
  internalLead?: string;
}

// Event Factory Functions
export function createEventMetadata(
  userId?: string,
  correlationId?: string,
  causationId?: string
): EventMetadata {
  return {
    correlationId: correlationId ?? nanoid(),
    causationId,
    userId,
    source: 'contracts-legal',
    timestamp: new Date(),
  };
}

export function createContractCreatedEvent(
  payload: ContractCreatedPayload,
  metadata: EventMetadata
): DomainEvent<ContractCreatedPayload> {
  return {
    id: nanoid(),
    type: CONTRACT_EVENTS.CREATED,
    aggregateId: payload.contractId,
    aggregateType: 'Contract',
    payload,
    metadata,
    occurredAt: new Date(),
    version: 1,
  };
}

export function createContractSignedEvent(
  payload: ContractSignedPayload,
  metadata: EventMetadata
): DomainEvent<ContractSignedPayload> {
  return {
    id: nanoid(),
    type: CONTRACT_EVENTS.SIGNED,
    aggregateId: payload.contractId,
    aggregateType: 'Contract',
    payload,
    metadata,
    occurredAt: new Date(),
    version: 1,
  };
}

export function createContractExpiringEvent(
  payload: ContractExpiringPayload,
  metadata: EventMetadata
): DomainEvent<ContractExpiringPayload> {
  return {
    id: nanoid(),
    type: CONTRACT_EVENTS.EXPIRING,
    aggregateId: payload.contractId,
    aggregateType: 'Contract',
    payload,
    metadata,
    occurredAt: new Date(),
    version: 1,
  };
}

export function createContractRenewedEvent(
  payload: ContractRenewedPayload,
  metadata: EventMetadata
): DomainEvent<ContractRenewedPayload> {
  return {
    id: nanoid(),
    type: CONTRACT_EVENTS.RENEWED,
    aggregateId: payload.contractId,
    aggregateType: 'Contract',
    payload,
    metadata,
    occurredAt: new Date(),
    version: 1,
  };
}

export function createContractTerminatedEvent(
  payload: ContractTerminatedPayload,
  metadata: EventMetadata
): DomainEvent<ContractTerminatedPayload> {
  return {
    id: nanoid(),
    type: CONTRACT_EVENTS.TERMINATED,
    aggregateId: payload.contractId,
    aggregateType: 'Contract',
    payload,
    metadata,
    occurredAt: new Date(),
    version: 1,
  };
}

export function createContractStatusChangedEvent(
  payload: ContractStatusChangedPayload,
  metadata: EventMetadata
): DomainEvent<ContractStatusChangedPayload> {
  const eventType = getEventTypeForStatus(payload.newStatus);
  return {
    id: nanoid(),
    type: eventType,
    aggregateId: payload.contractId,
    aggregateType: 'Contract',
    payload,
    metadata,
    occurredAt: new Date(),
    version: 1,
  };
}

export function createObligationDueEvent(
  payload: ObligationDuePayload,
  metadata: EventMetadata
): DomainEvent<ObligationDuePayload> {
  return {
    id: nanoid(),
    type: OBLIGATION_EVENTS.DUE,
    aggregateId: payload.obligationId,
    aggregateType: 'Obligation',
    payload,
    metadata,
    occurredAt: new Date(),
    version: 1,
  };
}

export function createMatterOpenedEvent(
  payload: MatterOpenedPayload,
  metadata: EventMetadata
): DomainEvent<MatterOpenedPayload> {
  return {
    id: nanoid(),
    type: MATTER_EVENTS.OPENED,
    aggregateId: payload.matterId,
    aggregateType: 'LegalMatter',
    payload,
    metadata,
    occurredAt: new Date(),
    version: 1,
  };
}

function getEventTypeForStatus(status: string): string {
  switch (status) {
    case 'PENDING_REVIEW':
      return CONTRACT_EVENTS.SUBMITTED_FOR_REVIEW;
    case 'PENDING_SIGNATURE':
      return CONTRACT_EVENTS.APPROVED;
    case 'ACTIVE':
      return CONTRACT_EVENTS.ACTIVATED;
    case 'SUSPENDED':
      return CONTRACT_EVENTS.SUSPENDED;
    case 'TERMINATED':
      return CONTRACT_EVENTS.TERMINATED;
    case 'EXPIRED':
      return CONTRACT_EVENTS.EXPIRED;
    case 'RENEWED':
      return CONTRACT_EVENTS.RENEWED;
    case 'ARCHIVED':
      return CONTRACT_EVENTS.ARCHIVED;
    default:
      return CONTRACT_EVENTS.UPDATED;
  }
}
