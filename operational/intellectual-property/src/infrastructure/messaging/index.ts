/**
 * Messaging Infrastructure - Public API
 */

export {
  type IPEventPublisher,
  type EventPublisherConfig,
  InMemoryEventPublisher,
  RabbitMQEventPublisher,
  createEventPublisher,
} from './event-publisher.js';
