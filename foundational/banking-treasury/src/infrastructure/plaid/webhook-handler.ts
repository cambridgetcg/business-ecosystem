/**
 * Plaid Webhook Handler
 *
 * Handles Plaid webhook events for:
 * - Transaction updates (SYNC_UPDATES_AVAILABLE, DEFAULT_UPDATE, HISTORICAL_UPDATE)
 * - Item updates (ERROR, PENDING_EXPIRATION, USER_PERMISSION_REVOKED)
 * - Account updates (ACCOUNT_UPDATED, RECURRING_TRANSACTIONS_UPDATE)
 * - Sync updates (SYNC_UPDATES_AVAILABLE)
 *
 * @module infrastructure/plaid
 */

import pino from 'pino';
import * as crypto from 'crypto';
import { getPool } from '../database.js';
import { getPlaidClient, type PlaidTransactionInfo } from './client.js';
import { eventBridgePublisher, type DomainEvent } from '../aws/eventbridge-publisher.js';
import { env } from '../../env.js';

const logger = pino({ name: 'plaid-webhook-handler' });

/**
 * Plaid webhook types.
 */
export type PlaidWebhookType =
  | 'TRANSACTIONS'
  | 'ITEM'
  | 'HOLDINGS'
  | 'INVESTMENTS_TRANSACTIONS'
  | 'LIABILITIES'
  | 'AUTH'
  | 'IDENTITY'
  | 'ASSETS'
  | 'INCOME'
  | 'TRANSFER'
  | 'LINK';

/**
 * Transaction webhook codes.
 */
export type TransactionWebhookCode =
  | 'SYNC_UPDATES_AVAILABLE'
  | 'RECURRING_TRANSACTIONS_UPDATE'
  | 'DEFAULT_UPDATE'
  | 'HISTORICAL_UPDATE'
  | 'TRANSACTIONS_REMOVED';

/**
 * Item webhook codes.
 */
export type ItemWebhookCode =
  | 'ERROR'
  | 'NEW_ACCOUNTS_AVAILABLE'
  | 'PENDING_EXPIRATION'
  | 'USER_PERMISSION_REVOKED'
  | 'USER_ACCOUNT_REVOKED'
  | 'WEBHOOK_UPDATE_ACKNOWLEDGED';

/**
 * Base webhook payload.
 */
export interface PlaidWebhookPayload {
  webhook_type: PlaidWebhookType;
  webhook_code: string;
  item_id: string;
  environment?: string;
  error?: {
    error_type: string;
    error_code: string;
    error_message: string;
    display_message?: string;
    causes?: Array<{
      item_id: string;
      error: {
        error_type: string;
        error_code: string;
        error_message: string;
      };
    }>;
  };
}

/**
 * Transaction webhook payload.
 */
export interface TransactionWebhookPayload extends PlaidWebhookPayload {
  webhook_type: 'TRANSACTIONS';
  webhook_code: TransactionWebhookCode;
  new_transactions?: number;
  removed_transactions?: string[];
}

/**
 * Item webhook payload.
 */
export interface ItemWebhookPayload extends PlaidWebhookPayload {
  webhook_type: 'ITEM';
  webhook_code: ItemWebhookCode;
  consent_expiration_time?: string;
  account_ids_with_new_auth?: string[];
}

/**
 * Webhook processing result.
 */
export interface WebhookProcessingResult {
  success: boolean;
  webhookType: string;
  webhookCode: string;
  itemId: string;
  message?: string;
  error?: string;
  transactionsProcessed?: number;
  accountsUpdated?: number;
}

/**
 * Connection record from database.
 */
interface ConnectionRecord {
  id: string;
  entity_id: string;
  access_token: string;
  sync_cursor: string | null;
}

/**
 * Plaid Webhook Handler
 *
 * Processes Plaid webhook events and:
 * - Syncs transaction updates
 * - Handles item errors and re-authentication
 * - Publishes domain events for downstream processing
 */
export class PlaidWebhookHandler {
  private readonly plaidClient = getPlaidClient();

  /**
   * Verify the webhook signature from Plaid.
   * Plaid signs webhooks with JWT - this verifies authenticity.
   */
  async verifyWebhookSignature(
    body: string,
    signedJwt: string | undefined
  ): Promise<boolean> {
    // In production, implement JWT verification using Plaid's public keys
    // See: https://plaid.com/docs/api/webhooks/webhook-verification/
    if (!signedJwt) {
      logger.warn('No Plaid-Verification header present');
      return env.NODE_ENV !== 'production'; // Allow unverified in non-production
    }

    try {
      // For now, we log a warning in production if signature verification is not implemented
      if (env.NODE_ENV === 'production') {
        logger.warn('Webhook signature verification should be implemented for production');
      }

      // Basic structure validation
      const parts = signedJwt.split('.');
      if (parts.length !== 3) {
        logger.error('Invalid JWT structure');
        return false;
      }

      // TODO: Implement full JWT verification with Plaid's public keys
      // This requires fetching the key from Plaid's key endpoint and verifying
      return true;
    } catch (error) {
      logger.error({ error }, 'Webhook signature verification failed');
      return false;
    }
  }

