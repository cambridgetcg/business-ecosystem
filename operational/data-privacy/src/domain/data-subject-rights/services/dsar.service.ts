/**
 * DSAR Service
 * Business logic for Data Subject Access Requests (GDPR Art. 15-22)
 */

import type { DSARRepository } from '../repositories/dsar.repository.js';
import type {
  DSARRequest,
  DSARActivity,
  CreateDSARInput,
  VerifyDSARInput,
  CompleteDSARInput,
  ExtendDSARInput,
  RejectDSARInput,
  DSARQueryFilter,
} from '../models/dsar-request.js';
import {
  calculateDeadline,
  calculateExtendedDeadline,
  generateRequestNumber,
  canVerify,
  canStartProcessing,
  canComplete,
  canExtend,
  isOverdue,
  getDaysRemaining,
} from '../models/dsar-request.js';

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

type DSARWithActivities = DSARRequest & { activities: DSARActivity[] };

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

export class DSARService {
  constructor(private repository: DSARRepository) {}

  /**
   * Submit a new DSAR
   */
  async submitDSAR(input: CreateDSARInput): Promise<ServiceResult<DSARWithActivities>> {
    const now = new Date();

    const dsar = await this.repository.create({
      ...input,
      requestNumber: generateRequestNumber(),
      receivedAt: now,
      deadline: calculateDeadline(now),
    });

    return { success: true, data: dsar };
  }

  /**
   * Verify subject identity
   */
  async verifyIdentity(
    id: string,
    input: VerifyDSARInput
  ): Promise<ServiceResult<DSARWithActivities>> {
    const dsar = await this.repository.findById(id);

    if (!dsar) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'DSAR not found' },
      };
    }

    if (!canVerify(dsar)) {
      return {
        success: false,
        error: { code: 'INVALID_STATE', message: 'DSAR is not awaiting verification' },
      };
    }

    const updated = await this.repository.markVerified(
      id,
      input.verificationMethod,
      input.verifiedBy
    );

    return { success: true, data: updated };
  }

  /**
   * Start processing a DSAR
   */
  async startProcessing(
    id: string,
    assignedTo: string
  ): Promise<ServiceResult<DSARWithActivities>> {
    const dsar = await this.repository.findById(id);

    if (!dsar) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'DSAR not found' },
      };
    }

    if (!canStartProcessing(dsar)) {
      return {
        success: false,
        error: { code: 'INVALID_STATE', message: 'DSAR must be verified before processing' },
      };
    }

    const updated = await this.repository.startProcessing(id, assignedTo);

    return { success: true, data: updated };
  }

  /**
   * Complete a DSAR
   */
  async completeDSAR(
    id: string,
    input: CompleteDSARInput,
    completedBy: string
  ): Promise<ServiceResult<DSARWithActivities & { onTime: boolean }>> {
    const dsar = await this.repository.findById(id);

    if (!dsar) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'DSAR not found' },
      };
    }

    if (!canComplete(dsar)) {
      return {
        success: false,
        error: { code: 'INVALID_STATE', message: 'DSAR is not in a completable state' },
      };
    }

    const updated = await this.repository.complete(
      id,
      input.responseMethod,
      completedBy,
      input.responseRef
    );

    // Check if completed on time
    const effectiveDeadline = dsar.extendedDeadline ?? dsar.deadline;
    const onTime = new Date() <= effectiveDeadline;

    return { success: true, data: { ...updated, onTime } };
  }

  /**
   * Extend DSAR deadline (GDPR Art. 12(3))
   */
  async extendDeadline(
    id: string,
    input: ExtendDSARInput,
    extendedBy: string
  ): Promise<ServiceResult<DSARWithActivities>> {
    const dsar = await this.repository.findById(id);

    if (!dsar) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'DSAR not found' },
      };
    }

    if (!canExtend(dsar)) {
      return {
        success: false,
        error: {
          code: 'EXTENSION_NOT_ALLOWED',
          message: dsar.extendedDeadline
            ? 'DSAR deadline already extended'
            : 'Cannot extend past original deadline',
        },
      };
    }

    const extendedDeadline = calculateExtendedDeadline(dsar.receivedAt);
    const updated = await this.repository.extend(id, extendedDeadline, input.reason, extendedBy);

    return { success: true, data: updated };
  }

  /**
   * Reject a DSAR
   */
  async rejectDSAR(
    id: string,
    input: RejectDSARInput,
    rejectedBy: string
  ): Promise<ServiceResult<DSARWithActivities>> {
    const dsar = await this.repository.findById(id);

    if (!dsar) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'DSAR not found' },
      };
    }

    const updated = await this.repository.reject(id, input.reason, rejectedBy);

    return { success: true, data: updated };
  }

  /**
   * Get DSAR by ID
   */
  async getDSAR(id: string): Promise<ServiceResult<DSARWithActivities & { daysRemaining: number; isOverdue: boolean }>> {
    const dsar = await this.repository.findById(id);

    if (!dsar) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'DSAR not found' },
      };
    }

    return {
      success: true,
      data: {
        ...dsar,
        daysRemaining: getDaysRemaining(dsar),
        isOverdue: isOverdue(dsar),
      },
    };
  }

  /**
   * List DSARs with filtering
   */
  async listDSARs(filter: DSARQueryFilter): Promise<{ data: DSARRequest[]; total: number }> {
    return this.repository.findMany(filter);
  }

  /**
   * Get overdue DSARs report
   */
  async getOverdueDSARs(entityId?: string): Promise<DSARRequest[]> {
    return this.repository.findOverdue(entityId);
  }
}
