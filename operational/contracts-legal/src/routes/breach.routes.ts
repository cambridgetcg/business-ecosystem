/**
 * Breach Tracking Routes
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { PrismaClient } from '#prisma';
import { z } from 'zod';
import { createBreachTrackingService } from '../domain/legal-operations/services/breach-tracking.service.js';
import { authenticate, requirePermissions } from '../middleware/index.js';

const canManageBreach = requirePermissions('contracts:breach:manage');
const canViewBreach = requirePermissions('contracts:breach:view');

// Validation Schemas
const IssueSeverityEnum = z.enum(['MINOR', 'MODERATE', 'SIGNIFICANT', 'CRITICAL']);
const IssueStatusEnum = z.enum(['OPEN', 'CURE_IN_PROGRESS', 'CURED', 'ESCALATED_TO_BREACH', 'WAIVED', 'DISPUTED']);
const BreachTypeEnum = z.enum(['NON_PERFORMANCE', 'DEFECTIVE_PERFORMANCE', 'LATE_PERFORMANCE', 'ANTICIPATORY', 'REPUDIATION']);
const MaterialityLevelEnum = z.enum(['MINOR', 'MODERATE', 'MATERIAL', 'FUNDAMENTAL']);
const BreachStatusEnum = z.enum(['ALLEGED', 'ACKNOWLEDGED', 'DENIED', 'UNDER_CURE', 'CURED', 'DETERMINED_MATERIAL', 'DETERMINED_IMMATERIAL', 'LITIGATED', 'SETTLED']);
const BreachResolutionEnum = z.enum(['CURED_BY_BREACHING_PARTY', 'DAMAGES_PAID', 'CONTRACT_TERMINATED', 'CONTRACT_MODIFIED', 'MUTUAL_RELEASE', 'WAIVED', 'COURT_JUDGMENT', 'ARBITRATION_AWARD', 'SETTLED']);

const CreatePerformanceIssueSchema = z.object({
  contractId: z.string().min(1),
  obligationId: z.string().optional(),
  description: z.string().min(1),
  affectedSection: z.string().optional(),
  severity: IssueSeverityEnum,
  isTimeSensitive: z.boolean().optional(),
  reportedBy: z.string().min(1),
  cureDeadline: z.coerce.date().optional(),
  curePeriodDays: z.number().int().positive().optional(),
});

const CreateCureAttemptSchema = z.object({
  performanceIssueId: z.string().min(1),
  description: z.string().min(1),
  attemptedBy: z.string().min(1),
});

const EvaluateCureSchema = z.object({
  successful: z.boolean(),
  evaluatedBy: z.string().min(1),
  evaluationNotes: z.string().optional(),
});

const CreateBreachAllegationSchema = z.object({
  contractId: z.string().min(1),
  allegedBy: z.string().min(1),
  breachType: BreachTypeEnum,
  description: z.string().min(1),
  affectedSections: z.array(z.string()).optional(),
  performanceIssueIds: z.array(z.string()).optional(),
  claimedMateriality: MaterialityLevelEnum,
  claimedDamages: z.number().optional(),
  claimedDamagesDesc: z.string().optional(),
});

const PerformanceIssueQuerySchema = z.object({
  contractId: z.string().optional(),
  severity: IssueSeverityEnum.optional(),
  status: IssueStatusEnum.optional(),
  escalated: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const BreachQuerySchema = z.object({
  contractId: z.string().optional(),
  breachType: BreachTypeEnum.optional(),
  status: BreachStatusEnum.optional(),
  materialityLevel: MaterialityLevelEnum.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export function createBreachRouter(prisma: PrismaClient) {
  const router = new Hono();
  const service = createBreachTrackingService(prisma);

  // Performance Issues
  router.get('/issues', authenticate, canViewBreach, zValidator('query', PerformanceIssueQuerySchema), async (c) => {
    const query = c.req.valid('query');
    const result = await service.listPerformanceIssues(query);
    return c.json(result);
  });

  router.get('/issues/:id', authenticate, canViewBreach, async (c) => {
    const id = c.req.param('id');
    const issue = await service.getPerformanceIssue(id);
    return c.json(issue);
  });

  router.post('/issues', authenticate, canManageBreach, zValidator('json', CreatePerformanceIssueSchema), async (c) => {
    const input = c.req.valid('json');
    const issue = await service.createPerformanceIssue(input);
    return c.json(issue, 201);
  });

  router.patch('/issues/:id/status', authenticate, canManageBreach, async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const issue = await service.updateIssueStatus(id, body.status, body.resolution);
    return c.json(issue);
  });

  // Cure Attempts
  router.post('/cure-attempts', authenticate, canManageBreach, zValidator('json', CreateCureAttemptSchema), async (c) => {
    const input = c.req.valid('json');
    const attempt = await service.createCureAttempt(input);
    return c.json(attempt, 201);
  });

  router.post('/cure-attempts/:id/evaluate', authenticate, canManageBreach, zValidator('json', EvaluateCureSchema), async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const attempt = await service.evaluateCureAttempt(id, input);
    return c.json(attempt);
  });

  // Breach Allegations
  router.get('/allegations', authenticate, canViewBreach, zValidator('query', BreachQuerySchema), async (c) => {
    const query = c.req.valid('query');
    const result = await service.listBreachAllegations(query);
    return c.json(result);
  });

  router.get('/allegations/:id', authenticate, canViewBreach, async (c) => {
    const id = c.req.param('id');
    const allegation = await service.getBreachAllegation(id);
    return c.json(allegation);
  });

  router.post('/allegations', authenticate, canManageBreach, zValidator('json', CreateBreachAllegationSchema), async (c) => {
    const input = c.req.valid('json');
    const allegation = await service.createBreachAllegation(input);
    return c.json(allegation, 201);
  });

  router.post('/allegations/:id/respond', authenticate, canManageBreach, async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const allegation = await service.respondToAllegation(id, body.denies, body.responseDetails);
    return c.json(allegation);
  });

  router.post('/allegations/:id/resolve', authenticate, canManageBreach, async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const allegation = await service.resolveAllegation(
      id,
      body.resolutionType,
      body.determinedMaterial,
      body.resolutionDetails,
      body.linkedToMatterId
    );
    return c.json(allegation);
  });

  // Contract Health
  router.get('/contracts/:contractId/health', authenticate, canViewBreach, async (c) => {
    const contractId = c.req.param('contractId');
    const health = await service.getContractPerformanceHealth(contractId);
    return c.json(health);
  });

  return router;
}
