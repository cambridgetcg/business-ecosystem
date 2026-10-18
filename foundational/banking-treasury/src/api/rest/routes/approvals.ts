/**
 * Payment Approval API Routes
 *
 * Endpoints for managing payment approval workflows and policies.
 *
 * @module api/rest/routes/approvals
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ApprovalService } from '../../../services/approval/index.js';
import type {
  CreateApprovalPolicyInput,
  ApprovalDecisionInput,
} from '../../../services/approval/types.js';

const approvalService = new ApprovalService();

export async function approvalRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Get pending approvals
   * GET /api/v1/approvals/pending
   */
  app.get('/approvals/pending', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const pendingApprovals = await approvalService.getPendingApprovals();

      return reply.status(200).send({
        success: true,
        data: pendingApprovals,
        count: pendingApprovals.length,
      });
    } catch (error) {
      request.log.error(error, 'Failed to get pending approvals');
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve pending approvals',
      });
    }
  });

  /**
   * Get approval by ID
   * GET /api/v1/approvals/:id
   */
  app.get('/approvals/:id', async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { id } = request.params;
      const approval = await approvalService.getApproval(id);

      return reply.status(200).send({
        success: true,
        data: approval,
      });
    } catch (error) {
      if ((error as Error).message.includes('not found')) {
        return reply.status(404).send({
          success: false,
          error: 'Approval not found',
        });
      }
      request.log.error(error, 'Failed to get approval');
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve approval',
      });
    }
  });

  /**
   * Submit approval decision
   * POST /api/v1/approvals/:id/decide
   */
  app.post('/approvals/:id/decide', async (
    request: FastifyRequest<{
      Params: { id: string };
      Body: {
        approverId: string;
        decision: 'approve' | 'reject';
        reason?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { id } = request.params;
      const { approverId, decision, reason } = request.body;

      if (!approverId) {
        return reply.status(400).send({
          success: false,
          error: 'approverId is required',
        });
      }

      if (!decision || !['approve', 'reject'].includes(decision)) {
        return reply.status(400).send({
          success: false,
          error: 'decision must be either "approve" or "reject"',
        });
      }

      const input: ApprovalDecisionInput = {
        approvalId: id,
        approverId,
        decision,
        reason,
      };

      const approval = await approvalService.processDecision(input);

      return reply.status(200).send({
        success: true,
        data: approval,
        message: decision === 'approve'
          ? approval.status === 'approved'
            ? 'Payment approved and ready for processing'
            : 'Approval recorded, waiting for additional approvals'
          : 'Payment rejected',
      });
    } catch (error) {
      if ((error as Error).message.includes('not found')) {
        return reply.status(404).send({
          success: false,
          error: 'Approval not found',
        });
      }
      if ((error as Error).message.includes('not pending') ||
          (error as Error).message.includes('expired')) {
        return reply.status(400).send({
          success: false,
          error: (error as Error).message,
        });
      }
      request.log.error(error, 'Failed to process approval decision');
      return reply.status(500).send({
        success: false,
        error: 'Failed to process approval decision',
      });
    }
  });

  /**
   * List approval policies
   * GET /api/v1/approvals/policies
   */
  app.get('/approvals/policies', async (
    request: FastifyRequest<{ Querystring: { activeOnly?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const activeOnly = request.query.activeOnly !== 'false';
      const policies = await approvalService.listPolicies(activeOnly);

      return reply.status(200).send({
        success: true,
        data: policies,
        count: policies.length,
      });
    } catch (error) {
      request.log.error(error, 'Failed to list approval policies');
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve approval policies',
      });
    }
  });

  /**
   * Get approval policy by ID
   * GET /api/v1/approvals/policies/:id
   */
  app.get('/approvals/policies/:id', async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { id } = request.params;
      const policy = await approvalService.getPolicy(id);

      return reply.status(200).send({
        success: true,
        data: policy,
      });
    } catch (error) {
      if ((error as Error).message.includes('not found')) {
        return reply.status(404).send({
          success: false,
          error: 'Policy not found',
        });
      }
      request.log.error(error, 'Failed to get approval policy');
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve approval policy',
      });
    }
  });

  /**
   * Create approval policy
   * POST /api/v1/approvals/policies
   */
  app.post('/approvals/policies', async (
    request: FastifyRequest<{ Body: CreateApprovalPolicyInput }>,
    reply: FastifyReply
  ) => {
    try {
      const input = request.body;

      // Validate required fields
      if (!input.name) {
        return reply.status(400).send({
          success: false,
          error: 'name is required',
        });
      }

      if (input.minAmount === undefined || input.minAmount < 0) {
        return reply.status(400).send({
          success: false,
          error: 'minAmount must be a non-negative number',
        });
      }

      if (!input.requiredLevels || input.requiredLevels < 1) {
        return reply.status(400).send({
          success: false,
          error: 'requiredLevels must be at least 1',
        });
      }

      if (!input.approversPerLevel || input.approversPerLevel.length === 0) {
        return reply.status(400).send({
          success: false,
          error: 'approversPerLevel must have at least one level configuration',
        });
      }

      const policy = await approvalService.createPolicy(input);

      return reply.status(201).send({
        success: true,
        data: policy,
      });
    } catch (error) {
      request.log.error(error, 'Failed to create approval policy');
      return reply.status(500).send({
        success: false,
        error: 'Failed to create approval policy',
      });
    }
  });

  /**
   * Check if payment requires approval
   * POST /api/v1/approvals/check
   */
  app.post('/approvals/check', async (
    request: FastifyRequest<{
      Body: {
        amount: number;
        currency: string;
        entityId: string;
        paymentMethod?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { amount, currency, entityId, paymentMethod } = request.body;

      if (!amount || !currency || !entityId) {
        return reply.status(400).send({
          success: false,
          error: 'amount, currency, and entityId are required',
        });
      }

      const result = await approvalService.checkApprovalRequired(
        amount,
        currency,
        entityId,
        paymentMethod
      );

      return reply.status(200).send({
        success: true,
        data: result,
      });
    } catch (error) {
      request.log.error(error, 'Failed to check approval requirement');
      return reply.status(500).send({
        success: false,
        error: 'Failed to check approval requirement',
      });
    }
  });

  /**
   * Expire stale approvals (admin/scheduled task)
   * POST /api/v1/approvals/expire-stale
   */
  app.post('/approvals/expire-stale', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const expiredCount = await approvalService.expireStaleApprovals();

      return reply.status(200).send({
        success: true,
        data: { expiredCount },
        message: `Expired ${expiredCount} stale approval(s)`,
      });
    } catch (error) {
      request.log.error(error, 'Failed to expire stale approvals');
      return reply.status(500).send({
        success: false,
        error: 'Failed to expire stale approvals',
      });
    }
  });
}
