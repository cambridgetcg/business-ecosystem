import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import compress from '@fastify/compress';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import etag from '@fastify/etag';
import requestContext from '@fastify/request-context';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { createRabbitMQPublisher, type RabbitMQPublisher } from '@ecosystem/messaging';
import { nanoid } from 'nanoid';
import { env } from '../../env.js';
import { getDb, healthCheck } from '../../infrastructure/persistence/database.js';
import { DrizzleLegalEntityRepository } from '../../infrastructure/persistence/repositories/drizzle-legal-entity-repository.js';
import { DrizzleOfficerRepository } from '../../infrastructure/persistence/repositories/drizzle-officer-repository.js';
import { DrizzleShareholderRepository } from '../../infrastructure/persistence/repositories/drizzle-shareholder-repository.js';
import { LegalEntityCommandHandler } from '../../application/handlers/legal-entity-command-handler.js';
import { LegalEntityQueryHandler } from '../../application/handlers/legal-entity-query-handler.js';
import { createEventPublisher, type EventPublisher } from '../../infrastructure/integration/event-publisher.js';
import { legalEntitiesRoutes } from './routes/legal-entities.js';
import { officerRoutes } from './routes/officers.js';
import { shareholderRoutes } from './routes/shareholders.js';
import { filingsRoutes } from './routes/filings.js';
import { directorsRoutes } from './routes/directors.js';
import { registeredAgentRoutes } from './routes/registered-agents.js';
import { shareClassesRoutes } from './routes/share-classes.js';
import { meetingMinutesRoutes } from './routes/meeting-minutes.js';
import { resolutionsRoutes } from './routes/resolutions.js';

let rabbitMQPublisher: RabbitMQPublisher | null = null;

