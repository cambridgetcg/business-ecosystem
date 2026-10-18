/**
 * Strategy Event Handler
 *
 * Handles strategy-related domain events and integrates with AWS infrastructure.
 * Manages IP valuations, FTO analyses, and due diligence reports.
 *
 * @module application/handlers
 */

import { eventOrchestratorService, type EventContext } from '../services/event-orchestrator.service.js';

/**
 * Strategy event types.
 */
export type StrategyEventType =
  // Valuation events
  | 'Valuation.Created'
  | 'Valuation.Updated'
  | 'Valuation.Completed'
  | 'Valuation.Approved'
  | 'Valuation.Rejected'
  | 'Valuation.Superseded'
  // FTO events
  | 'FTO.Created'
  | 'FTO.FindingAdded'
  | 'FTO.RiskIdentified'
  | 'FTO.Completed'
  | 'FTO.Updated'
  // Due Diligence events
  | 'DueDiligence.Created'
  | 'DueDiligence.FindingAdded'
  | 'DueDiligence.CriticalFinding'
  | 'DueDiligence.Completed'
  | 'DueDiligence.Updated';

/**
 * IP Valuation payload.
 */
export interface ValuationPayload {
  valuationId: string;
  name: string;
  purpose: string;
  methodology: string;
  valuationDate: Date;
  ipAssets: Array<{ type: string; id: string; name: string; weight?: number }>;
  valuedAmount?: number;
  currency?: string;
  confidenceLevel?: number;
  status: string;
  preparedBy?: string;
  approvedBy?: string;
}

/**
 * FTO Analysis payload.
 */
export interface FTOPayload {
  ftoId: string;
  name: string;
  product: string;
  jurisdiction: string;
  status: string;
  riskLevel?: string;
  analysisDate: Date;
  analyst?: string;
  patentsReviewed?: number;
  claimsAnalyzed?: number;
}

/**
 * FTO Finding payload.
 */
export interface FTOFindingPayload {
  ftoId: string;
  findingId: string;
  patentNumber: string;
  patentTitle: string;
  riskLevel: string;
  relevantClaims: number[];
  analysis: string;
  recommendation: string;
  designAroundPossible?: boolean;
  licensingOption?: boolean;
}

/**
 * Due Diligence payload.
 */
export interface DueDiligencePayload {
  reportId: string;
  name: string;
  type: string;
  targetEntity?: string;
  transactionType?: string;
  status: string;
  startDate: Date;
  completionDate?: Date;
  leadAnalyst?: string;
}

/**
 * Due Diligence Finding payload.
 */
export interface DDFindingPayload {
  reportId: string;
  findingId: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  impact?: string;
  recommendation?: string;
  affectedAssets?: Array<{ type: string; id: string }>;
}

/**
 * Strategy Event Handler
 *
 * Processes strategy domain events through the orchestration pipeline.
 */
export class StrategyEventHandler {
  // =========================================================================
  // Valuation Events
  // =========================================================================

  /**
   * Handle valuation created.
   */
  async handleValuationCreated(
    valuation: ValuationPayload,
    context?: EventContext
  ): Promise<void> {
    await eventOrchestratorService.process(
      'Valuation.Created',
      'IPValuation',
      valuation.valuationId,
      {
        name: valuation.name,
        purpose: valuation.purpose,
        methodology: valuation.methodology,
        valuationDate: valuation.valuationDate.toISOString(),
        ipAssetCount: valuation.ipAssets.length,
        status: valuation.status,
        preparedBy: valuation.preparedBy,
      },
      context
    );
  }

  /**
   * Handle valuation completed.
   */
  async handleValuationCompleted(
    valuationId: string,
    valuedAmount: number,
    currency: string,
    confidenceLevel: number,
    methodology: string,
    context?: EventContext
  ): Promise<void> {
    await eventOrchestratorService.process(
      'Valuation.Completed',
      'IPValuation',
      valuationId,
      {
        valuedAmount,
        currency,
        confidenceLevel,
        methodology,
        completedAt: new Date().toISOString(),
      },
      context
    );
  }

  /**
   * Handle valuation approved.
   */
  async handleValuationApproved(
    valuationId: string,
    approvedBy: string,
    approvalDate: Date,
    comments?: string,
    context?: EventContext
  ): Promise<void> {
    await eventOrchestratorService.process(
      'Valuation.Approved',
      'IPValuation',
      valuationId,
      {
        approvedBy,
        approvalDate: approvalDate.toISOString(),
        comments,
      },
      context
    );
  }

