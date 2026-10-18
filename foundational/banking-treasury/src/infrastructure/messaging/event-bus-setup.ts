/**
 * Event Bus Setup for Banking-Treasury Service
 * Configures RabbitMQ event consumption and publishing
 */

import {
  createEventBus,
  createHandlerRegistry,
  type EventBusHandle,
  type EventBus,
} from '@ecosystem/messaging';
import type { Pool } from 'pg';
import {
  ExternalEventTypes,
  createExternalEventHandlers,
} from './external-event-handlers.js';
import { BankingEventPublisher, setGlobalEventPublisher } from './event-publisher.js';

let eventBusHandle: EventBusHandle | null = null;

/**
 * Initialize the event bus and register handlers
 */
export async function initializeEventBus(
  rabbitmqUrl: string | undefined,
  pool: Pool
): Promise<EventBusHandle | null> {
  if (!rabbitmqUrl) {
    console.log('[Banking] RABBITMQ_URL not configured - event consumption disabled');
    return null;
  }

  // Create external event handlers
  const handlers = createExternalEventHandlers(pool);

  // Create handler registry
  const registry = createHandlerRegistry()
    .register(
      ExternalEventTypes.KYC_VERIFICATION_APPROVED,
      handlers.kycVerificationApprovedHandler,
      { name: 'KYCVerificationApprovedHandler', priority: 10 }
    )
    .register(
      ExternalEventTypes.KYC_IDENTITY_VERIFIED,
      handlers.kycVerificationApprovedHandler, // Same handler for both event types
      { name: 'KYCIdentityVerifiedHandler', priority: 10 }
    )
    .register(
      ExternalEventTypes.ENTITY_CREATED,
      handlers.entityCreatedHandler,
      { name: 'EntityCreatedHandler', priority: 20 }
    );

  // Create and start event bus
  eventBusHandle = await createEventBus({
    serviceName: 'banking-treasury',
    rabbitmqUrl,
    handlers: registry,
    autoStart: true,
  });

  // Create and set global publisher
  const publisher = new BankingEventPublisher(eventBusHandle.bus);
  setGlobalEventPublisher(publisher);

  console.log('[Banking] Event bus initialized - consuming and publishing events');
  console.log('[Banking] Subscribed to:', [
    ExternalEventTypes.KYC_VERIFICATION_APPROVED,
    ExternalEventTypes.KYC_IDENTITY_VERIFIED,
    ExternalEventTypes.ENTITY_CREATED,
  ]);

  return eventBusHandle;
}

/**
 * Shutdown the event bus gracefully
 */
export async function shutdownEventBus(): Promise<void> {
  if (eventBusHandle) {
    await eventBusHandle.stop();
    eventBusHandle = null;
    console.log('[Banking] Event bus shutdown complete');
  }
}

/**
 * Get the current event bus instance
 */
export function getEventBus(): EventBus | null {
  return eventBusHandle?.bus ?? null;
}

/**
 * Get the event bus handle (for advanced usage)
 */
export function getEventBusHandle(): EventBusHandle | null {
  return eventBusHandle;
}
