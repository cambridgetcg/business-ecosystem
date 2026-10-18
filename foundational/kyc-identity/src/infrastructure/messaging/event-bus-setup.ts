/**
 * Event Bus Setup for KYC-Identity Service
 * Configures RabbitMQ event consumption and publishing
 */

import {
  createEventBus,
  createHandlerRegistry,
  type EventBusHandle,
} from '@ecosystem/messaging';
import { IdentityCommandHandler, VerificationRequestCommandHandler } from '../../application/handlers/command-handlers.js';
import {
  ExternalEventTypes,
  createExternalEventHandlers,
} from './external-event-handlers.js';
import {
  createKYCEventPublisher,
  setGlobalEventPublisher,
} from './event-publisher.js';

let eventBusHandle: EventBusHandle | null = null;

/**
 * Initialize the event bus and register handlers
 */
export async function initializeEventBus(rabbitmqUrl?: string): Promise<EventBusHandle | null> {
  if (!rabbitmqUrl) {
    console.log('[KYC] RABBITMQ_URL not configured - event consumption disabled');
    // Still create a no-op publisher for graceful degradation
    setGlobalEventPublisher(createKYCEventPublisher(null));
    return null;
  }

  // Create command handlers
  const identityHandler = new IdentityCommandHandler();
  const verificationHandler = new VerificationRequestCommandHandler();

  // Create external event handlers
  const handlers = createExternalEventHandlers(identityHandler, verificationHandler);

  // Create handler registry
  const registry = createHandlerRegistry()
    .register(
      ExternalEventTypes.ENTITY_CREATED,
      handlers.entityCreatedHandler,
      { name: 'EntityCreatedHandler', priority: 10 }
    )
    .register(
      ExternalEventTypes.OFFICER_APPOINTED,
      handlers.officerAppointedHandler,
      { name: 'OfficerAppointedHandler', priority: 20 }
    );

  // Create and start event bus
  eventBusHandle = await createEventBus({
    serviceName: 'kyc-identity',
    rabbitmqUrl,
    handlers: registry,
    autoStart: true,
  });

  // Set up event publisher for outbound events
  const eventPublisher = createKYCEventPublisher(eventBusHandle.bus);
  setGlobalEventPublisher(eventPublisher);

  console.log('[KYC] Event bus initialized and consuming events');

  return eventBusHandle;
}

/**
 * Shutdown the event bus gracefully
 */
export async function shutdownEventBus(): Promise<void> {
  if (eventBusHandle) {
    await eventBusHandle.stop();
    eventBusHandle = null;
    console.log('[KYC] Event bus shutdown complete');
  }
}

/**
 * Get the current event bus handle
 */
export function getEventBus(): EventBusHandle | null {
  return eventBusHandle;
}
