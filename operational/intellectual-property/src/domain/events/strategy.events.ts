/**
 * Strategy Domain Events
 *
 * Events emitted by the IP Strategy domain (Valuation, FTO, Due Diligence).
 *
 * @module domain/events
 */

import type { DomainEvent } from '../entities/base.entity.js';

// ============================================================================
// IP VALUATION EVENTS
// ============================================================================

/**
 * IP Valuation created event.
 */
export interface IPValuationCreatedEvent extends DomainEvent {
  type: 'IPValuation.Created';
  payload: {
    title: string;
    purpose: string;
    methodology: string;
    assetCount: number;
  };
}

/**
 * IP Valuation submitted for review event.
 */
export interface IPValuationSubmittedEvent extends DomainEvent {
  type: 'IPValuation.Submitted';
  payload: {
    valuationNumber: string | undefined;
    title: string;
    selectedValue: number;
    currency: string;
  };
}

/**
 * IP Valuation approved event.
 */
export interface IPValuationApprovedEvent extends DomainEvent {
  type: 'IPValuation.Approved';
  payload: {
    valuationNumber: string | undefined;
    selectedValue: number;
    currency: string;
    approvedBy: string;
  };
}

/**
 * IP Valuation superseded event.
 */
export interface IPValuationSupersededEvent extends DomainEvent {
  type: 'IPValuation.Superseded';
  payload: {
    oldValuationId: string;
    newValuationId: string;
    reason: string;
  };
}

// ============================================================================
// FTO ANALYSIS EVENTS
// ============================================================================

/**
 * FTO Analysis initiated event.
 */
export interface FTOAnalysisInitiatedEvent extends DomainEvent {
  type: 'FTOAnalysis.Initiated';
  payload: {
    productName: string;
    jurisdictions: string[];
    launchDate?: string;
  };
}

/**
 * FTO Analysis completed event.
 */
export interface FTOAnalysisCompletedEvent extends DomainEvent {
  type: 'FTOAnalysis.Completed';
  payload: {
    analysisNumber: string | undefined;
    productName: string;
    overallRisk: string | undefined;
    findingsCount: number;
    potentialIssuesCount: number;
  };
}

/**
 * FTO Finding added event.
 */
export interface FTOFindingAddedEvent extends DomainEvent {
  type: 'FTOAnalysis.FindingAdded';
  payload: {
    findingId: string;
    patentNumber: string;
    findingType: string;
    riskLevel: string;
  };
}

/**
 * FTO Risk escalated event.
 */
export interface FTORiskEscalatedEvent extends DomainEvent {
  type: 'FTOAnalysis.RiskEscalated';
  payload: {
    productName: string;
    previousRisk: string;
    newRisk: string;
    launchDate?: string;
  };
}

// ============================================================================
// DUE DILIGENCE EVENTS
// ============================================================================

/**
 * Due Diligence Report initiated event.
 */
export interface DDReportInitiatedEvent extends DomainEvent {
  type: 'DDReport.Initiated';
  payload: {
    targetEntityName: string;
    ddType: string;
    transactionValue?: number;
    dealCloseDate?: string;
  };
}

/**
 * Due Diligence Report completed event.
 */
export interface DDReportCompletedEvent extends DomainEvent {
  type: 'DDReport.Completed';
  payload: {
    reportNumber: string | undefined;
    targetEntityName: string;
    ddType: string;
    overallRiskRating: string | undefined;
    findingsCount: number;
    dealBreakerCount: number;
    assessedPortfolioValue: number | undefined;
  };
}

/**
 * Due Diligence Finding added event.
 */
export interface DDFindingAddedEvent extends DomainEvent {
  type: 'DDReport.FindingAdded';
  payload: {
    findingId: string;
    category: string;
    severity: string;
    title: string;
  };
}

/**
 * Deal-breaker identified event.
 */
export interface DDDealBreakerIdentifiedEvent extends DomainEvent {
  type: 'DDReport.DealBreakerIdentified';
  payload: {
    reportNumber: string | undefined;
    targetEntityName: string;
    issue: string;
    dealCloseDate?: string;
  };
}

// ============================================================================
// UNION TYPES
// ============================================================================

/**
 * All IP Valuation event types.
 */
export type IPValuationEvent =
  | IPValuationCreatedEvent
  | IPValuationSubmittedEvent
  | IPValuationApprovedEvent
  | IPValuationSupersededEvent;

/**
 * All FTO Analysis event types.
 */
export type FTOAnalysisEvent =
  | FTOAnalysisInitiatedEvent
  | FTOAnalysisCompletedEvent
  | FTOFindingAddedEvent
  | FTORiskEscalatedEvent;

/**
 * All Due Diligence event types.
 */
export type DDReportEvent =
  | DDReportInitiatedEvent
  | DDReportCompletedEvent
  | DDFindingAddedEvent
  | DDDealBreakerIdentifiedEvent;

/**
 * All Strategy domain event types.
 */
export type StrategyEvent =
  | IPValuationEvent
  | FTOAnalysisEvent
  | DDReportEvent;
