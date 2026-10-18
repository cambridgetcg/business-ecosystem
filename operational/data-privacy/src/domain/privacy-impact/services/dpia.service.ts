/**
 * DPIA Service
 * Business logic for Privacy Impact Assessments (GDPR Art. 35)
 */

import type { DPIARepository } from '../repositories/dpia.repository.js';
import type {
  PrivacyImpactAssessment,
  CreateDPIAInput,
  UpdateDPIAInput,
  AddRiskInput,
  AddMitigationInput,
  DPOConsultationInput,
  ReviewInput,
  DPIAQueryFilter,
  IdentifiedRisk,
  Mitigation,
  ResidualRisk,
} from '../models/privacy-impact-assessment.js';
import {
  generateAssessmentNumber,
  generateRiskId,
  generateMitigationId,
  calculateOverallRisk,
  canSubmitForReview,
  canApprove,
  requiresAuthorityConsultation,
  isTerminal,
} from '../models/privacy-impact-assessment.js';

// ============================================================================
// SERVICE RESULT TYPES
// ============================================================================

export interface ServiceError {
  code: string;
  message: string;
}

export type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: ServiceError };

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

export class DPIAService {
  constructor(private repository: DPIARepository) {}

  /**
   * Create a new DPIA
   */
  async createDPIA(input: CreateDPIAInput): Promise<ServiceResult<PrivacyImpactAssessment>> {
    const assessmentNumber = generateAssessmentNumber();

    const dpia = await this.repository.create({
      ...input,
      assessmentNumber,
    });

    return { success: true, data: dpia };
  }

