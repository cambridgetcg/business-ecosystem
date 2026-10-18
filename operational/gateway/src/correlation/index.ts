/**
 * Event Correlation Module
 * Tracks business processes across services by correlating events
 */

// Types
export * from './types.js';

// Store
export { CorrelationStore, correlationStore, type CorrelationStoreOptions } from './correlation-store.js';

// Service
export {
  CorrelationService,
  correlationService,
  type CorrelationServiceOptions,
  type IncomingEvent,
} from './correlation-service.js';

// Event Handler
export {
  CorrelationEventHandler,
  correlationEventHandler,
  type EcosystemEvent,
  type EventBus,
  type EventHandlerConfig,
} from './event-handler.js';
