/**
 * Event Handler Registry
 *
 * Registers domain event handlers with the event bus.
 * Handlers are organized by domain concern.
 *
 * @module core/events/event-handlers
 */

import type { EventBus, DomainEvent } from './event-bus.js';

/**
 * Account-related event handlers.
 */
export function registerAccountEventHandlers(eventBus: EventBus): void {
  // Balance change handler - update cash position cache
  eventBus.subscribe('account.balance_changed', async (event: DomainEvent) => {
    console.log(`Account balance changed: ${event.aggregateId}`);
    // TODO: Invalidate cash position cache
    // TODO: Trigger cash position recalculation if needed
  }, 10);

  // Account frozen handler - notify operations
  eventBus.subscribe('account.frozen', async (event: DomainEvent) => {
    console.log(`Account frozen: ${event.aggregateId}`, event.payload);
    // TODO: Create operations alert
    // TODO: Block pending payments from this account
  }, 20);

  // Account closed handler - cleanup
  eventBus.subscribe('account.closed', async (event: DomainEvent) => {
    console.log(`Account closed: ${event.aggregateId}`);
    // TODO: Archive account data
    // TODO: Update related configurations
  }, 10);
}

/**
 * Payment-related event handlers.
 */
export function registerPaymentEventHandlers(eventBus: EventBus): void {
  // Payment processing started
  eventBus.subscribe('payment.processing_started', async (event: DomainEvent) => {
    console.log(`Payment processing started: ${event.aggregateId}`);
    // TODO: Update payment status in read model
  }, 10);

  // Payment completed
  eventBus.subscribe('payment.completed', async (event: DomainEvent) => {
    console.log(`Payment completed: ${event.aggregateId}`);
    // TODO: Update account balances
    // TODO: Trigger reconciliation
    // TODO: Update metrics
  }, 20);

  // Payment failed
  eventBus.subscribe('payment.failed', async (event: DomainEvent) => {
    console.log(`Payment failed: ${event.aggregateId}`, event.payload);
    // TODO: Create operations alert
    // TODO: Trigger retry logic if applicable
    // TODO: Update metrics
  }, 20);
}

/**
 * Compliance-related event handlers.
 */
export function registerComplianceEventHandlers(eventBus: EventBus): void {
  // Handle compliance blocks
  eventBus.subscribe('compliance.blocked', async (event: DomainEvent) => {
    console.log(`Compliance block: ${event.payload}`);
    // TODO: Create compliance case
    // TODO: Notify compliance team
  }, 30);
}

/**
 * Reconciliation-related event handlers.
 */
export function registerReconciliationEventHandlers(eventBus: EventBus): void {
  // Reconciliation completed
  eventBus.subscribe('reconciliation.completed', async (event: DomainEvent) => {
    console.log(`Reconciliation completed: ${event.aggregateId}`);
    // TODO: Update dashboard metrics
    // TODO: Notify if exceptions found
  }, 10);

  // Exception created
  eventBus.subscribe('reconciliation.exception_created', async (event: DomainEvent) => {
    console.log(`Reconciliation exception: ${event.aggregateId}`, event.payload);
    // TODO: Create alert
    // TODO: Assign to queue
  }, 20);
}

/**
 * Register all event handlers.
 */
export function registerAllEventHandlers(eventBus: EventBus): void {
  registerAccountEventHandlers(eventBus);
  registerPaymentEventHandlers(eventBus);
  registerComplianceEventHandlers(eventBus);
  registerReconciliationEventHandlers(eventBus);

  // Global logging handler (lowest priority)
  eventBus.subscribeAll(async (event: DomainEvent) => {
    console.log(`[EVENT] ${event.type} @ ${event.occurredAt.toISOString()} - ${event.aggregateType}:${event.aggregateId}`);
  }, -100);
}
