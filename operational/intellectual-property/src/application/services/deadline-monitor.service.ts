/**
 * Deadline Monitor Service
 *
 * Scheduled service that monitors upcoming and overdue deadlines.
 * Triggers notifications and escalations based on configured policies.
 *
 * @module application/services
 */

import {
  DeadlineStore,
  deadlineStore,
  type Deadline,
} from '../../infrastructure/aws/dynamodb-deadline-store.js';
import {
  DeadlineCalculator,
  deadlineCalculator,
} from '../../domain/services/deadline-calculator.service.js';
import { EscalationEngineService, escalationEngineService } from './escalation-engine.service.js';
import {
  EventBridgePublisher,
  eventBridgePublisher,
} from '../../infrastructure/aws/eventbridge-publisher.js';

/**
 * Monitor run result.
 */
export interface MonitorRunResult {
  runAt: Date;
  upcomingProcessed: number;
  overdueProcessed: number;
  notificationsSent: number;
  escalationsTriggered: number;
  errors: string[];
}

/**
 * Deadline summary for reporting.
 */
export interface DeadlineSummary {
  total: number;
  byPriority: Record<string, number>;
  byAssetType: Record<string, number>;
  overdue: number;
  dueThisWeek: number;
  dueThisMonth: number;
}

/**
 * Deadline Monitor Service
 *
 * Runs on a schedule to:
 * 1. Check for upcoming deadlines needing reminders
 * 2. Identify overdue deadlines
 * 3. Trigger appropriate escalations
 * 4. Mark missed deadlines
 */
export class DeadlineMonitorService {
  constructor(
    private readonly store: DeadlineStore = deadlineStore,
    private readonly calculator: DeadlineCalculator = deadlineCalculator,
    private readonly escalationEngine: EscalationEngineService = escalationEngineService,
    private readonly publisher: EventBridgePublisher = eventBridgePublisher
  ) {}

