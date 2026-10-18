/**
 * Deadline Reminder Service
 *
 * Automated service for monitoring compliance deadlines and
 * sending reminder notifications.
 *
 * @module application/services/deadline-reminder-service
 */

import { v4 as uuidv4 } from 'uuid';
import { ComplianceService } from './compliance-service.js';
import {
  type DomainEvent,
  deadlineApproaching,
  deadlineImminent,
  obligationOverdue,
} from '../../core/events/domain-events.js';
import type { ComplianceObligation } from '../../domain/entities/compliance-obligation.js';

// =============================================================================
// TYPES
// =============================================================================

export interface ReminderConfig {
  /** Days before deadline to send first reminder */
  firstReminderDays: number;
  /** Days before deadline to send second reminder */
  secondReminderDays: number;
  /** Days before deadline to send urgent reminder */
  urgentReminderDays: number;
  /** Enable automatic escalation for overdue items */
  autoEscalate: boolean;
  /** Days overdue before escalation */
  escalationThresholdDays: number;
}

export interface ReminderResult {
  processed: number;
  approaching: number;
  imminent: number;
  overdue: number;
  escalated: number;
  events: DomainEvent[];
}

export interface IEventPublisher {
  publish(event: DomainEvent): Promise<void>;
}

// =============================================================================
// SERVICE
// =============================================================================

export class DeadlineReminderService {
  private readonly complianceService: ComplianceService;
  private readonly eventPublisher: IEventPublisher;
  private readonly config: ReminderConfig;

  constructor(
    complianceService: ComplianceService,
    eventPublisher: IEventPublisher,
    config?: Partial<ReminderConfig>
  ) {
    this.complianceService = complianceService;
    this.eventPublisher = eventPublisher;
    this.config = {
      firstReminderDays: config?.firstReminderDays ?? 30,
      secondReminderDays: config?.secondReminderDays ?? 14,
      urgentReminderDays: config?.urgentReminderDays ?? 7,
      autoEscalate: config?.autoEscalate ?? true,
      escalationThresholdDays: config?.escalationThresholdDays ?? 3,
    };
  }

  /**
   * Process all upcoming deadlines and send appropriate reminders.
   */
  async processDeadlines(tenantId: string): Promise<ReminderResult> {
    const result: ReminderResult = {
      processed: 0,
      approaching: 0,
      imminent: 0,
      overdue: 0,
      escalated: 0,
      events: [],
    };

    // Get upcoming deadlines (30 days ahead)
    const upcoming = await this.complianceService.getUpcomingDeadlines(
      tenantId,
      this.config.firstReminderDays
    );

    // Get overdue obligations
    const overdue = await this.complianceService.getOverdueObligations(tenantId);

    const now = new Date();

    // Process upcoming deadlines
    for (const obligation of upcoming) {
      result.processed++;
      const daysRemaining = this.getDaysUntilDue(obligation.dueDate, now);

      if (daysRemaining <= this.config.urgentReminderDays) {
        // Imminent deadline
        const event = await this.sendImminentReminder(obligation, daysRemaining);
        result.events.push(event);
        result.imminent++;
      } else if (daysRemaining <= this.config.secondReminderDays) {
        // Approaching deadline
        const event = await this.sendApproachingReminder(obligation, daysRemaining);
        result.events.push(event);
        result.approaching++;
      }
    }

    // Process overdue items
    for (const obligation of overdue) {
      result.processed++;
      result.overdue++;

      const daysOverdue = this.getDaysOverdue(obligation.dueDate, now);
      const event = await this.sendOverdueAlert(obligation, daysOverdue);
      result.events.push(event);

      // Check for escalation
      if (
        this.config.autoEscalate &&
        daysOverdue >= this.config.escalationThresholdDays &&
        !obligation.escalated
      ) {
        await this.escalateObligation(obligation, daysOverdue);
        result.escalated++;
      }
    }

    return result;
  }

  /**
   * Send reminder for approaching deadline.
   */
  private async sendApproachingReminder(
    obligation: ComplianceObligation,
    daysRemaining: number
  ): Promise<DomainEvent> {
    const event = deadlineApproaching(obligation.id, {
      tenantId: obligation.tenantId,
      entityId: obligation.entityId,
      obligationId: obligation.id,
      title: obligation.title,
      dueDate: obligation.dueDate,
      daysRemaining,
      priority: obligation.priority,
      assignedTo: obligation.assignedTo ?? undefined,
    }, { tenantId: obligation.tenantId });

    await this.eventPublisher.publish(event);
    return event;
  }

  /**
   * Send reminder for imminent deadline.
   */
  private async sendImminentReminder(
    obligation: ComplianceObligation,
    daysRemaining: number
  ): Promise<DomainEvent> {
    const event = deadlineImminent(obligation.id, {
      tenantId: obligation.tenantId,
      entityId: obligation.entityId,
      obligationId: obligation.id,
      title: obligation.title,
      dueDate: obligation.dueDate,
      daysRemaining,
      priority: obligation.priority,
      assignedTo: obligation.assignedTo ?? undefined,
    }, { tenantId: obligation.tenantId });

    await this.eventPublisher.publish(event);
    return event;
  }

  /**
   * Send alert for overdue obligation.
   */
  private async sendOverdueAlert(
    obligation: ComplianceObligation,
    daysOverdue: number
  ): Promise<DomainEvent> {
    const event = obligationOverdue(obligation.id, {
      tenantId: obligation.tenantId,
      entityId: obligation.entityId,
      title: obligation.title,
      dueDate: obligation.dueDate,
      daysOverdue,
      priority: obligation.priority,
      assignedTo: obligation.assignedTo ?? undefined,
    }, { tenantId: obligation.tenantId });

    await this.eventPublisher.publish(event);
    return event;
  }

  /**
   * Escalate overdue obligation.
   */
  private async escalateObligation(
    obligation: ComplianceObligation,
    daysOverdue: number
  ): Promise<void> {
    await this.complianceService.updateObligation(
      obligation.id,
      {
        // escalated: true,
        // escalatedAt: new Date(),
        // escalationReason: `Overdue by ${daysOverdue} days`,
        notes: `[AUTO-ESCALATED] Overdue by ${daysOverdue} days on ${new Date().toISOString()}`,
      },
      'system'
    );
  }

  /**
   * Calculate days until due date.
   */
  private getDaysUntilDue(dueDate: Date, now: Date): number {
    const diffMs = dueDate.getTime() - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Calculate days overdue.
   */
  private getDaysOverdue(dueDate: Date, now: Date): number {
    const diffMs = now.getTime() - dueDate.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }
}

// =============================================================================
// FACTORY
// =============================================================================

/**
 * Create a no-op event publisher for testing.
 */
export class NoOpEventPublisher implements IEventPublisher {
  async publish(_event: DomainEvent): Promise<void> {
    // No-op
  }
}

/**
 * Create a logging event publisher for debugging.
 */
export class LoggingEventPublisher implements IEventPublisher {
  async publish(event: DomainEvent): Promise<void> {
    console.log('[ComplianceEvent]', {
      type: event.type,
      aggregateId: event.aggregateId,
      occurredAt: event.occurredAt,
    });
  }
}

export function createDeadlineReminderService(
  complianceService: ComplianceService,
  eventPublisher?: IEventPublisher,
  config?: Partial<ReminderConfig>
): DeadlineReminderService {
  return new DeadlineReminderService(
    complianceService,
    eventPublisher ?? new LoggingEventPublisher(),
    config
  );
}
