/**
 * Events Barrel Export
 *
 * @module core/events
 */

export { EventBus, type EventHandler, type DomainEvent } from './event-bus.js';
export {
  registerAccountEventHandlers,
  registerPaymentEventHandlers,
  registerComplianceEventHandlers,
  registerReconciliationEventHandlers,
  registerAllEventHandlers,
} from './event-handlers.js';
