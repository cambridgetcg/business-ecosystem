import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { getPool } from '../../../infrastructure/database.js';
import { eventPublisher } from '../../../infrastructure/aws/event-publisher.js';
import { env } from '../../../env.js';
import type { PaymentMethod } from '../../../types/index.js';
import { ApprovalService } from '../../../services/approval/index.js';

const initiatePaymentSchema = z.object({
  transactionId: z.string().uuid(),
  amount: z.object({
    value: z.number().positive(),
    currency: z.string().length(3).toUpperCase(),
  }),
  method: z.enum(['bank_transfer', 'ach', 'wire', 'check', 'credit_card', 'debit_card']),
  sourceAccountId: z.string().uuid().optional(),
  destinationAccountId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),
  description: z.string().max(500).optional(),
});

const processPaymentSchema = z.object({
  action: z.enum(['approve', 'reject', 'cancel']),
  reason: z.string().max(500).optional(),
});

const approvalService = new ApprovalService();

export async function paymentRoutes(app: FastifyInstance): Promise<void> {

  // Initiate a new payment
  app.post('/payments', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = initiatePaymentSchema.parse(request.body);
    const pool = await getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const paymentId = randomUUID();
      const now = new Date();

      // Get entity ID for approval check (from source account or use a default entity)
      let entityId: string | undefined;
      if (body.sourceAccountId) {
        const accountResult = await client.query(
          'SELECT entity_id FROM banking.bank_accounts WHERE id = $1',
          [body.sourceAccountId]
        );
        entityId = accountResult.rows[0]?.entity_id;
      }

      // Check if approval is required for this payment
      const approvalCheck = await approvalService.checkApprovalRequired(
        body.amount.value,
        body.amount.currency,
        entityId || 'default',
        body.method
      );

      const initialStatus = approvalCheck.requiresApproval ? 'pending_approval' : 'pending';

      // Insert payment record with appropriate initial status
      await client.query(`
        INSERT INTO banking.payments (
          id, transaction_id, amount_value, amount_currency, method,
          invoice_id, status, created_at, updated_at, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9)
      `, [paymentId, body.transactionId, body.amount.value, body.amount.currency,
          body.method, body.invoiceId, initialStatus, now,
          JSON.stringify({ source_account_id: body.sourceAccountId })]);

      // Insert transaction record
      await client.query(`
        INSERT INTO banking.transactions (
          id, entity_id, type, status, amount_value, amount_currency,
          description, source_account_id, destination_account_id, created_at, updated_at
        ) VALUES ($1, $2, 'payment', $3, $4, $5, $6, $7, $8, $9, $9)
      `, [body.transactionId, entityId || randomUUID(), initialStatus, body.amount.value, body.amount.currency,
          body.description, body.sourceAccountId, body.destinationAccountId, now]);

      // Audit log
      await client.query(`
        INSERT INTO banking.audit_log (entity_type, entity_id, action, occurred_at, changes)
        VALUES ('Payment', $1, 'created', $2, $3)
      `, [paymentId, now, JSON.stringify({
        amount: body.amount,
        method: body.method,
        requiresApproval: approvalCheck.requiresApproval,
        matchedPolicy: approvalCheck.matchedPolicy?.name,
      })]);

      await client.query('COMMIT');

      // Create approval workflow if required (after commit to ensure payment exists)
      let approval = null;
      if (approvalCheck.requiresApproval && approvalCheck.matchedPolicy) {
        approval = await approvalService.createApproval(paymentId, approvalCheck.matchedPolicy);
      }

      // Publish event
      if (env.ENABLE_EVENT_PUBLISHING) {
        await eventPublisher.publish({
          type: approvalCheck.requiresApproval ? 'payment.pending_approval' : 'payment.initiated',
          aggregateId: paymentId,
          aggregateType: 'Payment',
          payload: {
            transactionId: body.transactionId,
            amount: body.amount,
            method: body.method,
            requiresApproval: approvalCheck.requiresApproval,
            approvalId: approval?.id,
          },
          occurredAt: now,
        });
      }

      return reply.status(201).send({
        id: paymentId,
        transactionId: body.transactionId,
        status: initialStatus,
        amount: body.amount,
        method: body.method,
        createdAt: now,
        approval: approval ? {
          id: approval.id,
          status: approval.status,
          currentLevel: approval.currentLevel,
          totalLevels: approval.totalLevels,
          expiresAt: approval.expiresAt,
          policyName: approvalCheck.matchedPolicy?.name,
        } : undefined,
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  // Get payment by ID
  app.get('/payments/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const pool = await getPool();
    
    const result = await pool.query(`
      SELECT id, transaction_id, amount_value, amount_currency, method, 
             status, invoice_id, paid_at, failure_reason, created_at, updated_at
      FROM banking.payments 
      WHERE id = $1 AND deleted_at IS NULL
    `, [id]);
    
    if (!result.rows.length) {
      return reply.status(404).send({ error: 'Payment not found' });
    }
    
    const row = result.rows[0];
    return reply.send({
      id: row.id,
      transactionId: row.transaction_id,
      amount: { value: parseFloat(row.amount_value), currency: row.amount_currency },
      method: row.method,
      status: row.status,
      invoiceId: row.invoice_id,
      paidAt: row.paid_at,
      failureReason: row.failure_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  });

  // List payments
  app.get('/payments', async (request: FastifyRequest, reply: FastifyReply) => {
    const { status, method, limit = '20', offset = '0' } = request.query as Record<string, string>;
    const pool = await getPool();
    
    let query = `
      SELECT id, transaction_id, amount_value, amount_currency, method,
             status, invoice_id, paid_at, created_at
      FROM banking.payments
      WHERE deleted_at IS NULL
    `;
    const params: unknown[] = [];
    let paramIndex = 1;
    
    if (status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(status);
    }
    if (method) {
      query += ` AND method = $${paramIndex++}`;
      params.push(method);
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await pool.query(query, params);
    
    return reply.send({
      data: result.rows.map(row => ({
        id: row.id,
        transactionId: row.transaction_id,
        amount: { value: parseFloat(row.amount_value), currency: row.amount_currency },
        method: row.method,
        status: row.status,
        invoiceId: row.invoice_id,
        paidAt: row.paid_at,
        createdAt: row.created_at,
      })),
      pagination: { limit: parseInt(limit), offset: parseInt(offset) },
    });
  });

  // Process payment (approve/reject/cancel)
  app.post('/payments/:id/process', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = processPaymentSchema.parse(request.body);
    const pool = await getPool();
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get current payment
      const current = await client.query(
        'SELECT status FROM banking.payments WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
        [id]
      );
      
      if (!current.rows.length) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Payment not found' });
      }
      
      const currentStatus = current.rows[0].status;
      let newStatus: string;
      let eventType: string;
      
      switch (body.action) {
        case 'approve':
          if (currentStatus !== 'pending' && currentStatus !== 'processing') {
            throw new Error(`Cannot approve payment with status: ${currentStatus}`);
          }
          newStatus = 'completed';
          eventType = 'payment.completed';
          break;
        case 'reject':
          if (currentStatus !== 'pending' && currentStatus !== 'processing') {
            throw new Error(`Cannot reject payment with status: ${currentStatus}`);
          }
          newStatus = 'failed';
          eventType = 'payment.failed';
          break;
        case 'cancel':
          if (currentStatus === 'completed' || currentStatus === 'cancelled') {
            throw new Error(`Cannot cancel payment with status: ${currentStatus}`);
          }
          newStatus = 'cancelled';
          eventType = 'payment.cancelled';
          break;
      }
      
      const now = new Date();
      await client.query(`
        UPDATE banking.payments 
        SET status = $1, 
            paid_at = CASE WHEN $1 = 'completed' THEN $2 ELSE paid_at END,
            failure_reason = $3,
            updated_at = $2
        WHERE id = $4
      `, [newStatus, now, body.reason, id]);
      
      // Audit log
      await client.query(`
        INSERT INTO banking.audit_log (entity_type, entity_id, action, occurred_at, changes)
        VALUES ('Payment', $1, $2, $3, $4)
      `, [id, body.action, now, JSON.stringify({ from: currentStatus, to: newStatus, reason: body.reason })]);
      
      await client.query('COMMIT');
      
      // Publish event
      if (env.ENABLE_EVENT_PUBLISHING) {
        await eventPublisher.publish({
          type: eventType,
          aggregateId: id,
          aggregateType: 'Payment',
          payload: { previousStatus: currentStatus, newStatus, reason: body.reason },
          occurredAt: now,
        });
      }
      
      return reply.send({ id, status: newStatus, processedAt: now });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });
}
