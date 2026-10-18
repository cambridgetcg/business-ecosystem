/**
 * Event Handler Registry
 *
 * Registers domain event handlers with the event bus.
 * Handlers are organized by domain concern.
 *
 * @module core/events/event-handlers
 */

import type { EventBus, DomainEvent } from './event-bus.js';
import { getPool } from '../../infrastructure/database.js';
import { CacheService } from '../../infrastructure/cache/cache-service.js';
import pino from 'pino';

const logger = pino({ name: 'event-handlers' });

// Singleton cache service reference (set during initialization)
let cacheService: CacheService | null = null;

/**
 * Initialize event handlers with dependencies.
 */
export function initializeEventHandlers(cache: CacheService): void {
  cacheService = cache;
}

/**
 * Account-related event handlers.
 */
export function registerAccountEventHandlers(eventBus: EventBus): void {
  // Balance change handler - update cash position cache
  eventBus.subscribe('account.balance_changed', async (event: DomainEvent) => {
    logger.info({ accountId: event.aggregateId, payload: event.payload }, 'Account balance changed');

    // Invalidate cash position cache for the entity
    if (cacheService && event.payload?.entityId) {
      await cacheService.invalidate(`cash-position:${event.payload.entityId}`);
      await cacheService.invalidate(`account-balance:${event.aggregateId}`);
      logger.debug({ entityId: event.payload.entityId }, 'Cache invalidated for cash position');
    }

    // Update balance in read model (if using separate read model)
    try {
      const pool = await getPool();
      await pool.query(`
        INSERT INTO banking.audit_log (entity_type, entity_id, action, changes, occurred_at)
        VALUES ('bank_account', $1, 'balance_changed', $2, NOW())
      `, [event.aggregateId, JSON.stringify(event.payload)]);
    } catch (error) {
      logger.error({ error, accountId: event.aggregateId }, 'Failed to log balance change');
    }
  }, 10);

  // Account frozen handler - notify operations and block payments
  eventBus.subscribe('account.frozen', async (event: DomainEvent) => {
    logger.warn({ accountId: event.aggregateId, payload: event.payload }, 'Account frozen');

    // Block pending payments from this account
    try {
      const pool = await getPool();
      const result = await pool.query(`
        UPDATE banking.payments
        SET status = 'blocked',
            metadata = jsonb_set(COALESCE(metadata, '{}'), '{block_reason}', '"Source account frozen"'),
            updated_at = NOW()
        WHERE (metadata->>'source_account_id')::uuid = $1
          AND status IN ('pending', 'pending_approval', 'processing')
        RETURNING id
      `, [event.aggregateId]);

      if (result.rowCount && result.rowCount > 0) {
        logger.info({ accountId: event.aggregateId, blockedPayments: result.rowCount }, 'Blocked payments due to frozen account');
      }

      // Log the freeze action
      await pool.query(`
        INSERT INTO banking.audit_log (entity_type, entity_id, action, changes, occurred_at)
        VALUES ('bank_account', $1, 'frozen', $2, NOW())
      `, [event.aggregateId, JSON.stringify({ reason: event.payload?.reason, blockedPayments: result.rowCount })]);
    } catch (error) {
      logger.error({ error, accountId: event.aggregateId }, 'Failed to block payments for frozen account');
    }
  }, 20);

  // Account closed handler - cleanup
  eventBus.subscribe('account.closed', async (event: DomainEvent) => {
    logger.info({ accountId: event.aggregateId }, 'Account closed');

    try {
      const pool = await getPool();

      // Mark related configurations as inactive
      await pool.query(`
        UPDATE banking.bank_connections
        SET status = 'disconnected', updated_at = NOW()
        WHERE bank_account_id = $1
      `, [event.aggregateId]);

      // Log the closure
      await pool.query(`
        INSERT INTO banking.audit_log (entity_type, entity_id, action, changes, occurred_at)
        VALUES ('bank_account', $1, 'closed', $2, NOW())
      `, [event.aggregateId, JSON.stringify(event.payload)]);
    } catch (error) {
      logger.error({ error, accountId: event.aggregateId }, 'Failed to cleanup closed account');
    }
  }, 10);
}

/**
 * Payment-related event handlers.
 */
