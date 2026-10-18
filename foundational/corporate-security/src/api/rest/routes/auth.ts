/**
 * Authentication Routes
 */

import type { FastifyInstance } from 'fastify';
import type { SecurityService } from '../../../application/services/security-service.js';
import { getGlobalEventPublisher } from '../../../infrastructure/messaging/index.js';

export function registerAuthRoutes(app: FastifyInstance, service: SecurityService) {
  // Login with password
  app.post('/auth/login', async (request, reply) => {
    try {
      const { email, password, tenantId } = request.body as {
        email: string;
        password: string;
        tenantId: string;
      };

      if (!email || !password || !tenantId) {
        return reply.status(400).send({ error: 'email, password, and tenantId are required' });
      }

      const ip = request.ip || 'unknown';
      const userAgent = request.headers['user-agent'] || 'unknown';

      const result = await service.authenticatePassword(tenantId, email, password, ip, userAgent);

      // Publish login event
      const publisher = getGlobalEventPublisher();
      if (publisher) {
        if (result.success) {
          await publisher.publishLoginSuccess({
            tenantId,
            identityId: result.identity!.id,
            email,
            ipAddress: ip,
            userAgent,
          });
        } else {
          await publisher.publishLoginFailure({
            tenantId,
            email,
            ipAddress: ip,
            userAgent,
            reason: result.error || 'Authentication failed',
          });
        }
      }

      if (!result.success) {
        return reply.status(401).send({ error: result.error });
      }

      if (result.requiresMFA) {
        return reply.status(200).send({
          requiresMFA: true,
          identityId: result.identity!.id,
          message: 'MFA verification required',
        });
      }

      // Create session
      const session = await service.createSession(
        tenantId,
        result.identity!.id,
        ip,
        userAgent
      );

      // Remove sensitive fields from identity
      const { passwordHash, passwordSalt, verificationToken, mfaConfig, ...safeIdentity } = result.identity as any;

      return {
        identity: safeIdentity,
        sessionToken: session.sessionToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Validate session
  app.post('/auth/validate', async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({ error: 'Missing or invalid authorization header' });
      }

      const sessionToken = authHeader.substring(7);
      const result = await service.validateSession(sessionToken);

      if (!result.valid) {
        return reply.status(401).send({ error: 'Invalid or expired session' });
      }

      return {
        valid: true,
        identityId: result.identityId,
        tenantId: result.tenantId,
      };
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Logout
  app.post('/auth/logout', async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(400).send({ error: 'Missing or invalid authorization header' });
      }

      const sessionToken = authHeader.substring(7);

      // Get session info before revoking for event publishing
      const sessionInfo = await service.validateSession(sessionToken);

      await service.revokeSession(sessionToken);

      // Publish session revoked event
      if (sessionInfo.valid) {
        const publisher = getGlobalEventPublisher();
        if (publisher) {
          await publisher.publishSessionRevoked({
            tenantId: sessionInfo.tenantId!,
            identityId: sessionInfo.identityId!,
            sessionToken: sessionToken.substring(0, 8) + '...', // Partial for security
            reason: 'user_logout',
          });
        }
      }

      return { success: true, message: 'Logged out successfully' };
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Check access (authorization)
  app.post('/auth/check-access', async (request, reply) => {
    try {
      const {
        subjectId,
        subjectType = 'identity',
        subjectAttributes,
        action,
        resourceType,
        resourceId,
        resourceAttributes,
      } = request.body as any;

      if (!subjectId || !action || !resourceType) {
        return reply.status(400).send({
          error: 'subjectId, action, and resourceType are required',
        });
      }

      const decision = await service.checkAccess({
        subjectId,
        subjectType,
        subjectAttributes: subjectAttributes || {},
        action,
        resourceType,
        resourceId,
        resourceAttributes,
        environment: {
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          timestamp: new Date(),
          requestId: request.id,
        },
      });

      return decision;
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
