/**
 * Insurance Service Messaging Infrastructure
 *
 * Provides event handling capabilities for consuming domain events
 * from other services and publishing insurance domain events.
 *
 * @module infrastructure/messaging
 */

// Event types and payloads
export * from './event-types.js';

// Event publisher
export * from './event-publisher.js';

// Event bus setup (primary pattern)
export {
  initializeEventBus,
  shutdownEventBus,
  getEventBus,
  getEventBusHandle,
  type InsuranceEventBusDependencies,
} from './event-bus-setup.js';

// Legacy handlers (for backward compatibility)
export {
  dispatchEvent,
  EVENT_HANDLERS,
  handleEntityCreated,
  handleEmployeeCountChanged,
  handleComplianceObligationCreated,
  handleJournalEntryPosted,
  handleFiscalPeriodClosed,
  handlePaymentCompleted,
  type DomainEvent,
} from './event-handlers.js';
