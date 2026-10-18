/**
 * Escalation Engine Service
 *
 * Handles notification escalation based on deadline priority and time remaining.
 * Routes notifications to appropriate channels and recipients.
 *
 * @module application/services
 */

import {
  getEscalationPolicy,
  getCurrentEscalationLevel,
  overdueEscalationPolicy,
  getEmailsForRoles,
  type EscalationLevel,
  type EscalationPolicy,
} from '../../config/escalation-policies.config.js';
import { getReminderDaysForType } from '../../config/deadline-rules.config.js';
import {
  SNSNotificationService,
  snsNotificationService,
  type NotificationPriority,
} from '../../infrastructure/aws/sns-notification-service.js';
import type { Deadline } from '../../infrastructure/aws/dynamodb-deadline-store.js';

/**
 * Result of escalation processing.
 */
export interface EscalationResult {
  notificationSent: boolean;
  escalated: boolean;
  level?: string;
  channels?: string[];
  recipients?: string[];
  error?: string;
}

/**
 * Escalation Engine Service
 *
 * Processes deadlines and triggers appropriate notifications based on:
 * - Deadline type and priority
 * - Days until/past deadline
 * - Acknowledgment status
 * - Configured escalation policies
 */
export class EscalationEngineService {
  constructor(
    private readonly notificationService: SNSNotificationService = snsNotificationService
  ) {}

