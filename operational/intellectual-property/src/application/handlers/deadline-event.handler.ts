/**
 * Deadline Event Handler
 *
 * Listens to domain events and triggers deadline generation.
 * This is the bridge between domain events and the deadline system.
 *
 * @module application/handlers
 */

import {
  DeadlineGeneratorService,
  deadlineGeneratorService,
  type DeadlineGenerationEvent,
} from '../services/deadline-generator.service.js';

/**
 * Event handler result.
 */
export interface EventHandlerResult {
  handled: boolean;
  deadlinesCreated: number;
  error?: string;
}

/**
 * Supported event types for deadline generation.
 */
const SUPPORTED_EVENTS = [
  'Patent.Granted',
  'Patent.Filed',
  'Trademark.Registered',
  'Trademark.Filed',
  'Trademark.OppositionFiled',
  'DomainName.Registered',
  'DomainName.Renewed',
  'DomainDispute.Filed',
  'License.Executed',
  'License.RoyaltyScheduled',
  'TradeSecret.ProtectionReviewDue',
] as const;

type SupportedEventType = typeof SUPPORTED_EVENTS[number];

/**
 * Deadline Event Handler
 *
 * Receives domain events and delegates to the deadline generator.
 * Can be invoked by:
 * - EventBridge rules
 * - Lambda triggers
 * - Direct function calls
 * - Message queue consumers
 */
export class DeadlineEventHandler {
  constructor(
    private readonly generator: DeadlineGeneratorService = deadlineGeneratorService
  ) {}

  /**
   * Handle a domain event.
   */
  async handle(event: DeadlineGenerationEvent): Promise<EventHandlerResult> {
    // Check if event type is supported
    if (!this.isSupported(event.eventType)) {
      return {
        handled: false,
        deadlinesCreated: 0,
      };
    }

    try {
      const result = await this.generator.processEvent(event);

      return {
        handled: true,
        deadlinesCreated: result.deadlinesCreated,
        error: result.errors.length > 0 ? result.errors.join('; ') : undefined,
      };
    } catch (error) {
      return {
        handled: false,
        deadlinesCreated: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Handle an EventBridge event (AWS Lambda format).
   */
  async handleEventBridge(eventBridgeEvent: {
    'detail-type': string;
    source: string;
    time: string;
    detail: {
      aggregateType: string;
      aggregateId: string;
      metadata?: Record<string, unknown>;
      [key: string]: unknown;
    };
  }): Promise<EventHandlerResult> {
    const event: DeadlineGenerationEvent = {
      eventType: eventBridgeEvent['detail-type'],
      aggregateType: eventBridgeEvent.detail.aggregateType,
      aggregateId: eventBridgeEvent.detail.aggregateId,
      occurredAt: new Date(eventBridgeEvent.time),
      payload: eventBridgeEvent.detail,
      metadata: eventBridgeEvent.detail.metadata as DeadlineGenerationEvent['metadata'],
    };

    return this.handle(event);
  }

  /**
   * Handle a batch of events.
   */
  async handleBatch(events: DeadlineGenerationEvent[]): Promise<{
    total: number;
    handled: number;
    deadlinesCreated: number;
    errors: string[];
  }> {
    const result = {
      total: events.length,
      handled: 0,
      deadlinesCreated: 0,
      errors: [] as string[],
    };

    for (const event of events) {
      const handlerResult = await this.handle(event);

      if (handlerResult.handled) {
        result.handled++;
        result.deadlinesCreated += handlerResult.deadlinesCreated;
      }

      if (handlerResult.error) {
        result.errors.push(`${event.eventType}/${event.aggregateId}: ${handlerResult.error}`);
      }
    }

    return result;
  }

  /**
   * Check if event type is supported.
   */
  isSupported(eventType: string): eventType is SupportedEventType {
    return SUPPORTED_EVENTS.includes(eventType as SupportedEventType);
  }

  /**
   * Get list of supported event types.
   */
  getSupportedEvents(): readonly string[] {
    return SUPPORTED_EVENTS;
  }
}

// Singleton instance
export const deadlineEventHandler = new DeadlineEventHandler();

/**
 * Lambda handler export for AWS Lambda deployment.
 *
 * Configure EventBridge rule to invoke this Lambda with IP domain events.
 */
export async function lambdaHandler(
  event: {
    'detail-type': string;
    source: string;
    time: string;
    detail: Record<string, unknown>;
  },
  _context: unknown
): Promise<{ statusCode: number; body: string }> {
  const handler = new DeadlineEventHandler();

  const result = await handler.handleEventBridge(event as Parameters<typeof handler.handleEventBridge>[0]);

  return {
    statusCode: result.handled ? 200 : 400,
    body: JSON.stringify({
      handled: result.handled,
      deadlinesCreated: result.deadlinesCreated,
      error: result.error,
    }),
  };
}
