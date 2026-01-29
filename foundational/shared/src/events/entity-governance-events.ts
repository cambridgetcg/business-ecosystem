import { DomainEvent, createDomainEvent } from './base.js';
import {
  EntityType,
  EntityStatus,
  Jurisdiction,
  JurisdictionContext,
} from '../value-objects/index.js';

// ============================================================
// Entity Lifecycle Events
// ============================================================

export interface EntityCreatedPayload {
  entityName: string;
  entityType: EntityType;
  formationJurisdiction: Jurisdiction;
  formationDate: string; // ISO date
  taxIds?: Array<{ type: string; value: string; jurisdiction: Jurisdiction }>;
}

export type EntityCreatedEvent = DomainEvent<'entity.created', EntityCreatedPayload>;

export function createEntityCreatedEvent(
  entityId: string,
  payload: EntityCreatedPayload,
  triggeredBy: string
): EntityCreatedEvent {
  return createDomainEvent(
    'entity.created',
    entityId,
    'LegalEntity',
    1,
    payload,
    { entityId, triggeredBy }
  );
}

// ---

export interface EntityUpdatedPayload {
  changes: {
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }[];
}

export type EntityUpdatedEvent = DomainEvent<'entity.updated', EntityUpdatedPayload>;

// ---

export interface EntityDissolvedPayload {
  dissolutionDate: string; // ISO date
  reason: string;
  windupComplete: boolean;
}

export type EntityDissolvedEvent = DomainEvent<'entity.dissolved', EntityDissolvedPayload>;

// ---

export interface EntityStatusChangedPayload {
  previousStatus: EntityStatus;
  newStatus: EntityStatus;
  reason?: string;
  effectiveDate: string; // ISO date
}

export type EntityStatusChangedEvent = DomainEvent<'entity.status_changed', EntityStatusChangedPayload>;

// ============================================================
// Jurisdiction Events
// ============================================================

export interface JurisdictionAddedPayload {
  jurisdictionType: 'qualification' | 'tax_nexus' | 'regulatory';
  jurisdiction: Jurisdiction;
  effectiveDate: string; // ISO date
  details: Record<string, unknown>;
}

export type JurisdictionAddedEvent = DomainEvent<'entity.jurisdiction_added', JurisdictionAddedPayload>;

export interface JurisdictionRemovedPayload {
  jurisdictionType: 'qualification' | 'tax_nexus' | 'regulatory';
  jurisdiction: Jurisdiction;
  effectiveDate: string; // ISO date
  reason: string;
}

export type JurisdictionRemovedEvent = DomainEvent<'entity.jurisdiction_removed', JurisdictionRemovedPayload>;

// ============================================================
// Cap Table Events (triggers 409A valuations)
// ============================================================

export interface CapTableChangedPayload {
  changeType: CapTableChangeType;
  effectiveDate: string; // ISO date
  details: CapTableChangeDetails;
  triggers409AValuation: boolean;
}

export type CapTableChangeType =
  | 'shares_issued'
  | 'shares_transferred'
  | 'shares_redeemed'
  | 'option_granted'
  | 'option_exercised'
  | 'option_cancelled'
  | 'rsu_granted'
  | 'rsu_vested'
  | 'conversion'
  | 'stock_split'
  | 'recapitalization';

export interface CapTableChangeDetails {
  shareClass?: string;
  numberOfShares?: number;
  pricePerShare?: string; // Decimal as string
  fromShareholder?: string;
  toShareholder?: string;
  grantId?: string;
  vestingSchedule?: string;
}

export type CapTableChangedEvent = DomainEvent<'entity.cap_table_changed', CapTableChangedPayload>;

/**
 * Research insight: 409A valuations are triggered by "material events"
 * including financing rounds, significant business changes, or approaching IPO.
 * Penalties fall on EMPLOYEES (20% + interest), not the company.
 */
export interface ValuationTriggeredPayload {
  triggerType: '409a' | 'fair_market_value' | 'audit';
  triggerReason: string;
  requiredByDate?: string; // ISO date
  relatedCapTableEventId?: string;
}

export type ValuationTriggeredEvent = DomainEvent<'entity.valuation_triggered', ValuationTriggeredPayload>;

// ============================================================
// Governance Events
// ============================================================

export interface GovernanceActionRecordedPayload {
  actionType: GovernanceActionType;
  actionDate: string; // ISO date
  description: string;
  documentReference?: string;
  approvedBy?: string[];
  minutesRecorded: boolean;
}

export type GovernanceActionType =
  | 'board_meeting'
  | 'shareholder_meeting'
  | 'written_consent'
  | 'resolution'
  | 'officer_appointment'
  | 'officer_removal'
  | 'director_appointment'
  | 'director_removal'
  | 'bylaw_amendment'
  | 'articles_amendment';

export type GovernanceActionRecordedEvent = DomainEvent<'entity.governance_action_recorded', GovernanceActionRecordedPayload>;

// ============================================================
// Veil Protection Events
// ============================================================

/**
 * Research insight: SMLLC veil piercing risk is higher.
 * Courts examine: commingling, undercapitalization, failure to
 * observe formalities, and alter ego/instrumentality factors.
 */
export interface VeilProtectionAlertPayload {
  alertType: VeilProtectionAlertType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  recommendedActions: string[];
  daysSinceLastFormality?: number;
}

export type VeilProtectionAlertType =
  | 'missing_annual_meeting'
  | 'missing_minutes'
  | 'commingling_detected'
  | 'undercapitalization_risk'
  | 'formality_gap'
  | 'separate_identity_concern';

export type VeilProtectionAlertEvent = DomainEvent<'entity.veil_protection_alert', VeilProtectionAlertPayload>;

// ============================================================
// Beneficial Ownership Events (for CTA compliance)
// ============================================================

export interface BeneficialOwnershipChangedPayload {
  changeType: 'added' | 'removed' | 'updated';
  beneficialOwnerId: string;
  ownershipPercentage?: string; // Decimal as string
  controlType?: 'ownership' | 'control' | 'both';
  requiresCTAFiling: boolean;
  filingDeadline?: string; // ISO date
}

export type BeneficialOwnershipChangedEvent = DomainEvent<'entity.beneficial_ownership_changed', BeneficialOwnershipChangedPayload>;

// ============================================================
// All Entity Governance Events Union
// ============================================================

export type EntityGovernanceEvent =
  | EntityCreatedEvent
  | EntityUpdatedEvent
  | EntityDissolvedEvent
  | EntityStatusChangedEvent
  | JurisdictionAddedEvent
  | JurisdictionRemovedEvent
  | CapTableChangedEvent
  | ValuationTriggeredEvent
  | GovernanceActionRecordedEvent
  | VeilProtectionAlertEvent
  | BeneficialOwnershipChangedEvent;

export const ENTITY_GOVERNANCE_EVENT_TYPES = [
  'entity.created',
  'entity.updated',
  'entity.dissolved',
  'entity.status_changed',
  'entity.jurisdiction_added',
  'entity.jurisdiction_removed',
  'entity.cap_table_changed',
  'entity.valuation_triggered',
  'entity.governance_action_recorded',
  'entity.veil_protection_alert',
  'entity.beneficial_ownership_changed',
] as const;
