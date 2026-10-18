/**
 * Event Bus Factory
 * Simplified creation of event buses for different environments
 */

import type { EventBus } from './event-bus.js';
import { RabbitMQEventBus, type RabbitMQEventBusConfig } from './rabbitmq-event-bus.js';
import { InMemoryEventBus, type InMemoryEventBusOptions } from './in-memory-event-bus.js';
import { HandlerRegistry } from './handler-registry.js';

export interface EventBusFactoryConfig {
  /** Service name (used for queue naming) */
  serviceName: string;
  /** RabbitMQ URL (if not provided, uses in-memory bus) */
  rabbitmqUrl?: string;
  /** Exchange name (default: ecosystem.events) */
  exchange?: string;
  /** Message prefetch count (default: 10) */
  prefetch?: number;
  /** Handler registry to bootstrap */
  handlers?: HandlerRegistry;
  /** Auto-start consuming after bootstrap */
  autoStart?: boolean;
}

export interface EventBusHandle {
  bus: EventBus;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  isRabbitMQ: boolean;
}

/**
 * Create and configure an event bus based on environment
 */
export async function createEventBus(config: EventBusFactoryConfig): Promise<EventBusHandle> {
  const isRabbitMQ = !!config.rabbitmqUrl;

  let bus: EventBus;

  if (isRabbitMQ) {
    const rabbitConfig: RabbitMQEventBusConfig = {
      url: config.rabbitmqUrl!,
      serviceName: config.serviceName,
    };
    if (config.exchange !== undefined) rabbitConfig.exchange = config.exchange;
    if (config.prefetch !== undefined) rabbitConfig.prefetch = config.prefetch;

    const rabbitBus = new RabbitMQEventBus(rabbitConfig);

    await rabbitBus.connect();
    bus = rabbitBus;
  } else {
    console.log(`[EventBusFactory] No RabbitMQ URL - using InMemoryEventBus for ${config.serviceName}`);
    bus = new InMemoryEventBus({ sync: false, captureEvents: false });
  }

  // Bootstrap handlers if provided
  if (config.handlers) {
    await config.handlers.bootstrap(bus);
  }

  const handle: EventBusHandle = {
    bus,
    isRabbitMQ,

    start: async () => {
      if (isRabbitMQ) {
        await (bus as RabbitMQEventBus).startConsuming();
      }
    },

    stop: async () => {
      if (isRabbitMQ) {
        await (bus as RabbitMQEventBus).disconnect();
      }
    },
  };

  // Auto-start if requested
  if (config.autoStart) {
    await handle.start();
  }

  return handle;
}

/**
 * Create an event bus for testing
 */
export function createTestEventBus(options?: InMemoryEventBusOptions): InMemoryEventBus {
  return new InMemoryEventBus({
    sync: true,
    captureEvents: true,
    ...options,
  });
}

/**
 * Helper to create domain events
 */
export function createDomainEvent<T>(
  type: string,
  aggregateId: string,
  aggregateType: string,
  payload: T,
  options?: {
    correlationId?: string;
    causationId?: string;
    userId?: string;
    tenantId?: string;
    source?: string;
  }
): import('./types.js').DomainEvent<T> {
  const now = new Date();
  const metadata: import('./types.js').EventMetadata = {
    correlationId: options?.correlationId ?? crypto.randomUUID(),
    source: options?.source ?? 'unknown',
    timestamp: now,
  };

  // Only add optional fields if defined
  if (options?.causationId) metadata.causationId = options.causationId;
  if (options?.userId) metadata.userId = options.userId;
  if (options?.tenantId) metadata.tenantId = options.tenantId;

  return {
    id: crypto.randomUUID(),
    type,
    aggregateId,
    aggregateType,
    payload,
    metadata,
    occurredAt: now,
    version: 1,
  };
}