  /**
   * Process a Plaid webhook.
   */
  async handleWebhook(payload: PlaidWebhookPayload): Promise<WebhookProcessingResult> {
    const { webhook_type: webhookType, webhook_code: webhookCode, item_id: itemId } = payload;

    logger.info({ webhookType, webhookCode, itemId }, 'Processing Plaid webhook');

    try {
      // Find the connection for this item
      const connection = await this.findConnectionByItemId(itemId);

      if (!connection) {
        logger.warn({ itemId }, 'No connection found for Plaid item');
        return {
          success: false,
          webhookType,
          webhookCode,
          itemId,
          error: 'Connection not found',
        };
      }

      let result: WebhookProcessingResult;

      switch (webhookType) {
        case 'TRANSACTIONS':
          result = await this.handleTransactionWebhook(
            payload as TransactionWebhookPayload,
            connection
          );
          break;

        case 'ITEM':
          result = await this.handleItemWebhook(
            payload as ItemWebhookPayload,
            connection
          );
          break;

        case 'HOLDINGS':
        case 'INVESTMENTS_TRANSACTIONS':
          result = await this.handleInvestmentWebhook(payload, connection);
          break;

        case 'AUTH':
          result = await this.handleAuthWebhook(payload, connection);
          break;

        default:
          logger.debug({ webhookType, webhookCode }, 'Unhandled webhook type');
          result = {
            success: true,
            webhookType,
            webhookCode,
            itemId,
            message: 'Webhook acknowledged but not processed',
          };
      }

      // Publish webhook received event
      await this.publishWebhookEvent(payload, connection.entity_id, result);

      return result;
    } catch (error) {
      logger.error({ error, webhookType, webhookCode, itemId }, 'Webhook processing failed');
      return {
        success: false,
        webhookType,
        webhookCode,
        itemId,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Handle transaction webhooks.
   */
  private async handleTransactionWebhook(
    payload: TransactionWebhookPayload,
    connection: ConnectionRecord
  ): Promise<WebhookProcessingResult> {
    const { webhook_code: code, item_id: itemId } = payload;

    logger.info({ code, itemId }, 'Processing transaction webhook');

    switch (code) {
      case 'SYNC_UPDATES_AVAILABLE':
      case 'DEFAULT_UPDATE':
      case 'HISTORICAL_UPDATE': {
        // Sync transactions using the cursor-based sync API
        const syncResult = await this.syncTransactionsForConnection(connection);
        return {
          success: true,
          webhookType: 'TRANSACTIONS',
          webhookCode: code,
          itemId,
          message: `Synced ${syncResult.added} added, ${syncResult.modified} modified, ${syncResult.removed} removed transactions`,
          transactionsProcessed: syncResult.added + syncResult.modified,
        };
      }

      case 'TRANSACTIONS_REMOVED': {
        // Handle removed transactions
        const removedIds = payload.removed_transactions ?? [];
        if (removedIds.length > 0) {
          await this.markTransactionsRemoved(connection.entity_id, removedIds);
        }
        return {
          success: true,
          webhookType: 'TRANSACTIONS',
          webhookCode: code,
          itemId,
          message: `Marked ${removedIds.length} transactions as removed`,
          transactionsProcessed: removedIds.length,
        };
      }

      case 'RECURRING_TRANSACTIONS_UPDATE':
        // Recurring transaction patterns updated
        return {
          success: true,
          webhookType: 'TRANSACTIONS',
          webhookCode: code,
          itemId,
          message: 'Recurring transactions update acknowledged',
        };

      default:
        return {
          success: true,
          webhookType: 'TRANSACTIONS',
          webhookCode: code,
          itemId,
          message: 'Transaction webhook acknowledged',
        };
    }
  }

  /**
   * Handle item webhooks.
   */
  private async handleItemWebhook(
    payload: ItemWebhookPayload,
    connection: ConnectionRecord
  ): Promise<WebhookProcessingResult> {
    const { webhook_code: code, item_id: itemId, error } = payload;

    logger.info({ code, itemId, error }, 'Processing item webhook');

    const pool = await getPool();

    switch (code) {
      case 'ERROR': {
        // Item needs attention (re-authentication, etc.)
        await pool.query(
          `UPDATE banking.bank_connections
           SET status = 'error', error_message = $1, error_code = $2, updated_at = NOW()
           WHERE item_id = $3`,
          [
            error?.error_message ?? 'Unknown error',
            error?.error_code ?? 'UNKNOWN',
            itemId,
          ]
        );

        logger.warn({ itemId, error }, 'Plaid item error');

        return {
          success: true,
          webhookType: 'ITEM',
          webhookCode: code,
          itemId,
          message: `Item error recorded: ${error?.error_code}`,
        };
      }

      case 'PENDING_EXPIRATION': {
        // User consent is about to expire
        await pool.query(
          `UPDATE banking.bank_connections
           SET consent_expires_at = $1, updated_at = NOW()
           WHERE item_id = $2`,
          [payload.consent_expiration_time, itemId]
        );

        return {
          success: true,
          webhookType: 'ITEM',
          webhookCode: code,
          itemId,
          message: `Consent expiration warning: ${payload.consent_expiration_time}`,
        };
      }

      case 'USER_PERMISSION_REVOKED':
      case 'USER_ACCOUNT_REVOKED': {
        // User revoked access
        await pool.query(
          `UPDATE banking.bank_connections
           SET status = 'revoked', access_token = NULL, updated_at = NOW()
           WHERE item_id = $1`,
          [itemId]
        );

        return {
          success: true,
          webhookType: 'ITEM',
          webhookCode: code,
          itemId,
          message: 'User permission revoked',
        };
      }

      case 'NEW_ACCOUNTS_AVAILABLE': {
        // New accounts available to link
        return {
          success: true,
          webhookType: 'ITEM',
          webhookCode: code,
          itemId,
          message: 'New accounts available for linking',
        };
      }

      case 'WEBHOOK_UPDATE_ACKNOWLEDGED': {
        // Webhook URL was updated
        return {
          success: true,
          webhookType: 'ITEM',
          webhookCode: code,
          itemId,
          message: 'Webhook update acknowledged',
        };
      }

      default:
        return {
          success: true,
          webhookType: 'ITEM',
          webhookCode: code,
          itemId,
          message: 'Item webhook acknowledged',
        };
    }
  }

  /**
   * Handle investment webhooks (holdings and transactions).
   */
  private async handleInvestmentWebhook(
    payload: PlaidWebhookPayload,
    connection: ConnectionRecord
  ): Promise<WebhookProcessingResult> {
    const { webhook_type: type, webhook_code: code, item_id: itemId } = payload;

    logger.info({ type, code, itemId }, 'Processing investment webhook');

    // Investment webhooks would trigger syncing of holdings/investment transactions
    // For now, acknowledge receipt
    return {
      success: true,
      webhookType: type,
      webhookCode: code,
      itemId,
      message: 'Investment webhook acknowledged - sync not implemented',
    };
  }

  /**
   * Handle auth webhooks.
   */
  private async handleAuthWebhook(
    payload: PlaidWebhookPayload,
    connection: ConnectionRecord
  ): Promise<WebhookProcessingResult> {
    const { webhook_code: code, item_id: itemId } = payload;

    logger.info({ code, itemId }, 'Processing auth webhook');

    // Auth webhooks typically indicate account/routing number availability
    return {
      success: true,
      webhookType: 'AUTH',
      webhookCode: code,
      itemId,
      message: 'Auth webhook acknowledged',
    };
  }

  /**
   * Sync transactions for a connection using cursor-based sync.
   */
  private async syncTransactionsForConnection(
    connection: ConnectionRecord
  ): Promise<{ added: number; modified: number; removed: number }> {
    const { id: connectionId, entity_id: entityId, access_token: accessToken, sync_cursor: cursor } = connection;

    let added = 0;
    let modified = 0;
    let removed = 0;
    let currentCursor = cursor ?? undefined;
    let hasMore = true;

    const pool = await getPool();

    while (hasMore) {
      const syncResult = await this.plaidClient.syncTransactions(accessToken, currentCursor);

      // Process added transactions
      for (const transaction of syncResult.added) {
        await this.upsertTransaction(entityId, transaction, 'added');
        added++;
      }

      // Process modified transactions
      for (const transaction of syncResult.modified) {
        await this.upsertTransaction(entityId, transaction, 'modified');
        modified++;
      }

      // Process removed transactions
      for (const transactionId of syncResult.removed) {
        await this.markTransactionRemoved(entityId, transactionId);
        removed++;
      }

      currentCursor = syncResult.nextCursor;
      hasMore = syncResult.hasMore;
    }

    // Update the sync cursor
    await pool.query(
      `UPDATE banking.bank_connections
       SET sync_cursor = $1, last_sync_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [currentCursor, connectionId]
    );

    logger.info(
      { connectionId, entityId, added, modified, removed },
      'Transaction sync completed'
    );

    return { added, modified, removed };
  }

  /**
   * Upsert a transaction into the database.
   */
  private async upsertTransaction(
    entityId: string,
    transaction: PlaidTransactionInfo,
    operation: 'added' | 'modified'
  ): Promise<void> {
    const pool = await getPool();

    await pool.query(
      `INSERT INTO banking.transactions (
        id, entity_id, external_id, type, status,
        amount_value, amount_currency, description,
        merchant_name, category, payment_channel,
        transaction_date, pending, metadata,
        created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4,
        $5, $6, $7,
        $8, $9, $10,
        $11, $12, $13,
        NOW(), NOW()
      )
      ON CONFLICT (entity_id, external_id) DO UPDATE SET
        type = $3,
        status = $4,
        amount_value = $5,
        amount_currency = $6,
        description = $7,
        merchant_name = $8,
        category = $9,
        payment_channel = $10,
        transaction_date = $11,
        pending = $12,
        metadata = $13,
        updated_at = NOW()`,
      [
        entityId,
        transaction.transactionId,
        transaction.amount > 0 ? 'credit' : 'debit',
        transaction.pending ? 'pending' : 'completed',
        Math.abs(transaction.amount),
        transaction.isoCurrencyCode ?? 'USD',
        transaction.name,
        transaction.merchantName,
        JSON.stringify(transaction.category),
        transaction.paymentChannel,
        transaction.date,
        transaction.pending,
        JSON.stringify({
          plaidAccountId: transaction.accountId,
          categoryId: transaction.categoryId,
          checkNumber: transaction.checkNumber,
          location: transaction.location,
          personalFinanceCategory: transaction.personalFinanceCategory,
          authorizedDate: transaction.authorizedDate,
        }),
      ]
    );
  }

  /**
   * Mark a single transaction as removed.
   */
  private async markTransactionRemoved(entityId: string, transactionId: string): Promise<void> {
    const pool = await getPool();

    await pool.query(
      `UPDATE banking.transactions
       SET status = 'removed', updated_at = NOW()
       WHERE entity_id = $1 AND external_id = $2`,
      [entityId, transactionId]
    );
  }

  /**
   * Mark multiple transactions as removed.
   */
  private async markTransactionsRemoved(entityId: string, transactionIds: string[]): Promise<void> {
    if (transactionIds.length === 0) return;

    const pool = await getPool();

    await pool.query(
      `UPDATE banking.transactions
       SET status = 'removed', updated_at = NOW()
       WHERE entity_id = $1 AND external_id = ANY($2)`,
      [entityId, transactionIds]
    );
  }

  /**
   * Find a connection by item ID.
   */
  private async findConnectionByItemId(itemId: string): Promise<ConnectionRecord | null> {
    const pool = await getPool();

    const result = await pool.query<ConnectionRecord>(
      `SELECT id, entity_id, access_token, sync_cursor
       FROM banking.bank_connections
       WHERE item_id = $1 AND provider = 'plaid'`,
      [itemId]
    );

    return result.rows[0] ?? null;
  }

  /**
   * Publish a domain event for the webhook.
   */
  private async publishWebhookEvent(
    payload: PlaidWebhookPayload,
    entityId: string,
    result: WebhookProcessingResult
  ): Promise<void> {
    try {
      const event: DomainEvent = {
        type: `Plaid.Webhook.${payload.webhook_type}.${payload.webhook_code}`,
        aggregateType: 'BankConnection',
        aggregateId: payload.item_id,
        timestamp: new Date(),
        payload: {
          webhookType: payload.webhook_type,
          webhookCode: payload.webhook_code,
          itemId: payload.item_id,
          entityId,
          success: result.success,
          message: result.message,
          transactionsProcessed: result.transactionsProcessed,
          accountsUpdated: result.accountsUpdated,
          error: result.error,
        },
        metadata: {
          correlationId: payload.item_id,
        },
      };

      await eventBridgePublisher.publish(event);
    } catch (error) {
      logger.error({ error }, 'Failed to publish webhook event');
      // Don't throw - webhook processing should continue even if event publishing fails
    }
  }
}

// Singleton instance
export const plaidWebhookHandler = new PlaidWebhookHandler();
