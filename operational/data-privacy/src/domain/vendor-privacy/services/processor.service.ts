/**
 * Data Processor Service
 * Business logic for third-party processor management (GDPR Art. 28)
 */

import type { ProcessorRepository } from '../repositories/processor.repository.js';
import type {
  DataProcessor,
  CreateProcessorInput,
  UpdateProcessorInput,
  RecordDPAInput,
  AddTransferMechanismInput,
  AddSubProcessorInput,
  ProcessorQueryFilter,
  ComplianceStatus,
} from '../models/data-processor.js';
import {
  isEUCountry,
  hasAdequacyDecision,
  requiresTransferMechanism,
  canActivate,
  isDPAExpiringSoon,
  isDPAExpired,
  isAuditOverdue,
  getComplianceRisk,
} from '../models/data-processor.js';

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

export interface ProcessorRiskAssessment {
  processor: DataProcessor;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  issues: string[];
}

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

export class ProcessorService {
  constructor(private repository: ProcessorRepository) {}

  /**
   * Create a new processor
   */
  async createProcessor(
    input: CreateProcessorInput
  ): Promise<ServiceResult<DataProcessor & { requiresTransferMechanism: boolean }>> {
    const processor = await this.repository.create(input);
    const requiresMechanism = requiresTransferMechanism(processor);

    return {
      success: true,
      data: { ...processor, requiresTransferMechanism: requiresMechanism },
    };
  }