  /**
   * Handle valuation rejected.
   */
  async handleValuationRejected(
    valuationId: string,
    rejectedBy: string,
    reason: string,
    context?: EventContext
  ): Promise<void> {
    await eventOrchestratorService.process(
      'Valuation.Rejected',
      'IPValuation',
      valuationId,
      {
        rejectedBy,
        reason,
        rejectedAt: new Date().toISOString(),
      },
      context
    );
  }

  // =========================================================================
  // FTO Events
  // =========================================================================

  /**
   * Handle FTO analysis created.
   */
  async handleFTOCreated(
    fto: FTOPayload,
    context?: EventContext
  ): Promise<void> {
    await eventOrchestratorService.process(
      'FTO.Created',
      'FTOAnalysis',
      fto.ftoId,
      {
        name: fto.name,
        product: fto.product,
        jurisdiction: fto.jurisdiction,
        status: fto.status,
        analysisDate: fto.analysisDate.toISOString(),
        analyst: fto.analyst,
      },
      context
    );
  }

  /**
   * Handle FTO finding added.
   */
  async handleFTOFindingAdded(
    finding: FTOFindingPayload,
    context?: EventContext
  ): Promise<void> {
    const eventType = finding.riskLevel === 'high' || finding.riskLevel === 'critical'
      ? 'FTO.RiskIdentified'
      : 'FTO.FindingAdded';

    await eventOrchestratorService.process(
      eventType,
      'FTOAnalysis',
      finding.ftoId,
      {
        findingId: finding.findingId,
        patentNumber: finding.patentNumber,
        patentTitle: finding.patentTitle,
        riskLevel: finding.riskLevel,
        relevantClaims: finding.relevantClaims,
        analysis: finding.analysis,
        recommendation: finding.recommendation,
        designAroundPossible: finding.designAroundPossible,
        licensingOption: finding.licensingOption,
      },
      context
    );
  }

  /**
   * Handle FTO analysis completed.
   */
  async handleFTOCompleted(
    ftoId: string,
    overallRiskLevel: string,
    patentsReviewed: number,
    claimsAnalyzed: number,
    highRiskFindings: number,
    recommendation: string,
    context?: EventContext
  ): Promise<void> {
    await eventOrchestratorService.process(
      'FTO.Completed',
      'FTOAnalysis',
      ftoId,
      {
        overallRiskLevel,
        patentsReviewed,
        claimsAnalyzed,
        highRiskFindings,
        recommendation,
        completedAt: new Date().toISOString(),
      },
      context
    );
  }

  // =========================================================================
  // Due Diligence Events
  // =========================================================================

  /**
   * Handle due diligence report created.
   */
  async handleDueDiligenceCreated(
    report: DueDiligencePayload,
    context?: EventContext
  ): Promise<void> {
    await eventOrchestratorService.process(
      'DueDiligence.Created',
      'DueDiligenceReport',
      report.reportId,
      {
        name: report.name,
        type: report.type,
        targetEntity: report.targetEntity,
        transactionType: report.transactionType,
        status: report.status,
        startDate: report.startDate.toISOString(),
        leadAnalyst: report.leadAnalyst,
      },
      context
    );
  }

  /**
   * Handle due diligence finding added.
   */
  async handleDDFindingAdded(
    finding: DDFindingPayload,
    context?: EventContext
  ): Promise<void> {
    const eventType = finding.severity === 'critical' || finding.severity === 'high'
      ? 'DueDiligence.CriticalFinding'
      : 'DueDiligence.FindingAdded';

    await eventOrchestratorService.process(
      eventType,
      'DueDiligenceReport',
      finding.reportId,
      {
        findingId: finding.findingId,
        category: finding.category,
        severity: finding.severity,
        title: finding.title,
        description: finding.description,
        impact: finding.impact,
        recommendation: finding.recommendation,
        affectedAssetCount: finding.affectedAssets?.length ?? 0,
      },
      context
    );
  }

  /**
   * Handle due diligence completed.
   */
  async handleDueDiligenceCompleted(
    reportId: string,
    completionDate: Date,
    overallRisk: string,
    criticalFindings: number,
    totalFindings: number,
    recommendation: string,
    executiveSummary?: string,
    context?: EventContext
  ): Promise<void> {
    await eventOrchestratorService.process(
      'DueDiligence.Completed',
      'DueDiligenceReport',
      reportId,
      {
        completionDate: completionDate.toISOString(),
        overallRisk,
        criticalFindings,
        totalFindings,
        recommendation,
        executiveSummary,
      },
      context
    );
  }
}

// Singleton instance
export const strategyEventHandler = new StrategyEventHandler();
