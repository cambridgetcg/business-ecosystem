/**
 * Data Transfer Service
 * Business logic for cross-border data transfers (GDPR Chapter V)
 */

import type { TransferRepository } from '../repositories/transfer.repository.js';
import type {
  DataTransfer,
  CreateTransferInput,
  UpdateTransferInput,
  TransferImpactAssessmentInput,
  TransferQueryFilter,
  RiskLevel,
} from '../models/data-transfer.js';
import {
  hasAdequacyDecision,
  getAdequacyDecision,
  requiresTransferImpactAssessment,
  canApprove,
  recommendTransferBasis,
  getTransferComplianceStatus,
  calculateTransferRisk,
} from '../models/data-transfer.js';

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

export interface TransferRiskAssessment {
  transfer: DataTransfer;
  riskLevel: RiskLevel;
  compliant: boolean;
  issues: string[];
  requiresTIA: boolean;
}

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

export class TransferService {
  constructor(private repository: TransferRepository) {}

  /**
   * Create a new data transfer record
   */
  async createTransfer(
    input: CreateTransferInput
  ): Promise<ServiceResult<DataTransfer & { requiresTIA: boolean; recommendation: ReturnType<typeof recommendTransferBasis> }>> {
    const transfer = await this.repository.create(input);
    const requiresTIA = requiresTransferImpactAssessment(transfer);
    const recommendation = recommendTransferBasis(input.destinationCountry);

    return {
      success: true,
      data: { ...transfer, requiresTIA, recommendation },
    };
  }

