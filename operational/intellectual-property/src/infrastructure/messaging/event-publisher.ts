/**
 * IP Service Event Publisher
 * Integrates with @ecosystem/messaging for domain event publishing
 */

import type { DomainEvent } from '../../domain/events/domain-event.js';

/**
 * Event publisher interface for IP domain events
 */
export interface IPEventPublisher {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  publish(event: DomainEvent): Promise<void>;
  publishAll(events: DomainEvent[]): Promise<void>;
}

/**
 * Configuration for the event publisher
 */
export interface EventPublisherConfig {
  rabbitmqUrl?: string | undefined;
  exchange?: string | undefined;
  enabled?: boolean | undefined;
}

/**
 * In-memory publisher for development/testing
 * Logs events to console instead of publishing to message broker
 */
export class InMemoryEventPublisher implements IPEventPublisher {
  private events: DomainEvent[] = [];
  private handlers: Map<string, ((event: DomainEvent) => Promise<void>)[]> = new Map();

  async connect(): Promise<void> {
    console.log('[InMemoryEventPublisher] Connected (development mode)');
  }

  async disconnect(): Promise<void> {
    this.events = [];
    console.log('[InMemoryEventPublisher] Disconnected');
  }

  async publish(event: DomainEvent): Promise<void> {
    this.events.push(event);
    console.log(`[InMemoryEventPublisher] Event published: ${event.type}`, {
      id: event.id,
      aggregateId: event.aggregateId,
      aggregateType: event.aggregateType,
    });

    // Notify any registered handlers
    const handlers = this.handlers.get(event.type) ?? [];
    await Promise.all(handlers.map(h => h(event)));
  }

  async publishAll(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  /**
   * Register a handler for testing/development
   */
  onEvent(eventType: string, handler: (event: DomainEvent) => Promise<void>): void {
    const existing = this.handlers.get(eventType) ?? [];
    this.handlers.set(eventType, [...existing, handler]);
  }

  /**
   * Get all published events (for testing)
   */
  getPublishedEvents(): DomainEvent[] {
    return [...this.events];
  }

  /**
   * Clear all published events (for testing)
   */
  clearEvents(): void {
    this.events = [];
  }
}

/**
 * RabbitMQ-backed publisher for production
 * Uses @ecosystem/messaging library
 */
export class RabbitMQEventPublisher implements IPEventPublisher {
  private publisher: import('@ecosystem/messaging').RabbitMQPublisher | null = null;
  private readonly config: EventPublisherConfig;

  constructor(config: EventPublisherConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    if (!this.config.rabbitmqUrl) {
      throw new Error('RabbitMQ URL is required for RabbitMQEventPublisher');
    }

    // Dynamic import to avoid requiring amqplib when not using RabbitMQ
    const { createRabbitMQPublisher } = await import('@ecosystem/messaging');

    this.publisher = createRabbitMQPublisher(this.config.rabbitmqUrl, {
      exchange: this.config.exchange ?? 'ecosystem.ip',
      exchangeType: 'topic',
      confirmMode: true,
    });

    await this.publisher.connect();
    console.log('[RabbitMQEventPublisher] Connected to RabbitMQ');
  }

  async disconnect(): Promise<void> {
    if (this.publisher) {
      await this.publisher.disconnect();
      this.publisher = null;
    }
    console.log('[RabbitMQEventPublisher] Disconnected from RabbitMQ');
  }

  async publish(event: DomainEvent): Promise<void> {
    if (!this.publisher) {
      throw new Error('Publisher not connected. Call connect() first.');
    }

    // Convert IP domain event to ecosystem messaging format
    const messagingEvent = {
      id: event.id,
      type: event.type,
      aggregateId: event.aggregateId,
      aggregateType: event.aggregateType,
      payload: event.payload,
      metadata: {
        correlationId: event.metadata.correlationId,
        source: event.metadata.source,
        timestamp: event.metadata.timestamp,
        ...(event.metadata.causationId && { causationId: event.metadata.causationId }),
        ...(event.metadata.userId && { userId: event.metadata.userId }),
        ...(event.metadata.tenantId && { tenantId: event.metadata.tenantId }),
      },
      occurredAt: event.occurredAt,
      version: event.version,
    };

    await this.publisher.publish(messagingEvent);
  }

  async publishAll(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }
}

/**
 * Create an event publisher based on configuration
 * Returns InMemoryEventPublisher if RabbitMQ is not configured
 */
export function createEventPublisher(config: EventPublisherConfig = {}): IPEventPublisher {
  if (!config.enabled) {
    console.log('[EventPublisher] Event publishing disabled');
    return new InMemoryEventPublisher();
  }

  if (config.rabbitmqUrl) {
    return new RabbitMQEventPublisher(config);
  }

  console.log('[EventPublisher] No RabbitMQ URL configured, using in-memory publisher');
  return new InMemoryEventPublisher();
}
