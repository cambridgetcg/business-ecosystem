/**
 * Data Processor Repository Interface
 * Abstracts data access for third-party processor management
 */

import type {
  DataProcessor,
  ProcessorQueryFilter,
  CreateProcessorInput,
  UpdateProcessorInput,
  ProcessorStatus,
  ComplianceStatus,
  TransferMechanism,
  SubProcessor,
} from '../models/data-processor.js';

// ============================================================================
// REPOSITORY INTERFACE
// ============================================================================

export interface ProcessorRepository {
  /**
   * Find processor by ID
   */
  findById(id: string): Promise<DataProcessor | null>;

  /**
   * Find processors matching filter
   */
  findMany(filter: ProcessorQueryFilter): Promise<{ data: DataProcessor[]; total: number }>;

  /**
   * Find processors with expiring DPAs
   */
  findExpiringDPAs(entityId: string | undefined, daysThreshold: number): Promise<DataProcessor[]>;

  /**
   * Find non-compliant processors
   */
  findNonCompliant(entityId?: string): Promise<DataProcessor[]>;

  /**
   * Create new processor
   */
  create(input: CreateProcessorInput): Promise<DataProcessor>;

  /**
   * Update processor
   */
  update(id: string, input: UpdateProcessorInput): Promise<DataProcessor>;

  /**
   * Update processor status
   */
  updateStatus(id: string, status: ProcessorStatus): Promise<DataProcessor>;

  /**
   * Record DPA
   */
  recordDPA(
    id: string,
    dpaReference: string,
    signedAt: Date,
    expiresAt: Date
  ): Promise<DataProcessor>;

  /**
   * Set transfer mechanism
   */
  setTransferMechanism(
    id: string,
    mechanism: TransferMechanism,
    sccReference?: string
  ): Promise<DataProcessor>;

  /**
   * Add sub-processor
   */
  addSubProcessor(id: string, subProcessor: SubProcessor): Promise<DataProcessor>;

  /**
   * Remove sub-processor
   */
  removeSubProcessor(id: string, subProcessorName: string): Promise<DataProcessor>;

  /**
   * Record audit
   */
  recordAudit(
    id: string,
    auditDate: Date,
    complianceStatus: ComplianceStatus
  ): Promise<DataProcessor>;

  /**
   * Update certifications
   */
  updateCertifications(id: string, certifications: string[]): Promise<DataProcessor>;
}
