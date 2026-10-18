/**
 * Processing Activity Repository Interface
 * Abstracts data access for GDPR Article 30 records
 */

import type {
  ProcessingActivity,
  ActivityQueryFilter,
  CreateActivityInput,
  UpdateActivityInput,
  ActivityStatus,
} from '../models/processing-activity.js';

// ============================================================================
// REPOSITORY INTERFACE
// ============================================================================

export interface ActivityRepository {
  /**
   * Find activity by ID
   */
  findById(id: string): Promise<ProcessingActivity | null>;

  /**
   * Find activities matching filter
   */
  findMany(filter: ActivityQueryFilter): Promise<{ data: ProcessingActivity[]; total: number }>;

  /**
   * Find activities due for review
   */
  findDueForReview(entityId?: string): Promise<ProcessingActivity[]>;

  /**
   * Find activities with special category data
   */
  findWithSpecialCategories(entityId?: string): Promise<ProcessingActivity[]>;

  /**
   * Create new activity
   */
  create(input: CreateActivityInput): Promise<ProcessingActivity>;

  /**
   * Update activity
   */
  update(id: string, input: UpdateActivityInput): Promise<ProcessingActivity>;

  /**
   * Update activity status
   */
  updateStatus(id: string, status: ActivityStatus): Promise<ProcessingActivity>;

  /**
   * Record review
   */
  recordReview(id: string, reviewedBy: string, nextReviewDue: Date): Promise<ProcessingActivity>;

  /**
   * Link DPIA to activity
   */
  linkDPIA(id: string, dpiaReference: string): Promise<ProcessingActivity>;
}
