/**
 * Event Orchestrator Service
 *
 * Bridges domain events to AWS infrastructure:
 * - Publishes events to EventBridge for cross-service communication
 * - Sends notifications via SNS for alerts and deadlines
 * - Stores events in DynamoDB for audit trail
 * - Triggers deadline generation
 *
 * @module application/services
 */

import {
  EventBridgePublisher,
  eventBridgePublisher,
  type DomainEvent,
  type IPEventType,
} from '../../infrastructure/aws/eventbridge-publisher.js';
import {
  SNSNotificationService,
  snsNotificationService,
  type Notification,
  type NotificationPriority,
} from '../../infrastructure/aws/sns-notification-service.js';
import {
  DeadlineStore,
  IPEventStore,
  deadlineStore,
  ipEventStore,
} from '../../infrastructure/aws/dynamodb-deadline-store.js';
import {
  DeadlineEventHandler,
  deadlineEventHandler,
} from '../handlers/deadline-event.handler.js';

/**
 * Event orchestration result.
 */
export interface OrchestrationResult {
  eventId: string;
  published: boolean;
  notified: boolean;
  deadlinesCreated: number;
  stored: boolean;
  errors: string[];
}

/**
 * Event context for enrichment.
 */
export interface EventContext {
  correlationId?: string;
  causationId?: string;
  userId?: string;
  tenantId?: string;
}

/**
 * Notification rules for event types.
 */
const NOTIFICATION_RULES: Record<string, {
  priority: NotificationPriority;
  topics: ('deadline' | 'critical' | 'tradeSecret' | 'general' | 'crossService')[];
}> = {
  'Patent.MaintenanceFeeDue': { priority: 'high', topics: ['deadline'] },
  'Patent.MaintenanceFeeMissed': { priority: 'critical', topics: ['critical', 'deadline'] },
  'Patent.Granted': { priority: 'medium', topics: ['general'] },
  'Patent.Abandoned': { priority: 'high', topics: ['general', 'crossService'] },
  'Trademark.RenewalDue': { priority: 'high', topics: ['deadline'] },
  'Trademark.OppositionFiled': { priority: 'critical', topics: ['critical'] },
  'Trademark.Registered': { priority: 'low', topics: ['general'] },
  'TradeSecret.Accessed': { priority: 'high', topics: ['tradeSecret'] },
  'TradeSecret.Compromised': { priority: 'critical', topics: ['critical', 'tradeSecret'] },
  'DomainName.Expiring': { priority: 'high', topics: ['deadline'] },
  'DomainDispute.Filed': { priority: 'critical', topics: ['critical'] },
  'License.RoyaltyDue': { priority: 'medium', topics: ['deadline'] },
  'License.Terminated': { priority: 'high', topics: ['general', 'crossService'] },
  'Enforcement.MatterCreated': { priority: 'high', topics: ['general'] },
  'Enforcement.ActionTaken': { priority: 'medium', topics: ['general'] },
  'Enforcement.SettlementReached': { priority: 'high', topics: ['general', 'crossService'] },
  'Enforcement.LitigationFiled': { priority: 'critical', topics: ['critical'] },
  'Valuation.Completed': { priority: 'medium', topics: ['general', 'crossService'] },
  'Valuation.Approved': { priority: 'low', topics: ['general'] },
  'FTO.RiskIdentified': { priority: 'high', topics: ['general'] },
  'FTO.Completed': { priority: 'medium', topics: ['general'] },
  'DueDiligence.FindingAdded': { priority: 'medium', topics: ['general'] },
  'DueDiligence.Completed': { priority: 'high', topics: ['general', 'crossService'] },
};

/**
 * Event Orchestrator Service
 *
 * Central hub for IP event processing.
 */
export class EventOrchestratorService {
  constructor(
    private readonly eventBridge: EventBridgePublisher = eventBridgePublisher,
    private readonly sns: SNSNotificationService = snsNotificationService,
    private readonly deadlineHandler: DeadlineEventHandler = deadlineEventHandler,
    private readonly eventStore: typeof ipEventStore = ipEventStore,
    private readonly deadlines: DeadlineStore = deadlineStore
  ) {}

