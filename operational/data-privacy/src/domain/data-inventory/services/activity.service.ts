/**
 * Processing Activity Service
 * Business logic for GDPR Article 30 Records
 */

import type { ActivityRepository } from '../repositories/activity.repository.js';
import type {
  ProcessingActivity,
  CreateActivityInput,
  UpdateActivityInput,
  ActivityQueryFilter,
} from '../models/processing-activity.js';
import {
  shouldRequireDPIA,
  calculateNextReviewDate,
  validateSpecialCategoryBasis,
  isReviewDue,
  canArchive,
} from '../models/processing-activity.js';

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

export class ActivityService {
  constructor(private repository: ActivityRepository) {}

  /**
   * Create a new processing activity
   */
  async createActivity(
    input: CreateActivityInput
  ): Promise<ServiceResult<ProcessingActivity & { dpiaRecommended: boolean }>> {
    // Validate special category basis
    const specialCategories = input.specialCategories || [];
    if (specialCategories.length > 0) {
      const validation = validateSpecialCategoryBasis({
        specialCategories,
        lawfulBasis: input.lawfulBasis,
      } as ProcessingActivity);

      if (!validation.valid) {
        return {
          success: false,
          error: { code: 'INVALID_BASIS', message: validation.reason! },
        };
      }
    }

    const activity = await this.repository.create(input);
    const dpiaRecommended = shouldRequireDPIA(activity);

    return {
      success: true,
      data: { ...activity, dpiaRecommended },
    };
  }

  /**
   * Update activity details
   */
  async updateActivity(
    id: string,
    input: UpdateActivityInput
  ): Promise<ServiceResult<ProcessingActivity>> {
    const activity = await this.repository.findById(id);

    if (!activity) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Processing activity not found' },
      };
    }

    if (activity.status === 'ARCHIVED') {
      return {
        success: false,
        error: { code: 'ARCHIVED', message: 'Cannot modify archived activity' },
      };
    }

    // Validate special category basis if updating
    if (input.specialCategories || input.lawfulBasis) {
      const mergedSpecial = input.specialCategories ?? activity.specialCategories;
      const mergedBasis = input.lawfulBasis ?? activity.lawfulBasis;

      if (mergedSpecial.length > 0) {
        const validation = validateSpecialCategoryBasis({
          specialCategories: mergedSpecial,
          lawfulBasis: mergedBasis,
        } as ProcessingActivity);

        if (!validation.valid) {
          return {
            success: false,
            error: { code: 'INVALID_BASIS', message: validation.reason! },
          };
        }
      }
    }

    const updated = await this.repository.update(id, input);
    return { success: true, data: updated };
  }

  /**
   * Activate a draft activity
   */
  async activateActivity(id: string): Promise<ServiceResult<ProcessingActivity>> {
    const activity = await this.repository.findById(id);

    if (!activity) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Processing activity not found' },
      };
    }

    if (activity.status !== 'DRAFT') {
      return {
        success: false,
        error: { code: 'INVALID_STATE', message: 'Only draft activities can be activated' },
      };
    }

    // Validate completeness
    if (activity.purposes.length === 0) {
      return {
        success: false,
        error: { code: 'INCOMPLETE', message: 'Activity must have at least one purpose' },
      };
    }

    if (activity.lawfulBasis.length === 0) {
      return {
        success: false,
        error: { code: 'INCOMPLETE', message: 'Activity must have at least one lawful basis' },
      };
    }

    // Check DPIA requirement
    if (shouldRequireDPIA(activity) && !activity.dpiaReference) {
      return {
        success: false,
        error: { code: 'DPIA_REQUIRED', message: 'DPIA must be completed before activation' },
      };
    }

    const updated = await this.repository.updateStatus(id, 'ACTIVE');
    return { success: true, data: updated };
  }

  /**
   * Suspend an activity
   */
  async suspendActivity(id: string): Promise<ServiceResult<ProcessingActivity>> {
    const activity = await this.repository.findById(id);

    if (!activity) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Processing activity not found' },
      };
    }

    if (activity.status === 'ARCHIVED') {
      return {
        success: false,
        error: { code: 'INVALID_STATE', message: 'Cannot suspend archived activity' },
      };
    }

    const updated = await this.repository.updateStatus(id, 'SUSPENDED');
    return { success: true, data: updated };
  }

  /**
   * Archive an activity
   */
  async archiveActivity(id: string): Promise<ServiceResult<ProcessingActivity>> {
    const activity = await this.repository.findById(id);

    if (!activity) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Processing activity not found' },
      };
    }

    if (!canArchive(activity)) {
      return {
        success: false,
        error: { code: 'INVALID_STATE', message: 'Activity must be suspended before archiving' },
      };
    }

    const updated = await this.repository.updateStatus(id, 'ARCHIVED');
    return { success: true, data: updated };
  }

  /**
   * Record activity review
   */
  async recordReview(
    id: string,
    reviewedBy: string
  ): Promise<ServiceResult<ProcessingActivity>> {
    const activity = await this.repository.findById(id);

    if (!activity) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Processing activity not found' },
      };
    }

    const nextReviewDue = calculateNextReviewDate();
    const updated = await this.repository.recordReview(id, reviewedBy, nextReviewDue);

    return { success: true, data: updated };
  }

  /**
   * Link DPIA to activity
   */
  async linkDPIA(id: string, dpiaReference: string): Promise<ServiceResult<ProcessingActivity>> {
    const activity = await this.repository.findById(id);

    if (!activity) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Processing activity not found' },
      };
    }

    const updated = await this.repository.linkDPIA(id, dpiaReference);
    return { success: true, data: updated };
  }

  /**
   * Get activity by ID with analysis
   */
  async getActivity(
    id: string
  ): Promise<ServiceResult<ProcessingActivity & { reviewDue: boolean; dpiaRecommended: boolean }>> {
    const activity = await this.repository.findById(id);

    if (!activity) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Processing activity not found' },
      };
    }

    return {
      success: true,
      data: {
        ...activity,
        reviewDue: isReviewDue(activity),
        dpiaRecommended: shouldRequireDPIA(activity),
      },
    };
  }

  /**
   * List activities
   */
  async listActivities(filter: ActivityQueryFilter): Promise<{ data: ProcessingActivity[]; total: number }> {
    return this.repository.findMany(filter);
  }

  /**
   * Get activities due for review (compliance report)
   */
  async getReviewDueReport(entityId?: string): Promise<{
    data: ProcessingActivity[];
    count: number;
  }> {
    const activities = await this.repository.findDueForReview(entityId);
    return {
      data: activities,
      count: activities.length,
    };
  }

  /**
   * Get Article 30 summary for entity
   */
  async getArticle30Summary(entityId: string): Promise<{
    totalActivities: number;
    activeActivities: number;
    withSpecialCategories: number;
    withThirdCountryTransfers: number;
    pendingReview: number;
    dpiaRequired: number;
  }> {
    const { data: all } = await this.repository.findMany({ entityId, limit: 1000 });
    const specialCat = await this.repository.findWithSpecialCategories(entityId);
    const reviewDue = await this.repository.findDueForReview(entityId);

    return {
      totalActivities: all.length,
      activeActivities: all.filter((a) => a.status === 'ACTIVE').length,
      withSpecialCategories: specialCat.length,
      withThirdCountryTransfers: all.filter((a) => a.thirdCountryTransfers.length > 0).length,
      pendingReview: reviewDue.length,
      dpiaRequired: all.filter((a) => a.dpiaRequired).length,
    };
  }
}