export function registerPaymentEventHandlers(eventBus: EventBus): void {
  // Payment processing started
  eventBus.subscribe('payment.processing_started', async (event: DomainEvent) => {
    logger.info({ paymentId: event.aggregateId }, 'Payment processing started');

    try {
      const pool = await getPool();
      await pool.query(`
        INSERT INTO banking.audit_log (entity_type, entity_id, action, changes, occurred_at)
        VALUES ('payment', $1, 'processing_started', $2, NOW())
      `, [event.aggregateId, JSON.stringify(event.payload)]);
    } catch (error) {
      logger.error({ error, paymentId: event.aggregateId }, 'Failed to log payment processing start');
    }
  }, 10);

  // Payment completed - update balances and trigger reconciliation
  eventBus.subscribe('payment.completed', async (event: DomainEvent) => {
    logger.info({ paymentId: event.aggregateId, payload: event.payload }, 'Payment completed');

    try {
      const pool = await getPool();

      // Update source account balance (debit)
      if (event.payload?.sourceAccountId && event.payload?.amount) {
        await pool.query(`
          UPDATE banking.bank_accounts
          SET balance_amount = balance_amount - $2,
              updated_at = NOW(),
              version = version + 1
          WHERE id = $1
        `, [event.payload.sourceAccountId, event.payload.amount]);

        // Invalidate cache
        if (cacheService) {
          await cacheService.invalidate(`account-balance:${event.payload.sourceAccountId}`);
        }
      }

      // Log completion
      await pool.query(`
        INSERT INTO banking.audit_log (entity_type, entity_id, action, changes, occurred_at)
        VALUES ('payment', $1, 'completed', $2, NOW())
      `, [event.aggregateId, JSON.stringify(event.payload)]);

      // Queue for reconciliation
      await pool.query(`
        INSERT INTO banking.audit_log (entity_type, entity_id, action, metadata, occurred_at)
        VALUES ('reconciliation', $1, 'payment_queued', '{"trigger": "payment_completed"}', NOW())
      `, [event.aggregateId]);
    } catch (error) {
      logger.error({ error, paymentId: event.aggregateId }, 'Failed to process payment completion');
    }
  }, 20);

  // Payment failed - alert and retry logic
  eventBus.subscribe('payment.failed', async (event: DomainEvent) => {
    logger.error({ paymentId: event.aggregateId, payload: event.payload }, 'Payment failed');

    try {
      const pool = await getPool();

      // Log failure
      await pool.query(`
        INSERT INTO banking.audit_log (entity_type, entity_id, action, changes, occurred_at)
        VALUES ('payment', $1, 'failed', $2, NOW())
      `, [event.aggregateId, JSON.stringify(event.payload)]);

      // Check if payment is retryable based on failure code
      const retryableCodes = ['NETWORK_ERROR', 'TIMEOUT', 'TEMPORARY_FAILURE', 'RATE_LIMITED'];
      const failureCode = event.payload?.failureCode;

      if (failureCode && retryableCodes.includes(failureCode)) {
        // Get current retry count
        const result = await pool.query(`
          SELECT COALESCE((metadata->>'retry_count')::int, 0) as retry_count
          FROM banking.payments WHERE id = $1
        `, [event.aggregateId]);

        const retryCount = result.rows[0]?.retry_count || 0;
        const maxRetries = 3;

        if (retryCount < maxRetries) {
          // Mark for retry
          await pool.query(`
            UPDATE banking.payments
            SET status = 'pending_retry',
                metadata = jsonb_set(COALESCE(metadata, '{}'), '{retry_count}', $2::text::jsonb),
                updated_at = NOW()
            WHERE id = $1
          `, [event.aggregateId, retryCount + 1]);

          logger.info({ paymentId: event.aggregateId, retryCount: retryCount + 1 }, 'Payment marked for retry');
        } else {
          logger.warn({ paymentId: event.aggregateId, maxRetries }, 'Payment exhausted all retries');
        }
      }
    } catch (error) {
      logger.error({ error, paymentId: event.aggregateId }, 'Failed to process payment failure');
    }
  }, 20);
}

/**
 * Compliance-related event handlers.
 */
