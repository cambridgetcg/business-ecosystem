/**
 * Payment Recall Service
 *
 * Handles payment recall requests, tracking, and resolution.
 *
 * @module services/payments/recall-service
 */

import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../../infrastructure/database.js';

const logger = pino({ name: 'payment-recall-service' });

/**
 * Recall request status.
 */
export type RecallStatus =
  | 'pending'
  | 'in_review'
  | 'accepted'
  | 'rejected'
  | 'completed'
  | 'expired';

/**
 * Recall reason.
 */
export type RecallReason =
  | 'duplicate_payment'
  | 'wrong_amount'
  | 'wrong_beneficiary'
  | 'fraudulent'
  | 'technical_error'
  | 'customer_request'
  | 'compliance'
  | 'other';

/**
 * Recall request.
 */
export interface RecallRequest {
  id: string;
  paymentId: string;
  status: RecallStatus;
  reason: RecallReason;
  reasonDetails: string;
  requestedBy: string;
  requestedAt: Date;
  originalAmount: number;
  originalCurrency: string;
  recalledAmount?: number;
  responseDeadline: Date;
  respondedAt?: Date;
  respondedBy?: string;
  responseNotes?: string;
  completedAt?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Recall response.
 */
export interface RecallResponse {
  recallId: string;
  decision: 'accept' | 'reject' | 'partial';
  reason?: string;
  partialAmount?: number;
  respondedBy: string;
}

/**
 * Payment Recall Service
 */
export class RecallService {
  private readonly DEFAULT_RESPONSE_HOURS = 72; // 3 days

  /**
   * Create a recall request for a payment.
   */
  async createRecallRequest(
    paymentId: string,
    request: {
      reason: RecallReason;
      reasonDetails: string;
      requestedBy: string;
      urgency?: 'normal' | 'urgent';
    }
  ): Promise<RecallRequest> {
    const pool = await getPool();

    // Get payment details
    const paymentResult = await pool.query(`
      SELECT id, amount_value, amount_currency, status, paid_at
      FROM banking.payments
      WHERE id = $1 AND deleted_at IS NULL
    `, [paymentId]);

    if (paymentResult.rows.length === 0) {
      throw new Error(`Payment not found: ${paymentId}`);
    }

    const payment = paymentResult.rows[0];

    // Validate payment can be recalled
    if (!['completed', 'processing'].includes(payment.status)) {
      throw new Error(`Payment cannot be recalled in status: ${payment.status}`);
    }

    // Check for existing pending recall
    const existingRecall = await pool.query(`
      SELECT id FROM banking.payment_recalls
      WHERE payment_id = $1 AND status IN ('pending', 'in_review')
    `, [paymentId]);

    if (existingRecall.rows.length > 0) {
      throw new Error('A recall request is already pending for this payment');
    }

    const recallId = uuidv4();
    const responseHours = request.urgency === 'urgent' ? 24 : this.DEFAULT_RESPONSE_HOURS;
    const responseDeadline = new Date(Date.now() + responseHours * 60 * 60 * 1000);

    await pool.query(`
      INSERT INTO banking.payment_recalls (
        id, payment_id, status, reason, reason_details, requested_by,
        original_amount, original_currency, response_deadline,
        created_at, updated_at
      ) VALUES ($1, $2, 'pending', $3, $4, $5, $6, $7, $8, NOW(), NOW())
    `, [
      recallId,
      paymentId,
      request.reason,
      request.reasonDetails,
      request.requestedBy,
      payment.amount_value,
      payment.amount_currency,
      responseDeadline,
    ]);

    // Update payment status
    await pool.query(`
      UPDATE banking.payments
      SET status = 'recall_pending',
          metadata = jsonb_set(COALESCE(metadata, '{}'), '{recall_id}', $1::jsonb),
          updated_at = NOW()
      WHERE id = $2
    `, [JSON.stringify(recallId), paymentId]);

    // Create audit log
    await pool.query(`
      INSERT INTO banking.audit_log (entity_type, entity_id, action, changes, occurred_at)
      VALUES ('Payment', $1, 'recall_requested', $2, NOW())
    `, [paymentId, JSON.stringify({
      recallId,
      reason: request.reason,
      requestedBy: request.requestedBy,
    })]);

    logger.info({
      recallId,
      paymentId,
      reason: request.reason,
      responseDeadline,
    }, 'Recall request created');

    return {
      id: recallId,
      paymentId,
      status: 'pending',
      reason: request.reason,
      reasonDetails: request.reasonDetails,
      requestedBy: request.requestedBy,
      requestedAt: new Date(),
      originalAmount: parseFloat(payment.amount_value),
      originalCurrency: payment.amount_currency,
      responseDeadline,
    };
  }