  /**
   * Process a deadline and send notifications if needed.
   */
  async processDeadline(
    deadline: Deadline,
    daysUntilDeadline: number
  ): Promise<EscalationResult> {
    // Get applicable escalation policy
    const policy = getEscalationPolicy(deadline.deadlineType, deadline.priority);

    if (!policy) {
      return { notificationSent: false, escalated: false };
    }

    // Get current escalation level
    const level = getCurrentEscalationLevel(policy, daysUntilDeadline);

    if (!level) {
      return { notificationSent: false, escalated: false };
    }

    // Check if we should send notification
    const shouldNotify = this.shouldSendNotification(deadline, level, daysUntilDeadline);

    if (!shouldNotify) {
      return { notificationSent: false, escalated: false };
    }

    // Send notification
    try {
      await this.sendNotification(deadline, level, daysUntilDeadline);

      return {
        notificationSent: true,
        escalated: this.isEscalation(deadline, level),
        level: level.name,
        channels: level.channels,
        recipients: getEmailsForRoles(level.recipients),
      };
    } catch (error) {
      return {
        notificationSent: false,
        escalated: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Process an overdue deadline.
   */
  async processOverdueDeadline(
    deadline: Deadline,
    daysOverdue: number
  ): Promise<EscalationResult> {
    // Use overdue policy
    const level = getCurrentEscalationLevel(overdueEscalationPolicy, -daysOverdue);

    if (!level) {
      return { notificationSent: false, escalated: false };
    }

    // Check if we should send notification
    const shouldNotify = this.shouldSendOverdueNotification(deadline, level, daysOverdue);

    if (!shouldNotify) {
      return { notificationSent: false, escalated: false };
    }

    // Send critical notification
    try {
      await this.sendOverdueNotification(deadline, level, daysOverdue);

      return {
        notificationSent: true,
        escalated: true,
        level: level.name,
        channels: level.channels,
        recipients: getEmailsForRoles(level.recipients),
      };
    } catch (error) {
      return {
        notificationSent: false,
        escalated: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Determine if notification should be sent.
   */
  private shouldSendNotification(
    deadline: Deadline,
    level: EscalationLevel,
    daysUntil: number
  ): boolean {
    // Get configured reminder days
    const reminderDays = getReminderDaysForType(deadline.deadlineType);

    // Check if today is a reminder day
    const isReminderDay = reminderDays.includes(daysUntil);

    // Check if deadline is acknowledged (suppress repeat notifications)
    const isAcknowledged = deadline.status === 'acknowledged';

    // If acknowledged, only send if it's a new escalation level
    if (isAcknowledged && !this.isNewEscalationLevel(deadline, level)) {
      return false;
    }

    // Send if it's a reminder day or if repeat is enabled and interval has passed
    if (isReminderDay) {
      return true;
    }

    // Check repeat notification logic
    if (level.repeatIfUnacknowledged && !isAcknowledged && level.repeatIntervalHours) {
      return this.shouldRepeatNotification(deadline, level.repeatIntervalHours);
    }

    return false;
  }

  /**
   * Determine if overdue notification should be sent.
   */
  private shouldSendOverdueNotification(
    deadline: Deadline,
    level: EscalationLevel,
    daysOverdue: number
  ): boolean {
    // Always notify for overdue milestones (1, 7, 14 days overdue)
    const overdueMilestones = [1, 7, 14, 21, 30];
    if (overdueMilestones.includes(daysOverdue)) {
      return true;
    }

    // Check repeat logic
    if (level.repeatIfUnacknowledged && level.repeatIntervalHours) {
      return this.shouldRepeatNotification(deadline, level.repeatIntervalHours);
    }

    return false;
  }

  /**
   * Check if enough time has passed for repeat notification.
   */
  private shouldRepeatNotification(
    deadline: Deadline,
    repeatIntervalHours: number
  ): boolean {
    if (!deadline.lastReminderAt) {
      return true;
    }

    const lastReminder = new Date(deadline.lastReminderAt);
    const hoursSinceLastReminder =
      (Date.now() - lastReminder.getTime()) / (1000 * 60 * 60);

    return hoursSinceLastReminder >= repeatIntervalHours;
  }

  /**
   * Check if this is a new escalation level.
   */
  private isNewEscalationLevel(deadline: Deadline, level: EscalationLevel): boolean {
    // Compare current level with metadata to see if we've notified at this level
    const previousLevel = deadline.metadata?.lastEscalationLevel as string | undefined;
    return previousLevel !== level.name;
  }

  /**
   * Check if this notification represents an escalation.
   */
  private isEscalation(deadline: Deadline, level: EscalationLevel): boolean {
    const previousLevel = deadline.metadata?.lastEscalationLevel as string | undefined;
    return previousLevel !== undefined && previousLevel !== level.name;
  }

  /**
   * Send notification through appropriate channels.
   */
  private async sendNotification(
    deadline: Deadline,
    level: EscalationLevel,
    daysUntil: number
  ): Promise<void> {
    const priority = this.mapToPriority(deadline.priority);

    // Build notification message
    const notification = {
      subject: this.buildSubject(deadline, daysUntil),
      message: this.buildMessage(deadline, level, daysUntil),
      priority,
      assetType: deadline.assetType as 'patent' | 'trademark' | 'domain' | 'license' | 'trade_secret',
      assetId: deadline.assetId,
      deadlineId: deadline.deadlineId,
      dueDate: new Date(deadline.dueDate),
    };

    // Route to appropriate topic based on priority/type
    if (priority === 'critical') {
      await this.notificationService.sendCriticalAlert(notification);
    } else {
      await this.notificationService.sendDeadlineAlert(notification);
    }
  }

  /**
   * Send overdue notification.
   */
  private async sendOverdueNotification(
    deadline: Deadline,
    level: EscalationLevel,
    daysOverdue: number
  ): Promise<void> {
    const notification = {
      subject: `OVERDUE: ${deadline.title} (${daysOverdue} days past due)`,
      message: this.buildOverdueMessage(deadline, level, daysOverdue),
      priority: 'critical' as NotificationPriority,
      assetType: deadline.assetType as 'patent' | 'trademark' | 'domain' | 'license' | 'trade_secret',
      assetId: deadline.assetId,
      deadlineId: deadline.deadlineId,
      dueDate: new Date(deadline.dueDate),
    };

    await this.notificationService.sendCriticalAlert(notification);
  }

  /**
   * Build notification subject line.
   */
  private buildSubject(deadline: Deadline, daysUntil: number): string {
    const urgencyPrefix =
      daysUntil <= 3 ? 'URGENT: ' :
      daysUntil <= 7 ? 'ACTION REQUIRED: ' :
      daysUntil <= 14 ? 'REMINDER: ' : '';

    return `${urgencyPrefix}${deadline.title} - Due in ${daysUntil} days`;
  }

  /**
   * Build notification message body.
   */
  private buildMessage(
    deadline: Deadline,
    level: EscalationLevel,
    daysUntil: number
  ): string {
    const lines = [
      `Deadline Alert: ${level.name}`,
      '',
      `Asset: ${deadline.assetType.toUpperCase()} - ${deadline.assetId}`,
      `Deadline: ${deadline.title}`,
      `Due Date: ${new Date(deadline.dueDate).toLocaleDateString()}`,
      `Days Remaining: ${daysUntil}`,
      `Priority: ${deadline.priority.toUpperCase()}`,
    ];

    if (deadline.description) {
      lines.push('', `Description: ${deadline.description}`);
    }

    if (deadline.amount && deadline.currency) {
      lines.push(`Amount Due: ${deadline.amount} ${deadline.currency}`);
    }

    if (deadline.jurisdiction) {
      lines.push(`Jurisdiction: ${deadline.jurisdiction}`);
    }

    lines.push('', 'Please take appropriate action to avoid missing this deadline.');

    return lines.join('\n');
  }

  /**
   * Build overdue notification message.
   */
  private buildOverdueMessage(
    deadline: Deadline,
    level: EscalationLevel,
    daysOverdue: number
  ): string {
    const lines = [
      `⚠️ OVERDUE DEADLINE ALERT: ${level.name}`,
      '',
      `Asset: ${deadline.assetType.toUpperCase()} - ${deadline.assetId}`,
      `Deadline: ${deadline.title}`,
      `Due Date: ${new Date(deadline.dueDate).toLocaleDateString()}`,
      `Days Overdue: ${daysOverdue}`,
      '',
      'This deadline has been missed. Immediate action may be required to:',
      '- Assess potential consequences',
      '- Determine if remediation is possible',
      '- Document the miss for compliance purposes',
    ];

    if (deadline.deadlineType.includes('patent_maintenance')) {
      lines.push(
        '',
        'Note: Patent maintenance fees may be payable during a grace period with surcharge.'
      );
    }

    if (deadline.deadlineType.includes('trademark')) {
      lines.push(
        '',
        'Note: Trademark deadlines may have grace periods. Consult counsel immediately.'
      );
    }

    return lines.join('\n');
  }

  /**
   * Map deadline priority to notification priority.
   */
  private mapToPriority(priority: string): NotificationPriority {
    const mapping: Record<string, NotificationPriority> = {
      low: 'low',
      medium: 'medium',
      high: 'high',
      critical: 'critical',
    };
    return mapping[priority] ?? 'medium';
  }
}

// Singleton instance
export const escalationEngineService = new EscalationEngineService();
