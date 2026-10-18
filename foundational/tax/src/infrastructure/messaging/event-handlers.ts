/**
 * Tax Service Event Handlers
 *
 * Handles events from other ecosystem services:
 * - entity-governance: Entity changes trigger tax registration updates
 * - accounting: Financial period changes affect tax period alignment
 */

import type { DomainEvent } from '@ecosystem/messaging';
import type { UKTaxRegistrationRepository } from '../persistence/repositories/index.js';

// =============================================================================
// External Event Types (from other services)
// =============================================================================

// Entity Governance Events
export const EntityGovernanceEvents = {
  ENTITY_CREATED: 'entity-governance.entity.created',
  ENTITY_UPDATED: 'entity-governance.entity.updated',
  ENTITY_DISSOLVED: 'entity-governance.entity.dissolved',
  DIRECTOR_APPOINTED: 'entity-governance.officer.director_appointed',
  DIRECTOR_RESIGNED: 'entity-governance.officer.director_resigned',
  REGISTERED_AGENT_CHANGED: 'entity-governance.registered_agent.changed',
} as const;

// Accounting Events
export const AccountingEvents = {
  FINANCIAL_PERIOD_STARTED: 'accounting.financial_period.started',
  FINANCIAL_PERIOD_CLOSED: 'accounting.financial_period.closed',
  JOURNAL_POSTED: 'accounting.journal.posted',
  TAX_PROVISION_REQUIRED: 'accounting.tax_provision.required',
} as const;

// =============================================================================
// Event Payloads
// =============================================================================

export interface EntityCreatedPayload {
  entityId: string;
  tenantId: string;
  entityType: 'company' | 'llp' | 'partnership' | 'sole_trader';
  name: string;
  registrationNumber?: string;
  incorporationDate?: string;
  accountingPeriodEnd: string;
  jurisdiction: string;
}

export interface EntityUpdatedPayload {
  entityId: string;
  tenantId: string;
  changes: {
    name?: string;
    registeredAddress?: object;
    accountingPeriodEnd?: string;
  };
}

export interface EntityDissolvedPayload {
  entityId: string;
  tenantId: string;
  dissolutionDate: string;
}

export interface DirectorAppointedPayload {
  entityId: string;
  tenantId: string;
  directorId: string;
  name: string;
  appointmentDate: string;
}

export interface DirectorResignedPayload {
  entityId: string;
  tenantId: string;
  directorId: string;
  resignationDate: string;
}

export interface FinancialPeriodStartedPayload {
  entityId: string;
  tenantId: string;
  periodId: string;
  periodStart: string;
  periodEnd: string;
}

export interface FinancialPeriodClosedPayload {
  entityId: string;
  tenantId: string;
  periodId: string;
  periodEnd: string;
  profitBeforeTax?: string;
}

// =============================================================================
// Event Handler Interface
// =============================================================================

export interface EventHandler<T = unknown> {
  handle(event: DomainEvent<T>): Promise<void>;
}

// =============================================================================
// Entity Governance Event Handlers
// =============================================================================

export class EntityCreatedHandler implements EventHandler<EntityCreatedPayload> {
  constructor(
    private readonly registrationRepository: UKTaxRegistrationRepository,
    private readonly logger?: { info: (msg: string, data?: object) => void }
  ) {}

  async handle(event: DomainEvent<EntityCreatedPayload>): Promise<void> {
    const { entityId, tenantId, accountingPeriodEnd, jurisdiction } = event.payload;

    // Only auto-create tax registration for UK entities
    if (jurisdiction !== 'GB' && jurisdiction !== 'UK') {
      this.logger?.info('Skipping tax registration for non-UK entity', { entityId, jurisdiction });
      return;
    }

    // Check if registration already exists
    const existing = await this.registrationRepository.findByEntityId(entityId);
    if (existing) {
      this.logger?.info('Tax registration already exists', { entityId, registrationId: existing.id });
      return;
    }

    // Create initial tax registration
    await this.registrationRepository.create({
      tenantId,
      entityId,
      accountingPeriodEnd: new Date(accountingPeriodEnd),
    });

    this.logger?.info('Created tax registration for new entity', { entityId, tenantId });
  }
}

export class EntityUpdatedHandler implements EventHandler<EntityUpdatedPayload> {
  constructor(
    private readonly registrationRepository: UKTaxRegistrationRepository,
    private readonly logger?: { info: (msg: string, data?: object) => void }
  ) {}

  async handle(event: DomainEvent<EntityUpdatedPayload>): Promise<void> {
    const { entityId, changes } = event.payload;

    // Only handle accounting period end changes
    if (!changes.accountingPeriodEnd) {
      return;
    }

    const registration = await this.registrationRepository.findByEntityId(entityId);
    if (!registration) {
      this.logger?.info('No tax registration found for entity', { entityId });
      return;
    }

    // Update accounting period end
    await this.registrationRepository.update(registration.id, {
      accountingPeriodEnd: new Date(changes.accountingPeriodEnd),
    });

    this.logger?.info('Updated tax registration accounting period', { entityId, newPeriodEnd: changes.accountingPeriodEnd });
  }
}

export class EntityDissolvedHandler implements EventHandler<EntityDissolvedPayload> {
  constructor(
    private readonly registrationRepository: UKTaxRegistrationRepository,
    private readonly logger?: { info: (msg: string, data?: object) => void }
  ) {}

