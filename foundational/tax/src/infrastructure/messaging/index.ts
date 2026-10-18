/**
 * Tax Service Messaging Infrastructure
 *
 * Provides event handling capabilities for consuming domain events
 * from other services and publishing tax domain events.
 *
 * @module infrastructure/messaging
 */

// Event types and payloads
export * from './events.js';

// Event publisher
export * from './event-publisher.js';

// Event bus setup (primary pattern)
export {
  initializeEventBus,
  shutdownEventBus,
  getEventBus,
  getEventBusHandle,
  type TaxEventBusDependencies,
} from './event-bus-setup.js';

// Event handlers and consumer (legacy/advanced usage)
export {
  EntityGovernanceEvents,
  AccountingEvents,
  EntityCreatedHandler,
  EntityUpdatedHandler,
  EntityDissolvedHandler,
  FinancialPeriodClosedHandler,
  TaxEventConsumer,
  createEventConsumer,
  type EntityCreatedPayload,
  type EntityUpdatedPayload,
  type EntityDissolvedPayload,
  type FinancialPeriodStartedPayload,
  type FinancialPeriodClosedPayload,
  type EventHandler,
  type EventConsumer,
  type EventHandlerDependencies,
} from './event-handlers.js';