  /**
   * Respond to a recall request.
   */
  async respondToRecall(response: RecallResponse): Promise<RecallRequest> {
    const pool = await getPool();

    // Get recall details
    const recallResult = await pool.query(`
      SELECT * FROM banking.payment_recalls
      WHERE id = $1 AND status IN ('pending', 'in_review')
    `, [response.recallId]);

    if (recallResult.rows.length === 0) {
      throw new Error(`Recall request not found or already processed: ${response.recallId}`);
    }

    const recall = recallResult.rows[0];

    let newStatus: RecallStatus;
    let recalledAmount: number | undefined;

    switch (response.decision) {
      case 'accept':
        newStatus = 'accepted';
        recalledAmount = parseFloat(recall.original_amount);
        break;
      case 'partial':
        if (!response.partialAmount) {
          throw new Error('Partial amount required for partial acceptance');
        }
        newStatus = 'accepted';
        recalledAmount = response.partialAmount;
        break;
      case 'reject':
        newStatus = 'rejected';
        break;
    }

    // Update recall
    await pool.query(`
      UPDATE banking.payment_recalls
      SET status = $1,
          recalled_amount = $2,
          response_notes = $3,
          responded_by = $4,
          responded_at = NOW(),
          updated_at = NOW()
      WHERE id = $5
    `, [newStatus, recalledAmount, response.reason, response.respondedBy, response.recallId]);

    // Update payment status based on decision
    const paymentStatus = response.decision === 'reject' ? 'completed' : 'recalled';
    await pool.query(`
      UPDATE banking.payments
      SET status = $1, updated_at = NOW()
      WHERE id = $2
    `, [paymentStatus, recall.payment_id]);

    // Audit log
    await pool.query(`
      INSERT INTO banking.audit_log (entity_type, entity_id, action, changes, occurred_at)
      VALUES ('Payment', $1, $2, $3, NOW())
    `, [
      recall.payment_id,
      `recall_${response.decision}`,
      JSON.stringify({
        recallId: response.recallId,
        decision: response.decision,
        recalledAmount,
        respondedBy: response.respondedBy,
      }),
    ]);

    logger.info({
      recallId: response.recallId,
      paymentId: recall.payment_id,
      decision: response.decision,
      recalledAmount,
    }, 'Recall response recorded');

    return {
      id: response.recallId,
      paymentId: recall.payment_id,
      status: newStatus,
      reason: recall.reason,
      reasonDetails: recall.reason_details,
      requestedBy: recall.requested_by,
      requestedAt: new Date(recall.created_at),
      originalAmount: parseFloat(recall.original_amount),
      originalCurrency: recall.original_currency,
      recalledAmount,
      responseDeadline: new Date(recall.response_deadline),
      respondedAt: new Date(),
      respondedBy: response.respondedBy,
      responseNotes: response.reason,
    };
  }

  /**
   * Complete a recall (process the refund).
   */
  async completeRecall(
    recallId: string,
    completion: {
      completedBy: string;
      refundTransactionId?: string;
      notes?: string;
    }
  ): Promise<RecallRequest> {
    const pool = await getPool();

    const recallResult = await pool.query(`
      SELECT * FROM banking.payment_recalls
      WHERE id = $1 AND status = 'accepted'
    `, [recallId]);

    if (recallResult.rows.length === 0) {
      throw new Error(`Accepted recall not found: ${recallId}`);
    }

    const recall = recallResult.rows[0];

    // Update recall to completed
    await pool.query(`
      UPDATE banking.payment_recalls
      SET status = 'completed',
          completed_at = NOW(),
          metadata = jsonb_set(COALESCE(metadata, '{}'), '{refund_txn_id}', $1::jsonb),
          updated_at = NOW()
      WHERE id = $2
    `, [JSON.stringify(completion.refundTransactionId || null), recallId]);

    // Update payment to final status
    await pool.query(`
      UPDATE banking.payments
      SET status = 'recalled', updated_at = NOW()
      WHERE id = $1
    `, [recall.payment_id]);

    // Audit log
    await pool.query(`
      INSERT INTO banking.audit_log (entity_type, entity_id, action, changes, occurred_at)
      VALUES ('Payment', $1, 'recall_completed', $2, NOW())
    `, [recall.payment_id, JSON.stringify({
      recallId,
      completedBy: completion.completedBy,
      refundTransactionId: completion.refundTransactionId,
    })]);

    logger.info({
      recallId,
      paymentId: recall.payment_id,
      recalledAmount: recall.recalled_amount,
    }, 'Recall completed');

    return {
      id: recallId,
      paymentId: recall.payment_id,
      status: 'completed',
      reason: recall.reason,
      reasonDetails: recall.reason_details,
      requestedBy: recall.requested_by,
      requestedAt: new Date(recall.created_at),
      originalAmount: parseFloat(recall.original_amount),
      originalCurrency: recall.original_currency,
      recalledAmount: parseFloat(recall.recalled_amount),
      responseDeadline: new Date(recall.response_deadline),
      respondedAt: recall.responded_at ? new Date(recall.responded_at) : undefined,
      respondedBy: recall.responded_by,
      completedAt: new Date(),
    };
  }

