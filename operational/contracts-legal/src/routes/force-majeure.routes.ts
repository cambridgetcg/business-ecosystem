/**
 * Force Majeure Routes
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { createForceMajeureService } from '../domain/customer-contracts/services/force-majeure.service.js';
import { authenticate, requirePermissions } from '../middleware/index.js';

const canManageFM = requirePermissions('contracts:force-majeure:manage');
const canViewFM = requirePermissions('contracts:force-majeure:view');

// Validation Schemas
const CoveredEventEnum = z.enum([
  'ACT_OF_GOD', 'NATURAL_DISASTER', 'EARTHQUAKE', 'FLOOD', 'FIRE',
  'HURRICANE', 'TORNADO', 'PANDEMIC', 'EPIDEMIC', 'DISEASE_OUTBREAK',
  'WAR', 'TERRORISM', 'CIVIL_UNREST', 'RIOT', 'STRIKE', 'LABOR_DISPUTE',
  'GOVERNMENT_ACTION', 'CHANGE_IN_LAW', 'EMBARGO', 'SANCTIONS',
  'SUPPLY_CHAIN_DISRUPTION', 'UTILITY_FAILURE', 'CYBERATTACK', 'OTHER'
]);

const FMStatusEnum = z.enum(['INVOKED', 'ACKNOWLEDGED', 'DISPUTED', 'SUSPENDED', 'RESUMED', 'TERMINATED', 'RESOLVED']);
const PerformanceStandardEnum = z.enum(['PREVENTED', 'RENDERED_UNABLE', 'HINDERED', 'DELAYED', 'IMPACTED']);
const FMResolutionEnum = z.enum([
  'PERFORMANCE_RESUMED', 'OBLIGATIONS_MODIFIED', 'EXTENSION_GRANTED',
  'PARTIAL_PERFORMANCE', 'CONTRACT_TERMINATED', 'CLAIM_REJECTED', 'SETTLED'
]);

const CreateFMClauseSchema = z.object({
  contractId: z.string().min(1),
  hasClause: z.boolean(),
  clauseSection: z.string().optional(),
  coveredEvents: z.array(CoveredEventEnum).optional(),
  performanceStandard: PerformanceStandardEnum.optional(),
  noticeRequired: z.boolean().optional(),
  noticePeriodDays: z.number().int().positive().optional(),
  noticeRecipient: z.string().optional(),
  allowsSuspension: z.boolean().optional(),
  allowsTermination: z.boolean().optional(),
  terminationThresholdDays: z.number().int().positive().optional(),
  clauseText: z.string().optional(),
  reviewedBy: z.string().optional(),
});

const CreateFMEventSchema = z.object({
  contractId: z.string().min(1),
  eventType: CoveredEventEnum,
  eventName: z.string().min(1),
  eventDescription: z.string().min(1),
  eventStartDate: z.coerce.date(),
  eventEndDate: z.coerce.date().optional(),
  invokedBy: z.string().min(1),
  noticeGiven: z.boolean(),
  noticeDate: z.coerce.date().optional(),
  obligationsAffected: z.array(z.string()),
  reliefRequested: z.string().min(1),
});

const FMEventQuerySchema = z.object({
  contractId: z.string().optional(),
  eventType: CoveredEventEnum.optional(),
  status: FMStatusEnum.optional(),
  activeOnly: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export function createForceMajeureRouter(prisma: PrismaClient) {
  const router = new Hono();
  const service = createForceMajeureService(prisma);

  // Force Majeure Clauses
  router.get('/clauses/:contractId', authenticate, canViewFM, async (c) => {
    const contractId = c.req.param('contractId');
    const clause = await service.getClause(contractId);
    return c.json(clause);
  });

  router.put('/clauses', authenticate, canManageFM, zValidator('json', CreateFMClauseSchema), async (c) => {
    const input = c.req.valid('json');
    const clause = await service.createOrUpdateClause(input);
    return c.json(clause);
  });

  router.get('/clauses/:contractId/check/:eventType', authenticate, canViewFM, async (c) => {
    const contractId = c.req.param('contractId');
    const eventType = c.req.param('eventType') as any;
    const result = await service.checkEventCovered(contractId, eventType);
    return c.json(result);
  });

  // Force Majeure Events
  router.get('/events', authenticate, canViewFM, zValidator('query', FMEventQuerySchema), async (c) => {
    const query = c.req.valid('query');
    const result = await service.listEvents(query);
    return c.json(result);
  });

  router.get('/events/:id', authenticate, canViewFM, async (c) => {
    const id = c.req.param('id');
    const event = await service.getEvent(id);
    return c.json(event);
  });

  router.post('/events', authenticate, canManageFM, zValidator('json', CreateFMEventSchema), async (c) => {
    const input = c.req.valid('json');
    const event = await service.invokeForceMAjeure(input);
    return c.json(event, 201);
  });

  router.post('/events/:id/respond', authenticate, canManageFM, async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const event = await service.respondToEvent(id, body.response, body.disputed, body.disputeDetails);
    return c.json(event);
  });

  router.post('/events/:id/resolve', authenticate, canManageFM, async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const performanceResumed = body.performanceResumed ? new Date(body.performanceResumed) : undefined;
    const event = await service.resolveEvent(id, body.resolutionType, performanceResumed);
    return c.json(event);
  });

  // Contract-specific queries
  router.get('/contracts/:contractId/active', authenticate, canViewFM, async (c) => {
    const contractId = c.req.param('contractId');
    const events = await service.getActiveEventsForContract(contractId);
    return c.json(events);
  });

  return router;
}
