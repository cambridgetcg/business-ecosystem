/**
 * Contract Templates Routes
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { PrismaClient } from '@prisma/client';
import {
  CreateTemplateSchema,
  UpdateTemplateSchema,
  TemplateQuerySchema,
  GenerateContractSchema,
  createTemplateRepository,
  createTemplateService,
} from '../domain/contract-templates/index.js';
import { authenticate, contractPermissions } from '../middleware/index.js';
import { logAuditEvent } from '../middleware/audit.middleware.js';

export function createTemplatesRouter(prisma: PrismaClient) {
  const router = new Hono();
  const repository = createTemplateRepository(prisma);
  const service = createTemplateService(repository);

  router.get('/', authenticate, contractPermissions.canRead, zValidator('query', TemplateQuerySchema), async (c) => {
    const query = c.req.valid('query');
    const result = await service.listTemplates(query);
    return c.json(result);
  });

  router.get('/:id', authenticate, contractPermissions.canRead, async (c) => {
    const id = c.req.param('id');
    const template = await service.getTemplate(id);
    return c.json(template);
  });

  router.get('/:id/usage', authenticate, contractPermissions.canRead, async (c) => {
    const id = c.req.param('id');
    const stats = await service.getUsageStats(id);
    return c.json(stats);
  });

  router.post('/', authenticate, contractPermissions.canManageTemplates, zValidator('json', CreateTemplateSchema), async (c) => {
    const input = c.req.valid('json');
    const user = c.get('user');
    const template = await service.createTemplate(input, user.id);
    logAuditEvent(c, 'TEMPLATE_CREATED', 'ContractTemplate', template.id);
    return c.json(template, 201);
  });

  router.patch('/:id', authenticate, contractPermissions.canManageTemplates, zValidator('json', UpdateTemplateSchema), async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const user = c.get('user');
    const template = await service.updateTemplate(id, input, user.id);
    logAuditEvent(c, 'TEMPLATE_UPDATED', 'ContractTemplate', id);
    return c.json(template);
  });

  router.post('/:id/publish', authenticate, contractPermissions.canManageTemplates, async (c) => {
    const id = c.req.param('id');
    const { version } = await c.req.json();
    const user = c.get('user');
    const template = await service.publishNewVersion(id, version, user.id);
    return c.json(template);
  });

  router.post('/:id/deactivate', authenticate, contractPermissions.canManageTemplates, async (c) => {
    const id = c.req.param('id');
    const user = c.get('user');
    const template = await service.deactivateTemplate(id, user.id);
    return c.json(template);
  });

  router.delete('/:id', authenticate, contractPermissions.canManageTemplates, async (c) => {
    const id = c.req.param('id');
    await service.deleteTemplate(id);
    logAuditEvent(c, 'CONTRACT_DELETED', 'ContractTemplate', id);
    return c.json({ success: true });
  });

  router.post('/generate', authenticate, contractPermissions.canCreate, zValidator('json', GenerateContractSchema), async (c) => {
    const input = c.req.valid('json');
    const content = await service.generateContractContent(input);
    return c.json({ content, title: input.title });
  });

  return router;
}
