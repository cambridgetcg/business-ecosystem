/**
 * Corporate Security Messaging Infrastructure
 *
 * Event bus setup and publishing for cross-service communication.
 *
 * @module infrastructure/messaging
 */

export {
  initializeEventBus,
  shutdownEventBus,
  getEventBus,
  setSecurityServiceInstance,
  ExternalEventTypes,
  type ExternalEventType,
} from './event-bus-setup.js';

export {
  RabbitMQSecurityEventPublisher,
  SecurityEventTypes,
  type SecurityEventType,
  setGlobalEventPublisher,
  getGlobalEventPublisher,
} from './rabbitmq-publisher.js';
