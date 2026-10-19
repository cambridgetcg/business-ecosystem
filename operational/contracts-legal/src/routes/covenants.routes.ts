/**
 * Restrictive Covenants Routes
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { PrismaClient } from '#prisma';
import { z } from 'zod';
import { createEnforceabilityService } from '../domain/employment-agreements/services/enforceability.service.js';
import { authenticate, requirePermissions } from '../middleware/index.js';

const canManageCovenants = requirePermissions('employment:covenants:manage');
const canViewCovenants = requirePermissions('employment:covenants:view');

// Validation Schemas
const CovenantTypeEnum = z.enum([
  'NON_COMPETE', 'NON_SOLICITATION', 'NON_POACHING',
  'CONFIDENTIALITY', 'NON_DISPARAGEMENT', 'INVENTION_ASSIGNMENT'
]);
const EnforceabilityStatusEnum = z.enum([
  'NOT_ANALYZED', 'LIKELY_ENFORCEABLE', 'PARTIALLY_ENFORCEABLE',
  'UNLIKELY_ENFORCEABLE', 'VOID_BY_LAW', 'NEEDS_REVIEW'
]);
const CovenantStatusEnum = z.enum(['ACTIVE', 'EXPIRED', 'WAIVED', 'ENFORCED', 'CHALLENGED']);

const CreateCovenantSchema = z.object({
  employmentAgreementId: z.string().min(1),
  covenantType: CovenantTypeEnum,
  durationDays: z.number().int().positive().optional(),
  geographicScope: z.string().optional(),
  scopeDescription: z.string().optional(),
  competitorNames: z.array(z.string()).optional(),
  customerRestriction: z.boolean().optional(),
  employeeRestriction: z.boolean().optional(),
  consideration: z.string().optional(),
  considerationValue: z.number().positive().optional(),
  enforceabilityState: z.string().optional(),
});

const CovenantQuerySchema = z.object({
  employmentAgreementId: z.string().optional(),
  covenantType: CovenantTypeEnum.optional(),
  enforceabilityStatus: EnforceabilityStatusEnum.optional(),
  status: CovenantStatusEnum.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export function createCovenantsRouter(prisma: PrismaClient) {
  const router = new Hono();
  const service = createEnforceabilityService(prisma);

  // List covenants
  router.get('/', authenticate, canViewCovenants, zValidator('query', CovenantQuerySchema), async (c) => {
    const query = c.req.valid('query');
    const result = await service.listCovenants(query);
    return c.json(result);
  });

  // Get covenant by ID
  router.get('/:id', authenticate, canViewCovenants, async (c) => {
    const id = c.req.param('id');
    const covenant = await service.getCovenant(id);
    return c.json(covenant);
  });

  // Create covenant
  router.post('/', authenticate, canManageCovenants, zValidator('json', CreateCovenantSchema), async (c) => {
    const input = c.req.valid('json');
    const covenant = await service.createCovenant(input);
    return c.json(covenant, 201);
  });

  // Analyze enforceability
  router.post('/:id/analyze', authenticate, canManageCovenants, async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const user = c.get('user');
    const analyzedBy = user?.id || body.analyzedBy || 'system';
    const analysis = await service.analyzeEnforceability(id, body.state, analyzedBy);
    return c.json(analysis);
  });

  // Covenant lifecycle actions
  router.post('/:id/waive', authenticate, canManageCovenants, async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const user = c.get('user');
    const waivedBy = user?.id || body.waivedBy || 'system';
    const covenant = await service.waiveCovenant(id, waivedBy, body.reason);
    return c.json(covenant);
  });

  router.post('/:id/expire', authenticate, canManageCovenants, async (c) => {
    const id = c.req.param('id');
    const covenant = await service.markExpired(id);
    return c.json(covenant);
  });

  router.post('/:id/enforce', authenticate, canManageCovenants, async (c) => {
    const id = c.req.param('id');
    const covenant = await service.markEnforced(id);
    return c.json(covenant);
  });

  router.post('/:id/challenge', authenticate, canManageCovenants, async (c) => {
    const id = c.req.param('id');
    const covenant = await service.markChallenged(id);
    return c.json(covenant);
  });

  // Reports
  router.get('/reports/expiring', authenticate, canViewCovenants, async (c) => {
    const days = parseInt(c.req.query('days') || '30', 10);
    const result = await service.getExpiringCovenants(days);
    return c.json(result);
  });

  router.get('/reports/needs-analysis', authenticate, canViewCovenants, async (c) => {
    const result = await service.getCovenantsNeedingAnalysis();
    return c.json(result);
  });

  router.get('/reports/summary', authenticate, canViewCovenants, async (c) => {
    const summary = await service.getEnforceabilitySummary();
    return c.json(summary);
  });

  return router;
}
