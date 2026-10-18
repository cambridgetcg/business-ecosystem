/**
 * DPIA Repository Interface
 * Abstracts data access for Privacy Impact Assessments
 */

import type {
  PrivacyImpactAssessment,
  DPIAQueryFilter,
  CreateDPIAInput,
  UpdateDPIAInput,
  IdentifiedRisk,
  Mitigation,
  ResidualRisk,
  DPIAStatus,
} from '../models/privacy-impact-assessment.js';

// ============================================================================
// REPOSITORY INTERFACE
// ============================================================================

export interface DPIARepository {
  /**
   * Find DPIA by ID
   */
  findById(id: string): Promise<PrivacyImpactAssessment | null>;

  /**
   * Find DPIAs matching filter
   */
  findMany(filter: DPIAQueryFilter): Promise<{ data: PrivacyImpactAssessment[]; total: number }>;

  /**
   * Create new DPIA
   */
  create(
    input: CreateDPIAInput & { assessmentNumber: string }
  ): Promise<PrivacyImpactAssessment>;

  /**
   * Update DPIA details
   */
  update(id: string, input: UpdateDPIAInput): Promise<PrivacyImpactAssessment>;

  /**
   * Update DPIA status
   */
  updateStatus(id: string, status: DPIAStatus): Promise<PrivacyImpactAssessment>;

  /**
   * Add risk to DPIA
   */
  addRisk(id: string, risk: IdentifiedRisk): Promise<PrivacyImpactAssessment>;

  /**
   * Add mitigation to DPIA
   */
  addMitigation(id: string, mitigation: Mitigation): Promise<PrivacyImpactAssessment>;

  /**
   * Update mitigation status
   */
  updateMitigationStatus(
    id: string,
    mitigationId: string,
    status: Mitigation['status']
  ): Promise<PrivacyImpactAssessment>;

  /**
   * Set residual risks
   */
  setResidualRisks(id: string, residualRisks: ResidualRisk[]): Promise<PrivacyImpactAssessment>;

  /**
   * Record DPO consultation
   */
  recordDPOConsultation(
    id: string,
    opinion: string
  ): Promise<PrivacyImpactAssessment>;

  /**
   * Record authority consultation
   */
  recordAuthorityConsultation(
    id: string,
    response: string
  ): Promise<PrivacyImpactAssessment>;

  /**
   * Record review
   */
  recordReview(
    id: string,
    reviewedBy: string,
    notes: string,
    newStatus: DPIAStatus
  ): Promise<PrivacyImpactAssessment>;

  /**
   * Record approval
   */
  recordApproval(
    id: string,
    approvedBy: string,
    notes: string
  ): Promise<PrivacyImpactAssessment>;
}
