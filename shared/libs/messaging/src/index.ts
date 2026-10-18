/**
 * @ecosystem/messaging
 * Event-driven messaging infrastructure for the business ecosystem
 *
 * Core Components:
 * - EventBus: Unified pub/sub interface
 * - RabbitMQEventBus: Production implementation with RabbitMQ
 * - InMemoryEventBus: Testing implementation
 * - HandlerRegistry: Declarative handler registration
 * - EventBusFactory: Simplified creation
 */

// Core interfaces and types
export * from './types.js';
export * from './event-bus.js';

// Publisher/Subscriber (low-level)
export * from './publisher.js';
export * from './subscriber.js';
export * from './rabbitmq-publisher.js';
export * from './rabbitmq-subscriber.js';

// Unified Event Bus (recommended)
export * from './rabbitmq-event-bus.js';
export * from './in-memory-event-bus.js';

// Handler registration
export * from './handler-registry.js';

// Factory and helpers
export * from './event-bus-factory.js';