export function registerComplianceEventHandlers(eventBus: EventBus): void {
  // Handle compliance blocks
  eventBus.subscribe('compliance.blocked', async (event: DomainEvent) => {
    logger.warn({ payload: event.payload }, 'Compliance block triggered');

    try {
      const pool = await getPool();

      // Block the payment if one is associated
      if (event.payload?.paymentId) {
        await pool.query(`
          UPDATE banking.payments
          SET status = 'compliance_hold',
              metadata = jsonb_set(COALESCE(metadata, '{}'), '{compliance_block}', $2::jsonb),
              updated_at = NOW()
          WHERE id = $1
        `, [event.payload.paymentId, JSON.stringify({
          reason: event.payload.reason,
          ruleId: event.payload.ruleId,
          blockedAt: new Date().toISOString(),
        })]);
      }

      // Log the compliance event
      await pool.query(`
        INSERT INTO banking.audit_log (entity_type, entity_id, action, changes, occurred_at)
        VALUES ('compliance', $1, 'blocked', $2, NOW())
      `, [event.payload?.paymentId || event.aggregateId, JSON.stringify(event.payload)]);
    } catch (error) {
      logger.error({ error, payload: event.payload }, 'Failed to process compliance block');
    }
  }, 30);
}

/**
 * Reconciliation-related event handlers.
 */
export function registerReconciliationEventHandlers(eventBus: EventBus): void {
  // Reconciliation completed
  eventBus.subscribe('reconciliation.completed', async (event: DomainEvent) => {
    logger.info({ reconciliationId: event.aggregateId, payload: event.payload }, 'Reconciliation completed');

    try {
      const pool = await getPool();

      // Log completion
      await pool.query(`
        INSERT INTO banking.audit_log (entity_type, entity_id, action, changes, occurred_at)
        VALUES ('reconciliation', $1, 'completed', $2, NOW())
      `, [event.aggregateId, JSON.stringify(event.payload)]);

      // Check for exceptions and create alerts if needed
      const exceptionCount = event.payload?.exceptionCount || 0;
      if (exceptionCount > 0) {
        logger.warn({ reconciliationId: event.aggregateId, exceptionCount }, 'Reconciliation completed with exceptions');

        await pool.query(`
          INSERT INTO banking.audit_log (entity_type, entity_id, action, changes, occurred_at)
          VALUES ('alert', $1, 'reconciliation_exceptions', $2, NOW())
        `, [event.aggregateId, JSON.stringify({ exceptionCount, severity: exceptionCount > 10 ? 'high' : 'medium' })]);
      }

      // Invalidate dashboard cache
      if (cacheService && event.payload?.bankAccountId) {
        await cacheService.invalidate(`reconciliation-status:${event.payload.bankAccountId}`);
      }
    } catch (error) {
      logger.error({ error, reconciliationId: event.aggregateId }, 'Failed to process reconciliation completion');
    }
  }, 10);

  // Exception created
  eventBus.subscribe('reconciliation.exception_created', async (event: DomainEvent) => {
    logger.warn({ reconciliationId: event.aggregateId, payload: event.payload }, 'Reconciliation exception created');

    try {
      const pool = await getPool();

      // Log exception
      await pool.query(`
        INSERT INTO banking.audit_log (entity_type, entity_id, action, changes, occurred_at)
        VALUES ('reconciliation_exception', $1, 'created', $2, NOW())
      `, [event.aggregateId, JSON.stringify(event.payload)]);

      // High-value exceptions get priority routing
      const amount = event.payload?.amount || 0;
      const highValueThreshold = 10000;

      if (amount >= highValueThreshold) {
        logger.info({ amount, threshold: highValueThreshold }, 'High-value exception - priority routing');
        await pool.query(`
          INSERT INTO banking.audit_log (entity_type, entity_id, action, metadata, occurred_at)
          VALUES ('alert', $1, 'high_value_exception', '{"priority": "high", "requires_review": true}', NOW())
        `, [event.aggregateId]);
      }
    } catch (error) {
      logger.error({ error, reconciliationId: event.aggregateId }, 'Failed to process reconciliation exception');
    }
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
    logger.debug({
      type: event.type,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      occurredAt: event.occurredAt.toISOString(),
    }, 'Domain event processed');
  }, -100);
}
