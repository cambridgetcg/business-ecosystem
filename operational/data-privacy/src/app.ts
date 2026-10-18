/**
 * Hono App Factory for Data Privacy Service
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { PrismaClient } from '@prisma/client';
import { createRoutes } from './routes/index.js';
import { checkDatabaseHealth } from './lib/prisma.js';
import { rateLimit } from './middleware/rate-limit.js';
import { requestLogger, metricsCollector } from './middleware/request-logger.js';
import { securityHeaders } from './middleware/security-headers.js';
import { serverConfig, serviceConfig } from './env.js';
import { openApiSpec } from './openapi.js';

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

  // Security headers
  app.use('*', securityHeaders());

  // Structured request logging with correlation IDs (production)
  if (serverConfig.isProduction) {
    app.use('*', requestLogger());
    app.use('*', metricsCollector());
  } else {
    // Simple console logging for development
    app.use('*', honoLogger());
  }

  // Rate limiting for API endpoints (skip health checks)
  app.use('/api/*', rateLimit({
    skip: (c) => c.req.path === '/health' || c.req.path === '/ready',
  }));

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
    service: serviceConfig.name,
    version: serviceConfig.version,
    description: 'GDPR/CCPA compliance and privacy management',
    environment: serverConfig.nodeEnv,
    domains: [
      'consent-management',
      'data-subject-rights',
      'breach-management',
      'privacy-impact-assessment',
      'processing-activities',
      'vendor-privacy',
      'cross-border-transfers',
      'privacy-program-metrics',
    ],
    endpoints: {
      consent: '/api/v1/consent',
      dsar: '/api/v1/dsar',
      breach: '/api/v1/breach',
      dpia: '/api/v1/dpia',
      activities: '/api/v1/activities',
      processors: '/api/v1/processors',
      transfers: '/api/v1/transfers',
      metrics: '/api/v1/metrics',
    },
  }));

  // API routes
  app.route('/api/v1', createRoutes(prisma));

  // OpenAPI documentation
  app.get('/docs/openapi.json', (c) => c.json(openApiSpec));

  // Swagger UI (using CDN)
  app.get('/docs', (c) => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Data Privacy API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/docs/openapi.json',
      dom_id: '#swagger-ui',
      deepLinking: true,
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: 'StandaloneLayout'
    });
  </script>
</body>
</html>`;
    return c.html(html);
  });

  // 404 handler
  app.notFound((c) => c.json({ error: 'Not Found' }, 404));

  return app;
}