  /**
   * Update transfer details
   */
  async updateTransfer(
    id: string,
    input: UpdateTransferInput
  ): Promise<ServiceResult<DataTransfer>> {
    const transfer = await this.repository.findById(id);

    if (!transfer) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Transfer not found' },
      };
    }

    if (transfer.status === 'APPROVED') {
      return {
        success: false,
        error: { code: 'ALREADY_APPROVED', message: 'Cannot modify approved transfer' },
      };
    }

    const updated = await this.repository.update(id, input);
    return { success: true, data: updated };
  }

  /**
   * Record Transfer Impact Assessment (Schrems II requirement)
   * Alias: recordImpactAssessment
   */
  async recordImpactAssessment(
    id: string,
    input: TransferImpactAssessmentInput
  ): Promise<ServiceResult<DataTransfer>> {
    return this.recordTransferImpactAssessmentInternal(id, input);
  }

  /**
   * Record Transfer Impact Assessment (Schrems II requirement)
   */
  async recordTransferImpactAssessment(
    id: string,
    input: TransferImpactAssessmentInput
  ): Promise<ServiceResult<DataTransfer>> {
    return this.recordTransferImpactAssessmentInternal(id, input);
  }

  private async recordTransferImpactAssessmentInternal(
    id: string,
    input: TransferImpactAssessmentInput
  ): Promise<ServiceResult<DataTransfer>> {
    const transfer = await this.repository.findById(id);

    if (!transfer) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Transfer not found' },
      };
    }

    if (!requiresTransferImpactAssessment(transfer)) {
      return {
        success: false,
        error: {
          code: 'TIA_NOT_REQUIRED',
          message: 'Transfer Impact Assessment not required for this transfer (adequacy decision applies)',
        },
      };
    }

    // Critical risk cannot proceed without supplementary measures
    if (input.riskLevel === 'CRITICAL' && !input.supplementaryMeasures) {
      return {
        success: false,
        error: {
          code: 'CRITICAL_RISK',
          message: 'Critical risk assessment requires supplementary measures or transfer should not proceed',
        },
      };
    }

    const assessment = {
      assessedAt: new Date(),
      assessedBy: input.assessedBy,
      recipientCountryLaws: input.recipientCountryLaws,
      supplementaryMeasures: input.supplementaryMeasures,
      riskLevel: input.riskLevel,
      conclusion: input.conclusion,
    };

    const updated = await this.repository.recordTIA(id, assessment);
    return { success: true, data: updated };
  }

  /**
   * Add supplementary measures (encryption, pseudonymization, etc.)
   */
  async addSupplementaryMeasures(
    id: string,
    measures: {
      technicalMeasures?: string[];
      organizationalMeasures?: string[];
      contractualMeasures?: string[];
    }
  ): Promise<ServiceResult<DataTransfer>> {
    const transfer = await this.repository.findById(id);

    if (!transfer) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Transfer not found' },
      };
    }

    const updated = await this.repository.addSupplementaryMeasures(
      id,
      measures.technicalMeasures || [],
      measures.organizationalMeasures || [],
      measures.contractualMeasures || []
    );

    return { success: true, data: updated };
  }

  /**
   * Submit transfer for review
   */
  async submitForReview(id: string): Promise<ServiceResult<DataTransfer>> {
    const transfer = await this.repository.findById(id);

    if (!transfer) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Transfer not found' },
      };
    }

    if (transfer.status !== 'DRAFT') {
      return {
        success: false,
        error: { code: 'INVALID_STATE', message: 'Only draft transfers can be submitted' },
      };
    }

    // Check if TIA is required but missing
    if (requiresTransferImpactAssessment(transfer) && !transfer.transferImpactAssessment) {
      return {
        success: false,
        error: {
          code: 'TIA_REQUIRED',
          message: 'Transfer Impact Assessment must be completed before review',
        },
      };
    }

    const updated = await this.repository.updateStatus(id, 'PENDING_REVIEW');
    return { success: true, data: updated };
  }

  /**
   * Approve transfer
   */
  async approveTransfer(
    id: string,
    approvedBy: string,
    _notes?: string
  ): Promise<ServiceResult<DataTransfer>> {
    const transfer = await this.repository.findById(id);

    if (!transfer) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Transfer not found' },
      };
    }

    if (!canApprove(transfer)) {
      const { issues } = getTransferComplianceStatus(transfer);
      return {
        success: false,
        error: {
          code: 'CANNOT_APPROVE',
          message: `Cannot approve: ${issues.join(', ')}`,
        },
      };
    }

    const updated = await this.repository.recordApproval(id, approvedBy);
    return { success: true, data: updated };
  }

  /**
   * Reject transfer
   */
  async rejectTransfer(
    id: string,
    _rejectedBy?: string,
    _reason?: string
  ): Promise<ServiceResult<DataTransfer>> {
    const transfer = await this.repository.findById(id);

    if (!transfer) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Transfer not found' },
      };
    }

    const updated = await this.repository.updateStatus(id, 'REJECTED');
    return { success: true, data: updated };
  }

  /**
   * Suspend transfer
   */
  async suspendTransfer(id: string, _reason?: string): Promise<ServiceResult<DataTransfer>> {
    const transfer = await this.repository.findById(id);

    if (!transfer) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Transfer not found' },
      };
    }

    const updated = await this.repository.updateStatus(id, 'SUSPENDED');
    return { success: true, data: updated };
  }

  /**
   * Get recommended transfer basis for a country
   */
  getRecommendedBasis(countryCode: string): ReturnType<typeof recommendTransferBasis> {
    return recommendTransferBasis(countryCode);
  }

  /**
   * Get adequacy status for a country
   */
  getAdequacyStatus(countryCode: string): {
    hasAdequacy: boolean;
    decision: { decision: string; date: string } | null;
  } {
    return {
      hasAdequacy: hasAdequacyDecision(countryCode),
      decision: getAdequacyDecision(countryCode),
    };
  }

  /**
   * Get compliance status for a transfer
   */
  async getComplianceStatus(id: string): Promise<ServiceResult<{
    compliant: boolean;
    issues: string[];
    riskLevel: RiskLevel;
  }>> {
    const transfer = await this.repository.findById(id);

    if (!transfer) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Transfer not found' },
      };
    }

    const { compliant, issues } = getTransferComplianceStatus(transfer);

    return {
      success: true,
      data: {
        compliant,
        issues,
        riskLevel: calculateTransferRisk(transfer),
      },
    };
  }

  /**
   * Get transfer with risk assessment
   */
  async getTransfer(id: string): Promise<ServiceResult<TransferRiskAssessment>> {
    const transfer = await this.repository.findById(id);

    if (!transfer) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Transfer not found' },
      };
    }

    const { compliant, issues } = getTransferComplianceStatus(transfer);

    return {
      success: true,
      data: {
        transfer,
        riskLevel: calculateTransferRisk(transfer),
        compliant,
        issues,
        requiresTIA: requiresTransferImpactAssessment(transfer),
      },
    };
  }

  /**
   * List transfers
   */
  async listTransfers(filter: TransferQueryFilter): Promise<{ data: DataTransfer[]; total: number }> {
    return this.repository.findMany(filter);
  }

  /**
   * Get country adequacy status
   */
  getCountryAdequacy(countryCode: string): {
    hasAdequacy: boolean;
    decision: { decision: string; date: string } | null;
    recommendation: ReturnType<typeof recommendTransferBasis>;
  } {
    return {
      hasAdequacy: hasAdequacyDecision(countryCode),
      decision: getAdequacyDecision(countryCode),
      recommendation: recommendTransferBasis(countryCode),
    };
  }

  /**
   * Get transfers requiring TIA
   */
  async getTransfersNeedingTIA(entityId?: string): Promise<{
    data: DataTransfer[];
    count: number;
  }> {
    const transfers = await this.repository.findWithoutTIA(entityId);
    const needingTIA = transfers.filter(requiresTransferImpactAssessment);
    return {
      data: needingTIA,
      count: needingTIA.length,
    };
  }

  /**
   * Get transfer compliance summary
   */
  async getTransferSummary(entityId: string): Promise<{
    totalTransfers: number;
    approvedTransfers: number;
    pendingTransfers: number;
    adequacyTransfers: number;
    sccTransfers: number;
    bcrTransfers: number;
    missingTIA: number;
    highRiskTransfers: number;
    destinationCountries: string[];
  }> {
    const { data: all } = await this.repository.findMany({ entityId, limit: 1000 });
    const needingTIA = await this.repository.findWithoutTIA(entityId);

    const countries = new Set(all.map((t) => t.destinationCountry));

    return {
      totalTransfers: all.length,
      approvedTransfers: all.filter((t) => t.status === 'APPROVED').length,
      pendingTransfers: all.filter((t) => t.status === 'PENDING_REVIEW' || t.status === 'DRAFT').length,
      adequacyTransfers: all.filter((t) => t.transferBasis === 'ADEQUACY_DECISION').length,
      sccTransfers: all.filter((t) => t.transferBasis === 'STANDARD_CONTRACTUAL_CLAUSES').length,
      bcrTransfers: all.filter((t) => t.transferBasis === 'BINDING_CORPORATE_RULES').length,
      missingTIA: needingTIA.filter(requiresTransferImpactAssessment).length,
      highRiskTransfers: all.filter((t) => ['HIGH', 'CRITICAL'].includes(calculateTransferRisk(t))).length,
      destinationCountries: Array.from(countries),
    };
  }
}
