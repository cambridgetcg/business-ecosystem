/**
 * In-Memory Event Bus
 * For testing and local development without RabbitMQ
 */

import type { DomainEvent, EventHandler } from './types.js';
import type { EventBus } from './event-bus.js';

export interface InMemoryEventBusOptions {
  /** If true, dispatches events synchronously */
  sync?: boolean;
  /** If true, stores all published events for later inspection */
  captureEvents?: boolean;
}

export class InMemoryEventBus implements EventBus {
  private handlers: Map<string, EventHandler[]> = new Map();
  private readonly sync: boolean;
  private readonly captureEvents: boolean;
  private publishedEvents: DomainEvent[] = [];

  constructor(options: InMemoryEventBusOptions = {}) {
    this.sync = options.sync ?? false;
    this.captureEvents = options.captureEvents ?? true;
  }

  async publish<T>(event: DomainEvent<T>): Promise<void> {
    if (this.captureEvents) {
      this.publishedEvents.push(event as DomainEvent);
    }

    const eventType = event.type;
    const handlers = this.handlers.get(eventType) || [];

    // Also check for wildcard handlers
    for (const [pattern, patternHandlers] of this.handlers) {
      if (pattern.includes('*') && this.matchesPattern(eventType, pattern)) {
        handlers.push(...patternHandlers);
      }
    }

    if (this.sync) {
      await Promise.all(handlers.map(handler => handler.handle(event)));
    } else {
      // Dispatch asynchronously (simulates message queue behavior)
      setImmediate(async () => {
        for (const handler of handlers) {
          try {
            await handler.handle(event);
          } catch (error) {
            console.error('[InMemoryEventBus] Handler error:', error);
          }
        }
      });
    }
  }

  async publishMany<T>(events: DomainEvent<T>[]): Promise<void> {
    await Promise.all(events.map(event => this.publish(event)));
  }

  async subscribe<T>(eventType: string, handler: EventHandler<T>): Promise<void> {
    const handlers = this.handlers.get(eventType) || [];
    handlers.push(handler as EventHandler);
    this.handlers.set(eventType, handlers);
  }

  async unsubscribe(eventType: string): Promise<void> {
    this.handlers.delete(eventType);
  }

  private matchesPattern(eventType: string, pattern: string): boolean {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(eventType);
  }

  // ==========================================================================
  // Testing Utilities
  // ==========================================================================

  /**
   * Get all published events
   */
  getPublishedEvents(): DomainEvent[] {
    return [...this.publishedEvents];
  }

  /**
   * Get published events of a specific type
   */
  getEventsOfType<T>(eventType: string): DomainEvent<T>[] {
    return this.publishedEvents.filter(e => e.type === eventType) as DomainEvent<T>[];
  }

  /**
   * Check if an event of a specific type was published
   */
  hasPublished(eventType: string): boolean {
    return this.publishedEvents.some(e => e.type === eventType);
  }

  /**
   * Check if an event matching a predicate was published
   */
  hasPublishedMatching<T>(predicate: (event: DomainEvent<T>) => boolean): boolean {
    return this.publishedEvents.some(e => predicate(e as DomainEvent<T>));
  }

  /**
   * Get the count of published events
   */
  getPublishedCount(): number {
    return this.publishedEvents.length;
  }

  /**
   * Clear all published events (for test isolation)
   */
  clearPublishedEvents(): void {
    this.publishedEvents = [];
  }

  /**
   * Clear all handlers (for test isolation)
   */
  clearHandlers(): void {
    this.handlers.clear();
  }

  /**
   * Reset the event bus (clear events and handlers)
   */
  reset(): void {
    this.clearPublishedEvents();
    this.clearHandlers();
  }

  /**
   * Wait for all async handlers to complete
   * Useful in tests when sync mode is false
   */
  async flush(): Promise<void> {
    await new Promise(resolve => setImmediate(resolve));
  }
}

/**
 * Create an in-memory event bus for testing
 */
export function createInMemoryEventBus(
  options?: InMemoryEventBusOptions
): InMemoryEventBus {
  return new InMemoryEventBus(options);
}

/**
 * Create a synchronous in-memory event bus
 * Handlers are called immediately when publish() is called
 */
export function createSyncEventBus(): InMemoryEventBus {
  return new InMemoryEventBus({ sync: true, captureEvents: true });
}