  /**
   * Get recall request by ID.
   */
  async getRecall(recallId: string): Promise<RecallRequest | null> {
    const pool = await getPool();

    const result = await pool.query(`
      SELECT * FROM banking.payment_recalls WHERE id = $1
    `, [recallId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return this.mapRecallRow(row);
  }

  /**
   * Get recalls for a payment.
   */
  async getRecallsForPayment(paymentId: string): Promise<RecallRequest[]> {
    const pool = await getPool();

    const result = await pool.query(`
      SELECT * FROM banking.payment_recalls
      WHERE payment_id = $1
      ORDER BY created_at DESC
    `, [paymentId]);

    return result.rows.map(this.mapRecallRow);
  }

  /**
   * Get pending recalls (for processing queue).
   */
  async getPendingRecalls(
    options: {
      includeExpired?: boolean;
      limit?: number;
    } = {}
  ): Promise<RecallRequest[]> {
    const pool = await getPool();

    let query = `
      SELECT * FROM banking.payment_recalls
      WHERE status IN ('pending', 'in_review')
    `;

    if (!options.includeExpired) {
      query += ' AND response_deadline > NOW()';
    }

    query += ' ORDER BY response_deadline ASC';

    if (options.limit) {
      query += ` LIMIT ${options.limit}`;
    }

    const result = await pool.query(query);
    return result.rows.map(this.mapRecallRow);
  }

  /**
   * Expire overdue recalls.
   */
  async expireOverdueRecalls(): Promise<number> {
    const pool = await getPool();

    const result = await pool.query(`
      UPDATE banking.payment_recalls
      SET status = 'expired', updated_at = NOW()
      WHERE status IN ('pending', 'in_review')
        AND response_deadline < NOW()
      RETURNING id, payment_id
    `);

    // Update corresponding payments
    for (const row of result.rows) {
      await pool.query(`
        UPDATE banking.payments
        SET status = 'completed',
            metadata = jsonb_set(COALESCE(metadata, '{}'), '{recall_expired}', 'true'),
            updated_at = NOW()
        WHERE id = $1 AND status = 'recall_pending'
      `, [row.payment_id]);
    }

    if (result.rowCount && result.rowCount > 0) {
      logger.info({ count: result.rowCount }, 'Expired overdue recall requests');
    }

    return result.rowCount || 0;
  }

  private mapRecallRow(row: Record<string, unknown>): RecallRequest {
    return {
      id: row.id as string,
      paymentId: row.payment_id as string,
      status: row.status as RecallStatus,
      reason: row.reason as RecallReason,
      reasonDetails: row.reason_details as string,
      requestedBy: row.requested_by as string,
      requestedAt: new Date(row.created_at as string),
      originalAmount: parseFloat(row.original_amount as string),
      originalCurrency: row.original_currency as string,
      recalledAmount: row.recalled_amount ? parseFloat(row.recalled_amount as string) : undefined,
      responseDeadline: new Date(row.response_deadline as string),
      respondedAt: row.responded_at ? new Date(row.responded_at as string) : undefined,
      respondedBy: row.responded_by as string | undefined,
      responseNotes: row.response_notes as string | undefined,
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
      metadata: row.metadata as Record<string, unknown> | undefined,
    };
  }
}

// Singleton instance
export const recallService = new RecallService();
