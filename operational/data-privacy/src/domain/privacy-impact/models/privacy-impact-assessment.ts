/**
 * Privacy Impact Assessment (DPIA) Domain Model
 * GDPR Article 35 - Data Protection Impact Assessment
 */

// ============================================================================
// ENUMS
// ============================================================================

export type DPIAStatus =
  | 'DRAFT'
  | 'IN_PROGRESS'
  | 'PENDING_REVIEW'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'REQUIRES_CONSULTATION';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// ============================================================================
// DOMAIN MODELS
// ============================================================================

export interface IdentifiedRisk {
  id: string;
  description: string;
  likelihood: RiskLevel;
  impact: RiskLevel;
  overallRisk: RiskLevel;
  affectedRights: string[];
  category: string;
}

export interface Mitigation {
  id: string;
  riskId: string;
  description: string;
  type: 'TECHNICAL' | 'ORGANIZATIONAL' | 'CONTRACTUAL';
  status: 'PLANNED' | 'IMPLEMENTED' | 'VERIFIED';
  effectiveness: RiskLevel;
}

export interface ResidualRisk {
  riskId: string;
  residualLevel: RiskLevel;
  justification: string;
  acceptedBy?: string;
  acceptedAt?: Date;
}

export interface PrivacyImpactAssessment {
  id: string;
  entityId: string;

  // Identification
  assessmentNumber: string;
  title: string;
  description: string;

  // Linked processing activity
  processingActivityId?: string | undefined;

  // Assessment content
  necessity: string;
  proportionality: string;

  // Risk assessment (JSON stored)
  risks: IdentifiedRisk[];
  mitigations: Mitigation[];
  residualRisks?: ResidualRisk[] | undefined;

  // Consultation
  dpoConsulted: boolean;
  dpoOpinion?: string | undefined;
  authorityConsulted: boolean;
  authorityResponse?: string | undefined;

  // Status
  status: DPIAStatus;

  // Review
  reviewedBy?: string | undefined;
  reviewedAt?: Date | undefined;
  reviewNotes?: string | undefined;

  // Approval
  approvedBy?: string | undefined;
  approvedAt?: Date | undefined;
  approvalNotes?: string | undefined;

  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// ============================================================================
// INPUT TYPES
// ============================================================================

export interface CreateDPIAInput {
  entityId: string;
  title: string;
  description: string;
  processingActivityId?: string | undefined;
  necessity: string;
  proportionality: string;
  createdBy: string;
}

export interface UpdateDPIAInput {
  title?: string | undefined;
  description?: string | undefined;
  necessity?: string | undefined;
  proportionality?: string | undefined;
}

export interface AddRiskInput {
  description: string;
  likelihood: RiskLevel;
  impact: RiskLevel;
  affectedRights: string[];
  category: string;
}

export interface AddMitigationInput {
  riskId: string;
  description: string;
  type: 'TECHNICAL' | 'ORGANIZATIONAL' | 'CONTRACTUAL';
}

export interface DPOConsultationInput {
  opinion: string;
  consultedBy: string;
}

export interface ReviewInput {
  notes: string;
  reviewedBy: string;
  approved: boolean;
}

export interface DPIAQueryFilter {
  entityId?: string | undefined;
  status?: DPIAStatus | undefined;
  processingActivityId?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

// ============================================================================
// DOMAIN LOGIC
// ============================================================================

/**
 * Calculate overall risk from likelihood and impact
 * Uses a simple matrix: HIGH x HIGH = CRITICAL, etc.
 */
export function calculateOverallRisk(likelihood: RiskLevel, impact: RiskLevel): RiskLevel {
  const riskMatrix: Record<RiskLevel, Record<RiskLevel, RiskLevel>> = {
    LOW: { LOW: 'LOW', MEDIUM: 'LOW', HIGH: 'MEDIUM', CRITICAL: 'MEDIUM' },
    MEDIUM: { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH', CRITICAL: 'HIGH' },
    HIGH: { LOW: 'MEDIUM', MEDIUM: 'HIGH', HIGH: 'HIGH', CRITICAL: 'CRITICAL' },
    CRITICAL: { LOW: 'MEDIUM', MEDIUM: 'HIGH', HIGH: 'CRITICAL', CRITICAL: 'CRITICAL' },
  };
  return riskMatrix[likelihood][impact];
}

/**
 * Check if DPIA requires authority consultation
 * GDPR Art. 36 - Required when high residual risk remains
 */
export function requiresAuthorityConsultation(dpia: PrivacyImpactAssessment): boolean {
  if (!dpia.residualRisks || dpia.residualRisks.length === 0) {
    // Check original risks if no mitigations applied
    return dpia.risks.some(r => r.overallRisk === 'CRITICAL' || r.overallRisk === 'HIGH');
  }
  // Check residual risks after mitigation
  return dpia.residualRisks.some(r => r.residualLevel === 'CRITICAL' || r.residualLevel === 'HIGH');
}

/**
 * Check if DPIA can proceed to review
 */
export function canSubmitForReview(dpia: PrivacyImpactAssessment): boolean {
  // Must have risks identified
  if (dpia.risks.length === 0) return false;
  // Must have mitigations for high/critical risks
  const highRisks = dpia.risks.filter(r => r.overallRisk === 'HIGH' || r.overallRisk === 'CRITICAL');
  const mitigatedRiskIds = new Set(dpia.mitigations.map(m => m.riskId));
  const allHighRisksMitigated = highRisks.every(r => mitigatedRiskIds.has(r.id));
  return allHighRisksMitigated;
}

/**
 * Check if DPIA can be approved
 */
export function canApprove(dpia: PrivacyImpactAssessment): boolean {
  if (dpia.status !== 'PENDING_APPROVAL') return false;
  // If authority consultation required but not done, cannot approve
  if (requiresAuthorityConsultation(dpia) && !dpia.authorityConsulted) {
    return false;
  }
  return true;
}

/**
 * Check if DPIA is in a terminal state
 */
export function isTerminal(dpia: PrivacyImpactAssessment): boolean {
  return dpia.status === 'APPROVED' || dpia.status === 'REJECTED';
}

/**
 * Generate DPIA assessment number
 */
export function generateAssessmentNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `DPIA-${timestamp}-${random}`;
}

/**
 * Generate unique risk ID
 */
export function generateRiskId(): string {
  return `RISK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

/**
 * Generate unique mitigation ID
 */
export function generateMitigationId(): string {
  return `MIT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}
