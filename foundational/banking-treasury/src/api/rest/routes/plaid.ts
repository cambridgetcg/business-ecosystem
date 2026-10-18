/**
 * Plaid Integration API Routes
 *
 * Endpoints for Plaid bank account linking, balance sync, and transaction ingestion.
 *
 * @module api/rest/routes/plaid
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { plaidService } from '../../../services/bank-integration/index.js';
import { getPool } from '../../../infrastructure/database.js';

const linkTokenSchema = z.object({
  entityId: z.string().uuid(),
  userId: z.string(),
  clientName: z.string().default('Banking Treasury'),
  products: z.array(z.enum(['auth', 'transactions', 'identity', 'assets', 'liabilities', 'investments']))
    .default(['auth', 'transactions']),
  countryCodes: z.array(z.string().length(2)).default(['US']),
  language: z.string().default('en'),
  redirectUri: z.string().url().optional(),
});

const exchangeTokenSchema = z.object({
  publicToken: z.string(),
  entityId: z.string().uuid(),
});

const syncSchema = z.object({
  entityId: z.string().uuid(),
});

const transactionSyncSchema = z.object({
  entityId: z.string().uuid(),
  startDate: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid date'),
  endDate: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid date'),
});

const webhookSchema = z.object({
  webhook_type: z.string(),
  webhook_code: z.string(),
  item_id: z.string(),
  error: z.unknown().optional(),
});

export async function plaidRoutes(app: FastifyInstance): Promise<void> {

  /**
   * Create a link token for Plaid Link initialization
   * POST /api/v1/plaid/link-token
   */
  app.post('/plaid/link-token', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const input = linkTokenSchema.parse(request.body);

      const linkSession = await plaidService.createLinkToken({
        entityId: input.entityId,
        userId: input.userId,
        clientName: input.clientName,
        products: input.products,
        countryCodes: input.countryCodes,
        language: input.language,
        redirectUri: input.redirectUri,
      });

      return reply.status(201).send({
        success: true,
        data: {
          linkToken: linkSession.linkToken,
          expiration: linkSession.expiration,
          requestId: linkSession.requestId,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid request body',
          details: error.errors,
        });
      }
      request.log.error(error, 'Failed to create link token');
      return reply.status(500).send({
        success: false,
        error: 'Failed to create link token',
      });
    }
  });

  /**
   * Exchange public token for access token after Link flow
   * POST /api/v1/plaid/exchange-token
   */
  app.post('/plaid/exchange-token', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { publicToken, entityId } = exchangeTokenSchema.parse(request.body);

      const result = await plaidService.exchangePublicToken(publicToken, entityId);

      return reply.send({
        success: true,
        data: {
          itemId: result.itemId,
          requestId: result.requestId,
          message: 'Bank account linked successfully',
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid request body',
          details: error.errors,
        });
      }
      request.log.error(error, 'Failed to exchange token');
      return reply.status(500).send({
        success: false,
        error: 'Failed to exchange token',
      });
    }
  });

  /**
   * Sync account balances from Plaid
   * POST /api/v1/plaid/sync-balances
   */
  app.post('/plaid/sync-balances', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { entityId } = syncSchema.parse(request.body);

      const pool = await getPool();
      const result = await pool.query(`
        SELECT access_token FROM banking.bank_connections
        WHERE entity_id = $1 AND provider = 'plaid' AND status = 'connected'
        LIMIT 1
      `, [entityId]);

      if (result.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'No connected Plaid account found for this entity',
        });
      }

      const { access_token: accessToken } = result.rows[0];
      const syncResult = await plaidService.syncBalances(accessToken, entityId);

      return reply.send({
        success: true,
        data: {
          synced: syncResult.synced,
          updatedAt: syncResult.updated.toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid request body',
          details: error.errors,
        });
      }
      request.log.error(error, 'Failed to sync balances');
      return reply.status(500).send({
        success: false,
        error: 'Failed to sync balances',
      });
    }
  });

  /**
   * Ingest transactions from Plaid
   * POST /api/v1/plaid/sync-transactions
   */
  app.post('/plaid/sync-transactions', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { entityId, startDate, endDate } = transactionSyncSchema.parse(request.body);

      const pool = await getPool();
      const result = await pool.query(`
        SELECT access_token FROM banking.bank_connections
        WHERE entity_id = $1 AND provider = 'plaid' AND status = 'connected'
        LIMIT 1
      `, [entityId]);

      if (result.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'No connected Plaid account found for this entity',
        });
      }

      const { access_token: accessToken } = result.rows[0];
      const ingestResult = await plaidService.ingestTransactions(
        accessToken,
        entityId,
        startDate,
        endDate
      );

      return reply.send({
        success: true,
        data: {
          ingested: ingestResult.ingested,
          duplicates: ingestResult.duplicates,
          dateRange: { startDate, endDate },
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid request body',
          details: error.errors,
        });
      }
      request.log.error(error, 'Failed to sync transactions');
      return reply.status(500).send({
        success: false,
        error: 'Failed to sync transactions',
      });
    }
  });

  /**
   * Get linked accounts for an entity
   * GET /api/v1/plaid/accounts
   */
  app.get('/plaid/accounts', async (request: FastifyRequest, reply: FastifyReply) => {
    const { entityId } = request.query as { entityId: string };

    if (!entityId) {
      return reply.status(400).send({
        success: false,
        error: 'entityId query parameter is required',
      });
    }

    try {
      const pool = await getPool();
      const connResult = await pool.query(`
        SELECT access_token, item_id, status FROM banking.bank_connections
        WHERE entity_id = $1 AND provider = 'plaid' AND status = 'connected'
        LIMIT 1
      `, [entityId]);

      if (connResult.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'No connected Plaid account found for this entity',
        });
      }

      const { access_token: accessToken, item_id: itemId } = connResult.rows[0];
      const accounts = await plaidService.getAccounts(accessToken);

      return reply.send({
        success: true,
        data: {
          itemId,
          accounts: accounts.map(acc => ({
            accountId: acc.accountId,
            mask: acc.mask,
            name: acc.name,
            officialName: acc.officialName,
            type: acc.type,
            subtype: acc.subtype,
            balances: acc.balances,
          })),
        },
      });
    } catch (error) {
      request.log.error(error, 'Failed to get accounts');
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve accounts',
      });
    }
  });

  /**
   * Get connection status for an entity
   * GET /api/v1/plaid/status
   */
  app.get('/plaid/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const { entityId } = request.query as { entityId: string };

    if (!entityId) {
      return reply.status(400).send({
        success: false,
        error: 'entityId query parameter is required',
      });
    }

    try {
      const pool = await getPool();
      const result = await pool.query(`
        SELECT id, item_id, status, error_message, created_at, updated_at
        FROM banking.bank_connections
        WHERE entity_id = $1 AND provider = 'plaid'
        ORDER BY updated_at DESC
        LIMIT 5
      `, [entityId]);

      return reply.send({
        success: true,
        data: {
          connections: result.rows.map(row => ({
            connectionId: row.id,
            itemId: row.item_id,
            status: row.status,
            errorMessage: row.error_message,
            createdAt: row.created_at,
            lastUpdated: row.updated_at,
          })),
        },
      });
    } catch (error) {
      request.log.error(error, 'Failed to get connection status');
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve connection status',
      });
    }
  });

  /**
   * Handle Plaid webhooks
   * POST /api/v1/plaid/webhook
   */
  app.post('/plaid/webhook', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const payload = webhookSchema.parse(request.body);

      await plaidService.handleWebhook(
        payload.webhook_type,
        payload.webhook_code,
        payload.item_id,
        payload
      );

      return reply.send({ received: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid webhook payload',
          details: error.errors,
        });
      }
      request.log.error(error, 'Failed to process webhook');
      return reply.status(500).send({
        success: false,
        error: 'Failed to process webhook',
      });
    }
  });

  /**
   * Disconnect a bank account
   * DELETE /api/v1/plaid/connections/:itemId
   */
  app.delete('/plaid/connections/:itemId', async (
    request: FastifyRequest<{ Params: { itemId: string } }>,
    reply: FastifyReply
  ) => {
    const { itemId } = request.params;

    try {
      const pool = await getPool();
      const result = await pool.query(`
        SELECT access_token FROM banking.bank_connections
        WHERE item_id = $1 AND provider = 'plaid'
      `, [itemId]);

      if (result.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Connection not found',
        });
      }

      const { access_token: accessToken } = result.rows[0];
      await plaidService.removeItem(accessToken, itemId);

      return reply.send({
        success: true,
        message: 'Bank connection removed successfully',
      });
    } catch (error) {
      request.log.error(error, 'Failed to remove connection');
      return reply.status(500).send({
        success: false,
        error: 'Failed to remove connection',
      });
    }
  });
}
