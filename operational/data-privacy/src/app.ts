/**
 * Hono App Factory for Data Privacy Service
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { PrismaClient } from '#prisma';
import { createRoutes } from './routes/index.js';
import { checkDatabaseHealth } from './lib/prisma.js';

export interface AppConfig {
  prisma: PrismaClient;
}

export function createApp(config: AppConfig): Hono {
  const app = new Hono();
  const { prisma } = config;

  // Global middleware
  app.use('*', cors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
  }));
  app.use('*', honoLogger());

  // Health check endpoint
  app.get('/health', async (c) => {
    const dbHealth = await checkDatabaseHealth();
    const healthy = dbHealth.healthy;

    return c.json({
      status: healthy ? 'healthy' : 'unhealthy',
      service: 'data-privacy',
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
    service: 'data-privacy',
    version: process.env.SERVICE_VERSION || '0.1.0',
    description: 'GDPR/CCPA compliance and privacy management',
    domains: [
      'consent-management',
      'dsar-handling',
      'breach-management',
    ],
  }));

  // API routes
  app.route('/api/v1', createRoutes(prisma));

  // 404 handler
  app.notFound((c) => c.json({ error: 'Not Found' }, 404));

  return app;
}
