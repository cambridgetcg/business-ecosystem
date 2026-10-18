/**
 * Data Transfer Repository Interface
 * Abstracts data access for cross-border transfer management
 */

import type {
  DataTransfer,
  TransferQueryFilter,
  CreateTransferInput,
  UpdateTransferInput,
  TransferImpactAssessment,
  TransferStatus,
} from '../models/data-transfer.js';

// ============================================================================
// REPOSITORY INTERFACE
// ============================================================================

export interface TransferRepository {
  /**
   * Find transfer by ID
   */
  findById(id: string): Promise<DataTransfer | null>;

  /**
   * Find transfers matching filter
   */
  findMany(filter: TransferQueryFilter): Promise<{ data: DataTransfer[]; total: number }>;

  /**
   * Find transfers by destination country
   */
  findByDestination(countryCode: string, entityId?: string): Promise<DataTransfer[]>;

  /**
   * Find transfers without impact assessment
   */
  findWithoutTIA(entityId?: string): Promise<DataTransfer[]>;

  /**
   * Create new transfer
   */
  create(input: CreateTransferInput): Promise<DataTransfer>;

  /**
   * Update transfer
   */
  update(id: string, input: UpdateTransferInput): Promise<DataTransfer>;

  /**
   * Update transfer status
   */
  updateStatus(id: string, status: TransferStatus): Promise<DataTransfer>;

  /**
   * Record Transfer Impact Assessment
   */
  recordTIA(id: string, assessment: TransferImpactAssessment): Promise<DataTransfer>;

  /**
   * Add supplementary measures
   */
  addSupplementaryMeasures(
    id: string,
    technical: string[],
    organizational: string[],
    contractual: string[]
  ): Promise<DataTransfer>;

  /**
   * Record approval
   */
  recordApproval(id: string, approvedBy: string): Promise<DataTransfer>;
}