  /**
   * Update processor details
   */
  async updateProcessor(
    id: string,
    input: UpdateProcessorInput
  ): Promise<ServiceResult<DataProcessor>> {
    const processor = await this.repository.findById(id);

    if (!processor) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Processor not found' },
      };
    }

    if (processor.status === 'TERMINATED') {
      return {
        success: false,
        error: { code: 'TERMINATED', message: 'Cannot modify terminated processor' },
      };
    }

    const updated = await this.repository.update(id, input);
    return { success: true, data: updated };
  }

  /**
   * Record Data Processing Agreement
   */
  async recordDPA(
    id: string,
    input: RecordDPAInput
  ): Promise<ServiceResult<DataProcessor>> {
    const processor = await this.repository.findById(id);

    if (!processor) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Processor not found' },
      };
    }

    if (input.expiresAt <= input.signedAt) {
      return {
        success: false,
        error: { code: 'INVALID_DATES', message: 'Expiry date must be after signing date' },
      };
    }

    const updated = await this.repository.recordDPA(
      id,
      input.dpaReference,
      input.signedAt,
      input.expiresAt
    );

    return { success: true, data: updated };
  }

  /**
   * Set transfer mechanism for non-EU processor
   */
  async setTransferMechanism(
    id: string,
    input: AddTransferMechanismInput
  ): Promise<ServiceResult<DataProcessor>> {
    const processor = await this.repository.findById(id);

    if (!processor) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Processor not found' },
      };
    }

    if (processor.isEU) {
      return {
        success: false,
        error: { code: 'NOT_REQUIRED', message: 'Transfer mechanism not required for EU processors' },
      };
    }

    if (hasAdequacyDecision(processor.country)) {
      return {
        success: false,
        error: { code: 'NOT_REQUIRED', message: 'Country has adequacy decision' },
      };
    }

    // SCCs require reference
    if (input.mechanism === 'STANDARD_CONTRACTUAL_CLAUSES' && !input.sccReference) {
      return {
        success: false,
        error: { code: 'SCC_REFERENCE_REQUIRED', message: 'SCC reference is required' },
      };
    }

    const updated = await this.repository.setTransferMechanism(
      id,
      input.mechanism,
      input.sccReference
    );

    return { success: true, data: updated };
  }

  /**
   * Add sub-processor
   */
  async addSubProcessor(
    id: string,
    input: AddSubProcessorInput
  ): Promise<ServiceResult<DataProcessor>> {
    const processor = await this.repository.findById(id);

    if (!processor) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Processor not found' },
      };
    }

    // Check for duplicate
    if (processor.subProcessors?.some((sp) => sp.name === input.name)) {
      return {
        success: false,
        error: { code: 'DUPLICATE', message: 'Sub-processor already exists' },
      };
    }

    const updated = await this.repository.addSubProcessor(id, {
      name: input.name,
      country: input.country,
      purposes: input.purposes,
      approvedAt: new Date(),
    });

    return { success: true, data: updated };
  }

  /**
   * Remove sub-processor
   */
  async removeSubProcessor(
    id: string,
    subProcessorName: string
  ): Promise<ServiceResult<DataProcessor>> {
    const processor = await this.repository.findById(id);

    if (!processor) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Processor not found' },
      };
    }

    if (!processor.subProcessors?.some((sp) => sp.name === subProcessorName)) {
      return {
        success: false,
        error: { code: 'SUB_PROCESSOR_NOT_FOUND', message: 'Sub-processor not found' },
      };
    }

    const updated = await this.repository.removeSubProcessor(id, subProcessorName);
    return { success: true, data: updated };
  }

  /**
   * Activate processor (after DPA and transfer mechanism)
   */
  async activateProcessor(id: string): Promise<ServiceResult<DataProcessor>> {
    const processor = await this.repository.findById(id);

    if (!processor) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Processor not found' },
      };
    }

    if (processor.status === 'ACTIVE') {
      return {
        success: false,
        error: { code: 'ALREADY_ACTIVE', message: 'Processor is already active' },
      };
    }

    if (!canActivate(processor)) {
      const issues: string[] = [];
      if (!processor.dpaSignedAt) issues.push('DPA not recorded');
      if (isDPAExpired(processor)) issues.push('DPA has expired');
      if (requiresTransferMechanism(processor) && !processor.transferMechanism) {
        issues.push('Transfer mechanism required for non-EU/non-adequacy country');
      }

      return {
        success: false,
        error: {
          code: 'CANNOT_ACTIVATE',
          message: `Cannot activate: ${issues.join(', ')}`,
        },
      };
    }

    const updated = await this.repository.updateStatus(id, 'ACTIVE');
    return { success: true, data: updated };
  }

  /**
   * Suspend processor
   */
  async suspendProcessor(id: string, _reason?: string): Promise<ServiceResult<DataProcessor>> {
    const processor = await this.repository.findById(id);

    if (!processor) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Processor not found' },
      };
    }

    if (processor.status === 'TERMINATED') {
      return {
        success: false,
        error: { code: 'INVALID_STATE', message: 'Cannot suspend terminated processor' },
      };
    }

    const updated = await this.repository.updateStatus(id, 'SUSPENDED');
    return { success: true, data: updated };
  }

  /**
   * Terminate processor relationship
   */
  async terminateProcessor(id: string): Promise<ServiceResult<DataProcessor>> {
    const processor = await this.repository.findById(id);

    if (!processor) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Processor not found' },
      };
    }

    const updated = await this.repository.updateStatus(id, 'TERMINATED');
    return { success: true, data: updated };
  }

  /**
   * Record compliance audit
   */
  async recordAudit(
    id: string,
    complianceStatus: ComplianceStatus,
    _notes?: string,
    _auditedBy?: string
  ): Promise<ServiceResult<DataProcessor>> {
    const processor = await this.repository.findById(id);

    if (!processor) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Processor not found' },
      };
    }

    const updated = await this.repository.recordAudit(id, new Date(), complianceStatus);
    return { success: true, data: updated };
  }

  /**
   * Get compliance risk assessment for a processor
   */
  async getComplianceRisk(id: string): Promise<ServiceResult<ProcessorRiskAssessment>> {
    return this.getProcessor(id);
  }

  /**
   * Get processor by ID with risk assessment
   */
  async getProcessor(id: string): Promise<ServiceResult<ProcessorRiskAssessment>> {
    const processor = await this.repository.findById(id);

    if (!processor) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Processor not found' },
      };
    }

    const issues: string[] = [];
    if (!processor.dpaSignedAt) issues.push('No DPA on file');
    if (isDPAExpired(processor)) issues.push('DPA has expired');
    else if (isDPAExpiringSoon(processor)) issues.push('DPA expiring within 90 days');
    if (requiresTransferMechanism(processor) && !processor.transferMechanism) {
      issues.push('Missing transfer mechanism');
    }
    if (isAuditOverdue(processor)) issues.push('Audit overdue (>1 year)');
    if (processor.complianceStatus === 'NON_COMPLIANT') issues.push('Non-compliant status');
    if (processor.hasSubProcessors && (!processor.subProcessors || processor.subProcessors.length === 0)) {
      issues.push('Sub-processors not documented');
    }

    return {
      success: true,
      data: {
        processor,
        riskLevel: getComplianceRisk(processor),
        issues,
      },
    };
  }

  /**
   * List processors
   */
  async listProcessors(filter: ProcessorQueryFilter): Promise<{ data: DataProcessor[]; total: number }> {
    return this.repository.findMany(filter);
  }

  /**
   * Get DPA expiration report
   */
  async getDPAExpirationReport(
    entityId: string | undefined,
    daysThreshold: number = 90
  ): Promise<{ data: DataProcessor[]; count: number }> {
    const processors = await this.repository.findExpiringDPAs(entityId, daysThreshold);
    return {
      data: processors,
      count: processors.length,
    };
  }

  /**
   * Get vendor risk summary
   */
  async getVendorRiskSummary(entityId: string): Promise<{
    totalProcessors: number;
    activeProcessors: number;
    euProcessors: number;
    nonEuProcessors: number;
    dpaExpiringSoon: number;
    auditOverdue: number;
    highRisk: number;
  }> {
    const { data: all } = await this.repository.findMany({ entityId, limit: 1000 });
    const expiring = await this.repository.findExpiringDPAs(entityId, 90);

    return {
      totalProcessors: all.length,
      activeProcessors: all.filter((p) => p.status === 'ACTIVE').length,
      euProcessors: all.filter((p) => p.isEU).length,
      nonEuProcessors: all.filter((p) => !p.isEU).length,
      dpaExpiringSoon: expiring.length,
      auditOverdue: all.filter((p) => isAuditOverdue(p)).length,
      highRisk: all.filter((p) => ['HIGH', 'CRITICAL'].includes(getComplianceRisk(p))).length,
    };
  }
}
