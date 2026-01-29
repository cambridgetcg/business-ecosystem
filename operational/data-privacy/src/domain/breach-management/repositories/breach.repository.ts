/**
 * Breach Repository Interface
 * Abstracts data access for breach records
 */

import type {
  DataBreach,
  BreachActivity,
  BreachQueryFilter,
  CreateBreachInput,
  UpdateBreachInput,
  BreachStatus,
  RemediationStatus,
} from '../models/data-breach.js';

type BreachWithActivities = DataBreach & { activities: BreachActivity[] };

// ============================================================================
// REPOSITORY INTERFACE
// ============================================================================

export interface BreachRepository {
  /**
   * Find breach by ID with activities
   */
  findById(id: string): Promise<BreachWithActivities | null>;

  /**
   * Find breaches matching filter
   */
  findMany(filter: BreachQueryFilter): Promise<{ data: DataBreach[]; total: number }>;

  /**
   * Find breaches pending authority notification
   */
  findPendingNotification(entityId?: string): Promise<DataBreach[]>;

  /**
   * Create new breach
   */
  create(
    input: CreateBreachInput & {
      breachNumber: string;
      notificationDeadline?: Date;
    }
  ): Promise<BreachWithActivities>;

  /**
   * Update breach details
   */
  update(
    id: string,
    input: UpdateBreachInput,
    activity: { type: string; description: string; performedBy: string; metadata?: Record<string, unknown> }
  ): Promise<BreachWithActivities>;

  /**
   * Record authority notification
   */
  notifyAuthority(
    id: string,
    notifiedBy: string,
    authorityReference?: string
  ): Promise<BreachWithActivities>;

  /**
   * Record subject notification
   */
  notifySubjects(
    id: string,
    notificationMethod: string,
    notifiedBy: string
  ): Promise<BreachWithActivities>;

  /**
   * Mark breach as contained
   */
  markContained(id: string, containedBy: string): Promise<BreachWithActivities>;

  /**
   * Mark breach as resolved
   */
  markResolved(id: string, resolvedBy: string): Promise<BreachWithActivities>;

  /**
   * Update breach status
   */
  updateStatus(
    id: string,
    status: BreachStatus,
    activity: { type: string; description: string; performedBy: string }
  ): Promise<BreachWithActivities>;
}
