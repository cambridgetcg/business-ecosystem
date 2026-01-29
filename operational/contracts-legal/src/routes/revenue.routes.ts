/**
 * Revenue Recognition Routes (ASC 606)
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { createRevenueRecognitionService } from '../domain/customer-contracts/services/revenue-recognition.service.js';
import { authenticate, requirePermissions } from '../middleware/index.js';

const canManageRevenue = requirePermissions('contracts:revenue:manage');
const canViewRevenue = requirePermissions('contracts:revenue:view');

// Validation Schemas
const TimingTypeEnum = z.enum(['POINT_IN_TIME', 'OVER_TIME']);
const MeasurementMethodEnum = z.enum([
  'OUTPUT_UNITS_DELIVERED', 'OUTPUT_MILESTONES', 'OUTPUT_SURVEY',
  'INPUT_COSTS_INCURRED', 'INPUT_TIME_ELAPSED', 'INPUT_RESOURCES_CONSUMED'
]);
const POStatusEnum = z.enum(['NOT_STARTED', 'IN_PROGRESS', 'SATISFIED', 'CANCELLED']);
const MilestoneStatusEnum = z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'APPROVED', 'DISPUTED']);
const RevRecMethodEnum = z.enum([
  'POINT_IN_TIME_DELIVERY', 'POINT_IN_TIME_ACCEPTANCE',
  'OVER_TIME_OUTPUT', 'OVER_TIME_INPUT', 'PERCENTAGE_OF_COMPLETION'
]);

const CreatePerformanceObligationSchema = z.object({
  contractId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  satisfactionTiming: TimingTypeEnum,
  standalonePrice: z.number().positive().optional(),
  allocatedPrice: z.number().positive(),
  currency: z.string().optional(),
  measurementMethod: MeasurementMethodEnum.optional(),
});

const CreateMilestoneSchema = z.object({
  performanceObligationId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  percentOfObligation: z.number().min(0).max(100),
  targetDate: z.coerce.date().optional(),
});

const PerformanceObligationQuerySchema = z.object({
  contractId: z.string().optional(),
  status: POStatusEnum.optional(),
  satisfactionTiming: TimingTypeEnum.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export function createRevenueRouter(prisma: PrismaClient) {
  const router = new Hono();
  const service = createRevenueRecognitionService(prisma);

  // Performance Obligations
  router.get('/obligations', authenticate, canViewRevenue, zValidator('query', PerformanceObligationQuerySchema), async (c) => {
    const query = c.req.valid('query');
    const result = await service.listPerformanceObligations(query);
    return c.json(result);
  });

  router.get('/obligations/:id', authenticate, canViewRevenue, async (c) => {
    const id = c.req.param('id');
    const po = await service.getPerformanceObligation(id);
    return c.json(po);
  });

  router.post('/obligations', authenticate, canManageRevenue, zValidator('json', CreatePerformanceObligationSchema), async (c) => {
    const input = c.req.valid('json');
    const po = await service.createPerformanceObligation(input);
    return c.json(po, 201);
  });

  router.post('/obligations/:id/start', authenticate, canManageRevenue, async (c) => {
    const id = c.req.param('id');
    const po = await service.startPerformanceObligation(id);
    return c.json(po);
  });

  router.post('/obligations/:id/progress', authenticate, canManageRevenue, async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const po = await service.updateProgress(id, body.percentComplete);
    return c.json(po);
  });

  router.post('/obligations/:id/satisfy', authenticate, canManageRevenue, async (c) => {
    const id = c.req.param('id');
    const po = await service.satisfyObligation(id);
    return c.json(po);
  });

  // Milestones
  router.post('/milestones', authenticate, canManageRevenue, zValidator('json', CreateMilestoneSchema), async (c) => {
    const input = c.req.valid('json');
    const milestone = await service.createMilestone(input);
    return c.json(milestone, 201);
  });

  router.get('/milestones/:id', authenticate, canViewRevenue, async (c) => {
    const id = c.req.param('id');
    const milestone = await service.getMilestone(id);
    return c.json(milestone);
  });

  router.post('/milestones/:id/complete', authenticate, canManageRevenue, async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const milestone = await service.completeMilestone(id, body.completedBy, body.evidenceDocumentId);
    return c.json(milestone);
  });

  router.post('/milestones/:id/approve', authenticate, canManageRevenue, async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const milestone = await service.approveMilestoneForRevenue(id, body.approvedBy);
    return c.json(milestone);
  });

  // Contract Revenue Summary
  router.get('/contracts/:contractId/summary', authenticate, canViewRevenue, async (c) => {
    const contractId = c.req.param('contractId');
    const summary = await service.getContractRevenueSummary(contractId);
    return c.json(summary);
  });

  router.put('/contracts/:contractId/method', authenticate, canManageRevenue, async (c) => {
    const contractId = c.req.param('contractId');
    const body = await c.req.json();
    await service.setContractRevRecMethod(contractId, body.method, body.notes);
    return c.json({ success: true });
  });

  return router;
}
