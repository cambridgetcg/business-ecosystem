/**
 * Enforcement Routes API Tests
 *
 * Integration tests for the enforcement REST API endpoints.
 * Uses supertest for HTTP testing with a mocked Fastify app.
 *
 * @module test/api
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import Fastify, { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { z, ZodError } from 'zod';
import { randomUUID } from 'crypto';
import { EnforcementMatter, type CreateEnforcementMatterInput } from '../../src/domain/entities/enforcement-matter.entity.js';

// ============================================================================
// Zod Schemas (duplicated from routes for test validation)
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
// Test Routes Implementation
// ============================================================================

/**
 * Test-friendly enforcement routes.
 * Uses the same logic as production but without relying on Fastify's schema validation.
 */
async function testEnforcementRoutes(fastify: FastifyInstance): Promise<void> {
  const matters = new Map<string, EnforcementMatter>();

  // Error handler for Zod validation errors
  fastify.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        message: 'Validation error',
        errors: error.errors,
      });
    }
    return reply.status(500).send({ error: error.message });
  });

  // POST / - Create enforcement matter
  fastify.post('/', async (request, reply) => {
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
  });

  // GET /:id - Get matter by ID
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const idSchema = z.string().uuid();
    const id = idSchema.parse(request.params.id);
    const matter = matters.get(id);
    if (!matter) {
      return reply.status(404).send({ error: 'Matter not found' });
    }
    return reply.send(matter.toPersistence());
  });

  // GET / - List matters
  fastify.get('/', async (request, reply) => {
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
  });

  // POST /:id/investigate - Start investigation
  fastify.post<{ Params: { id: string }; Body: { assignedTo?: string } }>(
    '/:id/investigate',
    async (request, reply) => {
      const idSchema = z.string().uuid();
      const id = idSchema.parse(request.params.id);
      const matter = matters.get(id);
      if (!matter) {
        return reply.status(404).send({ error: 'Matter not found' });
      }
      try {
        matter.startInvestigation((request.body as { assignedTo?: string })?.assignedTo);
        return reply.send({ status: matter.status });
      } catch (error) {
        return reply.status(400).send({
          error: error instanceof Error ? error.message : 'Invalid transition',
        });
      }
    }
  );

  // POST /:id/cease-and-desist - Send C&D
  fastify.post<{ Params: { id: string } }>('/:id/cease-and-desist', async (request, reply) => {
    const idSchema = z.string().uuid();
    const id = idSchema.parse(request.params.id);
    const matter = matters.get(id);
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
  });

  // POST /:id/actions - Add action
  fastify.post<{ Params: { id: string } }>('/:id/actions', async (request, reply) => {
    const idSchema = z.string().uuid();
    const id = idSchema.parse(request.params.id);
    const matter = matters.get(id);
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
  });

  // GET /:id/actions - Get actions
  fastify.get<{ Params: { id: string } }>('/:id/actions', async (request, reply) => {
    const idSchema = z.string().uuid();
    const id = idSchema.parse(request.params.id);
    const matter = matters.get(id);
    if (!matter) {
      return reply.status(404).send({ error: 'Matter not found' });
    }
    return reply.send({ actions: matter.actions });
  });

  // POST /:id/parties - Add party
  fastify.post<{ Params: { id: string } }>('/:id/parties', async (request, reply) => {
    const idSchema = z.string().uuid();
    const id = idSchema.parse(request.params.id);
    const matter = matters.get(id);
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
  });

  // GET /:id/parties - Get parties
  fastify.get<{ Params: { id: string } }>('/:id/parties', async (request, reply) => {
    const idSchema = z.string().uuid();
    const id = idSchema.parse(request.params.id);
    const matter = matters.get(id);
    if (!matter) {
      return reply.status(404).send({ error: 'Matter not found' });
    }
    return reply.send({ parties: matter.parties });
  });

  // GET /summary - Get summary
  fastify.get('/summary', async (request, reply) => {
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
  });
}

/**
 * Build a test app instance with enforcement routes.
 * This creates a minimal Fastify instance without requiring database connection.
 */
async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
  });

  // Register test-friendly enforcement routes
  await app.register(testEnforcementRoutes, { prefix: '/api/v1/enforcement' });

  await app.ready();
  return app;
}

