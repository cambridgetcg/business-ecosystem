/**
 * Enforcement Routes
 *
 * REST API endpoints for enforcement matter management.
 *
 * @module api/rest/routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { EnforcementMatter, type CreateEnforcementMatterInput } from '../../../domain/entities/enforcement-matter.entity.js';

// ============================================================================
// Schemas
// ============================================================================

const enforcementTypeSchema = z.enum([
  'infringement', 'misappropriation', 'counterfeiting', 'cybersquatting',
  'unfair_competition', 'breach_of_license', 'other'
]);

const enforcementStatusSchema = z.enum([
  'monitoring', 'investigation', 'cease_and_desist', 'negotiation',
  'litigation', 'settled', 'resolved', 'abandoned'
]);

const enforcementPrioritySchema = z.enum(['low', 'medium', 'high', 'critical']);

const ipAssetTypeSchema = z.enum(['patent', 'trademark', 'copyright', 'trade_secret']);

const actionTypeSchema = z.enum([
  'cease_and_desist', 'dmca_takedown', 'customs_recordation', 'court_filing',
  'motion', 'discovery', 'settlement_offer', 'judgment', 'appeal',
  'monitoring_alert', 'investigation', 'negotiation', 'other'
]);

const partyRoleSchema = z.enum([
  'infringer', 'defendant', 'plaintiff', 'respondent', 'petitioner',
  'internal_counsel', 'external_counsel', 'investigator', 'expert_witness'
]);

const createMatterSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  type: enforcementTypeSchema,
  priority: enforcementPrioritySchema.optional(),
  ipAssetType: ipAssetTypeSchema,
  ipAssetId: z.string().uuid(),
  jurisdiction: z.string().min(1).max(100),
  venue: z.string().optional(),
  detectedDate: z.string().datetime().or(z.date()),
  estimatedDamages: z.number().int().optional(),
  assignedTo: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
});

const updateMatterSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  venue: z.string().optional(),
  matterNumber: z.string().optional(),
  priority: enforcementPrioritySchema.optional(),
  assignedTo: z.string().uuid().optional(),
});

const addActionSchema = z.object({
  actionType: actionTypeSchema,
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  scheduledDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  filingNumber: z.string().optional(),
  courtName: z.string().optional(),
  notes: z.string().optional(),
});

const addPartySchema = z.object({
  role: partyRoleSchema,
  name: z.string().min(1).max(255),
  organization: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  barNumber: z.string().optional(),
  firmName: z.string().optional(),
  internalContactId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

const fileLitigationSchema = z.object({
  caseNumber: z.string().min(1),
  venue: z.string().min(1),
});

const settleSchema = z.object({
  settlementAmount: z.number().int().min(0),
  outcome: z.string().min(1),
  notes: z.string().optional(),
});

const resolveSchema = z.object({
  outcome: z.string().min(1),
  notes: z.string().optional(),
});

const searchSchema = z.object({
  status: z.union([enforcementStatusSchema, z.array(enforcementStatusSchema)]).optional(),
  priority: z.union([enforcementPrioritySchema, z.array(enforcementPrioritySchema)]).optional(),
  type: z.union([enforcementTypeSchema, z.array(enforcementTypeSchema)]).optional(),
  ipAssetType: ipAssetTypeSchema.optional(),
  ipAssetId: z.string().uuid().optional(),
  jurisdiction: z.string().optional(),
  assignedTo: z.string().uuid().optional(),
  searchTerm: z.string().optional(),
  detectedAfter: z.string().datetime().optional(),
  detectedBefore: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

// ============================================================================
// Route Handler
// ============================================================================

export async function enforcementRoutes(fastify: FastifyInstance): Promise<void> {
  // In-memory store for demo (replace with repository injection)
  const matters = new Map<string, EnforcementMatter>();

  /**
   * Create enforcement matter.
   */
  fastify.post<{ Body: z.infer<typeof createMatterSchema> }>(
    '/',
    {
      schema: {
        tags: ['enforcement'],
        summary: 'Create enforcement matter',
        body: createMatterSchema,
      },
    },
    async (request, reply) => {
      const input = createMatterSchema.parse(request.body);

      const createInput: CreateEnforcementMatterInput = {
        ...input,
        detectedDate: new Date(input.detectedDate),
      };

      const matter = EnforcementMatter.create(createInput);
      matters.set(matter.id, matter);

      return reply.status(201).send({
        id: matter.id,
        title: matter.title,
        status: matter.status,
        priority: matter.priority,
      });
    }
  );

  /**
   * Get enforcement matter by ID.
   */
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    {
      schema: {
        tags: ['enforcement'],
        summary: 'Get enforcement matter by ID',
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const matter = matters.get(request.params.id);

      if (!matter) {
        return reply.status(404).send({ error: 'Matter not found' });
      }

      return reply.send(matter.toPersistence());
    }
  );

  /**
   * List enforcement matters.
   */
  fastify.get<{ Querystring: z.infer<typeof searchSchema> }>(
    '/',
    {
      schema: {
        tags: ['enforcement'],
        summary: 'List enforcement matters',
        querystring: searchSchema,
      },
    },
    async (request, reply) => {
      const filters = searchSchema.parse(request.query);
      let results = Array.from(matters.values());

      // Apply filters
      if (filters.status) {
        const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
        results = results.filter(m => statuses.includes(m.status));
      }

      if (filters.priority) {
        const priorities = Array.isArray(filters.priority) ? filters.priority : [filters.priority];
        results = results.filter(m => priorities.includes(m.priority));
      }

      if (filters.type) {
        const types = Array.isArray(filters.type) ? filters.type : [filters.type];
        results = results.filter(m => types.includes(m.type));
      }

      if (filters.ipAssetType) {
        results = results.filter(m => m.ipAssetType === filters.ipAssetType);
      }

      if (filters.ipAssetId) {
        results = results.filter(m => m.ipAssetId === filters.ipAssetId);
      }

      if (filters.assignedTo) {
        results = results.filter(m => m.assignedTo === filters.assignedTo);
      }

      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        results = results.filter(m => m.title.toLowerCase().includes(term));
      }

      // Pagination
      const total = results.length;
      const limit = filters.limit ?? 50;
      const offset = filters.offset ?? 0;
      results = results.slice(offset, offset + limit);

      return reply.send({
        data: results.map(m => ({
          id: m.id,
          matterNumber: m.matterNumber,
          title: m.title,
          type: m.type,
          status: m.status,
          priority: m.priority,
          ipAssetType: m.ipAssetType,
          ipAssetId: m.ipAssetId,
          jurisdiction: m.jurisdiction,
          detectedDate: m.detectedDate,
          isOpen: m.isOpen,
        })),
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      });
    }
  );

  /**
   * Update enforcement matter.
   */
  fastify.patch<{ Params: { id: string }; Body: z.infer<typeof updateMatterSchema> }>(
    '/:id',
    {
      schema: {
        tags: ['enforcement'],
        summary: 'Update enforcement matter',
        params: z.object({ id: z.string().uuid() }),
        body: updateMatterSchema,
      },
    },
    async (request, reply) => {
      const matter = matters.get(request.params.id);

      if (!matter) {
        return reply.status(404).send({ error: 'Matter not found' });
      }

      const updates = updateMatterSchema.parse(request.body);

      if (updates.priority) {
        matter.setPriority(updates.priority);
      }

      if (updates.assignedTo) {
        matter.assignTo(updates.assignedTo);
      }

      matter.update({
        title: updates.title,
        description: updates.description,
        venue: updates.venue,
        matterNumber: updates.matterNumber,
      });

      return reply.send({ success: true });
    }
  );

  /**
   * Start investigation.
   */
  fastify.post<{ Params: { id: string }; Body: { assignedTo?: string } }>(
    '/:id/investigate',
    {
      schema: {
        tags: ['enforcement'],
        summary: 'Start investigation',
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const matter = matters.get(request.params.id);

      if (!matter) {
        return reply.status(404).send({ error: 'Matter not found' });
      }

      try {
        matter.startInvestigation(request.body.assignedTo);
        return reply.send({ status: matter.status });
      } catch (error) {
        return reply.status(400).send({
          error: error instanceof Error ? error.message : 'Invalid transition',
        });
      }
    }
  );

  /**
   * Send cease and desist.
   */
  fastify.post<{ Params: { id: string } }>(
    '/:id/cease-and-desist',
    {
      schema: {
        tags: ['enforcement'],
        summary: 'Send cease and desist',
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const matter = matters.get(request.params.id);

      if (!matter) {
        return reply.status(404).send({ error: 'Matter not found' });
      }

      try {
        matter.sendCeaseAndDesist();
        return reply.send({ status: matter.status });
      } catch (error) {
        return reply.status(400).send({
          error: error instanceof Error ? error.message : 'Invalid transition',
        });
      }
    }
  );

  /**
   * File litigation.
   */
  fastify.post<{ Params: { id: string }; Body: z.infer<typeof fileLitigationSchema> }>(
    '/:id/litigate',
    {
      schema: {
        tags: ['enforcement'],
        summary: 'File litigation',
        params: z.object({ id: z.string().uuid() }),
        body: fileLitigationSchema,
      },
    },
    async (request, reply) => {
      const matter = matters.get(request.params.id);

      if (!matter) {
        return reply.status(404).send({ error: 'Matter not found' });
      }

      const { caseNumber, venue } = fileLitigationSchema.parse(request.body);

      try {
        matter.fileLitigation(caseNumber, venue);
        return reply.send({
          status: matter.status,
          caseNumber: matter.caseNumber,
          venue: matter.venue,
        });
      } catch (error) {
        return reply.status(400).send({
          error: error instanceof Error ? error.message : 'Invalid transition',
        });
      }
    }
  );

  /**
   * Settle matter.
   */
  fastify.post<{ Params: { id: string }; Body: z.infer<typeof settleSchema> }>(
    '/:id/settle',
    {
      schema: {
        tags: ['enforcement'],
        summary: 'Settle matter',
        params: z.object({ id: z.string().uuid() }),
        body: settleSchema,
      },
    },
    async (request, reply) => {
      const matter = matters.get(request.params.id);

      if (!matter) {
        return reply.status(404).send({ error: 'Matter not found' });
      }

      const { settlementAmount, outcome, notes } = settleSchema.parse(request.body);

      try {
        matter.settle(settlementAmount, outcome, notes);
        return reply.send({
          status: matter.status,
          settlementAmount: matter.settlementAmount,
          outcome: matter.outcome,
        });
      } catch (error) {
        return reply.status(400).send({
          error: error instanceof Error ? error.message : 'Invalid transition',
        });
      }
    }
  );

  /**
   * Resolve matter.
   */
  fastify.post<{ Params: { id: string }; Body: z.infer<typeof resolveSchema> }>(
    '/:id/resolve',
    {
      schema: {
        tags: ['enforcement'],
        summary: 'Resolve matter',
        params: z.object({ id: z.string().uuid() }),
        body: resolveSchema,
      },
    },
    async (request, reply) => {
      const matter = matters.get(request.params.id);

      if (!matter) {
        return reply.status(404).send({ error: 'Matter not found' });
      }

      const { outcome, notes } = resolveSchema.parse(request.body);

      try {
        matter.resolve(outcome, notes);
        return reply.send({
          status: matter.status,
          outcome: matter.outcome,
        });
      } catch (error) {
        return reply.status(400).send({
          error: error instanceof Error ? error.message : 'Invalid transition',
        });
      }
    }
  );

  // ============================================================================
  // Actions
  // ============================================================================

  /**
   * Add action to matter.
   */
  fastify.post<{ Params: { id: string }; Body: z.infer<typeof addActionSchema> }>(
    '/:id/actions',
    {
      schema: {
        tags: ['enforcement'],
        summary: 'Add action to matter',
        params: z.object({ id: z.string().uuid() }),
        body: addActionSchema,
      },
    },
    async (request, reply) => {
      const matter = matters.get(request.params.id);

      if (!matter) {
        return reply.status(404).send({ error: 'Matter not found' });
      }

      const input = addActionSchema.parse(request.body);

      const action = matter.addAction({
        actionType: input.actionType,
        status: 'pending',
        title: input.title,
        description: input.description,
        scheduledDate: input.scheduledDate ? new Date(input.scheduledDate) : undefined,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        filingNumber: input.filingNumber,
        courtName: input.courtName,
        notes: input.notes,
      });

      return reply.status(201).send({
        id: action.id,
        actionType: action.actionType,
        title: action.title,
        status: action.status,
      });
    }
  );

  /**
   * Get matter actions.
   */
  fastify.get<{ Params: { id: string } }>(
    '/:id/actions',
    {
      schema: {
        tags: ['enforcement'],
        summary: 'Get matter actions',
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const matter = matters.get(request.params.id);

      if (!matter) {
        return reply.status(404).send({ error: 'Matter not found' });
      }

      return reply.send({ actions: matter.actions });
    }
  );

  /**
   * Update action status.
   */
  fastify.patch<{
    Params: { id: string; actionId: string };
    Body: { status: string; completedDate?: string };
  }>(
    '/:id/actions/:actionId/status',
    {
      schema: {
        tags: ['enforcement'],
        summary: 'Update action status',
        params: z.object({
          id: z.string().uuid(),
          actionId: z.string().uuid(),
        }),
      },
    },
    async (request, reply) => {
      const matter = matters.get(request.params.id);

      if (!matter) {
        return reply.status(404).send({ error: 'Matter not found' });
      }

      const { status, completedDate } = request.body;

      try {
        matter.updateActionStatus(
          request.params.actionId,
          status as 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'failed',
          completedDate ? new Date(completedDate) : undefined
        );
        return reply.send({ success: true });
      } catch (error) {
        return reply.status(400).send({
          error: error instanceof Error ? error.message : 'Invalid action',
        });
      }
    }
  );

  // ============================================================================
  // Parties
  // ============================================================================

  /**
   * Add party to matter.
   */
  fastify.post<{ Params: { id: string }; Body: z.infer<typeof addPartySchema> }>(
    '/:id/parties',
    {
      schema: {
        tags: ['enforcement'],
        summary: 'Add party to matter',
        params: z.object({ id: z.string().uuid() }),
        body: addPartySchema,
      },
    },
    async (request, reply) => {
      const matter = matters.get(request.params.id);

      if (!matter) {
        return reply.status(404).send({ error: 'Matter not found' });
      }

      const input = addPartySchema.parse(request.body);
      const party = matter.addParty(input);

      return reply.status(201).send({
        id: party.id,
        role: party.role,
        name: party.name,
      });
    }
  );

  /**
   * Get matter parties.
   */
  fastify.get<{ Params: { id: string } }>(
    '/:id/parties',
    {
      schema: {
        tags: ['enforcement'],
        summary: 'Get matter parties',
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const matter = matters.get(request.params.id);

      if (!matter) {
        return reply.status(404).send({ error: 'Matter not found' });
      }

      return reply.send({ parties: matter.parties });
    }
  );

  /**
   * Remove party from matter.
   */
  fastify.delete<{ Params: { id: string; partyId: string } }>(
    '/:id/parties/:partyId',
    {
      schema: {
        tags: ['enforcement'],
        summary: 'Remove party from matter',
        params: z.object({
          id: z.string().uuid(),
          partyId: z.string().uuid(),
        }),
      },
    },
    async (request, reply) => {
      const matter = matters.get(request.params.id);

      if (!matter) {
        return reply.status(404).send({ error: 'Matter not found' });
      }

      try {
        matter.removeParty(request.params.partyId);
        return reply.send({ success: true });
      } catch (error) {
        return reply.status(400).send({
          error: error instanceof Error ? error.message : 'Invalid party',
        });
      }
    }
  );

  // ============================================================================
  // Dashboard / Analytics
  // ============================================================================

  /**
   * Get enforcement summary.
   */
  fastify.get(
    '/summary',
    {
      schema: {
        tags: ['enforcement'],
        summary: 'Get enforcement summary',
      },
    },
    async (request, reply) => {
      const allMatters = Array.from(matters.values());

      const summary = {
        total: allMatters.length,
        open: allMatters.filter(m => m.isOpen).length,
        inLitigation: allMatters.filter(m => m.isInLitigation).length,
        byStatus: {} as Record<string, number>,
        byPriority: {} as Record<string, number>,
        byType: {} as Record<string, number>,
        totalEstimatedDamages: 0,
        totalActualCosts: 0,
        totalSettlements: 0,
      };

      for (const matter of allMatters) {
        summary.byStatus[matter.status] = (summary.byStatus[matter.status] ?? 0) + 1;
        summary.byPriority[matter.priority] = (summary.byPriority[matter.priority] ?? 0) + 1;
        summary.byType[matter.type] = (summary.byType[matter.type] ?? 0) + 1;

        if (matter.estimatedDamages) {
          summary.totalEstimatedDamages += matter.estimatedDamages;
        }
        if (matter.actualCosts) {
          summary.totalActualCosts += matter.actualCosts;
        }
        if (matter.settlementAmount) {
          summary.totalSettlements += matter.settlementAmount;
        }
      }

      return reply.send(summary);
    }
  );
}
