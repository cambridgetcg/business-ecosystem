/**
 * Banking-Treasury Messaging Infrastructure
 *
 * Provides event handling capabilities for consuming domain events
 * from other services and publishing banking domain events.
 *
 * @module infrastructure/messaging
 */

// Event types and payloads
export * from './event-types.js';

// Event publisher
export * from './event-publisher.js';

// Event bus setup
export {
  initializeEventBus,
  shutdownEventBus,
  getEventBus,
  getEventBusHandle,
} from './event-bus-setup.js';

// External event handlers
export {
  ExternalEventTypes,
  KYCVerificationApprovedHandler,
  EntityCreatedHandler,
  createExternalEventHandlers,
} from './external-event-handlers.js';