  /**
   * Run the deadline monitor (main entry point for scheduled execution).
   */
  async run(): Promise<MonitorRunResult> {
    const result: MonitorRunResult = {
      runAt: new Date(),
      upcomingProcessed: 0,
      overdueProcessed: 0,
      notificationsSent: 0,
      escalationsTriggered: 0,
      errors: [],
    };

    try {
      // Process upcoming deadlines
      const upcomingResult = await this.processUpcomingDeadlines();
      result.upcomingProcessed = upcomingResult.processed;
      result.notificationsSent += upcomingResult.notificationsSent;
      result.escalationsTriggered += upcomingResult.escalationsTriggered;
      result.errors.push(...upcomingResult.errors);

      // Process overdue deadlines
      const overdueResult = await this.processOverdueDeadlines();
      result.overdueProcessed = overdueResult.processed;
      result.notificationsSent += overdueResult.notificationsSent;
      result.escalationsTriggered += overdueResult.escalationsTriggered;
      result.errors.push(...overdueResult.errors);

      // Publish monitor run event
      await this.publisher.publish({
        type: 'DeadlineMonitor.RunCompleted',
        aggregateType: 'DeadlineMonitor',
        aggregateId: 'singleton',
        timestamp: new Date(),
        payload: {
          upcomingProcessed: result.upcomingProcessed,
          overdueProcessed: result.overdueProcessed,
          notificationsSent: result.notificationsSent,
          escalationsTriggered: result.escalationsTriggered,
          errorCount: result.errors.length,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Monitor run failed: ${message}`);
    }

    return result;
  }

  /**
   * Process upcoming deadlines.
   */
  private async processUpcomingDeadlines(): Promise<{
    processed: number;
    notificationsSent: number;
    escalationsTriggered: number;
    errors: string[];
  }> {
    const result = {
      processed: 0,
      notificationsSent: 0,
      escalationsTriggered: 0,
      errors: [] as string[],
    };

    // Get deadlines due in the next 90 days
    const upcomingDeadlines = await this.store.getUpcomingDeadlines(90, 500);

    for (const deadline of upcomingDeadlines) {
      try {
        result.processed++;

        const daysUntil = this.calculator.daysUntilDeadline(new Date(deadline.dueDate));

        // Check if escalation is needed
        const escalationResult = await this.escalationEngine.processDeadline(
          deadline,
          daysUntil
        );

        if (escalationResult.notificationSent) {
          result.notificationsSent++;

          // Record that reminder was sent
          await this.store.recordReminderSent(deadline.assetId, deadline.deadlineId);
        }

        if (escalationResult.escalated) {
          result.escalationsTriggered++;
        }

        // Update priority if needed based on time remaining
        const newPriority = this.calculator.calculatePriorityFromDaysRemaining(daysUntil);
        if (newPriority !== deadline.priority) {
          await this.store.updateDeadlineStatus(
            deadline.assetId,
            deadline.deadlineId,
            deadline.status
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Deadline ${deadline.deadlineId}: ${message}`);
      }
    }

    return result;
  }

  /**
   * Process overdue deadlines.
   */
  private async processOverdueDeadlines(): Promise<{
    processed: number;
    notificationsSent: number;
    escalationsTriggered: number;
    errors: string[];
  }> {
    const result = {
      processed: 0,
      notificationsSent: 0,
      escalationsTriggered: 0,
      errors: [] as string[],
    };

    // Get overdue deadlines
    const overdueDeadlines = await this.store.getOverdueDeadlines(100);

    for (const deadline of overdueDeadlines) {
      try {
        result.processed++;

        const daysOverdue = Math.abs(
          this.calculator.daysUntilDeadline(new Date(deadline.dueDate))
        );

        // Mark as missed if not already
        if (deadline.status === 'pending') {
          await this.store.updateDeadlineStatus(
            deadline.assetId,
            deadline.deadlineId,
            'missed'
          );

          // Publish missed deadline event
          await this.publisher.publish({
            type: 'Deadline.Missed',
            aggregateType: 'Deadline',
            aggregateId: deadline.deadlineId,
            timestamp: new Date(),
            payload: {
              assetId: deadline.assetId,
              assetType: deadline.assetType,
              deadlineType: deadline.deadlineType,
              dueDate: deadline.dueDate,
              daysOverdue,
            },
          });
        }

        // Process overdue escalation
        const escalationResult = await this.escalationEngine.processOverdueDeadline(
          deadline,
          daysOverdue
        );

        if (escalationResult.notificationSent) {
          result.notificationsSent++;
          await this.store.recordReminderSent(deadline.assetId, deadline.deadlineId);
        }

        if (escalationResult.escalated) {
          result.escalationsTriggered++;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Overdue ${deadline.deadlineId}: ${message}`);
      }
    }

    return result;
  }

  /**
   * Get deadline summary for dashboard/reporting.
   */
  async getDeadlineSummary(): Promise<DeadlineSummary> {
    const now = new Date();
    const oneWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const oneMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Get all pending deadlines
    const pendingDeadlines = await this.store.getDeadlinesByStatus('pending', 1000);
    const overdueDeadlines = await this.store.getOverdueDeadlines(1000);

    const summary: DeadlineSummary = {
      total: pendingDeadlines.length + overdueDeadlines.length,
      byPriority: { low: 0, medium: 0, high: 0, critical: 0 },
      byAssetType: {},
      overdue: overdueDeadlines.length,
      dueThisWeek: 0,
      dueThisMonth: 0,
    };

    const allDeadlines = [...pendingDeadlines, ...overdueDeadlines];

    for (const deadline of allDeadlines) {
      // Count by priority
      summary.byPriority[deadline.priority] = (summary.byPriority[deadline.priority] ?? 0) + 1;

      // Count by asset type
      summary.byAssetType[deadline.assetType] = (summary.byAssetType[deadline.assetType] ?? 0) + 1;

      // Count by time period
      const dueDate = new Date(deadline.dueDate);
      if (dueDate <= oneWeek) {
        summary.dueThisWeek++;
      }
      if (dueDate <= oneMonth) {
        summary.dueThisMonth++;
      }
    }

    return summary;
  }

  /**
   * Get critical deadlines requiring immediate attention.
   */
  async getCriticalDeadlines(limit = 20): Promise<Deadline[]> {
    const criticalDeadlines = await this.store.getDeadlinesByStatus('pending', limit);

    return criticalDeadlines
      .filter(d => d.priority === 'critical' || d.priority === 'high')
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, limit);
  }

  /**
   * Acknowledge a deadline (stops repeat notifications until next level).
   */
  async acknowledgeDeadline(
    assetId: string,
    deadlineId: string,
    acknowledgedBy: string
  ): Promise<void> {
    await this.store.updateDeadlineStatus(assetId, deadlineId, 'acknowledged', acknowledgedBy);

    await this.publisher.publish({
      type: 'Deadline.Acknowledged',
      aggregateType: 'Deadline',
      aggregateId: deadlineId,
      timestamp: new Date(),
      payload: {
        assetId,
        acknowledgedBy,
      },
    });
  }

  /**
   * Complete a deadline.
   */
  async completeDeadline(
    assetId: string,
    deadlineId: string,
    completedBy: string
  ): Promise<void> {
    await this.store.updateDeadlineStatus(assetId, deadlineId, 'completed', completedBy);

    await this.publisher.publish({
      type: 'Deadline.Completed',
      aggregateType: 'Deadline',
      aggregateId: deadlineId,
      timestamp: new Date(),
      payload: {
        assetId,
        completedBy,
      },
    });
  }

  /**
   * Waive a deadline (intentionally skip).
   */
  async waiveDeadline(
    assetId: string,
    deadlineId: string,
    waivedBy: string,
    reason: string
  ): Promise<void> {
    await this.store.updateDeadlineStatus(assetId, deadlineId, 'waived', waivedBy);

    await this.publisher.publish({
      type: 'Deadline.Waived',
      aggregateType: 'Deadline',
      aggregateId: deadlineId,
      timestamp: new Date(),
      payload: {
        assetId,
        waivedBy,
        reason,
      },
    });
  }
}

// Singleton instance
export const deadlineMonitorService = new DeadlineMonitorService();