  /**
   * Update DPIA details
   */
  async updateDPIA(
    id: string,
    input: UpdateDPIAInput
  ): Promise<ServiceResult<PrivacyImpactAssessment>> {
    const dpia = await this.repository.findById(id);

    if (!dpia) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'DPIA not found' },
      };
    }

    if (isTerminal(dpia)) {
      return {
        success: false,
        error: { code: 'INVALID_STATE', message: 'Cannot modify approved/rejected DPIA' },
      };
    }

    const updated = await this.repository.update(id, input);
    return { success: true, data: updated };
  }

  /**
   * Add risk to DPIA
   */
  async addRisk(
    id: string,
    input: AddRiskInput
  ): Promise<ServiceResult<PrivacyImpactAssessment>> {
    const dpia = await this.repository.findById(id);

    if (!dpia) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'DPIA not found' },
      };
    }

    if (isTerminal(dpia)) {
      return {
        success: false,
        error: { code: 'INVALID_STATE', message: 'Cannot add risks to approved/rejected DPIA' },
      };
    }

    const risk: IdentifiedRisk = {
      id: generateRiskId(),
      description: input.description,
      likelihood: input.likelihood,
      impact: input.impact,
      overallRisk: calculateOverallRisk(input.likelihood, input.impact),
      affectedRights: input.affectedRights,
      category: input.category,
    };

    const updated = await this.repository.addRisk(id, risk);
    return { success: true, data: updated };
  }

  /**
   * Add mitigation for a risk
   */
  async addMitigation(
    id: string,
    input: AddMitigationInput
  ): Promise<ServiceResult<PrivacyImpactAssessment>> {
    const dpia = await this.repository.findById(id);

    if (!dpia) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'DPIA not found' },
      };
    }

    if (isTerminal(dpia)) {
      return {
        success: false,
        error: { code: 'INVALID_STATE', message: 'Cannot add mitigations to approved/rejected DPIA' },
      };
    }

    // Verify risk exists
    const riskExists = dpia.risks.some((r) => r.id === input.riskId);
    if (!riskExists) {
      return {
        success: false,
        error: { code: 'RISK_NOT_FOUND', message: 'Referenced risk not found' },
      };
    }

    const mitigation: Mitigation = {
      id: generateMitigationId(),
      riskId: input.riskId,
      description: input.description,
      type: input.type,
      status: 'PLANNED',
      effectiveness: 'MEDIUM', // Default, can be updated after implementation
    };

    const updated = await this.repository.addMitigation(id, mitigation);
    return { success: true, data: updated };
  }

  /**
   * Update mitigation status (PLANNED -> IMPLEMENTED -> VERIFIED)
   */
  async updateMitigationStatus(
    id: string,
    mitigationId: string,
    status: Mitigation['status']
  ): Promise<ServiceResult<PrivacyImpactAssessment>> {
    const dpia = await this.repository.findById(id);

    if (!dpia) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'DPIA not found' },
      };
    }

    const mitigationExists = dpia.mitigations.some((m) => m.id === mitigationId);
    if (!mitigationExists) {
      return {
        success: false,
        error: { code: 'MITIGATION_NOT_FOUND', message: 'Mitigation not found' },
      };
    }

    const updated = await this.repository.updateMitigationStatus(id, mitigationId, status);
    return { success: true, data: updated };
  }

  /**
   * Set residual risks after mitigations
   */
  async setResidualRisks(
    id: string,
    residualRisks: ResidualRisk[]
  ): Promise<ServiceResult<PrivacyImpactAssessment>> {
    const dpia = await this.repository.findById(id);

    if (!dpia) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'DPIA not found' },
      };
    }

    // Verify all referenced risks exist
    const riskIds = new Set(dpia.risks.map((r) => r.id));
    const invalidRisks = residualRisks.filter((r) => !riskIds.has(r.riskId));
    if (invalidRisks.length > 0) {
      return {
        success: false,
        error: {
          code: 'INVALID_RISK_REFERENCE',
          message: `Invalid risk IDs: ${invalidRisks.map((r) => r.riskId).join(', ')}`,
        },
      };
    }

    const updated = await this.repository.setResidualRisks(id, residualRisks);
    return { success: true, data: updated };
  }

  /**
   * Record DPO consultation
   */
  async consultDPO(
    id: string,
    input: DPOConsultationInput
  ): Promise<ServiceResult<PrivacyImpactAssessment>> {
    const dpia = await this.repository.findById(id);

    if (!dpia) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'DPIA not found' },
      };
    }

    if (dpia.dpoConsulted) {
      return {
        success: false,
        error: { code: 'ALREADY_CONSULTED', message: 'DPO already consulted' },
      };
    }

    const updated = await this.repository.recordDPOConsultation(id, input.opinion);
    return { success: true, data: updated };
  }

  /**
   * Record supervisory authority consultation (GDPR Art. 36)
   */
  async consultAuthority(
    id: string,
    response: string
  ): Promise<ServiceResult<PrivacyImpactAssessment>> {
    const dpia = await this.repository.findById(id);

    if (!dpia) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'DPIA not found' },
      };
    }

    if (dpia.authorityConsulted) {
      return {
        success: false,
        error: { code: 'ALREADY_CONSULTED', message: 'Authority already consulted' },
      };
    }

    const updated = await this.repository.recordAuthorityConsultation(id, response);

    // Move to pending approval after authority consultation
    if (updated.status === 'REQUIRES_CONSULTATION') {
      return {
        success: true,
        data: await this.repository.updateStatus(id, 'PENDING_APPROVAL'),
      };
    }

    return { success: true, data: updated };
  }

  /**
   * Submit DPIA for review
   */
  async submitForReview(id: string): Promise<ServiceResult<PrivacyImpactAssessment>> {
    const dpia = await this.repository.findById(id);

    if (!dpia) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'DPIA not found' },
      };
    }

    if (!canSubmitForReview(dpia)) {
      return {
        success: false,
        error: {
          code: 'CANNOT_SUBMIT',
          message: 'DPIA must have risks identified and high/critical risks mitigated',
        },
      };
    }

    const updated = await this.repository.updateStatus(id, 'PENDING_REVIEW');
    return { success: true, data: updated };
  }

  /**
   * Review DPIA (approve for next stage or reject)
   */
  async reviewDPIA(
    id: string,
    input: ReviewInput
  ): Promise<ServiceResult<PrivacyImpactAssessment>> {
    const dpia = await this.repository.findById(id);

    if (!dpia) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'DPIA not found' },
      };
    }

    if (dpia.status !== 'PENDING_REVIEW') {
      return {
        success: false,
        error: { code: 'INVALID_STATE', message: 'DPIA is not pending review' },
      };
    }

    let newStatus: PrivacyImpactAssessment['status'];
    if (!input.approved) {
      newStatus = 'REJECTED';
    } else if (requiresAuthorityConsultation(dpia)) {
      newStatus = 'REQUIRES_CONSULTATION';
    } else {
      newStatus = 'PENDING_APPROVAL';
    }

    const updated = await this.repository.recordReview(
      id,
      input.reviewedBy,
      input.notes,
      newStatus
    );

    return { success: true, data: updated };
  }

  /**
   * Final approval of DPIA
   */
  async approveDPIA(
    id: string,
    approvedBy: string,
    notes: string
  ): Promise<ServiceResult<PrivacyImpactAssessment>> {
    const dpia = await this.repository.findById(id);

    if (!dpia) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'DPIA not found' },
      };
    }

    if (!canApprove(dpia)) {
      return {
        success: false,
        error: {
          code: 'CANNOT_APPROVE',
          message: 'DPIA cannot be approved. Check status and authority consultation requirement.',
        },
      };
    }

    const updated = await this.repository.recordApproval(id, approvedBy, notes);
    return { success: true, data: updated };
  }

  /**
   * Get DPIA by ID
   */
  async getDPIA(
    id: string
  ): Promise<ServiceResult<PrivacyImpactAssessment & { requiresConsultation: boolean }>> {
    const dpia = await this.repository.findById(id);

    if (!dpia) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'DPIA not found' },
      };
    }

    return {
      success: true,
      data: {
        ...dpia,
        requiresConsultation: requiresAuthorityConsultation(dpia),
      },
    };
  }

  /**
   * List DPIAs with filtering
   */
  async listDPIAs(filter: DPIAQueryFilter): Promise<{ data: PrivacyImpactAssessment[]; total: number }> {
    return this.repository.findMany(filter);
  }
}