describe('Enforcement Routes API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  // ==========================================================================
  // Test Data Helpers
  // ==========================================================================

  const validMatterInput = {
    title: 'Patent Infringement - Widget Co',
    description: 'Suspected infringement of Patent US12345678',
    type: 'infringement',
    priority: 'high',
    ipAssetType: 'patent',
    ipAssetId: randomUUID(),
    jurisdiction: 'US',
    venue: 'N.D. California',
    detectedDate: new Date().toISOString(),
    estimatedDamages: 1000000,
    tags: ['urgent', 'tech'],
  };

  const validActionInput = {
    actionType: 'cease_and_desist',
    title: 'Initial C&D Letter',
    description: 'First cease and desist letter to Widget Co',
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  };

  const validPartyInput = {
    role: 'infringer',
    name: 'Widget Co Inc.',
    organization: 'Widget Co',
    contactEmail: 'legal@widgetco.com',
  };

  // ==========================================================================
  // POST /api/v1/enforcement - Create Enforcement Matter
  // ==========================================================================

  describe('POST /api/v1/enforcement - Create Enforcement Matter', () => {
    it('should create a new enforcement matter with valid input', async () => {
      const response = await request(app.server)
        .post('/api/v1/enforcement')
        .send(validMatterInput)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe(validMatterInput.title);
      expect(response.body.status).toBe('monitoring');
      expect(response.body.priority).toBe('high');
    });

    it('should create matter with default priority when not specified', async () => {
      const input = {
        title: 'Test Matter',
        type: 'infringement',
        ipAssetType: 'trademark',
        ipAssetId: randomUUID(),
        jurisdiction: 'UK',
        detectedDate: new Date().toISOString(),
      };

      const response = await request(app.server)
        .post('/api/v1/enforcement')
        .send(input)
        .expect(201);

      expect(response.body.priority).toBe('medium');
    });

    it('should return 400 for missing required fields', async () => {
      const invalidInput = {
        title: 'Test Matter',
        // Missing type, ipAssetType, ipAssetId, jurisdiction, detectedDate
      };

      const response = await request(app.server)
        .post('/api/v1/enforcement')
        .send(invalidInput)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 400 for invalid enforcement type', async () => {
      const invalidInput = {
        ...validMatterInput,
        type: 'invalid_type',
      };

      const response = await request(app.server)
        .post('/api/v1/enforcement')
        .send(invalidInput)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 400 for invalid UUID in ipAssetId', async () => {
      const invalidInput = {
        ...validMatterInput,
        ipAssetId: 'not-a-uuid',
      };

      const response = await request(app.server)
        .post('/api/v1/enforcement')
        .send(invalidInput)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 400 for empty title', async () => {
      const invalidInput = {
        ...validMatterInput,
        title: '',
      };

      const response = await request(app.server)
        .post('/api/v1/enforcement')
        .send(invalidInput)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 400 for invalid date format', async () => {
      const invalidInput = {
        ...validMatterInput,
        detectedDate: 'invalid-date',
      };

      const response = await request(app.server)
        .post('/api/v1/enforcement')
        .send(invalidInput)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should accept all valid enforcement types', async () => {
      const types = [
        'infringement',
        'misappropriation',
        'counterfeiting',
        'cybersquatting',
        'unfair_competition',
        'breach_of_license',
        'other',
      ];

      for (const type of types) {
        const response = await request(app.server)
          .post('/api/v1/enforcement')
          .send({ ...validMatterInput, type, ipAssetId: randomUUID() })
          .expect(201);

        expect(response.body).toHaveProperty('id');
      }
    });

    it('should accept all valid priority levels', async () => {
      const priorities = ['low', 'medium', 'high', 'critical'];

      for (const priority of priorities) {
        const response = await request(app.server)
          .post('/api/v1/enforcement')
          .send({ ...validMatterInput, priority, ipAssetId: randomUUID() })
          .expect(201);

        expect(response.body.priority).toBe(priority);
      }
    });
  });

  // ==========================================================================
  // GET /api/v1/enforcement/:id - Get Matter by ID
  // ==========================================================================

  describe('GET /api/v1/enforcement/:id - Get Matter by ID', () => {
    it('should return a matter by ID', async () => {
      // First create a matter
      const createResponse = await request(app.server)
        .post('/api/v1/enforcement')
        .send(validMatterInput)
        .expect(201);

      const matterId = createResponse.body.id;

      // Then retrieve it
      const response = await request(app.server)
        .get(`/api/v1/enforcement/${matterId}`)
        .expect(200);

      expect(response.body.id).toBe(matterId);
      expect(response.body.title).toBe(validMatterInput.title);
      expect(response.body.type).toBe(validMatterInput.type);
      expect(response.body.status).toBe('monitoring');
    });

    it('should return 404 for non-existent matter', async () => {
      const nonExistentId = randomUUID();

      const response = await request(app.server)
        .get(`/api/v1/enforcement/${nonExistentId}`)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Matter not found');
    });

    it('should return 400 for invalid UUID format', async () => {
      const response = await request(app.server)
        .get('/api/v1/enforcement/invalid-uuid')
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });

  // ==========================================================================
  // GET /api/v1/enforcement - List Matters with Filters
  // ==========================================================================

  describe('GET /api/v1/enforcement - List Matters with Filters', () => {
    // Create test matters first
    let createdMatterIds: string[] = [];

    beforeAll(async () => {
      // Create matters with different statuses and priorities
      const matters = [
        { ...validMatterInput, title: 'Matter 1', priority: 'high', ipAssetId: randomUUID() },
        { ...validMatterInput, title: 'Matter 2', priority: 'low', ipAssetId: randomUUID() },
        { ...validMatterInput, title: 'Matter 3', type: 'counterfeiting', ipAssetId: randomUUID() },
      ];

      for (const matter of matters) {
        const response = await request(app.server)
          .post('/api/v1/enforcement')
          .send(matter);
        createdMatterIds.push(response.body.id);
      }
    });

    it('should list all matters', async () => {
      const response = await request(app.server)
        .get('/api/v1/enforcement')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('limit');
      expect(response.body).toHaveProperty('offset');
      expect(response.body).toHaveProperty('hasMore');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should filter by status', async () => {
      const response = await request(app.server)
        .get('/api/v1/enforcement')
        .query({ status: 'monitoring' })
        .expect(200);

      expect(response.body.data.every((m: { status: string }) => m.status === 'monitoring')).toBe(true);
    });

    it('should filter by priority', async () => {
      const response = await request(app.server)
        .get('/api/v1/enforcement')
        .query({ priority: 'high' })
        .expect(200);

      expect(response.body.data.every((m: { priority: string }) => m.priority === 'high')).toBe(true);
    });

    it('should filter by type', async () => {
      const response = await request(app.server)
        .get('/api/v1/enforcement')
        .query({ type: 'counterfeiting' })
        .expect(200);

      expect(response.body.data.every((m: { type: string }) => m.type === 'counterfeiting')).toBe(true);
    });

    it('should filter by ipAssetType', async () => {
      const response = await request(app.server)
        .get('/api/v1/enforcement')
        .query({ ipAssetType: 'patent' })
        .expect(200);

      expect(response.body.data.every((m: { ipAssetType: string }) => m.ipAssetType === 'patent')).toBe(true);
    });

    it('should support search by term', async () => {
      const response = await request(app.server)
        .get('/api/v1/enforcement')
        .query({ searchTerm: 'Matter 1' })
        .expect(200);

      expect(response.body.data.some((m: { title: string }) => m.title.includes('Matter 1'))).toBe(true);
    });

    it('should support pagination with limit', async () => {
      const response = await request(app.server)
        .get('/api/v1/enforcement')
        .query({ limit: 2 })
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(2);
      expect(response.body.limit).toBe(2);
    });

    it('should support pagination with offset', async () => {
      const response = await request(app.server)
        .get('/api/v1/enforcement')
        .query({ limit: 10, offset: 1 })
        .expect(200);

      expect(response.body.offset).toBe(1);
    });

    it('should return 400 for invalid limit', async () => {
      const response = await request(app.server)
        .get('/api/v1/enforcement')
        .query({ limit: 200 }) // Max is 100
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 400 for invalid status filter', async () => {
      const response = await request(app.server)
        .get('/api/v1/enforcement')
        .query({ status: 'invalid_status' })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });

  // ==========================================================================
  // POST /api/v1/enforcement/:id/investigate - Start Investigation
  // ==========================================================================

  describe('POST /api/v1/enforcement/:id/investigate - Start Investigation', () => {
    it('should start investigation on a matter', async () => {
      // Create a new matter in monitoring status
      const createResponse = await request(app.server)
        .post('/api/v1/enforcement')
        .send(validMatterInput)
        .expect(201);

      const matterId = createResponse.body.id;

      const response = await request(app.server)
        .post(`/api/v1/enforcement/${matterId}/investigate`)
        .send({ assignedTo: randomUUID() })
        .expect(200);

      expect(response.body.status).toBe('investigation');
    });

    it('should return 404 for non-existent matter', async () => {
      const nonExistentId = randomUUID();

      const response = await request(app.server)
        .post(`/api/v1/enforcement/${nonExistentId}/investigate`)
        .send({})
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Matter not found');
    });

    it('should return 400 for invalid state transition', async () => {
      // Create and settle a matter to put it in terminal state
      const createResponse = await request(app.server)
        .post('/api/v1/enforcement')
        .send(validMatterInput)
        .expect(201);

      const matterId = createResponse.body.id;

      // First transition to investigation
      await request(app.server)
        .post(`/api/v1/enforcement/${matterId}/investigate`)
        .send({})
        .expect(200);

      // Try to investigate again (invalid transition)
      const response = await request(app.server)
        .post(`/api/v1/enforcement/${matterId}/investigate`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  // ==========================================================================
  // POST /api/v1/enforcement/:id/cease-and-desist - Send C&D
  // ==========================================================================

  describe('POST /api/v1/enforcement/:id/cease-and-desist - Send C&D', () => {
    it('should send cease and desist for matter in investigation', async () => {
      // Create and start investigation
      const createResponse = await request(app.server)
        .post('/api/v1/enforcement')
        .send(validMatterInput)
        .expect(201);

      const matterId = createResponse.body.id;

      await request(app.server)
        .post(`/api/v1/enforcement/${matterId}/investigate`)
        .send({})
        .expect(200);

      // Send C&D
      const response = await request(app.server)
        .post(`/api/v1/enforcement/${matterId}/cease-and-desist`)
        .send({})
        .expect(200);

      expect(response.body.status).toBe('cease_and_desist');
    });

    it('should return 404 for non-existent matter', async () => {
      const nonExistentId = randomUUID();

      const response = await request(app.server)
        .post(`/api/v1/enforcement/${nonExistentId}/cease-and-desist`)
        .send({})
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Matter not found');
    });

    it('should allow C&D directly from monitoring (valid transition)', async () => {
      // Create matter in monitoring status
      const createResponse = await request(app.server)
        .post('/api/v1/enforcement')
        .send(validMatterInput)
        .expect(201);

      const matterId = createResponse.body.id;

      // C&D from monitoring is a valid transition according to the entity
      const response = await request(app.server)
        .post(`/api/v1/enforcement/${matterId}/cease-and-desist`)
        .send({})
        .expect(200);

      expect(response.body.status).toBe('cease_and_desist');
    });

    it('should return 400 for invalid state transition from resolved', async () => {
      // Create matter and transition to a terminal state
      const createResponse = await request(app.server)
        .post('/api/v1/enforcement')
        .send(validMatterInput)
        .expect(201);

      const matterId = createResponse.body.id;

      // Move to investigation first
      await request(app.server)
        .post(`/api/v1/enforcement/${matterId}/investigate`)
        .send({})
        .expect(200);

      // Then send C&D
      await request(app.server)
        .post(`/api/v1/enforcement/${matterId}/cease-and-desist`)
        .send({})
        .expect(200);

      // Try to send C&D again from cease_and_desist status (invalid transition)
      const response = await request(app.server)
        .post(`/api/v1/enforcement/${matterId}/cease-and-desist`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  // ==========================================================================
  // POST /api/v1/enforcement/:id/actions - Add Action
  // ==========================================================================

  describe('POST /api/v1/enforcement/:id/actions - Add Action', () => {
    it('should add an action to a matter', async () => {
      // Create a matter
      const createResponse = await request(app.server)
        .post('/api/v1/enforcement')
        .send(validMatterInput)
        .expect(201);

      const matterId = createResponse.body.id;

      const response = await request(app.server)
        .post(`/api/v1/enforcement/${matterId}/actions`)
        .send(validActionInput)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.actionType).toBe(validActionInput.actionType);
      expect(response.body.title).toBe(validActionInput.title);
      expect(response.body.status).toBe('pending');
    });

    it('should return 404 for non-existent matter', async () => {
      const nonExistentId = randomUUID();

      const response = await request(app.server)
        .post(`/api/v1/enforcement/${nonExistentId}/actions`)
        .send(validActionInput)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Matter not found');
    });

    it('should return 400 for missing required action fields', async () => {
      const createResponse = await request(app.server)
        .post('/api/v1/enforcement')
        .send(validMatterInput)
        .expect(201);

      const matterId = createResponse.body.id;

      const invalidAction = {
        // Missing actionType and title
        description: 'Test description',
      };

      const response = await request(app.server)
        .post(`/api/v1/enforcement/${matterId}/actions`)
        .send(invalidAction)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 400 for invalid action type', async () => {
      const createResponse = await request(app.server)
        .post('/api/v1/enforcement')
        .send(validMatterInput)
        .expect(201);

      const matterId = createResponse.body.id;

      const invalidAction = {
        ...validActionInput,
        actionType: 'invalid_action_type',
      };

      const response = await request(app.server)
        .post(`/api/v1/enforcement/${matterId}/actions`)
        .send(invalidAction)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should accept all valid action types', async () => {
      const createResponse = await request(app.server)
        .post('/api/v1/enforcement')
        .send(validMatterInput)
        .expect(201);

      const matterId = createResponse.body.id;

      const actionTypes = [
        'cease_and_desist',
        'dmca_takedown',
        'customs_recordation',
        'court_filing',
        'motion',
        'discovery',
        'settlement_offer',
        'judgment',
        'appeal',
        'monitoring_alert',
        'investigation',
        'negotiation',
        'other',
      ];

      for (const actionType of actionTypes) {
        const response = await request(app.server)
          .post(`/api/v1/enforcement/${matterId}/actions`)
          .send({ ...validActionInput, actionType })
          .expect(201);

        expect(response.body.actionType).toBe(actionType);
      }
    });
  });

  // ==========================================================================
  // POST /api/v1/enforcement/:id/parties - Add Party
  // ==========================================================================

  describe('POST /api/v1/enforcement/:id/parties - Add Party', () => {
    it('should add a party to a matter', async () => {
      // Create a matter
      const createResponse = await request(app.server)
        .post('/api/v1/enforcement')
        .send(validMatterInput)
        .expect(201);

      const matterId = createResponse.body.id;

      const response = await request(app.server)
        .post(`/api/v1/enforcement/${matterId}/parties`)
        .send(validPartyInput)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.role).toBe(validPartyInput.role);
      expect(response.body.name).toBe(validPartyInput.name);
    });

    it('should return 404 for non-existent matter', async () => {
      const nonExistentId = randomUUID();

      const response = await request(app.server)
        .post(`/api/v1/enforcement/${nonExistentId}/parties`)
        .send(validPartyInput)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Matter not found');
    });

    it('should return 400 for missing required party fields', async () => {
      const createResponse = await request(app.server)
        .post('/api/v1/enforcement')
        .send(validMatterInput)
        .expect(201);

      const matterId = createResponse.body.id;

      const invalidParty = {
        // Missing role and name
        organization: 'Test Org',
      };

      const response = await request(app.server)
        .post(`/api/v1/enforcement/${matterId}/parties`)
        .send(invalidParty)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 400 for invalid party role', async () => {
      const createResponse = await request(app.server)
        .post('/api/v1/enforcement')
        .send(validMatterInput)
        .expect(201);

      const matterId = createResponse.body.id;

      const invalidParty = {
        ...validPartyInput,
        role: 'invalid_role',
      };

      const response = await request(app.server)
        .post(`/api/v1/enforcement/${matterId}/parties`)
        .send(invalidParty)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 400 for invalid email format', async () => {
      const createResponse = await request(app.server)
        .post('/api/v1/enforcement')
        .send(validMatterInput)
        .expect(201);

      const matterId = createResponse.body.id;

      const invalidParty = {
        ...validPartyInput,
        contactEmail: 'not-an-email',
      };

      const response = await request(app.server)
        .post(`/api/v1/enforcement/${matterId}/parties`)
        .send(invalidParty)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should accept all valid party roles', async () => {
      const createResponse = await request(app.server)
        .post('/api/v1/enforcement')
        .send(validMatterInput)
        .expect(201);

      const matterId = createResponse.body.id;

      const roles = [
        'infringer',
        'defendant',
        'plaintiff',
        'respondent',
        'petitioner',
        'internal_counsel',
        'external_counsel',
        'investigator',
        'expert_witness',
      ];

      for (const role of roles) {
        const response = await request(app.server)
          .post(`/api/v1/enforcement/${matterId}/parties`)
          .send({ ...validPartyInput, role })
          .expect(201);

        expect(response.body.role).toBe(role);
      }
    });

    it('should add external counsel with bar number', async () => {
      const createResponse = await request(app.server)
        .post('/api/v1/enforcement')
        .send(validMatterInput)
        .expect(201);

      const matterId = createResponse.body.id;

      const counselParty = {
        role: 'external_counsel',
        name: 'Jane Attorney',
        firmName: 'Smith & Associates LLP',
        barNumber: 'CA-123456',
        contactEmail: 'jane@smithlaw.com',
      };

      const response = await request(app.server)
        .post(`/api/v1/enforcement/${matterId}/parties`)
        .send(counselParty)
        .expect(201);

      expect(response.body.role).toBe('external_counsel');
      expect(response.body.name).toBe('Jane Attorney');
    });
  });

  // ==========================================================================
  // Additional Endpoint Tests
  // ==========================================================================

  describe('GET /api/v1/enforcement/:id/actions - Get Matter Actions', () => {
    it('should return actions for a matter', async () => {
      // Create matter and add action
      const createResponse = await request(app.server)
        .post('/api/v1/enforcement')
        .send(validMatterInput)
        .expect(201);

      const matterId = createResponse.body.id;

      await request(app.server)
        .post(`/api/v1/enforcement/${matterId}/actions`)
        .send(validActionInput)
        .expect(201);

      const response = await request(app.server)
        .get(`/api/v1/enforcement/${matterId}/actions`)
        .expect(200);

      expect(response.body).toHaveProperty('actions');
      expect(Array.isArray(response.body.actions)).toBe(true);
      expect(response.body.actions.length).toBeGreaterThan(0);
    });

    it('should return 404 for non-existent matter', async () => {
      const nonExistentId = randomUUID();

      const response = await request(app.server)
        .get(`/api/v1/enforcement/${nonExistentId}/actions`)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Matter not found');
    });
  });

  describe('GET /api/v1/enforcement/:id/parties - Get Matter Parties', () => {
    it('should return parties for a matter', async () => {
      // Create matter and add party
      const createResponse = await request(app.server)
        .post('/api/v1/enforcement')
        .send(validMatterInput)
        .expect(201);

      const matterId = createResponse.body.id;

      await request(app.server)
        .post(`/api/v1/enforcement/${matterId}/parties`)
        .send(validPartyInput)
        .expect(201);

      const response = await request(app.server)
        .get(`/api/v1/enforcement/${matterId}/parties`)
        .expect(200);

      expect(response.body).toHaveProperty('parties');
      expect(Array.isArray(response.body.parties)).toBe(true);
      expect(response.body.parties.length).toBeGreaterThan(0);
    });

    it('should return 404 for non-existent matter', async () => {
      const nonExistentId = randomUUID();

      const response = await request(app.server)
        .get(`/api/v1/enforcement/${nonExistentId}/parties`)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Matter not found');
    });
  });

  describe('GET /api/v1/enforcement/summary - Get Enforcement Summary', () => {
    it('should return enforcement summary', async () => {
      const response = await request(app.server)
        .get('/api/v1/enforcement/summary')
        .expect(200);

      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('open');
      expect(response.body).toHaveProperty('inLitigation');
      expect(response.body).toHaveProperty('byStatus');
      expect(response.body).toHaveProperty('byPriority');
      expect(response.body).toHaveProperty('byType');
    });
  });

  // ==========================================================================
  // Edge Cases and Error Handling
  // ==========================================================================

  describe('Error Handling', () => {
    it('should handle malformed JSON gracefully', async () => {
      // Note: Fastify may return different status codes for parsing errors
      // depending on configuration. We just verify it doesn't crash.
      const response = await request(app.server)
        .post('/api/v1/enforcement')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      // Should return an error status (either 400 or 500)
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body).toBeDefined();
    });

    it('should handle empty request body', async () => {
      const response = await request(app.server)
        .post('/api/v1/enforcement')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should handle null body gracefully', async () => {
      const response = await request(app.server)
        .post('/api/v1/enforcement')
        .send(null);

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });
});