export async function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV === 'development'
      ? { level: env.LOG_LEVEL, transport: { target: 'pino-pretty' } }
      : { level: env.LOG_LEVEL },
    genReqId: () => nanoid(), // Generate unique request IDs
    requestIdHeader: 'x-request-id',
    trustProxy: true, // Trust proxy headers for proper client IP detection
  });

  // ==========================================================================
  // Security Plugins
  // ==========================================================================
  await app.register(cors, {
    origin: env.NODE_ENV === 'production' ? false : true, // Configure for production
    credentials: true,
  });
  await app.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
  });
  await app.register(cookie, {
    secret: env.JWT_SECRET || 'development-secret-change-in-production',
    hook: 'onRequest',
  });

  // JWT Authentication
  await app.register(jwt, {
    secret: env.JWT_SECRET || 'development-secret-change-in-production',
    sign: { expiresIn: '24h' },
  });

  // ==========================================================================
  // Performance Plugins
  // ==========================================================================
  await app.register(compress, { global: true });
  await app.register(etag);

  // Rate limiting - protect against abuse
  await app.register(rateLimit, {
    max: 100, // 100 requests per window
    timeWindow: '1 minute',
    errorResponseBuilder: (req, context) => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Try again in ${context.after}`,
      retryAfter: context.after,
    }),
  });

  // ==========================================================================
  // Request Context (for correlation IDs across async operations)
  // ==========================================================================
  await app.register(requestContext, {
    defaultStoreValues: {
      requestId: '',
      userId: '',
      correlationId: '',
    },
  });

  // Propagate request context
  app.addHook('onRequest', async (request) => {
    request.requestContext.set('requestId', request.id);
    request.requestContext.set('correlationId', request.headers['x-correlation-id'] as string || request.id);
  });

  // ==========================================================================
  // File Upload Support
  // ==========================================================================
  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max file size
      files: 5, // Max 5 files per request
    },
  });

  // ==========================================================================
  // API Documentation
  // ==========================================================================
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Entity Governance API',
        description: 'Legal entity formation, corporate structure, and governance management',
        version: '0.1.0',
      },
      servers: [{ url: 'http://localhost:' + env.PORT }],
      tags: [
        { name: 'Health', description: 'Health check endpoints' },
        { name: 'Legal Entities', description: 'Legal entity management' },
        { name: 'Officers', description: 'Corporate officer management' },
        { name: 'Corporate Structure', description: 'Parent-subsidiary relationships' },
        { name: 'Governance', description: 'Board and committee management' },
        { name: 'Shareholders', description: 'Shareholder and cap table management' },
        { name: 'Filings', description: 'Annual filings and compliance' },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: true },
  });

  // Health endpoints
  app.get('/health', { schema: { tags: ['Health'] } }, async () => ({ status: 'ok' }));

  app.get('/health/ready', { schema: { tags: ['Health'] } }, async () => {
    const dbHealthy = await healthCheck();
    if (!dbHealthy) {
      throw { statusCode: 503, message: 'Database not ready' };
    }
    return {
      status: 'ready',
      database: 'connected',
      messaging: rabbitMQPublisher?.connected ? 'connected' : 'disconnected',
    };
  });

  app.get('/health/live', { schema: { tags: ['Health'] } }, async () => ({ status: 'live' }));

  // Set up messaging (optional - graceful degradation if unavailable)
  let eventPublisher: EventPublisher | undefined;
  if (env.RABBITMQ_URL) {
    try {
      rabbitMQPublisher = createRabbitMQPublisher(env.RABBITMQ_URL, {
        exchange: 'ecosystem.events',
        exchangeType: 'topic',
        confirmMode: true,
      });
      await rabbitMQPublisher.connect();
      eventPublisher = createEventPublisher(rabbitMQPublisher);
      app.log.info('Connected to RabbitMQ for event publishing');
    } catch (error) {
      app.log.warn({ error }, 'Failed to connect to RabbitMQ - events will not be published');
    }
  } else {
    app.log.warn('RABBITMQ_URL not configured - events will not be published');
  }

  // Graceful shutdown
  app.addHook('onClose', async () => {
    if (rabbitMQPublisher) {
      await rabbitMQPublisher.disconnect();
      app.log.info('Disconnected from RabbitMQ');
    }
  });

  // Set up repositories and handlers
  const db = getDb();
  const legalEntityRepository = new DrizzleLegalEntityRepository(db as any);
  const officerRepository = new DrizzleOfficerRepository(db as any);
  const shareholderRepository = new DrizzleShareholderRepository(db as any);
  const commandHandler = new LegalEntityCommandHandler(legalEntityRepository, eventPublisher);
  const queryHandler = new LegalEntityQueryHandler(legalEntityRepository);

  // Register routes
  await app.register(
    async (instance) => {
      await legalEntitiesRoutes(instance, { commandHandler, queryHandler });
    },
    { prefix: '/api/v1/entities' }
  );

  // Officer routes
  await app.register(
    async (instance) => {
      await officerRoutes(instance, {
        officerRepository,
        entityRepository: legalEntityRepository,
        eventPublisher,
      });
    },
    { prefix: '/api/v1' }
  );

  // Shareholder routes
  await app.register(
    async (instance) => {
      await shareholderRoutes(instance, {
        shareholderRepository,
        entityRepository: legalEntityRepository,
        eventPublisher,
      });
    },
    { prefix: '/api/v1' }
  );

  // Filings routes (annual filings, compliance)
  await app.register(
    async (instance) => {
      await filingsRoutes(instance, { db: db as any });
    },
    { prefix: '/api/v1' }
  );

  // Directors/Boards routes
  await app.register(
    async (instance) => {
      await directorsRoutes(instance, { db: db as any });
    },
    { prefix: '/api/v1' }
  );

  // Registered agent routes
  await app.register(
    async (instance) => {
      await registeredAgentRoutes(instance, { db: db as any });
    },
    { prefix: '/api/v1' }
  );

  // Share classes routes
  await app.register(
    async (instance) => {
      await shareClassesRoutes(instance, { db: db as any });
    },
    { prefix: '/api/v1' }
  );

  // Meeting minutes routes
  await app.register(
    async (instance) => {
      await meetingMinutesRoutes(instance, { db: db as any });
    },
    { prefix: '/api/v1' }
  );

  // Resolutions routes
  await app.register(
    async (instance) => {
      await resolutionsRoutes(instance, { db: db as any });
    },
    { prefix: '/api/v1' }
  );

  return app;
}
