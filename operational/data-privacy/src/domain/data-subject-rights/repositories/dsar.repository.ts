/**
 * DSAR Repository Interface
 * Abstracts data access for DSAR requests
 */

import type {
  DSARRequest,
  DSARActivity,
  DSARQueryFilter,
  CreateDSARInput,
  DSARStatus,
  VerificationMethod,
  ResponseMethod,
} from '../models/dsar-request.js';

// ============================================================================
// REPOSITORY INTERFACE
// ============================================================================

export interface DSARRepository {
  /**
   * Find DSAR by ID with activities
   */
  findById(id: string): Promise<(DSARRequest & { activities: DSARActivity[] }) | null>;

  /**
   * Find DSARs matching filter
   */
  findMany(filter: DSARQueryFilter): Promise<{ data: DSARRequest[]; total: number }>;

  /**
   * Find overdue DSARs
   */
  findOverdue(entityId?: string): Promise<DSARRequest[]>;

  /**
   * Create new DSAR
   */
  create(
    input: CreateDSARInput & {
      requestNumber: string;
      deadline: Date;
      receivedAt: Date;
    }
  ): Promise<DSARRequest & { activities: DSARActivity[] }>;

  /**
   * Update DSAR status with activity log
   */
  updateStatus(
    id: string,
    status: DSARStatus,
    activity: { type: string; description: string; performedBy: string },
    metadata?: Record<string, unknown>
  ): Promise<DSARRequest & { activities: DSARActivity[] }>;

  /**
   * Mark DSAR as verified
   */
  markVerified(
    id: string,
    verificationMethod: VerificationMethod,
    verifiedBy: string
  ): Promise<DSARRequest & { activities: DSARActivity[] }>;

  /**
   * Start DSAR processing
   */
  startProcessing(
    id: string,
    assignedTo: string
  ): Promise<DSARRequest & { activities: DSARActivity[] }>;

  /**
   * Complete DSAR
   */
  complete(
    id: string,
    responseMethod: ResponseMethod,
    completedBy: string,
    responseRef?: string
  ): Promise<DSARRequest & { activities: DSARActivity[] }>;

  /**
   * Extend DSAR deadline
   */
  extend(
    id: string,
    extendedDeadline: Date,
    reason: string,
    extendedBy: string
  ): Promise<DSARRequest & { activities: DSARActivity[] }>;

  /**
   * Reject DSAR
   */
  reject(
    id: string,
    reason: string,
    rejectedBy: string
  ): Promise<DSARRequest & { activities: DSARActivity[] }>;
}
