/**
 * Enforcement Domain Events
 *
 * Events emitted by the enforcement domain.
 *
 * @module domain/events
 */

import type { DomainEvent } from '../entities/base.entity.js';

/**
 * Enforcement matter opened event.
 */
export interface EnforcementMatterOpenedEvent extends DomainEvent {
  type: 'EnforcementMatter.Opened';
  payload: {
    title: string;
    type: string;
    ipAssetType: string;
    ipAssetId: string;
    jurisdiction: string;
    priority: string;
  };
}

/**
 * Enforcement matter status changed event.
 */
export interface EnforcementMatterStatusChangedEvent extends DomainEvent {
  type: 'EnforcementMatter.StatusChanged';
  payload: {
    oldStatus: string;
    newStatus: string;
    notes?: string;
  };
}

/**
 * Litigation filed event.
 */
export interface EnforcementLitigationFiledEvent extends DomainEvent {
  type: 'EnforcementMatter.LitigationFiled';
  payload: {
    caseNumber: string;
    venue: string;
    jurisdiction: string;
    ipAssetType: string;
    ipAssetId: string;
  };
}

/**
 * Enforcement matter settled event.
 */
export interface EnforcementMatterSettledEvent extends DomainEvent {
  type: 'EnforcementMatter.Settled';
  payload: {
    settlementAmount: number;
    outcome: string;
    totalCosts?: number;
  };
}

/**
 * Enforcement matter resolved event.
 */
export interface EnforcementMatterResolvedEvent extends DomainEvent {
  type: 'EnforcementMatter.Resolved';
  payload: {
    outcome: string;
    actualDamages?: number;
    totalCosts?: number;
  };
}

/**
 * Enforcement action added event.
 */
export interface EnforcementActionAddedEvent extends DomainEvent {
  type: 'EnforcementMatter.ActionAdded';
  payload: {
    actionId: string;
    actionType: string;
    title: string;
    dueDate?: string;
  };
}

/**
 * Response received event.
 */
export interface EnforcementResponseReceivedEvent extends DomainEvent {
  type: 'EnforcementMatter.ResponseReceived';
  payload: {
    actionId: string;
    actionType: string;
    responseDate: string;
  };
}

/**
 * Party added event.
 */
export interface EnforcementPartyAddedEvent extends DomainEvent {
  type: 'EnforcementMatter.PartyAdded';
  payload: {
    partyId: string;
    role: string;
    name: string;
  };
}

/**
 * Asset linked event.
 */
export interface EnforcementAssetLinkedEvent extends DomainEvent {
  type: 'EnforcementMatter.AssetLinked';
  payload: {
    assetType: string;
    assetId: string;
  };
}

/**
 * Escalated to critical event.
 */
export interface EnforcementEscalatedEvent extends DomainEvent {
  type: 'EnforcementMatter.EscalatedToCritical';
  payload: {
    oldPriority: string;
    reason: string;
  };
}

/**
 * All enforcement event types.
 */
export type EnforcementEvent =
  | EnforcementMatterOpenedEvent
  | EnforcementMatterStatusChangedEvent
  | EnforcementLitigationFiledEvent
  | EnforcementMatterSettledEvent
  | EnforcementMatterResolvedEvent
  | EnforcementActionAddedEvent
  | EnforcementResponseReceivedEvent
  | EnforcementPartyAddedEvent
  | EnforcementAssetLinkedEvent
  | EnforcementEscalatedEvent;
