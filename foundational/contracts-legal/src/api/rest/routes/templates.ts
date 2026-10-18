/**
 * Contract Template Routes
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb, contractTemplates } from '../../../infrastructure/persistence/index.js';
import { CreateTemplateInputSchema, UpdateTemplateInputSchema } from '../../../domain/template/models/template.js';
import { getGlobalEventPublisher, ContractsEventTypes } from '../../../infrastructure/messaging/event-publisher.js';

export const templateRoutes: FastifyPluginAsync = async (app) => {
  // List templates
  app.get('/', {
    schema: {
      tags: ['templates'],
      summary: 'List contract templates',
      querystring: z.object({
        tenantId: z.string().uuid(),
        status: z.enum(['draft', 'active', 'archived', 'deprecated']).optional(),
        contractType: z.string().optional(),
        limit: z.coerce.number().default(20),
        offset: z.coerce.number().default(0),
      }),
    },
  }, async (request, reply) => {
    const { tenantId, limit, offset } = request.query as {
      tenantId: string;
      status?: string;
      limit: number;
      offset: number;
    };

    const db = getDb();
    const results = await db.select()
      .from(contractTemplates)
      .where(eq(contractTemplates.tenantId, tenantId))
      .limit(limit)
      .offset(offset);

    return { data: results, total: results.length };
  });

  // Create template
  app.post('/', {
    schema: {
      tags: ['templates'],
      summary: 'Create a new template',
      body: CreateTemplateInputSchema,
    },
  }, async (request, reply) => {
    const input = request.body as z.infer<typeof CreateTemplateInputSchema>;

    const db = getDb();

    const [template] = await db.insert(contractTemplates).values({
      tenantId: input.tenantId,
      name: input.name,
      description: input.description ?? null,
      contractType: input.contractType,
      status: 'draft',
      content: input.content,
      variables: input.variables ?? null,
      requiresApproval: input.requiresApproval ?? false,
      metadata: input.metadata ?? null,
      tags: input.tags ?? null,
    }).returning();

    reply.code(201);
    return template;
  });

  // Get template by ID
  app.get('/:id', {
    schema: {
      tags: ['templates'],
      summary: 'Get template by ID',
      params: z.object({
        id: z.string().uuid(),
      }),
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const db = getDb();
    const [template] = await db.select()
      .from(contractTemplates)
      .where(eq(contractTemplates.id, id));

    if (!template) {
      reply.code(404);
      return { error: 'Template not found' };
    }

    return template;
  });

  // Update template
  app.patch('/:id', {
    schema: {
      tags: ['templates'],
      summary: 'Update template',
      params: z.object({
        id: z.string().uuid(),
      }),
      body: UpdateTemplateInputSchema,
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const input = request.body as z.infer<typeof UpdateTemplateInputSchema>;

    const db = getDb();

    const [existing] = await db.select()
      .from(contractTemplates)
      .where(eq(contractTemplates.id, id));

    if (!existing) {
      reply.code(404);
      return { error: 'Template not found' };
    }

    if (existing.status !== 'draft') {
      reply.code(400);
      return { error: 'Only draft templates can be edited' };
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description;
    if (input.content !== undefined) updates.content = input.content;
    if (input.variables !== undefined) updates.variables = input.variables;
    if (input.requiresApproval !== undefined) updates.requiresApproval = input.requiresApproval;
    if (input.metadata !== undefined) updates.metadata = input.metadata;
    if (input.tags !== undefined) updates.tags = input.tags;

    const [updated] = await db.update(contractTemplates)
      .set(updates)
      .where(eq(contractTemplates.id, id))
      .returning();

    return updated;
  });

  // Publish template
  app.post('/:id/publish', {
    schema: {
      tags: ['templates'],
      summary: 'Publish template (make active)',
      params: z.object({
        id: z.string().uuid(),
      }),
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const db = getDb();

    const [template] = await db.select()
      .from(contractTemplates)
      .where(eq(contractTemplates.id, id));

    if (!template) {
      reply.code(404);
      return { error: 'Template not found' };
    }

    if (template.status !== 'draft') {
      reply.code(400);
      return { error: 'Only draft templates can be published' };
    }

    if (template.requiresApproval && !template.approvedAt) {
      reply.code(400);
      return { error: 'Template requires approval before publishing' };
    }

    const [updated] = await db.update(contractTemplates)
      .set({
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(contractTemplates.id, id))
      .returning();

    // Publish event
    const publisher = getGlobalEventPublisher();
    if (publisher) {
      await publisher.publish(ContractsEventTypes.TEMPLATE_PUBLISHED, id, {
        templateId: id,
        tenantId: template.tenantId,
        name: template.name,
        contractType: template.contractType,
      });
    }

    return updated;
  });

  // Archive template
  app.post('/:id/archive', {
    schema: {
      tags: ['templates'],
      summary: 'Archive template',
      params: z.object({
        id: z.string().uuid(),
      }),
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const db = getDb();

    const [template] = await db.select()
      .from(contractTemplates)
      .where(eq(contractTemplates.id, id));

    if (!template) {
      reply.code(404);
      return { error: 'Template not found' };
    }

    if (template.status !== 'active' && template.status !== 'deprecated') {
      reply.code(400);
      return { error: 'Only active or deprecated templates can be archived' };
    }

    const [updated] = await db.update(contractTemplates)
      .set({
        status: 'archived',
        updatedAt: new Date(),
      })
      .where(eq(contractTemplates.id, id))
      .returning();

    // Publish event
    const publisher = getGlobalEventPublisher();
    if (publisher) {
      await publisher.publish(ContractsEventTypes.TEMPLATE_ARCHIVED, id, {
        templateId: id,
        tenantId: template.tenantId,
        name: template.name,
      });
    }

    return updated;
  });

  // Delete template
  app.delete('/:id', {
    schema: {
      tags: ['templates'],
      summary: 'Delete template (soft delete)',
      params: z.object({
        id: z.string().uuid(),
      }),
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const db = getDb();

    const [template] = await db.select()
      .from(contractTemplates)
      .where(eq(contractTemplates.id, id));

    if (!template) {
      reply.code(404);
      return { error: 'Template not found' };
    }

    if (template.status === 'active') {
      reply.code(400);
      return { error: 'Active templates cannot be deleted' };
    }

    await db.update(contractTemplates)
      .set({ deletedAt: new Date() })
      .where(eq(contractTemplates.id, id));

    reply.code(204);
    return;
  });
};
