/**
 * Breach Service
 * Business logic for Data Breach Management (GDPR Art. 33-34)
 */

import type { BreachRepository } from '../repositories/breach.repository.js';
import type {
  DataBreach,
  BreachActivity,
  CreateBreachInput,
  UpdateBreachInput,
  NotifyAuthorityInput,
  NotifySubjectsInput,
  BreachQueryFilter,
} from '../models/data-breach.js';
import {
  calculateNotificationDeadline,
  generateBreachNumber,
  isNotificationOverdue,
  getHoursRemaining,
  wasNotificationLate,
  canContain,
  canResolve,
} from '../models/data-breach.js';

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

type BreachWithActivities = DataBreach & { activities: BreachActivity[] };

export interface BreachWithUrgency extends DataBreach {
  hoursRemaining: number | null;
  isOverdue: boolean;
}

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

export class BreachService {
  constructor(private repository: BreachRepository) {}

  /**
   * Report a new breach
   */
  async reportBreach(input: CreateBreachInput): Promise<ServiceResult<BreachWithActivities>> {
    const breachNumber = generateBreachNumber();
    const notificationDeadline = input.authorityNotificationRequired !== false
      ? calculateNotificationDeadline(input.discoveredAt)
      : undefined;

    const createInput: Parameters<typeof this.repository.create>[0] = {
      ...input,
      breachNumber,
    };

    if (notificationDeadline) {
      createInput.notificationDeadline = notificationDeadline;
    }

    const breach = await this.repository.create(createInput);

    return { success: true, data: breach };
  }

  /**
   * Update breach details
   */
  async updateBreach(
    id: string,
    input: UpdateBreachInput,
    updatedBy: string
  ): Promise<ServiceResult<BreachWithActivities>> {
    const breach = await this.repository.findById(id);

    if (!breach) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Breach not found' },
      };
    }

    const updated = await this.repository.update(id, input, {
      type: 'UPDATED',
      description: 'Breach details updated',
      performedBy: updatedBy,
      metadata: input as Record<string, unknown>,
    });

    return { success: true, data: updated };
  }

  /**
   * Notify supervisory authority (GDPR Art. 33)
   */
  async notifyAuthority(
    id: string,
    input: NotifyAuthorityInput
  ): Promise<ServiceResult<BreachWithActivities & { wasLate: boolean }>> {
    const breach = await this.repository.findById(id);

    if (!breach) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Breach not found' },
      };
    }

    if (breach.authorityNotifiedAt) {
      return {
        success: false,
        error: { code: 'ALREADY_NOTIFIED', message: 'Authority already notified' },
      };
    }

    const updated = await this.repository.notifyAuthority(
      id,
      input.notifiedBy,
      input.authorityReference
    );

    return {
      success: true,
      data: {
        ...updated,
        wasLate: wasNotificationLate(updated),
      },
    };
  }

  /**
   * Notify affected subjects (GDPR Art. 34)
   */
  async notifySubjects(
    id: string,
    input: NotifySubjectsInput
  ): Promise<ServiceResult<BreachWithActivities>> {
    const breach = await this.repository.findById(id);

    if (!breach) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Breach not found' },
      };
    }

    const updated = await this.repository.notifySubjects(
      id,
      input.notificationMethod,
      input.notifiedBy
    );

    return { success: true, data: updated };
  }

  /**
   * Mark breach as contained
   */
  async containBreach(
    id: string,
    containedBy: string
  ): Promise<ServiceResult<BreachWithActivities>> {
    const breach = await this.repository.findById(id);

    if (!breach) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Breach not found' },
      };
    }

    if (!canContain(breach)) {
      return {
        success: false,
        error: { code: 'INVALID_STATE', message: 'Breach cannot be contained in current state' },
      };
    }

    const updated = await this.repository.markContained(id, containedBy);

    return { success: true, data: updated };
  }

  /**
   * Mark breach as resolved
   */
  async resolveBreach(
    id: string,
    resolvedBy: string
  ): Promise<ServiceResult<BreachWithActivities>> {
    const breach = await this.repository.findById(id);

    if (!breach) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Breach not found' },
      };
    }

    if (!canResolve(breach)) {
      return {
        success: false,
        error: { code: 'INVALID_STATE', message: 'Breach is already resolved or closed' },
      };
    }

    const updated = await this.repository.markResolved(id, resolvedBy);

    return { success: true, data: updated };
  }

  /**
   * Get breach by ID with urgency info
   */
  async getBreach(
    id: string
  ): Promise<ServiceResult<BreachWithActivities & { hoursRemaining: number | null; isOverdue: boolean }>> {
    const breach = await this.repository.findById(id);

    if (!breach) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Breach not found' },
      };
    }

    return {
      success: true,
      data: {
        ...breach,
        hoursRemaining: getHoursRemaining(breach),
        isOverdue: isNotificationOverdue(breach),
      },
    };
  }

  /**
   * List breaches with filtering
   */
  async listBreaches(filter: BreachQueryFilter): Promise<{ data: DataBreach[]; total: number }> {
    return this.repository.findMany(filter);
  }

  /**
   * Get breaches pending authority notification (72-hour compliance report)
   */
  async getPendingNotificationReport(entityId?: string): Promise<{
    data: BreachWithUrgency[];
    count: number;
    overdue: number;
  }> {
    const breaches = await this.repository.findPendingNotification(entityId);

    const withUrgency: BreachWithUrgency[] = breaches.map((breach) => ({
      ...breach,
      hoursRemaining: getHoursRemaining(breach),
      isOverdue: isNotificationOverdue(breach),
    }));

    return {
      data: withUrgency,
      count: withUrgency.length,
      overdue: withUrgency.filter((b) => b.isOverdue).length,
    };
  }
}
