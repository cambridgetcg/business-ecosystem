/**
 * Strategy Commands
 *
 * CQRS commands for IP strategy operations:
 * - IP Valuations
 * - Freedom-to-Operate (FTO) Analyses
 * - Due Diligence Reports
 *
 * @module application/commands
 */

// ============================================================================
// IP Valuation Commands
// ============================================================================

export type ValuationMethodology =
  | 'cost'
  | 'market'
  | 'income'
  | 'relief_from_royalty'
  | 'excess_earnings'
  | 'real_options'
  | 'monte_carlo'
  | 'comparable_transactions';

export type ValuationPurpose =
  | 'financial_reporting'
  | 'tax'
  | 'litigation'
  | 'licensing'
  | 'sale'
  | 'financing'
  | 'insurance'
  | 'internal_planning'
  | 'm_and_a';

export type ValuationStatus =
  | 'draft'
  | 'in_progress'
  | 'review'
  | 'approved'
  | 'superseded'
  | 'archived';

export interface IPAssetRef {
  type: string;
  id: string;
  name: string;
  weight?: number;
}

/**
 * Create a new IP valuation.
 */
export interface CreateValuationCommand {
  type: 'CreateValuation';
  name: string;
  purpose: ValuationPurpose;
  methodology: ValuationMethodology;
  valuationDate: Date;
  ipAssets: IPAssetRef[];
  assumptions?: string[];
  preparedBy?: string;
  actorId: string;
}

/**
 * Update valuation details.
 */
export interface UpdateValuationCommand {
  type: 'UpdateValuation';
  valuationId: string;
  name?: string;
  methodology?: ValuationMethodology;
  assumptions?: string[];
  actorId: string;
}

/**
 * Complete a valuation with final values.
 */
export interface CompleteValuationCommand {
  type: 'CompleteValuation';
  valuationId: string;
  valuedAmount: number;
  currency: string;
  confidenceLevel: number;
  supportingAnalysis?: string;
  actorId: string;
}

/**
 * Submit valuation for approval.
 */
export interface SubmitValuationForApprovalCommand {
  type: 'SubmitValuationForApproval';
  valuationId: string;
  actorId: string;
}

/**
 * Approve a valuation.
 */
export interface ApproveValuationCommand {
  type: 'ApproveValuation';
  valuationId: string;
  comments?: string;
  actorId: string;
}

/**
 * Reject a valuation.
 */
export interface RejectValuationCommand {
  type: 'RejectValuation';
  valuationId: string;
  reason: string;
  actorId: string;
}

/**
 * Archive a valuation.
 */
export interface ArchiveValuationCommand {
  type: 'ArchiveValuation';
  valuationId: string;
  actorId: string;
}

// ============================================================================
// FTO Analysis Commands
// ============================================================================

export type FTOStatus =
  | 'initiated'
  | 'in_progress'
  | 'review'
  | 'completed'
  | 'superseded';

export type FTORiskLevel =
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

export type FTOFindingType =
  | 'potential_infringement'
  | 'design_around_available'
  | 'license_available'
  | 'patent_invalid'
  | 'non_infringement'
  | 'expired';

/**
 * Create a new FTO analysis.
 */
export interface CreateFTOAnalysisCommand {
  type: 'CreateFTOAnalysis';
  name: string;
  product: string;
  productDescription?: string;
  jurisdiction: string;
  targetLaunchDate?: Date;
  analyst?: string;
  actorId: string;
}

/**
 * Update FTO analysis details.
 */
export interface UpdateFTOAnalysisCommand {
  type: 'UpdateFTOAnalysis';
  ftoId: string;
  name?: string;
  productDescription?: string;
  jurisdiction?: string;
  targetLaunchDate?: Date;
  actorId: string;
}

/**
 * Add a finding to an FTO analysis.
 */
export interface AddFTOFindingCommand {
  type: 'AddFTOFinding';
  ftoId: string;
  patentNumber: string;
  patentTitle: string;
  patentHolder: string;
  findingType: FTOFindingType;
  riskLevel: FTORiskLevel;
  relevantClaims: number[];
  analysis: string;
  recommendation: string;
  designAroundPossible?: boolean;
  licensingOption?: boolean;
  estimatedLicenseCost?: number;
  actorId: string;
}

