/**
 * Event Bus Setup
 * Initializes RabbitMQ connection and registers event handlers
 */

import {
  createEventBus,
  createHandlerRegistry,
  type EventBusHandle,
} from '@ecosystem/messaging';
import {
  createExternalEventHandlers,
  ExternalEventTypes,
} from './external-event-handlers.js';
import {
  createContractsEventPublisher,
  setGlobalEventPublisher,
} from './event-publisher.js';

let eventBusHandle: EventBusHandle | null = null;

/**
 * Initialize the event bus and register handlers
 */
export async function initializeEventBus(rabbitmqUrl?: string): Promise<void> {
  if (!rabbitmqUrl) {
    console.log('[ContractsLegal] No RabbitMQ URL provided, event bus disabled');
    setGlobalEventPublisher(createContractsEventPublisher(null));
    return;
  }

  try {
    console.log('[ContractsLegal] Initializing event bus...');

    // Create handler registry and register external event handlers
    const handlers = createExternalEventHandlers();
    const registry = createHandlerRegistry();

    // Register handlers for external events
    registry.register(
      ExternalEventTypes.ENTITY_CREATED,
      handlers.entityCreatedHandler,
      { name: 'EntityCreatedHandler' }
    );

    registry.register(
      ExternalEventTypes.KYC_VERIFICATION_APPROVED,
      handlers.kycVerificationApprovedHandler,
      { name: 'KYCVerificationApprovedHandler' }
    );

    // Create event bus with handler registry
    eventBusHandle = await createEventBus({
      serviceName: 'contracts-legal',
      rabbitmqUrl,
      handlers: registry,
      autoStart: true,
    });

    // Create and configure event publisher
    const publisher = createContractsEventPublisher(eventBusHandle.bus);
    setGlobalEventPublisher(publisher);

    console.log('[ContractsLegal] Event bus initialized successfully');
  } catch (error) {
    console.error('[ContractsLegal] Failed to initialize event bus:', error);
    setGlobalEventPublisher(createContractsEventPublisher(null));
    throw error;
  }
}

/**
 * Shutdown the event bus gracefully
 */
export async function shutdownEventBus(): Promise<void> {
  if (eventBusHandle) {
    try {
      await eventBusHandle.stop();
      console.log('[ContractsLegal] Event bus shut down successfully');
    } catch (error) {
      console.error('[ContractsLegal] Error shutting down event bus:', error);
    }
    eventBusHandle = null;
  }
}

/**
 * Get the event bus instance
 */
export function getEventBus(): EventBusHandle | null {
  return eventBusHandle;
}
