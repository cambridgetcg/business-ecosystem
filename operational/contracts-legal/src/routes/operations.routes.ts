/**
 * Legal Operations Routes
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { PrismaClient } from '@prisma/client';
import {
  CreateNotificationSchema,
  NotificationQuerySchema,
  AuditLogQuerySchema,
  DashboardQuerySchema,
  CreateModificationSchema,
  UpdateModificationSchema,
  ExecuteModificationSchema,
  ModificationQuerySchema,
  createLegalOpsRepository,
  createLegalOpsService,
} from '../domain/legal-operations/index.js';
import { authenticate, requirePermissions } from '../middleware/index.js';

const canManageOps = requirePermissions('legal:operations:manage');
const canViewOps = requirePermissions('legal:operations:view');

export function createOperationsRouter(prisma: PrismaClient) {
  const router = new Hono();
  const repository = createLegalOpsRepository(prisma);
  const service = createLegalOpsService(repository);

  // Dashboard
  router.get('/dashboard', authenticate, canViewOps, zValidator('query', DashboardQuerySchema), async (c) => {
    const query = c.req.valid('query');
    const dashboard = await service.getDashboard(query);
    return c.json(dashboard);
  });

  // Notifications
  router.get('/notifications', authenticate, canViewOps, zValidator('query', NotificationQuerySchema), async (c) => {
    const query = c.req.valid('query');
    const result = await service.listNotifications(query);
    return c.json(result);
  });

  router.post('/notifications', authenticate, canManageOps, zValidator('json', CreateNotificationSchema), async (c) => {
    const input = c.req.valid('json');
    const notification = await service.createNotification(input);
    return c.json(notification, 201);
  });

  router.post('/notifications/process', authenticate, canManageOps, async (c) => {
    const result = await service.processPendingNotifications();
    return c.json(result);
  });

  router.post('/notifications/:id/sent', authenticate, canManageOps, async (c) => {
    const id = c.req.param('id');
    const notification = await service.markNotificationSent(id);
    return c.json(notification);
  });

  // Audit Logs
  router.get('/audit-logs', authenticate, canViewOps, zValidator('query', AuditLogQuerySchema), async (c) => {
    const query = c.req.valid('query');
    const result = await service.listAuditLogs(query);
    return c.json(result);
  });

  // Contract Modifications (Amendments/Addenda)
  router.get('/modifications', authenticate, canViewOps, zValidator('query', ModificationQuerySchema), async (c) => {
    const query = c.req.valid('query');
    const result = await service.listModifications(query);
    return c.json(result);
  });

  router.get('/modifications/:id', authenticate, canViewOps, async (c) => {
    const id = c.req.param('id');
    const modification = await service.getModification(id);
    return c.json(modification);
  });

  router.post('/modifications', authenticate, canManageOps, zValidator('json', CreateModificationSchema), async (c) => {
    const input = c.req.valid('json');
    const user = c.get('user');
    const userId = user?.id || 'system';
    const modification = await service.createModification(input, userId);
    return c.json(modification, 201);
  });

  router.patch('/modifications/:id', authenticate, canManageOps, zValidator('json', UpdateModificationSchema), async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const modification = await service.updateModification(id, input);
    return c.json(modification);
  });

  router.post('/modifications/:id/execute', authenticate, canManageOps, zValidator('json', ExecuteModificationSchema), async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const modification = await service.executeModification(id, input);
    return c.json(modification);
  });

  router.get('/contracts/:contractId/modifications', authenticate, canViewOps, async (c) => {
    const contractId = c.req.param('contractId');
    const history = await service.getModificationHistory(contractId);
    return c.json(history);
  });

  return router;
}