/**
 * Update an FTO finding.
 */
export interface UpdateFTOFindingCommand {
  type: 'UpdateFTOFinding';
  ftoId: string;
  findingId: string;
  riskLevel?: FTORiskLevel;
  analysis?: string;
  recommendation?: string;
  actorId: string;
}

/**
 * Complete an FTO analysis.
 */
export interface CompleteFTOAnalysisCommand {
  type: 'CompleteFTOAnalysis';
  ftoId: string;
  overallRiskLevel: FTORiskLevel;
  overallRecommendation: string;
  executiveSummary?: string;
  actorId: string;
}

// ============================================================================
// Due Diligence Commands
// ============================================================================

export type DDType =
  | 'acquisition'
  | 'merger'
  | 'licensing_in'
  | 'licensing_out'
  | 'investment'
  | 'partnership'
  | 'spin_off'
  | 'ip_sale';

export type DDStatus =
  | 'initiated'
  | 'document_collection'
  | 'analysis'
  | 'review'
  | 'completed'
  | 'on_hold'
  | 'cancelled';

export type DDFindingSeverity =
  | 'info'
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

export type DDFindingCategory =
  | 'ownership'
  | 'validity'
  | 'encumbrances'
  | 'litigation'
  | 'freedom_to_operate'
  | 'maintenance'
  | 'licensing'
  | 'valuation'
  | 'regulatory'
  | 'other';

/**
 * Create a new due diligence report.
 */
export interface CreateDueDiligenceCommand {
  type: 'CreateDueDiligence';
  name: string;
  ddType: DDType;
  targetEntity?: string;
  transactionType?: string;
  transactionValue?: number;
  leadAnalyst?: string;
  dueDate?: Date;
  actorId: string;
}

/**
 * Update due diligence report details.
 */
export interface UpdateDueDiligenceCommand {
  type: 'UpdateDueDiligence';
  reportId: string;
  name?: string;
  targetEntity?: string;
  transactionValue?: number;
  dueDate?: Date;
  actorId: string;
}

/**
 * Add a finding to a due diligence report.
 */
export interface AddDDFindingCommand {
  type: 'AddDDFinding';
  reportId: string;
  category: DDFindingCategory;
  severity: DDFindingSeverity;
  title: string;
  description: string;
  impact?: string;
  recommendation?: string;
  affectedAssets?: Array<{ type: string; id: string }>;
  actorId: string;
}

/**
 * Update a due diligence finding.
 */
export interface UpdateDDFindingCommand {
  type: 'UpdateDDFinding';
  reportId: string;
  findingId: string;
  severity?: DDFindingSeverity;
  impact?: string;
  recommendation?: string;
  actorId: string;
}

/**
 * Complete due diligence report.
 */
export interface CompleteDueDiligenceCommand {
  type: 'CompleteDueDiligence';
  reportId: string;
  overallRisk: DDFindingSeverity;
  recommendation: string;
  executiveSummary?: string;
  actorId: string;
}

/**
 * Put due diligence on hold.
 */
export interface HoldDueDiligenceCommand {
  type: 'HoldDueDiligence';
  reportId: string;
  reason: string;
  actorId: string;
}

/**
 * Cancel due diligence.
 */
export interface CancelDueDiligenceCommand {
  type: 'CancelDueDiligence';
  reportId: string;
  reason: string;
  actorId: string;
}

/**
 * Union type of all strategy commands.
 */
export type StrategyCommand =
  // Valuation commands
  | CreateValuationCommand
  | UpdateValuationCommand
  | CompleteValuationCommand
  | SubmitValuationForApprovalCommand
  | ApproveValuationCommand
  | RejectValuationCommand
  | ArchiveValuationCommand
  // FTO commands
  | CreateFTOAnalysisCommand
  | UpdateFTOAnalysisCommand
  | AddFTOFindingCommand
  | UpdateFTOFindingCommand
  | CompleteFTOAnalysisCommand
  // Due Diligence commands
  | CreateDueDiligenceCommand
  | UpdateDueDiligenceCommand
  | AddDDFindingCommand
  | UpdateDDFindingCommand
  | CompleteDueDiligenceCommand
  | HoldDueDiligenceCommand
  | CancelDueDiligenceCommand;
