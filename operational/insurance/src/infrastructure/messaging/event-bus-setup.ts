/**
 * Event Bus Setup for Insurance Service
 * Configures RabbitMQ event consumption using @ecosystem/messaging
 */

import {
  createEventBus,
  createHandlerRegistry,
  type EventBusHandle,
  type EventBus,
} from '@ecosystem/messaging';
import type { PrismaClient } from '@prisma/client';
import { ExternalEventTypes } from './event-types.js';
import { InsuranceEventPublisher, setGlobalEventPublisher } from './event-publisher.js';

let eventBusHandle: EventBusHandle | null = null;

export interface InsuranceEventBusDependencies {
  prisma: PrismaClient;
  logger?: {
    info: (msg: string, data?: object) => void;
    error: (msg: string, data?: object) => void;
    warn: (msg: string, data?: object) => void;
  };
}

/**
 * Initialize the event bus and register handlers
 */
export async function initializeEventBus(
  rabbitmqUrl: string | undefined,
  deps: InsuranceEventBusDependencies
): Promise<EventBusHandle | null> {
  if (!rabbitmqUrl) {
    console.log('[Insurance] RABBITMQ_URL not configured - event bus disabled');
    return null;
  }

  const { prisma, logger } = deps;
  const log = logger || console;

  try {
    // Create handler registry
    const registry = createHandlerRegistry()
      // Handle entity creation - check for insurance requirements
      .register(
        ExternalEventTypes.ENTITY_CREATED,
        {
          handle: async (event) => {
            const payload = event.payload as {
              entityId: string;
              tenantId: string;
              name: string;
              entityType: string;
              jurisdiction: string;
              hasEmployees?: boolean;
            };

            log.info(`[Insurance] Entity created: ${payload.entityId}`, { entityType: payload.entityType });

            // Check if UK company with employees needs employers' liability
            if (
              payload.jurisdiction?.toLowerCase().includes('uk') ||
              payload.jurisdiction === 'GB'
            ) {
              // Check for existing employers' liability policy
              const existingPolicy = await prisma.policy.findFirst({
                where: {
                  entityId: payload.entityId,
                  policyType: 'employers_liability',
                  status: { in: ['active', 'bound'] },
                },
              });

              if (!existingPolicy && payload.hasEmployees) {
                log.warn(`[Insurance] UK entity ${payload.entityId} has employees but no employers' liability coverage`, {
                  entityId: payload.entityId,
                  entityName: payload.name,
                });
                // In production, this would publish an EmployersLiabilityGap event
              }
            }
          },
        },
        { name: 'EntityCreatedHandler', priority: 10 }
      )
      // Handle entity dissolution - flag policies for cancellation review
      .register(
        ExternalEventTypes.ENTITY_DISSOLVED,
        {
          handle: async (event) => {
            const payload = event.payload as {
              entityId: string;
              tenantId: string;
              dissolutionDate: string;
            };

            log.info(`[Insurance] Entity dissolved: ${payload.entityId}`);

            // Find active policies for the dissolved entity
            const activePolicies = await prisma.policy.findMany({
              where: {
                entityId: payload.entityId,
                status: { in: ['active', 'bound', 'pending_renewal'] },
              },
            });

            if (activePolicies.length > 0) {
              log.warn(`[Insurance] Dissolved entity ${payload.entityId} has ${activePolicies.length} active policies requiring review`);

              // Mark policies for review (in production, would update status or create task)
              for (const policy of activePolicies) {
                await prisma.policy.update({
                  where: { id: policy.id },
                  data: {
                    metadata: {
                      ...(policy.metadata as object || {}),
                      dissolutionReviewRequired: true,
                      dissolutionDate: payload.dissolutionDate,
                    },
                    updatedAt: new Date(),
                  },
                });
              }
            }
          },
        },
        { name: 'EntityDissolvedHandler', priority: 5 }
      )
      // Handle data breaches - may trigger cyber liability claims
      .register(
        ExternalEventTypes.DATA_BREACH_REPORTED,
        {
          handle: async (event) => {
            const payload = event.payload as {
              breachId: string;
              tenantId: string;
              entityId: string;
              breachType: string;
              severity: string;
              description: string;
              reportedAt: string;
            };

            log.info(`[Insurance] Data breach reported: ${payload.breachId}`, {
              entityId: payload.entityId,
              severity: payload.severity,
            });

            // Check for cyber liability coverage
            const cyberPolicy = await prisma.policy.findFirst({
              where: {
                entityId: payload.entityId,
                policyType: 'cyber_liability',
                status: 'active',
              },
            });

            if (cyberPolicy) {
              log.info(`[Insurance] Cyber policy ${cyberPolicy.id} may cover data breach ${payload.breachId}`);

              // In production, this might auto-create a claim draft or notification
              // For now, just log and add to policy metadata
              await prisma.policy.update({
                where: { id: cyberPolicy.id },
                data: {
                  metadata: {
                    ...(cyberPolicy.metadata as object || {}),
                    potentialClaims: [
                      ...((cyberPolicy.metadata as any)?.potentialClaims || []),
                      {
                        type: 'data_breach',
                        breachId: payload.breachId,
                        reportedAt: payload.reportedAt,
                        severity: payload.severity,
                      },
                    ],
                  },
                  updatedAt: new Date(),
                },
              });
            } else {
              log.warn(`[Insurance] Entity ${payload.entityId} has data breach but no cyber liability coverage`);
            }
          },
        },
        { name: 'DataBreachReportedHandler', priority: 5 }
      )
      // Handle compliance breaches - may affect policy conditions
      .register(
        ExternalEventTypes.COMPLIANCE_BREACH_DETECTED,
        {
          handle: async (event) => {
            const payload = event.payload as {
              tenantId: string;
              entityId: string;
              breachType: string;
              severity: string;
              description: string;
            };

            log.info(`[Insurance] Compliance breach detected for entity ${payload.entityId}`, {
              breachType: payload.breachType,
              severity: payload.severity,
            });

            // Compliance breaches may affect policy conditions or premiums
            // Log for insurer notification purposes
            const affectedPolicies = await prisma.policy.findMany({
              where: {
                entityId: payload.entityId,
                status: 'active',
              },
              select: { id: true, policyNumber: true, policyType: true },
            });

            if (affectedPolicies.length > 0) {
              log.warn(`[Insurance] ${affectedPolicies.length} active policies may be affected by compliance breach`, {
                entityId: payload.entityId,
                policies: affectedPolicies.map(p => p.policyNumber),
              });
            }
          },
        },
        { name: 'ComplianceBreachHandler', priority: 10 }
      );

    // Create and start event bus
    eventBusHandle = await createEventBus({
      serviceName: 'insurance',
      rabbitmqUrl,
      handlers: registry,
      autoStart: true,
    });

    // Create and set global publisher
    const publisher = new InsuranceEventPublisher(eventBusHandle.bus);
    setGlobalEventPublisher(publisher);

    console.log('[Insurance] Event bus initialized successfully');
    console.log('[Insurance] Subscribed to:', [
      ExternalEventTypes.ENTITY_CREATED,
      ExternalEventTypes.ENTITY_DISSOLVED,
      ExternalEventTypes.DATA_BREACH_REPORTED,
      ExternalEventTypes.COMPLIANCE_BREACH_DETECTED,
    ]);

    return eventBusHandle;
  } catch (error) {
    console.error('[Insurance] Failed to initialize event bus:', error);
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
    console.log('[Insurance] Event bus shutdown complete');
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
