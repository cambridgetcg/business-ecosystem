/**
 * External Event Handlers
 *
 * Handles events from other ecosystem services that entity-governance
 * needs to react to.
 */

import type { DomainEvent, EventHandler } from '@ecosystem/messaging';

// =============================================================================
// Event Types from Other Services
// =============================================================================

export const ExternalEventTypes = {
  // From Accounting
  ACCOUNT_CREATED: 'accounting.account.created',
  ACCOUNT_CLOSED: 'accounting.account.closed',

  // From Tax
  TAX_ID_ASSIGNED: 'tax.entity.tax-id-assigned',
  TAX_STATUS_CHANGED: 'tax.entity.status-changed',

  // From Compliance
  REGULATORY_REQUIREMENT_ADDED: 'compliance.requirement.added',
  REGULATORY_DEADLINE_CHANGED: 'compliance.deadline.changed',
} as const;

// =============================================================================
// Handler Implementations
// =============================================================================

export interface TaxIdAssignedPayload {
  entityId: string;
  taxId: string;
  taxIdType: 'EIN' | 'SSN' | 'ITIN' | 'FTIN';
  jurisdiction: string;
  effectiveDate: string;
}

/**
 * Handler for when Tax service assigns a tax ID to an entity
 */
export class TaxIdAssignedHandler implements EventHandler<TaxIdAssignedPayload> {
  constructor(
    private readonly entityRepository: {
      updateTaxId(entityId: string, taxId: string): Promise<void>;
    }
  ) {}

  async handle(event: DomainEvent<TaxIdAssignedPayload>): Promise<void> {
    const { entityId, taxId } = event.payload;
    await this.entityRepository.updateTaxId(entityId, taxId);
  }
}

export interface RegulatoryRequirementAddedPayload {
  entityId: string;
  requirementId: string;
  filingType: string;
  jurisdiction: string;
  frequency: string;
  dueDateRule: Record<string, unknown>;
}

interface FilingRequirementInput {
  entityId: string;
  filingType: string;
  jurisdictionCountry: string;
  jurisdictionState?: string;
  frequency: string;
  dueDateRule: Record<string, unknown>;
}

/**
 * Handler for when Compliance service adds a new regulatory requirement
 */
export class RegulatoryRequirementAddedHandler implements EventHandler<RegulatoryRequirementAddedPayload> {
  constructor(
    private readonly filingRepository: {
      createFilingRequirement(requirement: FilingRequirementInput): Promise<void>;
    }
  ) {}

  async handle(event: DomainEvent<RegulatoryRequirementAddedPayload>): Promise<void> {
    const { entityId, filingType, jurisdiction, frequency, dueDateRule } = event.payload;
    const parts = jurisdiction.split('-');
    const country = parts[0] ?? '';
    const state = parts[1];

    const requirement: FilingRequirementInput = {
      entityId,
      filingType,
      jurisdictionCountry: country,
      frequency,
      dueDateRule,
    };

    if (state !== undefined) {
      requirement.jurisdictionState = state;
    }

    await this.filingRepository.createFilingRequirement(requirement);
  }
}

// =============================================================================
// Handler Registry
// =============================================================================

export interface EventHandlerRegistry {
  register<T>(eventType: string, handler: EventHandler<T>): void;
  getHandler<T>(eventType: string): EventHandler<T> | undefined;
  getAllEventTypes(): string[];
}

export class InMemoryEventHandlerRegistry implements EventHandlerRegistry {
  private handlers = new Map<string, EventHandler<unknown>>();

  register<T>(eventType: string, handler: EventHandler<T>): void {
    this.handlers.set(eventType, handler as EventHandler<unknown>);
  }

  getHandler<T>(eventType: string): EventHandler<T> | undefined {
    return this.handlers.get(eventType) as EventHandler<T> | undefined;
  }

  getAllEventTypes(): string[] {
    return Array.from(this.handlers.keys());
  }
}
