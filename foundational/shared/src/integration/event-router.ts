import type {
  DomainEvent,
  EventHandler,
  EventSubscriber,
  FoundationalEvent,
} from '../events/index.js';

/**
 * Event Router
 *
 * Central event routing for cross-domain communication.
 * Routes events from publishers to subscribers based on event type.
 */
export class EventRouter {
  private handlers: Map<string, EventHandler<DomainEvent>[]> = new Map();
  private subscribers: EventSubscriber[] = [];

  /**
   * Register a handler for a specific event type
   */
  registerHandler<T extends DomainEvent>(
    eventType: T['eventType'],
    handler: EventHandler<T>
  ): void {
    const handlers = this.handlers.get(eventType) ?? [];
    handlers.push(handler as EventHandler<DomainEvent>);
    this.handlers.set(eventType, handlers);
  }

  /**
   * Register a subscriber that receives all events
   */
  addSubscriber(subscriber: EventSubscriber): void {
    this.subscribers.push(subscriber);
  }

  /**
   * Route an event to all registered handlers
   */
  async routeEvent(event: FoundationalEvent): Promise<void> {
    // Notify type-specific handlers
    const typeHandlers = this.handlers.get(event.eventType) ?? [];
    await Promise.all(typeHandlers.map(h => h(event)));

    // Notify global subscribers
    await Promise.all(this.subscribers.map(s => s.handle(event)));
  }

  /**
   * Batch route multiple events
   */
  async routeEvents(events: FoundationalEvent[]): Promise<void> {
    for (const event of events) {
      await this.routeEvent(event);
    }
  }
}

/**
 * Cross-Domain Event Handlers
 *
 * Pre-configured handlers for common cross-domain workflows.
 */
export const CrossDomainHandlers = {
  /**
   * When an entity is created, notify other domains
   */
  onEntityCreated: (callback: (entityId: string, entityType: string) => Promise<void>) => {
    return async (event: DomainEvent): Promise<void> => {
      if (event.eventType === 'entity_governance.entity.created') {
        const payload = event.payload as { entityId: string; entityType: string };
        await callback(payload.entityId, payload.entityType);
      }
    };
  },

  /**
   * When a journal entry is posted, potentially trigger tax calculations
   */
  onJournalEntryPosted: (callback: (entityId: string, entryId: string, amount: string) => Promise<void>) => {
    return async (event: DomainEvent): Promise<void> => {
      if (event.eventType === 'accounting.journal_entry.posted') {
        const payload = event.payload as { entryId: string; totalDebits: { amount: string } };
        await callback(event.aggregateId, payload.entryId, payload.totalDebits.amount);
      }
    };
  },

  /**
   * When a payment completes, create accounting entries
   */
  onPaymentCompleted: (callback: (entityId: string, paymentId: string, amount: string) => Promise<void>) => {
    return async (event: DomainEvent): Promise<void> => {
      if (event.eventType === 'banking_treasury.payment.completed') {
        const payload = event.payload as { paymentId: string; amount: { amount: string } };
        await callback(event.aggregateId, payload.paymentId, payload.amount.amount);
      }
    };
  },

  /**
   * When beneficial ownership changes, trigger compliance review
   */
  onBeneficialOwnershipChanged: (callback: (entityId: string) => Promise<void>) => {
    return async (event: DomainEvent): Promise<void> => {
      if (event.eventType === 'entity_governance.beneficial_ownership.changed') {
        await callback(event.aggregateId);
      }
    };
  },

  /**
   * When cap table changes, potentially trigger 409A valuation
   */
  onCapTableChanged: (callback: (entityId: string, changeType: string) => Promise<void>) => {
    return async (event: DomainEvent): Promise<void> => {
      if (event.eventType === 'entity_governance.cap_table.changed') {
        const payload = event.payload as { changeType: string };
        await callback(event.aggregateId, payload.changeType);
      }
    };
  },
};

export default EventRouter;
