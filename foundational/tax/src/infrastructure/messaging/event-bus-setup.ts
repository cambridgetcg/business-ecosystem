/**
 * Event Bus Setup for Tax Service
 * Configures RabbitMQ event consumption using @ecosystem/messaging
 */

import {
  createEventBus,
  createHandlerRegistry,
  type EventBusHandle,
  type EventBus,
} from '@ecosystem/messaging';
import type { UKTaxRegistrationRepository } from '../persistence/repositories/index.js';
import {
  EntityGovernanceEvents,
  AccountingEvents,
  EntityCreatedHandler,
  EntityUpdatedHandler,
  EntityDissolvedHandler,
  FinancialPeriodClosedHandler,
} from './event-handlers.js';
import { TaxEventPublisher, setGlobalEventPublisher } from './event-publisher.js';

let eventBusHandle: EventBusHandle | null = null;

export interface TaxEventBusDependencies {
  registrationRepository: UKTaxRegistrationRepository;
  logger?: {
    info: (msg: string, data?: object) => void;
    error: (msg: string, data?: object) => void;
  };
}

/**
 * Initialize the event bus and register handlers
 */
export async function initializeEventBus(
  rabbitmqUrl: string | undefined,
  deps: TaxEventBusDependencies
): Promise<EventBusHandle | null> {
  if (!rabbitmqUrl) {
    console.log('[Tax] RABBITMQ_URL not configured - event bus disabled');
    return null;
  }

  try {
    // Create handler instances
    const entityCreatedHandler = new EntityCreatedHandler(deps.registrationRepository, deps.logger);
    const entityUpdatedHandler = new EntityUpdatedHandler(deps.registrationRepository, deps.logger);
    const entityDissolvedHandler = new EntityDissolvedHandler(deps.registrationRepository, deps.logger);
    const financialPeriodClosedHandler = new FinancialPeriodClosedHandler(deps.registrationRepository, deps.logger);

    // Create handler registry
    const registry = createHandlerRegistry()
      // Entity Governance Events
      .register(
        EntityGovernanceEvents.ENTITY_CREATED,
        {
          handle: async (event) => entityCreatedHandler.handle(event as any),
        },
        { name: 'EntityCreatedHandler', priority: 10 }
      )
      .register(
        EntityGovernanceEvents.ENTITY_UPDATED,
        {
          handle: async (event) => entityUpdatedHandler.handle(event as any),
        },
        { name: 'EntityUpdatedHandler', priority: 10 }
      )
      .register(
        EntityGovernanceEvents.ENTITY_DISSOLVED,
        {
          handle: async (event) => entityDissolvedHandler.handle(event as any),
        },
        { name: 'EntityDissolvedHandler', priority: 5 }
      )
      // Accounting Events
      .register(
        AccountingEvents.FINANCIAL_PERIOD_CLOSED,
        {
          handle: async (event) => financialPeriodClosedHandler.handle(event as any),
        },
        { name: 'FinancialPeriodClosedHandler', priority: 10 }
      );

    // Create and start event bus
    eventBusHandle = await createEventBus({
      serviceName: 'tax',
      rabbitmqUrl,
      handlers: registry,
      autoStart: true,
    });

    // Create and set global publisher
    const publisher = new TaxEventPublisher(eventBusHandle.bus);
    setGlobalEventPublisher(publisher);

    console.log('[Tax] Event bus initialized successfully');
    console.log('[Tax] Subscribed to:', [
      EntityGovernanceEvents.ENTITY_CREATED,
      EntityGovernanceEvents.ENTITY_UPDATED,
      EntityGovernanceEvents.ENTITY_DISSOLVED,
      AccountingEvents.FINANCIAL_PERIOD_CLOSED,
    ]);

    return eventBusHandle;
  } catch (error) {
    console.error('[Tax] Failed to initialize event bus:', error);
    return null;
  }
}

/**
 * Shutdown the event bus gracefully
 */
export async function shutdownEventBus(): Promise<void> {
  if (eventBusHandle) {
    await eventBusHandle.stop();
    eventBusHandle = null;
    console.log('[Tax] Event bus shutdown complete');
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
