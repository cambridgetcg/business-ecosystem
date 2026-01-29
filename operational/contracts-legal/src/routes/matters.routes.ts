/**
 * Legal Matters Routes
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { PrismaClient } from '@prisma/client';
import {
  CreateMatterSchema,
  UpdateMatterSchema,
  CloseMatterSchema,
  MatterActivitySchema,
  MatterQuerySchema,
  createLitigationRepository,
  createLitigationService,
} from '../domain/litigation/index.js';
import { authenticate, legalPermissions } from '../middleware/index.js';
import { logAuditEvent } from '../middleware/audit.middleware.js';

export function createMattersRouter(prisma: PrismaClient) {
  const router = new Hono();
  const repository = createLitigationRepository(prisma);
  const service = createLitigationService(repository);

  router.get('/', authenticate, legalPermissions.canViewMatters, zValidator('query', MatterQuerySchema), async (c) => {
    const query = c.req.valid('query');
    const result = await service.listMatters(query);
    return c.json(result);
  });

  router.get('/statistics', authenticate, legalPermissions.canViewMatters, async (c) => {
    const stats = await service.getStatistics();
    return c.json(stats);
  });

  router.get('/hearings', authenticate, legalPermissions.canViewMatters, async (c) => {
    const days = parseInt(c.req.query('days') || '30', 10);
    const hearings = await service.getUpcomingHearings(days);
    return c.json({ hearings, count: hearings.length });
  });

  router.get('/:id', authenticate, legalPermissions.canViewMatters, async (c) => {
    const id = c.req.param('id');
    const matter = await service.getMatter(id);
    return c.json(matter);
  });

  router.get('/:id/activities', authenticate, legalPermissions.canViewMatters, async (c) => {
    const id = c.req.param('id');
    const limit = parseInt(c.req.query('limit') || '50', 10);
    const activities = await service.getActivities(id, limit);
    return c.json(activities);
  });

  router.post('/', authenticate, legalPermissions.canManageMatters, zValidator('json', CreateMatterSchema), async (c) => {
    const input = c.req.valid('json');
    const user = c.get('user');
    const matter = await service.createMatter(input, user.id);
    logAuditEvent(c, 'MATTER_CREATED', 'LegalMatter', matter.id);
    return c.json(matter, 201);
  });

  router.patch('/:id', authenticate, legalPermissions.canManageMatters, zValidator('json', UpdateMatterSchema), async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const user = c.get('user');
    const matter = await service.updateMatter(id, input, user.id);
    logAuditEvent(c, 'MATTER_UPDATED', 'LegalMatter', id);
    return c.json(matter);
  });

  router.post('/:id/close', authenticate, legalPermissions.canManageMatters, zValidator('json', CloseMatterSchema), async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const user = c.get('user');
    const matter = await service.closeMatter(id, input, user.id);
    logAuditEvent(c, 'MATTER_UPDATED', 'LegalMatter', id);
    return c.json(matter);
  });

  router.post('/:id/activities', authenticate, legalPermissions.canManageMatters, zValidator('json', MatterActivitySchema), async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const user = c.get('user');
    const activity = await service.addActivity(id, input, user.id);
    return c.json(activity, 201);
  });

  router.delete('/:id', authenticate, legalPermissions.canManageLitigation, async (c) => {
    const id = c.req.param('id');
    await service.deleteMatter(id);
    logAuditEvent(c, 'CONTRACT_DELETED', 'LegalMatter', id);
    return c.json({ success: true });
  });

  return router;
}
