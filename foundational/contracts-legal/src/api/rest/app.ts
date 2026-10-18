/**
 * Fastify Application Setup
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import compress from '@fastify/compress';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { env } from '../../env.js';
import { contractRoutes } from './routes/contracts.js';
import { templateRoutes } from './routes/templates.js';
import { signatureRoutes } from './routes/signatures.js';
import { partyRoutes } from './routes/parties.js';
import { documentRoutes } from './routes/documents.js';
import { lifecycleRoutes } from './routes/lifecycle.js';
import { reportingRoutes } from './routes/reporting.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport: env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
  });

  // Register plugins
  await app.register(cors, { origin: true });
  await app.register(compress);
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
  });

  // Swagger documentation
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Contracts Legal API',
        description: 'Contract management, templates, and e-signatures',
        version: '1.0.0',
      },
      servers: [{ url: `http://localhost:${env.PORT}` }],
      tags: [
        { name: 'contracts', description: 'Contract management' },
        { name: 'templates', description: 'Contract templates' },
        { name: 'signatures', description: 'E-signature management' },
        { name: 'parties', description: 'Contract parties management' },
        { name: 'documents', description: 'Document management' },
        { name: 'lifecycle', description: 'Contract lifecycle operations' },
        { name: 'reporting', description: 'Analytics and reporting' },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });

  // Health check
  app.get('/health', async () => ({ status: 'ok', service: 'contracts-legal' }));

  // Register routes
  await app.register(contractRoutes, { prefix: '/api/v1/contracts' });
  await app.register(templateRoutes, { prefix: '/api/v1/templates' });
  await app.register(signatureRoutes, { prefix: '/api/v1/signatures' });
  await app.register(partyRoutes, { prefix: '/api/v1/parties' });
  await app.register(documentRoutes, { prefix: '/api/v1/documents' });
  await app.register(lifecycleRoutes, { prefix: '/api/v1/contracts' });
  await app.register(reportingRoutes, { prefix: '/api/v1/reports' });

  return app;
}
