/**
 * Entity Governance Domain Events
 *
 * These events are published when significant domain changes occur.
 * Other services (accounting, tax, compliance) can subscribe to these events
 * for cross-service integration.
 */

import type { DomainEvent } from '@ecosystem/messaging';

// =============================================================================
// Entity Lifecycle Events
// =============================================================================

export interface EntityCreatedPayload {
  entityId: string;
  name: string;
  legalName: string;
  entityType: string;
  jurisdictionCountry: string;
  jurisdictionState?: string;
  incorporationDate?: Date;
  taxId?: string;
  registrationNumber?: string;
}

export interface EntityUpdatedPayload {
  entityId: string;
  changes: Record<string, { old: unknown; new: unknown }>;
}

export interface EntityDissolvedPayload {
  entityId: string;
  dissolutionDate: Date;
  reason?: string;
}

export interface EntityMergedPayload {
  survivingEntityId: string;
  mergedEntityId: string;
  effectiveDate: Date;
}

// =============================================================================
// Corporate Structure Events
// =============================================================================

export interface SubsidiaryAddedPayload {
  parentEntityId: string;
  subsidiaryEntityId: string;
  ownershipPercentage: number;
  effectiveDate: Date;
}

export interface SubsidiaryRemovedPayload {
  parentEntityId: string;
  subsidiaryEntityId: string;
  effectiveDate: Date;
  reason?: string;
}

export interface OwnershipChangedPayload {
  parentEntityId: string;
  subsidiaryEntityId: string;
  previousPercentage: number;
  newPercentage: number;
  effectiveDate: Date;
}

// =============================================================================
// Governance Events
// =============================================================================

export interface OfficerAppointedPayload {
  entityId: string;
  officerId: string;
  personId: string;
  title: string;
  appointmentDate: Date;
}

export interface OfficerTerminatedPayload {
  entityId: string;
  officerId: string;
  personId: string;
  terminationDate: Date;
  reason?: string;
}

export interface DirectorAppointedPayload {
  entityId: string;
  boardId: string;
  directorId: string;
  personId: string;
  appointmentDate: Date;
  isIndependent: boolean;
}

export interface DirectorRemovedPayload {
  entityId: string;
  boardId: string;
  directorId: string;
  personId: string;
  removalDate: Date;
  reason?: string;
}

export interface ResolutionPassedPayload {
  entityId: string;
  boardId?: string;
  resolutionId: string;
  resolutionType: string;
  title: string;
  effectiveDate: Date;
}

// =============================================================================
// Shareholders Events
// =============================================================================

export interface SharesIssuedPayload {
  entityId: string;
  shareClassId: string;
  shareholderId: string;
  sharesIssued: number;
  issueDate: Date;
  issuePrice?: number;
}

export interface SharesTransferredPayload {
  entityId: string;
  shareClassId: string;
  fromShareholderId: string;
  toShareholderId: string;
  sharesTransferred: number;
  transferDate: Date;
  transferPrice?: number;
}

export interface EquityGrantIssuedPayload {
  entityId: string;
  grantId: string;
  recipientId: string;
  grantType: string;
  sharesGranted: number;
  exercisePrice?: number;
  vestingSchedule?: Record<string, unknown>;
}

// =============================================================================
// Compliance Events
// =============================================================================

export interface FilingDuePayload {
  entityId: string;
  filingType: string;
  jurisdictionCountry: string;
  jurisdictionState?: string;
  dueDate: Date;
}

export interface FilingCompletedPayload {
  entityId: string;
  filingId: string;
  filingType: string;
  filedDate: Date;
  confirmationNumber?: string;
}

export interface FilingOverduePayload {
  entityId: string;
  filingId: string;
  filingType: string;
  dueDate: Date;
  daysOverdue: number;
}

export interface RegisteredAgentChangedPayload {
  entityId: string;
  previousAgentName?: string;
  newAgentName: string;
  effectiveDate: Date;
  jurisdictionCountry: string;
  jurisdictionState?: string;
}

// =============================================================================
// Event Type Constants
// =============================================================================

export const EntityEventTypes = {
  // Entity Lifecycle
  ENTITY_CREATED: 'entity-governance.entity.created',
  ENTITY_UPDATED: 'entity-governance.entity.updated',
  ENTITY_DISSOLVED: 'entity-governance.entity.dissolved',
  ENTITY_MERGED: 'entity-governance.entity.merged',

  // Corporate Structure
  SUBSIDIARY_ADDED: 'entity-governance.structure.subsidiary-added',
  SUBSIDIARY_REMOVED: 'entity-governance.structure.subsidiary-removed',
  OWNERSHIP_CHANGED: 'entity-governance.structure.ownership-changed',

  // Governance
  OFFICER_APPOINTED: 'entity-governance.governance.officer-appointed',
  OFFICER_TERMINATED: 'entity-governance.governance.officer-terminated',
  DIRECTOR_APPOINTED: 'entity-governance.governance.director-appointed',
  DIRECTOR_REMOVED: 'entity-governance.governance.director-removed',
  RESOLUTION_PASSED: 'entity-governance.governance.resolution-passed',

  // Shareholders
  SHARES_ISSUED: 'entity-governance.shareholders.shares-issued',
  SHARES_TRANSFERRED: 'entity-governance.shareholders.shares-transferred',
  EQUITY_GRANT_ISSUED: 'entity-governance.shareholders.equity-grant-issued',

  // Compliance
  FILING_DUE: 'entity-governance.compliance.filing-due',
  FILING_COMPLETED: 'entity-governance.compliance.filing-completed',
  FILING_OVERDUE: 'entity-governance.compliance.filing-overdue',
  REGISTERED_AGENT_CHANGED: 'entity-governance.compliance.registered-agent-changed',
} as const;

export type EntityEventType = typeof EntityEventTypes[keyof typeof EntityEventTypes];
