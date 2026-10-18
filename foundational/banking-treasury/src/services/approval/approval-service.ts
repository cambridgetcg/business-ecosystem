/**
 * Payment Approval Service
 *
 * Manages payment approval workflows including policy matching,
 * approval creation, and decision processing.
 *
 * @module services/approval/approval-service
 */

import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';
import { getPool } from '../../infrastructure/database.js';
import type {
  ApprovalPolicy,
  PaymentApproval,
  ApprovalDecision,
  CreateApprovalPolicyInput,
  ApprovalDecisionInput,
  ApprovalCheckResult,
  PendingApproval,
  ApprovalStatus,
} from './types.js';

const logger = pino({ name: 'approval-service' });

export class ApprovalService {
  /**
   * Check if a payment requires approval based on active policies.
   */
  async checkApprovalRequired(
    amount: number,
    currency: string,
    entityId: string,
    paymentMethod?: string
  ): Promise<ApprovalCheckResult> {
    const pool = await getPool();

    // Find matching policies ordered by priority (highest first)
    const result = await pool.query(`
      SELECT * FROM banking.approval_policies
      WHERE is_active = true
        AND min_amount <= $1
        AND (max_amount IS NULL OR max_amount >= $1)
        AND (currency IS NULL OR currency = $2)
        AND (entity_id IS NULL OR entity_id = $3)
        AND (payment_method IS NULL OR payment_method = $4)
      ORDER BY priority DESC, min_amount DESC
      LIMIT 1
    `, [amount, currency, entityId, paymentMethod]);

    if (result.rows.length === 0) {
      return {
        requiresApproval: false,
        reason: 'No matching approval policy found',
      };
    }

    const policy = this.mapPolicyRow(result.rows[0]);

    return {
      requiresApproval: true,
      matchedPolicy: policy,
      reason: `Matched policy: ${policy.name} (amount >= ${policy.minAmount})`,
    };
  }

  /**
   * Create an approval workflow for a payment.
   */
  async createApproval(
    paymentId: string,
    policy: ApprovalPolicy
  ): Promise<PaymentApproval> {
    const pool = await getPool();
    const id = uuidv4();

    // Calculate expiration based on first level timeout
    const firstLevelConfig = policy.approversPerLevel[0];
    const timeoutHours = firstLevelConfig?.timeoutHours || 48;
    const expiresAt = new Date(Date.now() + timeoutHours * 60 * 60 * 1000);

    await pool.query(`
      INSERT INTO banking.payment_approvals
        (id, payment_id, policy_id, current_level, total_levels, status, expires_at, created_at)
      VALUES ($1, $2, $3, 1, $4, 'pending', $5, NOW())
    `, [id, paymentId, policy.id, policy.requiredLevels, expiresAt]);

    // Update payment status to pending_approval
    await pool.query(`
      UPDATE banking.payments
      SET status = 'pending_approval', updated_at = NOW()
      WHERE id = $1
    `, [paymentId]);

    logger.info({ paymentId, approvalId: id, policyId: policy.id }, 'Created approval workflow');

    return {
      id,
      paymentId,
      policyId: policy.id,
      currentLevel: 1,
      totalLevels: policy.requiredLevels,
      status: 'pending',
      expiresAt,
      createdAt: new Date(),
      completedAt: undefined,
      decisions: [],
    };
  }

  /**
   * Process an approval decision.
   */
  async processDecision(input: ApprovalDecisionInput): Promise<PaymentApproval> {
    const pool = await getPool();

    // Get the approval with its policy
    const approvalResult = await pool.query(`
      SELECT pa.*, ap.approvers_per_level, ap.required_levels
      FROM banking.payment_approvals pa
      JOIN banking.approval_policies ap ON pa.policy_id = ap.id
      WHERE pa.id = $1
    `, [input.approvalId]);

    if (approvalResult.rows.length === 0) {
      throw new Error(`Approval not found: ${input.approvalId}`);
    }

    const approvalRow = approvalResult.rows[0];

    if (approvalRow.status !== 'pending') {
      throw new Error(`Approval is not pending: ${approvalRow.status}`);
    }

    if (approvalRow.expires_at && new Date(approvalRow.expires_at) < new Date()) {
      throw new Error('Approval has expired');
    }

    // Record the decision
    const decisionId = uuidv4();
    await pool.query(`
      INSERT INTO banking.approval_decisions
        (id, approval_id, level, approver_id, decision, reason, decided_at, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
    `, [
      decisionId,
      input.approvalId,
      approvalRow.current_level,
      input.approverId,
      input.decision,
      input.reason,
      JSON.stringify(input.metadata || {}),
    ]);

    logger.info({
      approvalId: input.approvalId,
      approverId: input.approverId,
      decision: input.decision,
      level: approvalRow.current_level,
    }, 'Recorded approval decision');

    // Handle rejection immediately
    if (input.decision === 'reject') {
      return this.rejectApproval(input.approvalId, approvalRow.payment_id);
    }

    // Check if current level is complete
    const levelComplete = await this.isLevelComplete(
      input.approvalId,
      approvalRow.current_level,
      approvalRow.approvers_per_level
    );

    if (levelComplete) {
      // Move to next level or complete
      if (approvalRow.current_level >= approvalRow.total_levels) {
        return this.completeApproval(input.approvalId, approvalRow.payment_id);
      } else {
        return this.advanceToNextLevel(input.approvalId, approvalRow);
      }
    }

    // Return current state
    return this.getApproval(input.approvalId);
  }

