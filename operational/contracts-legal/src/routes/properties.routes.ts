/**
 * Properties Routes
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { PrismaClient } from '@prisma/client';
import {
  CreatePropertySchema,
  UpdatePropertySchema,
  PropertyQuerySchema,
  createPropertyRepository,
  createPropertyService,
} from '../domain/real-estate/index.js';
import { authenticate, requirePermissions } from '../middleware/index.js';
import { logAuditEvent } from '../middleware/audit.middleware.js';

const canManageProperties = requirePermissions('properties:manage');
const canViewProperties = requirePermissions('properties:view');

export function createPropertiesRouter(prisma: PrismaClient) {
  const router = new Hono();
  const repository = createPropertyRepository(prisma);
  const service = createPropertyService(repository);

  router.get('/', authenticate, canViewProperties, zValidator('query', PropertyQuerySchema), async (c) => {
    const query = c.req.valid('query');
    const result = await service.listProperties(query);
    return c.json(result);
  });

  router.get('/portfolio', authenticate, canViewProperties, async (c) => {
    const summary = await service.getPortfolioSummary();
    return c.json(summary);
  });

  router.get('/:id', authenticate, canViewProperties, async (c) => {
    const id = c.req.param('id');
    const property = await service.getProperty(id);
    return c.json(property);
  });

  router.post('/', authenticate, canManageProperties, zValidator('json', CreatePropertySchema), async (c) => {
    const input = c.req.valid('json');
    const user = c.get('user');
    const property = await service.createProperty(input, user.id);
    logAuditEvent(c, 'CONTRACT_CREATED', 'Property', property.id);
    return c.json(property, 201);
  });

  router.patch('/:id', authenticate, canManageProperties, zValidator('json', UpdatePropertySchema), async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const user = c.get('user');
    const property = await service.updateProperty(id, input, user.id);
    logAuditEvent(c, 'CONTRACT_UPDATED', 'Property', id);
    return c.json(property);
  });

  router.delete('/:id', authenticate, canManageProperties, async (c) => {
    const id = c.req.param('id');
    await service.deleteProperty(id);
    logAuditEvent(c, 'CONTRACT_DELETED', 'Property', id);
    return c.json({ success: true });
  });

  return router;
}
