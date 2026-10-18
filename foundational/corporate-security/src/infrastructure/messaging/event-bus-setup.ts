/**
 * Event Bus Setup
 * Initializes RabbitMQ connection and registers event handlers for corporate-security service
 *
 * @module infrastructure/messaging/event-bus-setup
 */

import {
  createEventBus,
  createHandlerRegistry,
  type EventBusHandle,
  type DomainEvent,
} from '@ecosystem/messaging';
import {
  RabbitMQSecurityEventPublisher,
  setGlobalEventPublisher,
} from './rabbitmq-publisher.js';

let eventBusHandle: EventBusHandle | null = null;

// Service instance for handling events (set during initialization)
let securityServiceInstance: {
  reportSecurityIncident: (input: {
    tenantId: string;
    title: string;
    description: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    category: string;
    detectedBy: 'system' | 'user' | 'external';
    detectionSource?: string;
    affectedResources?: string[];
    reportedBy?: string;
  }) => Promise<{ incidentId: string; incidentNumber: string }>;
} | null = null;

/**
 * Set the security service instance for event handlers
 */
export function setSecurityServiceInstance(service: typeof securityServiceInstance): void {
  securityServiceInstance = service;
}

/**
 * External event types that corporate-security consumes
 */
export const ExternalEventTypes = {
  // From Entity Governance
  ENTITY_CREATED: 'entity-governance.entity.created',
  OFFICER_APPOINTED: 'entity-governance.officer.appointed',

  // From KYC Identity
  KYC_VERIFICATION_APPROVED: 'kyc-identity.verification.approved',
  KYC_VERIFICATION_REJECTED: 'kyc-identity.verification.rejected',

  // From Compliance
  COMPLIANCE_BREACH_DETECTED: 'compliance.breach.detected',
} as const;

export type ExternalEventType = typeof ExternalEventTypes[keyof typeof ExternalEventTypes];

/**
 * Initialize the event bus and register handlers
 */
export async function initializeEventBus(rabbitmqUrl?: string): Promise<void> {
  if (!rabbitmqUrl) {
    console.log('[CorporateSecurity] No RabbitMQ URL provided, event bus disabled');
    // Create publisher that logs but doesn't actually publish
    setGlobalEventPublisher(new RabbitMQSecurityEventPublisher(null));
    return;
  }

  try {
    console.log('[CorporateSecurity] Initializing event bus...');

    // Create handler registry for external events
    const registry = createHandlerRegistry();

    // Handle entity created events - provision security identity
    registry.register(
      ExternalEventTypes.ENTITY_CREATED,
      {
        handle: async (event) => {
          const payload = event.payload as {
            entityId: string;
            tenantId: string;
            name: string;
            entityType: string;
          };

          console.log(`[CorporateSecurity] Entity created: ${payload.entityId}`, {
            name: payload.name,
            entityType: payload.entityType,
          });

          // In a full implementation, this would:
          // - Create default security policies for the entity
          // - Set up audit logging
          // - Configure default access controls
        },
      },
      { name: 'EntityCreatedHandler', priority: 10 }
    );

    // Handle KYC verification approved - unlock identity access
    registry.register(
      ExternalEventTypes.KYC_VERIFICATION_APPROVED,
      {
        handle: async (event: DomainEvent) => {
          const payload = event.payload as {
            entityId?: string;
            externalId?: string;
            tenantId: string;
            verificationLevel: string;
          };

          const entityId = payload.entityId || payload.externalId;
          console.log(`[CorporateSecurity] KYC approved for: ${entityId}`, {
            verificationLevel: payload.verificationLevel,
          });

          // In a full implementation, this would:
          // - Upgrade access level based on KYC verification
          // - Enable additional security features
        },
      },
      { name: 'KYCApprovedHandler', priority: 15 }
    );

    // Handle KYC verification rejected - log security event
    registry.register(
      ExternalEventTypes.KYC_VERIFICATION_REJECTED,
      {
        handle: async (event: DomainEvent) => {
          const payload = event.payload as {
            entityId?: string;
            externalId?: string;
            tenantId: string;
            reason: string;
            riskScore?: number;
          };

          const entityId = payload.entityId || payload.externalId;
          console.log(`[CorporateSecurity] KYC rejected for: ${entityId}`, {
            reason: payload.reason,
          });

          // Create security incident if high risk or suspicious
          if (securityServiceInstance && payload.riskScore && payload.riskScore > 70) {
            try {
              const result = await securityServiceInstance.reportSecurityIncident({
                tenantId: payload.tenantId,
                title: `High-Risk KYC Rejection: ${entityId}`,
                description: `KYC verification rejected with high risk score (${payload.riskScore}). Reason: ${payload.reason}`,
                severity: payload.riskScore > 90 ? 'high' : 'medium',
                category: 'identity_verification_failure',
                detectedBy: 'system',
                detectionSource: 'kyc-identity-service',
                affectedResources: entityId ? [entityId] : [],
              });

              console.log(`[CorporateSecurity] Created security incident for KYC rejection: ${result.incidentNumber}`);
            } catch (error) {
              console.error('[CorporateSecurity] Failed to create incident from KYC rejection:', error);
            }
          }
        },
      },
      { name: 'KYCRejectedHandler', priority: 15 }
    );

    // Handle compliance breach detected - trigger security incident
    registry.register(
      ExternalEventTypes.COMPLIANCE_BREACH_DETECTED,
      {
        handle: async (event: DomainEvent) => {
          const payload = event.payload as {
            tenantId: string;
            entityId: string;
            breachType: string;
            severity: string;
            description: string;
          };

          console.log(`[CorporateSecurity] Compliance breach detected: ${payload.breachType}`, {
            entityId: payload.entityId,
            severity: payload.severity,
          });

          // Create a security incident if service is available
          if (securityServiceInstance) {
            try {
              const severityMap: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
                critical: 'critical',
                high: 'high',
                medium: 'medium',
                low: 'low',
              };

              const result = await securityServiceInstance.reportSecurityIncident({
                tenantId: payload.tenantId,
                title: `Compliance Breach: ${payload.breachType}`,
                description: payload.description,
                severity: severityMap[payload.severity.toLowerCase()] || 'medium',
                category: 'compliance_violation',
                detectedBy: 'system',
                detectionSource: 'compliance-service',
                affectedResources: [payload.entityId],
              });

              console.log(`[CorporateSecurity] Created security incident: ${result.incidentNumber}`);
            } catch (error) {
              console.error('[CorporateSecurity] Failed to create incident from compliance breach:', error);
            }
          }
        },
      },
      { name: 'ComplianceBreachHandler', priority: 5 }
    );

    // Create event bus with handler registry
    eventBusHandle = await createEventBus({
      serviceName: 'corporate-security',
      rabbitmqUrl,
      handlers: registry,
      autoStart: true,
    });

    // Create and configure event publisher
    const publisher = new RabbitMQSecurityEventPublisher(eventBusHandle.bus);
    setGlobalEventPublisher(publisher);

    console.log('[CorporateSecurity] Event bus initialized successfully');
  } catch (error) {
    console.error('[CorporateSecurity] Failed to initialize event bus:', error);
    // Create fallback publisher that doesn't publish
    setGlobalEventPublisher(new RabbitMQSecurityEventPublisher(null));
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
      console.log('[CorporateSecurity] Event bus shut down successfully');
    } catch (error) {
      console.error('[CorporateSecurity] Error shutting down event bus:', error);
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
