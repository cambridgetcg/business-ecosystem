/**
 * Event Handlers for Insurance Service
 *
 * Consumes domain events from other services:
 * - Entity-Governance: Entity created/updated (to set up insurance requirements)
 * - Compliance: Regulatory requirements for insurance coverage
 * - Accounting: Premium payments, loss reserve journal entries
 *
 * @module infrastructure/messaging/event-handlers
 */

import type { Policy } from '../../domain/policy/models/policy.js';

// =============================================================================
// Event Types
// =============================================================================

export interface DomainEvent {
  event_type: string;
  event_id: string;
  timestamp: string;
  correlation_id?: string;
  source: string;
  user_id?: string;
  version: number;
  data: Record<string, unknown>;
}

// =============================================================================
// Entity-Governance Event Handlers
// =============================================================================

/**
 * Handle entity created events
 *
 * When a new entity is created, we may need to:
 * - Check if it requires employers' liability insurance (UK requirement)
 * - Set up default insurance requirements based on entity type
 * - Create compliance obligations for mandatory coverage
 */
export async function handleEntityCreated(event: DomainEvent): Promise<void> {
  const { entity_id, entity_type, jurisdiction, employee_count } = event.data;

  console.log('[Insurance] Received entity created event', {
    entity_id,
    entity_type,
    jurisdiction,
    event_id: event.event_id,
  });

  // UK companies with employees must have employers' liability insurance
  if (jurisdiction === 'uk' && (employee_count as number) > 0) {
    console.log('[Insurance] Entity requires employers liability insurance', {
      entity_id,
      employee_count,
    });
    // In full implementation, would create a compliance task or notification
  }
}

/**
 * Handle employee count changed events
 *
 * When employee count changes, we may need to:
 * - Verify employers' liability coverage is adequate
 * - Adjust coverage limits if needed
 */
export async function handleEmployeeCountChanged(event: DomainEvent): Promise<void> {
  const { entity_id, previous_count, new_count } = event.data;

  console.log('[Insurance] Received employee count changed event', {
    entity_id,
    previous_count,
    new_count,
    event_id: event.event_id,
  });

  // Check if the entity now needs employers' liability insurance
  if ((previous_count as number) === 0 && (new_count as number) > 0) {
    console.log('[Insurance] Entity now has employees, requires employers liability', {
      entity_id,
    });
  }
}

// =============================================================================
// Compliance Event Handlers
// =============================================================================

/**
 * Handle compliance obligation created events
 *
 * When a compliance obligation related to insurance is created,
 * we need to track it and link to relevant policies.
 */
export async function handleComplianceObligationCreated(event: DomainEvent): Promise<void> {
  const { obligation_id, entity_id, category, title, due_date } = event.data;

  console.log('[Insurance] Received compliance obligation created event', {
    obligation_id,
    entity_id,
    category,
    event_id: event.event_id,
  });

  // Insurance-related categories
  const insuranceCategories = [
    'employers_liability',
    'public_liability',
    'professional_indemnity',
    'directors_officers',
  ];

  if (insuranceCategories.includes(category as string)) {
    console.log('[Insurance] Compliance obligation requires insurance review', {
      obligation_id,
      category,
      due_date,
    });
  }
}

// =============================================================================
// Accounting Event Handlers
// =============================================================================

/**
 * Handle journal entry posted events from Accounting
 *
 * When a journal entry related to insurance is posted, we may need to:
 * - Update premium payment status
 * - Record claim payments
 * - Update loss reserves
 */
export async function handleJournalEntryPosted(event: DomainEvent): Promise<void> {
  const { entry_id, entry_number, description, total_debits, total_credits } = event.data;

  console.log('[Insurance] Received journal entry posted event', {
    entry_id,
    entry_number,
    event_id: event.event_id,
  });

  const desc = ((description as string) || '').toLowerCase();

  // Check if this relates to insurance
  if (desc.includes('premium') || desc.includes('insurance')) {
    console.log('[Insurance] Journal entry relates to insurance premium', {
      entry_id,
      description,
      amount: total_debits,
    });
    // In full implementation, would update policy premium payment status
  }

  if (desc.includes('claim') || desc.includes('loss')) {
    console.log('[Insurance] Journal entry relates to insurance claim', {
      entry_id,
      description,
      amount: total_debits,
    });
    // In full implementation, would update claim payment records
  }
}

/**
 * Handle fiscal period closed events
 *
 * When a fiscal period closes, we may need to:
 * - Review reserve adequacy
 * - Generate insurance expense reports
 */
export async function handleFiscalPeriodClosed(event: DomainEvent): Promise<void> {
  const { period_id, period_key, fiscal_year } = event.data;

  console.log('[Insurance] Received fiscal period closed event', {
    period_id,
    period_key,
    fiscal_year,
    event_id: event.event_id,
  });

  // Trigger reserve review for the closed period
  console.log('[Insurance] Reserve review required for period', {
    period_key,
    action: 'reserve_review_pending',
  });
}

// =============================================================================
// Banking-Treasury Event Handlers
// =============================================================================

/**
 * Handle payment completed events
 *
 * When a payment is completed that relates to insurance, we update the policy.
 */
export async function handlePaymentCompleted(event: DomainEvent): Promise<void> {
  const { payment_id, amount, currency, external_reference } = event.data;

  console.log('[Insurance] Received payment completed event', {
    payment_id,
    amount,
    currency,
    event_id: event.event_id,
  });

  // Check if this payment relates to an insurance premium
  // In full implementation, would look up payment by reference
}

// =============================================================================
// Event Handler Registry
// =============================================================================

export const EVENT_HANDLERS: Record<string, (event: DomainEvent) => Promise<void>> = {
  // Entity-Governance events
  'entity-governance.entity.created': handleEntityCreated,
  'entity-governance.employee_count.changed': handleEmployeeCountChanged,

  // Compliance events
  'compliance.obligation.created': handleComplianceObligationCreated,

  // Accounting events
  'accounting.journal_entry.posted': handleJournalEntryPosted,
  'accounting.fiscal_period.closed': handleFiscalPeriodClosed,

  // Banking-Treasury events
  'banking.payment.completed': handlePaymentCompleted,
};

/**
 * Dispatch an event to the appropriate handler
 */
export async function dispatchEvent(event: DomainEvent): Promise<void> {
  const handler = EVENT_HANDLERS[event.event_type];

  if (handler) {
    try {
      await handler(event);
    } catch (error) {
      console.error('[Insurance] Event handler error', {
        event_type: event.event_type,
        event_id: event.event_id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } else {
    console.debug('[Insurance] No handler for event type', {
      event_type: event.event_type,
    });
  }
}
