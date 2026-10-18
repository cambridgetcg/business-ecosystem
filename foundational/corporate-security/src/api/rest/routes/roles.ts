/**
 * Role Management Routes
 */

import type { FastifyInstance } from 'fastify';
import type { SecurityService } from '../../../application/services/security-service.js';
import { CreateRoleInputSchema } from '../../../domain/access-control/models/role.js';

export function registerRoleRoutes(app: FastifyInstance, service: SecurityService) {
  // Create role
  app.post('/roles', async (request, reply) => {
    try {
      const input = CreateRoleInputSchema.parse(request.body);
      const role = await service.createRole(input);
      return reply.status(201).send(role);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      request.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get role by ID
  app.get('/roles/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const role = await service.getRole(id);

      if (!role) {
        return reply.status(404).send({ error: 'Role not found' });
      }

      return role;
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // List roles for tenant
  app.get('/roles', async (request, reply) => {
    try {
      const tenantId = (request.headers['x-tenant-id'] as string) || '';

      if (!tenantId) {
        return reply.status(400).send({ error: 'X-Tenant-Id header required' });
      }

      const roles = await service.getRolesByTenant(tenantId);
      return roles;
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Assign role to identity
  app.post('/roles/:roleId/assign', async (request, reply) => {
    try {
      const { roleId } = request.params as { roleId: string };
      const { identityId, entityId, validUntil, delegatable } = request.body as any;
      const tenantId = (request.headers['x-tenant-id'] as string) || '';
      const assignedBy = (request.headers['x-user-id'] as string) || '';

      if (!tenantId || !assignedBy) {
        return reply.status(400).send({ error: 'X-Tenant-Id and X-User-Id headers required' });
      }

      if (!identityId) {
        return reply.status(400).send({ error: 'identityId is required' });
      }

      const assignment = await service.assignRole(
        tenantId,
        identityId,
        roleId,
        assignedBy,
        {
          entityId,
          validUntil: validUntil ? new Date(validUntil) : undefined,
          delegatable,
        }
      );

      return reply.status(201).send(assignment);
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