  /**
   * Check if a level has enough approvals.
   */
  private async isLevelComplete(
    approvalId: string,
    level: number,
    approversPerLevel: unknown[]
  ): Promise<boolean> {
    const pool = await getPool();

    const levelConfig = (approversPerLevel as { level: number; requiredCount: number }[])
      .find(c => c.level === level);
    const requiredCount = levelConfig?.requiredCount || 1;

    const result = await pool.query(`
      SELECT COUNT(*) as count
      FROM banking.approval_decisions
      WHERE approval_id = $1 AND level = $2 AND decision = 'approve'
    `, [approvalId, level]);

    return parseInt(result.rows[0].count, 10) >= requiredCount;
  }

  /**
   * Advance approval to next level.
   */
  private async advanceToNextLevel(
    approvalId: string,
    approvalRow: Record<string, unknown>
  ): Promise<PaymentApproval> {
    const pool = await getPool();
    const nextLevel = (approvalRow.current_level as number) + 1;

    // Calculate new expiration
    const levelConfig = (approvalRow.approvers_per_level as { level: number; timeoutHours?: number }[])
      .find(c => c.level === nextLevel);
    const timeoutHours = levelConfig?.timeoutHours || 48;
    const expiresAt = new Date(Date.now() + timeoutHours * 60 * 60 * 1000);

    await pool.query(`
      UPDATE banking.payment_approvals
      SET current_level = $2, expires_at = $3
      WHERE id = $1
    `, [approvalId, nextLevel, expiresAt]);

    logger.info({ approvalId, nextLevel }, 'Advanced to next approval level');

    return this.getApproval(approvalId);
  }

  /**
   * Complete an approval workflow.
   */
  private async completeApproval(
    approvalId: string,
    paymentId: string
  ): Promise<PaymentApproval> {
    const pool = await getPool();

    await pool.query(`
      UPDATE banking.payment_approvals
      SET status = 'approved', completed_at = NOW()
      WHERE id = $1
    `, [approvalId]);

    // Update payment to approved status
    await pool.query(`
      UPDATE banking.payments
      SET status = 'approved', updated_at = NOW()
      WHERE id = $1
    `, [paymentId]);

    logger.info({ approvalId, paymentId }, 'Approval workflow completed - payment approved');

    return this.getApproval(approvalId);
  }

  /**
   * Reject an approval workflow.
   */
  private async rejectApproval(
    approvalId: string,
    paymentId: string
  ): Promise<PaymentApproval> {
    const pool = await getPool();

    await pool.query(`
      UPDATE banking.payment_approvals
      SET status = 'rejected', completed_at = NOW()
      WHERE id = $1
    `, [approvalId]);

    // Update payment to rejected status
    await pool.query(`
      UPDATE banking.payments
      SET status = 'rejected', updated_at = NOW()
      WHERE id = $1
    `, [paymentId]);

    logger.info({ approvalId, paymentId }, 'Approval workflow rejected');

    return this.getApproval(approvalId);
  }

  /**
   * Get an approval by ID.
   */
  async getApproval(approvalId: string): Promise<PaymentApproval> {
    const pool = await getPool();

    const result = await pool.query(`
      SELECT * FROM banking.payment_approvals WHERE id = $1
    `, [approvalId]);

    if (result.rows.length === 0) {
      throw new Error(`Approval not found: ${approvalId}`);
    }

    const decisionsResult = await pool.query(`
      SELECT * FROM banking.approval_decisions
      WHERE approval_id = $1
      ORDER BY decided_at
    `, [approvalId]);

    return this.mapApprovalRow(result.rows[0], decisionsResult.rows);
  }

  /**
   * Get pending approvals for a user.
   */
  async getPendingApprovals(approverId?: string): Promise<PendingApproval[]> {
    const pool = await getPool();

    const result = await pool.query(`
      SELECT
        pa.*,
        p.id as payment_id,
        p.amount_value as payment_amount,
        p.amount_currency as payment_currency,
        p.method as payment_method,
        p.status as payment_status,
        ap.name as policy_name,
        ap.approvers_per_level
      FROM banking.payment_approvals pa
      JOIN banking.payments p ON pa.payment_id = p.id
      JOIN banking.approval_policies ap ON pa.policy_id = ap.id
      WHERE pa.status = 'pending'
        AND (pa.expires_at IS NULL OR pa.expires_at > NOW())
      ORDER BY pa.created_at
    `);

    const approvals: PendingApproval[] = [];

    for (const row of result.rows) {
      const decisionsResult = await pool.query(`
        SELECT * FROM banking.approval_decisions
        WHERE approval_id = $1 AND level = $2
      `, [row.id, row.current_level]);

      const levelConfig = (row.approvers_per_level as { level: number; requiredCount: number }[])
        .find(c => c.level === row.current_level);

      approvals.push({
        approval: this.mapApprovalRow(row, decisionsResult.rows),
        payment: {
          id: row.payment_id,
          amount: parseFloat(row.payment_amount),
          currency: row.payment_currency,
          method: row.payment_method,
          status: row.payment_status,
        },
        policy: {
          id: row.policy_id,
          name: row.policy_name,
        } as ApprovalPolicy,
        pendingAtLevel: row.current_level,
        decisionsAtCurrentLevel: decisionsResult.rows.map(this.mapDecisionRow),
        requiredApprovalsAtCurrentLevel: levelConfig?.requiredCount || 1,
      });
    }

    return approvals;
  }