  /**
   * Process a domain event through the full orchestration pipeline.
   */
  async process(
    eventType: IPEventType | string,
    aggregateType: string,
    aggregateId: string,
    payload: Record<string, unknown>,
    context?: EventContext
  ): Promise<OrchestrationResult> {
    const result: OrchestrationResult = {
      eventId: crypto.randomUUID(),
      published: false,
      notified: false,
      deadlinesCreated: 0,
      stored: false,
      errors: [],
    };

    const event: DomainEvent = {
      type: eventType,
      aggregateType,
      aggregateId,
      timestamp: new Date(),
      payload,
      metadata: context,
    };

    // 1. Store event for audit trail
    try {
      await this.eventStore.putEvent({
        eventId: result.eventId,
        eventType,
        aggregateType,
        aggregateId,
        payload,
        timestamp: new Date(),
        metadata: context,
      });
      result.stored = true;
    } catch (error) {
      result.errors.push(`Event store failed: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    // 2. Publish to EventBridge for cross-service routing
    try {
      await this.eventBridge.publish(event);
      result.published = true;
    } catch (error) {
      result.errors.push(`EventBridge publish failed: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    // 3. Send notifications based on event type
    try {
      const notificationResult = await this.sendNotifications(eventType, aggregateType, aggregateId, payload);
      result.notified = notificationResult;
    } catch (error) {
      result.errors.push(`Notification failed: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    // 4. Process deadline generation
    try {
      const deadlineResult = await this.deadlineHandler.handle({
        eventType,
        aggregateType,
        aggregateId,
        occurredAt: new Date(),
        payload,
        metadata: context,
      });
      result.deadlinesCreated = deadlineResult.deadlinesCreated;
    } catch (error) {
      result.errors.push(`Deadline generation failed: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    return result;
  }

  /**
   * Send notifications based on event type rules.
   */
  private async sendNotifications(
    eventType: string,
    aggregateType: string,
    aggregateId: string,
    payload: Record<string, unknown>
  ): Promise<boolean> {
    const rules = NOTIFICATION_RULES[eventType];
    if (!rules) return false;

    const notification: Notification = {
      subject: this.formatSubject(eventType, payload),
      message: this.formatMessage(eventType, aggregateType, aggregateId, payload),
      priority: rules.priority,
      assetType: this.mapAssetType(aggregateType),
      assetId: aggregateId,
    };

    const promises: Promise<string>[] = [];

    for (const topic of rules.topics) {
      switch (topic) {
        case 'deadline':
          promises.push(this.sns.sendDeadlineAlert(notification));
          break;
        case 'critical':
          promises.push(this.sns.sendCriticalAlert(notification));
          break;
        case 'tradeSecret':
          promises.push(this.sns.sendTradeSecretAlert(notification));
          break;
        case 'crossService':
          promises.push(this.sns.sendCrossServiceEvent(notification));
          break;
        case 'general':
        default:
          promises.push(this.sns.sendIPEvent(notification));
      }
    }

    await Promise.allSettled(promises);
    return true;
  }

  /**
   * Format notification subject.
   */
  private formatSubject(eventType: string, payload: Record<string, unknown>): string {
    const name = payload['name'] ?? payload['title'] ?? payload['mark'] ?? payload['patentNumber'] ?? '';
    const [domain, action] = eventType.split('.');
    return `IP ${domain}: ${action}${name ? ` - ${name}` : ''}`;
  }

  /**
   * Format notification message.
   */
  private formatMessage(
    eventType: string,
    aggregateType: string,
    aggregateId: string,
    payload: Record<string, unknown>
  ): string {
    const lines = [
      `Event: ${eventType}`,
      `Asset Type: ${aggregateType}`,
      `Asset ID: ${aggregateId}`,
      '',
      'Details:',
    ];

    for (const [key, value] of Object.entries(payload)) {
      if (value !== null && value !== undefined) {
        lines.push(`  ${key}: ${JSON.stringify(value)}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Map aggregate type to notification asset type.
   */
  private mapAssetType(aggregateType: string): Notification['assetType'] {
    const mapping: Record<string, Notification['assetType']> = {
      Patent: 'patent',
      Trademark: 'trademark',
      Copyright: undefined,
      License: 'license',
      TradeSecret: 'trade_secret',
      DomainName: 'domain',
    };
    return mapping[aggregateType];
  }

  /**
   * Process batch of events.
   */
  async processBatch(
    events: Array<{
      eventType: string;
      aggregateType: string;
      aggregateId: string;
      payload: Record<string, unknown>;
      context?: EventContext;
    }>
  ): Promise<{
    total: number;
    successful: number;
    failed: number;
    results: OrchestrationResult[];
  }> {
    const results: OrchestrationResult[] = [];
    let successful = 0;
    let failed = 0;

    for (const event of events) {
      const result = await this.process(
        event.eventType,
        event.aggregateType,
        event.aggregateId,
        event.payload,
        event.context
      );
      results.push(result);

      if (result.errors.length === 0) {
        successful++;
      } else {
        failed++;
      }
    }

    return {
      total: events.length,
      successful,
      failed,
      results,
    };
  }
}

// Singleton instance
export const eventOrchestratorService = new EventOrchestratorService();
