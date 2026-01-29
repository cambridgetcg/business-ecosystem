/**
 * Hono App Factory
 *
 * Creates and configures the Hono application with all middleware and routes.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { PrismaClient } from '@prisma/client';
import { requestId, requestLogger, errorHandler, notFoundHandler, auditTrail } from './middleware/index.js';
import { createRoutes } from './routes/index.js';
import { checkDatabaseHealth } from './lib/prisma.js';

export interface AppConfig {
  prisma: PrismaClient;
}

export function createApp(config: AppConfig): Hono {
  const app = new Hono();
  const { prisma } = config;

  // Global middleware (order matters)
  app.use('*', requestId);
  app.use('*', cors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
  }));
  app.use('*', requestLogger);
  app.use('*', errorHandler);
  app.use('*', auditTrail);

  // Health check endpoint
  app.get('/health', async (c) => {
    const dbHealth = await checkDatabaseHealth();
    const healthy = dbHealth.healthy;
    
    return c.json({
      status: healthy ? 'healthy' : 'unhealthy',
      service: 'contracts-legal',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbHealth,
      },
    }, healthy ? 200 : 503);
  });

  // Readiness check
  app.get('/ready', async (c) => {
    const dbHealth = await checkDatabaseHealth();
    
    if (!dbHealth.healthy) {
      return c.json({ ready: false, reason: 'Database not connected' }, 503);
    }
    
    return c.json({ ready: true });
  });

  // Root endpoint - service info
  app.get('/', (c) => c.json({
    service: 'contracts-legal',
    version: process.env.SERVICE_VERSION || '0.1.0',
    description: 'Contract lifecycle management and legal operations',
    domains: [
      'customer-contracts',
      'vendor-contracts',
      'employment-agreements',
      'contract-templates',
      'contract-lifecycle',
      'litigation',
      'real-estate',
      'legal-operations'
    ],
  }));

  // API routes
  app.route('/api/v1', createRoutes(prisma));

  // 404 handler
  app.notFound(notFoundHandler);

  return app;
}