  /**
   * Create an approval policy.
   */
  async createPolicy(input: CreateApprovalPolicyInput): Promise<ApprovalPolicy> {
    const pool = await getPool();
    const id = uuidv4();

    await pool.query(`
      INSERT INTO banking.approval_policies
        (id, name, entity_id, min_amount, max_amount, currency, payment_method,
         required_levels, approvers_per_level, priority, is_active, created_at, updated_at, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, NOW(), NOW(), $11)
    `, [
      id,
      input.name,
      input.entityId,
      input.minAmount,
      input.maxAmount,
      input.currency,
      input.paymentMethod,
      input.requiredLevels,
      JSON.stringify(input.approversPerLevel),
      input.priority || 0,
      input.createdBy,
    ]);

    logger.info({ policyId: id, name: input.name }, 'Created approval policy');

    return this.getPolicy(id);
  }

  /**
   * Get a policy by ID.
   */
  async getPolicy(policyId: string): Promise<ApprovalPolicy> {
    const pool = await getPool();

    const result = await pool.query(`
      SELECT * FROM banking.approval_policies WHERE id = $1
    `, [policyId]);

    if (result.rows.length === 0) {
      throw new Error(`Policy not found: ${policyId}`);
    }

    return this.mapPolicyRow(result.rows[0]);
  }

  /**
   * List all policies.
   */
  async listPolicies(activeOnly = true): Promise<ApprovalPolicy[]> {
    const pool = await getPool();

    const result = await pool.query(`
      SELECT * FROM banking.approval_policies
      WHERE ($1 = false OR is_active = true)
      ORDER BY priority DESC, name
    `, [activeOnly]);

    return result.rows.map(this.mapPolicyRow);
  }

  /**
   * Expire stale approvals.
   */
  async expireStaleApprovals(): Promise<number> {
    const pool = await getPool();

    const result = await pool.query(`
      UPDATE banking.payment_approvals
      SET status = 'expired', completed_at = NOW()
      WHERE status = 'pending' AND expires_at < NOW()
      RETURNING id, payment_id
    `);

    // Update associated payments
    for (const row of result.rows) {
      await pool.query(`
        UPDATE banking.payments
        SET status = 'approval_expired', updated_at = NOW()
        WHERE id = $1
      `, [row.payment_id]);
    }

    if (result.rowCount && result.rowCount > 0) {
      logger.info({ count: result.rowCount }, 'Expired stale approvals');
    }

    return result.rowCount || 0;
  }

  private mapPolicyRow(row: Record<string, unknown>): ApprovalPolicy {
    return {
      id: row.id as string,
      name: row.name as string,
      entityId: row.entity_id as string | undefined,
      minAmount: parseFloat(row.min_amount as string),
      maxAmount: row.max_amount ? parseFloat(row.max_amount as string) : undefined,
      currency: row.currency as string | undefined,
      paymentMethod: row.payment_method as string | undefined,
      requiredLevels: row.required_levels as number,
      approversPerLevel: row.approvers_per_level as { level: number; requiredCount: number }[],
      priority: row.priority as number,
      isActive: row.is_active as boolean,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
      createdBy: row.created_by as string | undefined,
    };
  }

  private mapApprovalRow(
    row: Record<string, unknown>,
    decisions: Record<string, unknown>[]
  ): PaymentApproval {
    return {
      id: row.id as string,
      paymentId: row.payment_id as string,
      policyId: row.policy_id as string,
      currentLevel: row.current_level as number,
      totalLevels: row.total_levels as number,
      status: row.status as ApprovalStatus,
      expiresAt: row.expires_at ? new Date(row.expires_at as string) : undefined,
      createdAt: new Date(row.created_at as string),
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
      decisions: decisions.map(this.mapDecisionRow),
    };
  }

  private mapDecisionRow(row: Record<string, unknown>): ApprovalDecision {
    return {
      id: row.id as string,
      approvalId: row.approval_id as string,
      level: row.level as number,
      approverId: row.approver_id as string,
      decision: row.decision as 'approve' | 'reject',
      reason: row.reason as string | undefined,
      decidedAt: new Date(row.decided_at as string),
      metadata: row.metadata as Record<string, unknown> | undefined,
    };
  }
}
