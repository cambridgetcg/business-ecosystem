/**
 * Internal Event Bus
 *
 * Handles domain events within the service boundary.
 * For cross-service events, events are also published to external message bus.
 *
 * @module core/events/event-bus
 */

/**
 * Base domain event interface.
 */
export interface DomainEvent {
  readonly type: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly occurredAt: Date;
  readonly payload: Record<string, unknown>;
}

/**
 * Event handler function type.
 */
export type EventHandler<T extends DomainEvent = DomainEvent> = (event: T) => Promise<void>;

/**
 * Event handler registration.
 */
interface HandlerRegistration {
  eventType: string | '*';
  handler: EventHandler;
  priority: number;
}

/**
 * Event Bus for internal event propagation.
 *
 * Features:
 * - Sync and async event handling
 * - Priority-based handler ordering
 * - Wildcard handlers for all events
 * - Error isolation per handler
 */
export class EventBus {
  private handlers: HandlerRegistration[] = [];
  private processing = false;
  private queue: DomainEvent[] = [];

  /**
   * Subscribe to a specific event type.
   */
  subscribe<T extends DomainEvent>(
    eventType: string,
    handler: EventHandler<T>,
    priority: number = 0
  ): () => void {
    const registration: HandlerRegistration = {
      eventType,
      handler: handler as EventHandler,
      priority,
    };

    this.handlers.push(registration);
    this.handlers.sort((a, b) => b.priority - a.priority);

    // Return unsubscribe function
    return () => {
      const index = this.handlers.indexOf(registration);
      if (index !== -1) {
        this.handlers.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to all events.
   */
  subscribeAll(handler: EventHandler, priority: number = -100): () => void {
    return this.subscribe('*', handler, priority);
  }

  /**
   * Publish an event to all subscribers.
   */
  async publish(event: DomainEvent): Promise<void> {
    this.queue.push(event);

    if (!this.processing) {
      await this.processQueue();
    }
  }

  /**
   * Publish multiple events.
   */
  async publishAll(events: DomainEvent[]): Promise<void> {
    this.queue.push(...events);

    if (!this.processing) {
      await this.processQueue();
    }
  }

  /**
   * Process the event queue.
   */
  private async processQueue(): Promise<void> {
    this.processing = true;

    try {
      while (this.queue.length > 0) {
        const event = this.queue.shift()!;
        await this.dispatch(event);
      }
    } finally {
      this.processing = false;
    }
  }

  /**
   * Dispatch event to handlers.
   */
  private async dispatch(event: DomainEvent): Promise<void> {
    const matchingHandlers = this.handlers.filter(
      h => h.eventType === event.type || h.eventType === '*'
    );

    const errors: Error[] = [];

    for (const { handler } of matchingHandlers) {
      try {
        await handler(event);
      } catch (error) {
        // Isolate handler errors - don't let one handler break others
        console.error(`Event handler error for ${event.type}:`, error);
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }

    // Log if there were errors but don't throw
    if (errors.length > 0) {
      console.warn(`${errors.length} handler(s) failed for event ${event.type}`);
    }
  }

  /**
   * Get count of registered handlers.
   */
  getHandlerCount(eventType?: string): number {
    if (eventType) {
      return this.handlers.filter(h => h.eventType === eventType || h.eventType === '*').length;
    }
    return this.handlers.length;
  }

  /**
   * Clear all handlers (for testing).
   */
  clear(): void {
    this.handlers = [];
    this.queue = [];
  }
}
