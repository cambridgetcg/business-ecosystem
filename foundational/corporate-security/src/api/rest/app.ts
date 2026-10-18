/**
 * Corporate Security REST API
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { db } from '../../infrastructure/persistence/database.js';
import { SecurityService } from '../../application/services/security-service.js';
import { setSecurityServiceInstance } from '../../infrastructure/messaging/index.js';
import { registerIdentityRoutes } from './routes/identities.js';
import { registerRoleRoutes } from './routes/roles.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerAuditRoutes } from './routes/audit.js';

// Shared security service instance (exported for external access)
let securityServiceInstance: SecurityService | null = null;

export function getSecurityService(): SecurityService | null {
  return securityServiceInstance;
}

export async function createApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  // Security middleware
  await app.register(cors, {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  // Create service instance
  const securityService = new SecurityService(db);
  securityServiceInstance = securityService;

  // Wire up the security service for event handlers
  setSecurityServiceInstance(securityService);

  // Health check
  app.get('/health', async () => ({
    status: 'healthy',
    service: 'corporate-security',
    timestamp: new Date().toISOString(),
  }));

  // Register routes
  await app.register(async (instance) => {
    registerIdentityRoutes(instance, securityService);
    registerRoleRoutes(instance, securityService);
    registerAuthRoutes(instance, securityService);
    registerAuditRoutes(instance, securityService);
  }, { prefix: '/api/v1/security' });

  return app;
}