  async handle(event: DomainEvent<EntityDissolvedPayload>): Promise<void> {
    const { entityId, dissolutionDate } = event.payload;

    const registration = await this.registrationRepository.findByEntityId(entityId);
    if (!registration) {
      return;
    }

    // Deregister from all tax schemes
    if (registration.vatRegistered) {
      await this.registrationRepository.deregisterFromVAT(registration.id, new Date(dissolutionDate));
    }
    if (registration.payeRegistered) {
      await this.registrationRepository.deregisterFromPAYE(registration.id, new Date(dissolutionDate));
    }

    // Mark registration as cancelled
    await this.registrationRepository.update(registration.id, {
      metadata: {
        ...registration.metadata,
        dissolutionDate,
        status: 'dissolved',
      },
    });

    this.logger?.info('Deregistered dissolved entity from tax schemes', { entityId, dissolutionDate });
  }
}

// =============================================================================
// Accounting Event Handlers
// =============================================================================

export class FinancialPeriodClosedHandler implements EventHandler<FinancialPeriodClosedPayload> {
  constructor(
    private readonly registrationRepository: UKTaxRegistrationRepository,
    private readonly logger?: { info: (msg: string, data?: object) => void }
  ) {}

  async handle(event: DomainEvent<FinancialPeriodClosedPayload>): Promise<void> {
    const { entityId, periodEnd, profitBeforeTax } = event.payload;

    const registration = await this.registrationRepository.findByEntityId(entityId);
    if (!registration) {
      return;
    }

    // Update annual turnover for VAT threshold monitoring
    if (profitBeforeTax) {
      const turnover = parseFloat(profitBeforeTax);
      const vatThreshold = 90000; // 2024/25 VAT registration threshold

      await this.registrationRepository.update(registration.id, {
        annualTurnover: turnover.toString(),
        vatThresholdExceeded: turnover > vatThreshold,
      });

      if (turnover > vatThreshold && !registration.vatRegistered) {
        this.logger?.info('Entity exceeded VAT threshold', { entityId, turnover, threshold: vatThreshold });
        // In a real implementation, this might trigger a notification or workflow
      }
    }

    this.logger?.info('Updated tax registration from financial period close', { entityId, periodEnd });
  }
}

// =============================================================================
// Event Consumer (Message Bus Subscriber)
// =============================================================================

export interface EventConsumer {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export class TaxEventConsumer implements EventConsumer {
  private handlers: Map<string, EventHandler<any>> = new Map();
  private running = false;

  constructor(
    private readonly messagingClient: {
      subscribe: (
        patterns: string[],
        handler: (event: DomainEvent<unknown>) => Promise<void>
      ) => Promise<void>;
      unsubscribe: () => Promise<void>;
    },
    private readonly logger?: {
      info: (msg: string, data?: object) => void;
      error: (msg: string, data?: object) => void;
    }
  ) {}

  registerHandler<T>(eventType: string, handler: EventHandler<T>): void {
    this.handlers.set(eventType, handler);
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    const patterns = Array.from(this.handlers.keys());
    if (patterns.length === 0) {
      this.logger?.info('No event handlers registered, skipping subscription');
      return;
    }

    await this.messagingClient.subscribe(patterns, async (event) => {
      await this.handleEvent(event);
    });

    this.running = true;
    this.logger?.info('Tax event consumer started', { patterns });
  }

  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    await this.messagingClient.unsubscribe();
    this.running = false;
    this.logger?.info('Tax event consumer stopped');
  }

  private async handleEvent(event: DomainEvent<unknown>): Promise<void> {
    const handler = this.handlers.get(event.type);
    if (!handler) {
      this.logger?.info('No handler for event type', { type: event.type });
      return;
    }

    try {
      await handler.handle(event);
      this.logger?.info('Event handled successfully', { type: event.type, id: event.id });
    } catch (error) {
      this.logger?.error('Error handling event', {
        type: event.type,
        id: event.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error; // Re-throw for dead-letter queue handling
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export interface EventHandlerDependencies {
  registrationRepository: UKTaxRegistrationRepository;
  logger?: {
    info: (msg: string, data?: object) => void;
    error: (msg: string, data?: object) => void;
  };
}

export function createEventConsumer(
  messagingClient: {
    subscribe: (patterns: string[], handler: (event: DomainEvent<unknown>) => Promise<void>) => Promise<void>;
    unsubscribe: () => Promise<void>;
  },
  deps: EventHandlerDependencies
): TaxEventConsumer {
  const consumer = new TaxEventConsumer(messagingClient, deps.logger);

  // Register entity-governance handlers
  consumer.registerHandler(
    EntityGovernanceEvents.ENTITY_CREATED,
    new EntityCreatedHandler(deps.registrationRepository, deps.logger)
  );
  consumer.registerHandler(
    EntityGovernanceEvents.ENTITY_UPDATED,
    new EntityUpdatedHandler(deps.registrationRepository, deps.logger)
  );
  consumer.registerHandler(
    EntityGovernanceEvents.ENTITY_DISSOLVED,
    new EntityDissolvedHandler(deps.registrationRepository, deps.logger)
  );

  // Register accounting handlers
  consumer.registerHandler(
    AccountingEvents.FINANCIAL_PERIOD_CLOSED,
    new FinancialPeriodClosedHandler(deps.registrationRepository, deps.logger)
  );

  return consumer;
}
