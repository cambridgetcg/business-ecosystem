/**
 * Identity Management Routes
 */

import type { FastifyInstance } from 'fastify';
import type { SecurityService } from '../../../application/services/security-service.js';
import { CreateIdentityInputSchema } from '../../../domain/identity/models/identity.js';
import { getGlobalEventPublisher } from '../../../infrastructure/messaging/index.js';

export function registerIdentityRoutes(app: FastifyInstance, service: SecurityService) {
  // Create identity
  app.post('/identities', async (request, reply) => {
    try {
      const input = CreateIdentityInputSchema.parse(request.body);
      const identity = await service.createIdentity(input);

      // Publish IdentityCreated event
      const publisher = getGlobalEventPublisher();
      if (publisher) {
        await publisher.publishIdentityCreated({
          identityId: identity.id,
          tenantId: identity.tenantId,
          email: identity.email,
          identityType: identity.identityType,
          displayName: identity.displayName || undefined,
          status: identity.status,
          createdBy: (request.headers['x-user-id'] as string) || undefined,
        });
      }

      // Remove sensitive fields
      const { passwordHash, passwordSalt, verificationToken, ...safeIdentity } = identity as any;

      return reply.status(201).send(safeIdentity);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      request.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get identity by ID
  app.get('/identities/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const identity = await service.getIdentity(id);

      if (!identity) {
        return reply.status(404).send({ error: 'Identity not found' });
      }

      // Remove sensitive fields
      const { passwordHash, passwordSalt, verificationToken, ...safeIdentity } = identity as any;

      return safeIdentity;
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get identity by email
  app.get('/identities/by-email/:tenantId/:email', async (request, reply) => {
    try {
      const { tenantId, email } = request.params as { tenantId: string; email: string };
      const identity = await service.getIdentityByEmail(tenantId, email);

      if (!identity) {
        return reply.status(404).send({ error: 'Identity not found' });
      }

      // Remove sensitive fields
      const { passwordHash, passwordSalt, verificationToken, ...safeIdentity } = identity as any;

      return safeIdentity;
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get identity's roles
  app.get('/identities/:id/roles', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const tenantId = (request.headers['x-tenant-id'] as string) || '';

      if (!tenantId) {
        return reply.status(400).send({ error: 'X-Tenant-Id header required' });
      }

      const roles = await service.getIdentityRoles(tenantId, id);
      return roles;
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
