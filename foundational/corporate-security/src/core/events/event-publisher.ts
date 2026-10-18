/**
 * Security Event Publisher
 *
 * Publishes security domain events to the ecosystem event bus.
 * Integrates with @ecosystem/messaging for cross-service communication.
 *
 * @module core/events/event-publisher
 */

import type { DomainEvent, EventMetadata } from '@ecosystem/messaging';

/**
 * Event Publisher interface for security events.
 */
export interface ISecurityEventPublisher {
  publish<T>(event: DomainEvent<T>): Promise<void>;
  publishBatch<T>(events: DomainEvent<T>[]): Promise<void>;
}

/**
 * In-memory event publisher for testing and development.
 */
export class InMemorySecurityEventPublisher implements ISecurityEventPublisher {
  private events: DomainEvent<unknown>[] = [];
  private handlers: Map<string, Array<(event: DomainEvent<unknown>) => Promise<void>>> = new Map();

  async publish<T>(event: DomainEvent<T>): Promise<void> {
    this.events.push(event as DomainEvent<unknown>);

    // Notify subscribers
    const handlers = this.handlers.get(event.type) ?? [];
    const wildcardHandlers = this.handlers.get('*') ?? [];

    for (const handler of [...handlers, ...wildcardHandlers]) {
      try {
        await handler(event as DomainEvent<unknown>);
      } catch (error) {
        console.error(`Event handler error for ${event.type}:`, error);
      }
    }
  }

  async publishBatch<T>(events: DomainEvent<T>[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  subscribe(eventType: string, handler: (event: DomainEvent<unknown>) => Promise<void>): void {
    const handlers = this.handlers.get(eventType) ?? [];
    handlers.push(handler);
    this.handlers.set(eventType, handlers);
  }

  getPublishedEvents(): DomainEvent<unknown>[] {
    return [...this.events];
  }

  getEventsByType(type: string): DomainEvent<unknown>[] {
    return this.events.filter(e => e.type === type);
  }

  clear(): void {
    this.events = [];
  }
}

/**
 * Logging event publisher for debugging and audit trails.
 */
export class LoggingSecurityEventPublisher implements ISecurityEventPublisher {
  private readonly logger: Console;

  constructor(logger: Console = console) {
    this.logger = logger;
  }

  async publish<T>(event: DomainEvent<T>): Promise<void> {
    this.logger.info('[SecurityEvent]', {
      id: event.id,
      type: event.type,
      aggregateId: event.aggregateId,
      aggregateType: event.aggregateType,
      occurredAt: event.occurredAt,
      tenantId: event.metadata.tenantId,
      userId: event.metadata.userId,
    });
  }

  async publishBatch<T>(events: DomainEvent<T>[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }
}

/**
 * Composite event publisher that delegates to multiple publishers.
 */
export class CompositeSecurityEventPublisher implements ISecurityEventPublisher {
  private readonly publishers: ISecurityEventPublisher[];

  constructor(publishers: ISecurityEventPublisher[]) {
    this.publishers = publishers;
  }

  async publish<T>(event: DomainEvent<T>): Promise<void> {
    await Promise.all(this.publishers.map(p => p.publish(event)));
  }

  async publishBatch<T>(events: DomainEvent<T>[]): Promise<void> {
    await Promise.all(this.publishers.map(p => p.publishBatch(events)));
  }
}

/**
 * No-op publisher for when event publishing is disabled.
 */
export class NoOpSecurityEventPublisher implements ISecurityEventPublisher {
  async publish<T>(_event: DomainEvent<T>): Promise<void> {
    // No-op
  }

  async publishBatch<T>(_events: DomainEvent<T>[]): Promise<void> {
    // No-op
  }
}

/**
 * Create an event publisher based on configuration.
 */
export function createSecurityEventPublisher(
  config: {
    enabled: boolean;
    logging?: boolean;
  }
): ISecurityEventPublisher {
  if (!config.enabled) {
    return new NoOpSecurityEventPublisher();
  }

  const publishers: ISecurityEventPublisher[] = [];

  if (config.logging) {
    publishers.push(new LoggingSecurityEventPublisher());
  }

  // Add in-memory publisher for local handlers
  publishers.push(new InMemorySecurityEventPublisher());

  if (publishers.length === 1) {
    return publishers[0];
  }

  return new CompositeSecurityEventPublisher(publishers);
}
