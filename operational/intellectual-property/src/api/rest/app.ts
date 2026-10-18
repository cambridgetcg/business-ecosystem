/**
 * Fastify App Builder
 * Pattern: BACKBONE.md Framework Layer
 */

import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { Pool } from 'pg';
import { patentsRoutes } from './routes/patents.routes.js';
import { trademarksRoutes } from './routes/trademarks.routes.js';
import { copyrightsRoutes } from './routes/copyrights.routes.js';
import { licensesRoutes } from './routes/licenses.routes.js';
import { tradeSecretsRoutes } from './routes/trade-secrets.routes.js';
import { patentFamiliesRoutes } from './routes/patent-families.routes.js';
import { maintenanceFeesRoutes } from './routes/maintenance-fees.routes.js';
import { domainNamesRoutes } from './routes/domain-names.routes.js';
import { enforcementRoutes } from './routes/enforcement.routes.js';
import { strategyRoutes } from './routes/strategy.routes.js';
import { dashboardRoutes } from './routes/dashboard.routes.js';
import { analyticsRoutes } from './routes/analytics.routes.js';
import { reportsRoutes } from './routes/reports.routes.js';
import { healthRoutes } from './routes/health.routes.js';
import type { Database } from '../../infrastructure/persistence/database.js';
import type { CacheService } from '../../infrastructure/cache/index.js';
import type { IPEventPublisher } from '../../infrastructure/messaging/index.js';

export interface AppDependencies {
  db: Database;
  pool: Pool;
  cache: CacheService;
  eventPublisher: IPEventPublisher;
}

export async function buildApp(deps: AppDependencies): Promise<FastifyInstance> {
  const isDev = process.env.NODE_ENV === 'development';

  const app = Fastify({
    logger: isDev
      ? { level: 'info', transport: { target: 'pino-pretty', options: { colorize: true } } }
      : { level: process.env.LOG_LEVEL ?? 'info' },
  });

  // Security
  await app.register(helmet);
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? '*',
    credentials: true,
  });

  // Documentation
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Intellectual Property API',
        description: 'IP portfolio management - patents, trademarks, copyrights',
        version: '0.1.0',
      },
      servers: [{ url: process.env.API_URL ?? 'http://localhost:3014' }],
      tags: [
        { name: 'patents', description: 'Patent management' },
        { name: 'patent-families', description: 'Patent family relationships' },
        { name: 'maintenance-fees', description: 'Patent maintenance fees' },
        { name: 'domain-names', description: 'Domain name management' },
        { name: 'trademarks', description: 'Trademark management' },
        { name: 'copyrights', description: 'Copyright management' },
        { name: 'trade-secrets', description: 'Trade secret management' },
        { name: 'licenses', description: 'IP licensing' },
        { name: 'enforcement', description: 'IP enforcement matters' },
        { name: 'valuations', description: 'IP valuations' },
        { name: 'fto', description: 'Freedom-to-operate analyses' },
        { name: 'due-diligence', description: 'Due diligence reports' },
        { name: 'dashboard', description: 'Portfolio health dashboard' },
        { name: 'analytics', description: 'Enforcement analytics' },
        { name: 'reports', description: 'Portfolio reports' },
        { name: 'health', description: 'Health checks' },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });

  // Decorate with dependencies
  app.decorate('db', deps.db);
  app.decorate('pool', deps.pool);
  app.decorate('cache', deps.cache);
  app.decorate('eventPublisher', deps.eventPublisher);

  // Routes
  await app.register(healthRoutes, { pool: deps.pool, cache: deps.cache });
  await app.register(patentsRoutes, { prefix: '/api/v1/patents' });
  await app.register(trademarksRoutes, { prefix: '/api/v1/trademarks' });
  await app.register(copyrightsRoutes, { prefix: '/api/v1/copyrights' });
  await app.register(licensesRoutes, { prefix: '/api/v1/licenses' });
  await app.register(tradeSecretsRoutes, { prefix: '/api/v1/trade-secrets' });
  await app.register(patentFamiliesRoutes, { prefix: '/api/v1/patent-families' });
  await app.register(maintenanceFeesRoutes, { prefix: '/api/v1/maintenance-fees' });
  await app.register(domainNamesRoutes, { prefix: '/api/v1/domain-names' });
  await app.register(enforcementRoutes, { prefix: '/api/v1/enforcement' });
  await app.register(strategyRoutes, { prefix: '/api/v1/strategy' });
  await app.register(dashboardRoutes, { prefix: '/api/v1/dashboard' });
  await app.register(analyticsRoutes, { prefix: '/api/v1/analytics' });
  await app.register(reportsRoutes, { prefix: '/api/v1/reports' });

  return app;
}
