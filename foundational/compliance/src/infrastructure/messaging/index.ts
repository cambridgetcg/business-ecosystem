/**
 * Compliance Service Messaging Infrastructure
 *
 * Provides event handling capabilities for consuming domain events
 * from other services and publishing compliance domain events.
 *
 * @module infrastructure/messaging
 */

import { createEventBus, createHandlerRegistry, type EventBusHandle, type EventBus } from '@ecosystem/messaging';
import type { Database } from '../persistence/index.js';
import { ComplianceService } from '../../application/services/compliance-service.js';
import { ComplianceEventPublisher, setGlobalEventPublisher, getGlobalEventPublisher } from './event-publisher.js';
import { ExternalEventTypes } from './event-types.js';

// Event types and publisher
export * from './event-types.js';
export * from './event-publisher.js';

// Legacy handlers (for backward compatibility)
export {
  dispatchEvent,
  EVENT_HANDLERS,
  handleJournalEntryPosted,
  handleFiscalPeriodClosed,
  handleTaxFilingSubmitted,
  handleTaxRegistrationCompleted,
  handleEntityCreated,
  handlePSCChanged,
  handleComplianceBlocked,
  handleDataBreachIdentified,
  handleOfficerAppointed,
  handleShareholderAdded,
  type DomainEvent,
} from './event-handlers.js';

// =============================================================================
// Event Bus Initialization
// =============================================================================

let eventBusHandle: EventBusHandle | null = null;

/**
 * Initialize the event bus for the compliance service
 */
export async function initializeEventBus(
  rabbitmqUrl: string | undefined,
  complianceService: ComplianceService
): Promise<EventBusHandle | null> {
  if (!rabbitmqUrl) {
    console.log('[Compliance] Event bus disabled - no RABBITMQ_URL');
    return null;
  }

  try {
    // Import event handlers for delegation
    const {
      handleEntityCreated,
      handleOfficerAppointed,
      handleShareholderAdded,
      handleDataBreachIdentified,
      handleTaxFilingSubmitted,
      handleFiscalPeriodClosed,
    } = await import('./event-handlers.js');

    // Helper to convert @ecosystem/messaging event to legacy handler format
    const wrapHandler = (handler: (event: any, service: any) => Promise<void>) => ({
      handle: async (event: any) => {
        const legacyEvent = {
          event_type: event.type,
          event_id: event.id,
          timestamp: event.occurredAt?.toISOString?.() || new Date().toISOString(),
          correlation_id: event.metadata?.correlationId,
          source: event.metadata?.source,
          user_id: event.metadata?.userId,
          version: event.version || 1,
          data: {
            ...event.payload,
            tenant_id: event.metadata?.tenantId || event.payload?.tenantId,
            entity_id: event.payload?.entityId,
          },
        };
        await handler(legacyEvent, complianceService);
      },
    });

    // Create handler registry for external events
    const registry = createHandlerRegistry()
      // Entity Governance events
      .register(
        ExternalEventTypes.ENTITY_CREATED,
        wrapHandler(handleEntityCreated),
        { name: 'EntityCreatedHandler', priority: 10 }
      )
      .register(
        ExternalEventTypes.OFFICER_APPOINTED,
        wrapHandler(handleOfficerAppointed),
        { name: 'OfficerAppointedHandler', priority: 15 }
      )
      .register(
        ExternalEventTypes.SHAREHOLDER_ADDED,
        wrapHandler(handleShareholderAdded),
        { name: 'ShareholderAddedHandler', priority: 15 }
      )

      // KYC events
      .register(
        ExternalEventTypes.KYC_VERIFICATION_APPROVED,
        {
          handle: async (event) => {
            const payload = event.payload as {
              entityId?: string;
              externalId?: string;
              tenantId: string;
            };

            const entityId = payload.entityId || payload.externalId;
            if (!entityId) return;

            console.log(`[Compliance] KYC approved for entity: ${entityId}`);

            // Mark KYC-related obligations as completed
            const obligations = await complianceService.getObligationsByEntity(
              payload.tenantId,
              entityId,
              { status: 'pending', category: 'aml_kyc' }
            );

            for (const obl of obligations) {
              if (obl.title.toLowerCase().includes('kyc')) {
                await complianceService.updateObligation(obl.id, {
                  status: 'completed',
                  notes: 'Auto-completed via KYC verification',
                });
              }
            }
          },
        },
        { name: 'KYCVerificationApprovedHandler', priority: 15 }
      )

      // Data Privacy events (72-hour GDPR breach notification)
      .register(
        ExternalEventTypes.DATA_BREACH_REPORTED,
        wrapHandler(handleDataBreachIdentified),
        { name: 'DataBreachReportedHandler', priority: 5 }
      )

      // Tax events
      .register(
        ExternalEventTypes.TAX_FILING_COMPLETED,
        wrapHandler(handleTaxFilingSubmitted),
        { name: 'TaxFilingCompletedHandler', priority: 10 }
      )

      // Accounting events
      .register(
        'accounting.fiscal_period.closed',
        wrapHandler(handleFiscalPeriodClosed),
        { name: 'FiscalPeriodClosedHandler', priority: 10 }
      )
      .register(
        'accounting.journal_entry.posted',
        {
          handle: async (event) => {
            const payload = event.payload as {
              entryId: string;
              entryNumber: string;
              description: string;
            };
            console.log(`[Compliance] Journal entry posted: ${payload.entryNumber}`);
            // Tax-related journal entries may require compliance tracking
          },
        },
        { name: 'JournalEntryPostedHandler', priority: 50 }
      );

    // Create event bus
    eventBusHandle = await createEventBus({
      serviceName: 'compliance',
      rabbitmqUrl,
      handlers: registry,
      autoStart: true,
    });

    // Create and set global publisher
    const publisher = new ComplianceEventPublisher(eventBusHandle.bus);
    setGlobalEventPublisher(publisher);

    console.log('[Compliance] Event bus initialized successfully');
    return eventBusHandle;
  } catch (error) {
    console.error('[Compliance] Failed to initialize event bus:', error);
    return null;
  }
}

/**
 * Get the event bus instance
 */
export function getEventBus(): EventBus | null {
  return eventBusHandle?.bus ?? null;
}

/**
 * Shutdown the event bus gracefully
 */
export async function shutdownEventBus(): Promise<void> {
  if (eventBusHandle) {
    await eventBusHandle.stop();
    eventBusHandle = null;
    console.log('[Compliance] Event bus shutdown complete');
  }
}
