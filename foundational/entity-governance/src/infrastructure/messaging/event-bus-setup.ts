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
  createEntityGovernanceEventPublisher,
  setGlobalEventPublisher,
} from './event-publisher.js';

let eventBusHandle: EventBusHandle | null = null;

/**
 * Initialize the event bus and register handlers
 */
export async function initializeEventBus(rabbitmqUrl?: string): Promise<void> {
  if (!rabbitmqUrl) {
    console.log('[EntityGovernance] No RabbitMQ URL provided, event bus disabled');
    // Create publisher that logs but doesn't actually publish
    setGlobalEventPublisher(createEntityGovernanceEventPublisher(null));
    return;
  }

  try {
    console.log('[EntityGovernance] Initializing event bus...');

    // Create handler registry and register external event handlers
    const handlers = createExternalEventHandlers();
    const registry = createHandlerRegistry();

    // Register handlers for external events
    registry.register(
      ExternalEventTypes.KYC_VERIFICATION_APPROVED,
      handlers.kycVerificationApprovedHandler,
      { name: 'KYCVerificationApprovedHandler' }
    );

    registry.register(
      ExternalEventTypes.KYC_VERIFICATION_REJECTED,
      handlers.kycVerificationRejectedHandler,
      { name: 'KYCVerificationRejectedHandler' }
    );

    registry.register(
      ExternalEventTypes.TAX_ID_ASSIGNED,
      handlers.taxIdAssignedHandler,
      { name: 'TaxIdAssignedHandler' }
    );

    // Create event bus with handler registry
    eventBusHandle = await createEventBus({
      serviceName: 'entity-governance',
      rabbitmqUrl,
      handlers: registry,
      autoStart: true,
    });

    // Create and configure event publisher
    const publisher = createEntityGovernanceEventPublisher(eventBusHandle.bus);
    setGlobalEventPublisher(publisher);

    console.log('[EntityGovernance] Event bus initialized successfully');
  } catch (error) {
    console.error('[EntityGovernance] Failed to initialize event bus:', error);
    // Create fallback publisher that doesn't publish
    setGlobalEventPublisher(createEntityGovernanceEventPublisher(null));
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
      console.log('[EntityGovernance] Event bus shut down successfully');
    } catch (error) {
      console.error('[EntityGovernance] Error shutting down event bus:', error);
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
