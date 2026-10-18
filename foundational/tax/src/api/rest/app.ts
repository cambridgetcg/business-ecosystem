/**
 * UK Tax Service - Fastify Application
 *
 * REST API for UK tax compliance including:
 * - Tax registrations (UTR, VAT, PAYE)
 * - Corporation Tax periods
 * - VAT returns (MTD compliant)
 * - PAYE submissions (RTI)
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import compress from '@fastify/compress';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import etag from '@fastify/etag';
import requestContext from '@fastify/request-context';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { createRabbitMQPublisher, type RabbitMQPublisher } from '@ecosystem/messaging';
import { nanoid } from 'nanoid';
import { env } from '../../env.js';
import { getDb, healthCheck } from '../../infrastructure/persistence/database.js';
import {
  UKTaxRegistrationRepository,
  CorporationTaxRepository,
  VATReturnRepository,
  PAYESubmissionRepository,
  EmployeeTaxRecordRepository,
} from '../../infrastructure/persistence/repositories/index.js';
import { createEventPublisher, type EventPublisher } from '../../infrastructure/messaging/index.js';
import {
  HMRCOAuthClient,
  HMRCApiClient,
  DrizzleTokenStore,
  VATSubmissionService,
  InMemoryTokenStore,
} from '../../infrastructure/hmrc/index.js';
import { registrationRoutes } from './routes/registrations.js';
import { corporationTaxRoutes } from './routes/corporation-tax.js';
import { vatRoutes } from './routes/vat.js';
import { payeRoutes } from './routes/paye.js';
import { hmrcOAuthRoutes } from './routes/hmrc-oauth.js';

let rabbitMQPublisher: RabbitMQPublisher | null = null;

export async function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV === 'development'
      ? { level: env.LOG_LEVEL, transport: { target: 'pino-pretty' } }
      : { level: env.LOG_LEVEL },
    genReqId: () => nanoid(),
    requestIdHeader: 'x-request-id',
    trustProxy: true,
  });

  // ==========================================================================
  // Security Plugins
  // ==========================================================================
  await app.register(cors, {
    origin: env.NODE_ENV === 'production' ? false : true,
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

  // Rate limiting
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
    errorResponseBuilder: (_req, context) => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Try again in ${context.after}`,
      retryAfter: context.after,
    }),
  });

  // ==========================================================================
  // Request Context
  // ==========================================================================
  await app.register(requestContext, {
    defaultStoreValues: {
      requestId: '',
      userId: '',
      correlationId: '',
    },
  });

  app.addHook('onRequest', async (request) => {
    request.requestContext.set('requestId', request.id);
    request.requestContext.set('correlationId', request.headers['x-correlation-id'] as string || request.id);
  });

  // ==========================================================================
  // API Documentation
  // ==========================================================================
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'UK Tax Service API',
        description: 'UK tax compliance - Corporation Tax, VAT (MTD), PAYE/NI',
        version: '0.1.0',
      },
      servers: [{ url: 'http://localhost:' + env.PORT }],
      tags: [
        { name: 'Health', description: 'Health check endpoints' },
        { name: 'Registrations', description: 'UK tax registration management' },
        { name: 'Corporation Tax', description: 'Corporation Tax periods and calculations' },
        { name: 'VAT', description: 'VAT returns (MTD compliant)' },
        { name: 'PAYE', description: 'PAYE submissions (RTI)' },
        { name: 'Employees', description: 'Employee tax records' },
        { name: 'HMRC OAuth', description: 'HMRC Making Tax Digital authorization' },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: true },
  });

  // ==========================================================================
  // Health Endpoints
  // ==========================================================================
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

  // ==========================================================================
  // Messaging Setup (Optional - Graceful Degradation)
  // ==========================================================================
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

  // ==========================================================================
  // Repositories Setup
  // ==========================================================================
  const db = getDb();
  const registrationRepository = new UKTaxRegistrationRepository(db as any);
  const corporationTaxRepository = new CorporationTaxRepository(db as any);
  const vatReturnRepository = new VATReturnRepository(db as any);
  const payeSubmissionRepository = new PAYESubmissionRepository(db as any);
  const employeeTaxRecordRepository = new EmployeeTaxRecordRepository(db as any);

  // ==========================================================================
  // HMRC MTD Setup
  // ==========================================================================
  let hmrcOAuthClient: HMRCOAuthClient | undefined;
  let hmrcTokenStore: DrizzleTokenStore | InMemoryTokenStore | undefined;
  let hmrcApiClient: HMRCApiClient | undefined;
  let vatSubmissionService: VATSubmissionService | undefined;

  if (env.HMRC_CLIENT_ID && env.HMRC_CLIENT_SECRET) {
    const hmrcEnvironment = env.HMRC_ENVIRONMENT;
    const baseUrl = `http://localhost:${env.PORT}`;
    const redirectUri = env.HMRC_REDIRECT_URI || `${baseUrl}/api/v1/tax/hmrc/callback`;

    hmrcOAuthClient = new HMRCOAuthClient({
      clientId: env.HMRC_CLIENT_ID,
      clientSecret: env.HMRC_CLIENT_SECRET,
      redirectUri,
      environment: hmrcEnvironment,
      scopes: ['read:vat', 'write:vat'],
    });

    // Use database-backed token store in production, in-memory for development
    hmrcTokenStore = env.NODE_ENV === 'production'
      ? new DrizzleTokenStore(db as any, 'default-tenant')
      : new InMemoryTokenStore();

    hmrcApiClient = new HMRCApiClient({
      oauthClient: hmrcOAuthClient,
      tokenStore: hmrcTokenStore,
      environment: hmrcEnvironment,
      fraudPreventionHeaders: {
        govClientConnectionMethod: 'WEB_APP_VIA_SERVER',
        govVendorProductName: 'Business Ecosystem Tax Service',
        govVendorVersion: 'tax-service=0.1.0',
      },
    });

    vatSubmissionService = new VATSubmissionService(hmrcApiClient, {
      info: (msg, data) => app.log.info(data, msg),
      error: (msg, data) => app.log.error(data, msg),
    });

    app.log.info({ environment: hmrcEnvironment }, 'HMRC MTD integration configured');
  } else {
    app.log.warn('HMRC credentials not configured - MTD submission will use mock mode');
  }

  // ==========================================================================
  // Register Routes
  // ==========================================================================

  // Registration routes
  await app.register(
    async (instance) => {
      await registrationRoutes(instance, {
        registrationRepository,
        eventPublisher,
      });
    },
    { prefix: '/api/v1/tax/registrations' }
  );

  // Corporation Tax routes
  await app.register(
    async (instance) => {
      await corporationTaxRoutes(instance, {
        corporationTaxRepository,
        registrationRepository,
        eventPublisher,
      });
    },
    { prefix: '/api/v1/tax/corporation-tax' }
  );

  // VAT routes
  await app.register(
    async (instance) => {
      await vatRoutes(instance, {
        vatReturnRepository,
        registrationRepository,
        eventPublisher,
        vatSubmissionService,
      });
    },
    { prefix: '/api/v1/tax/vat' }
  );

  // PAYE routes
  await app.register(
    async (instance) => {
      await payeRoutes(instance, {
        payeSubmissionRepository,
        employeeTaxRecordRepository,
        registrationRepository,
        eventPublisher,
      });
    },
    { prefix: '/api/v1/tax/paye' }
  );

  // HMRC OAuth routes (if configured)
  if (hmrcOAuthClient && hmrcTokenStore) {
    await app.register(
      async (instance) => {
        await hmrcOAuthRoutes(instance, {
          oauthClient: hmrcOAuthClient!,
          tokenStore: hmrcTokenStore!,
        });
      },
      { prefix: '/api/v1/tax' }
    );
    app.log.info('HMRC OAuth routes registered');
  }

  // Expose VAT submission service for direct integration
  (app as any).vatSubmissionService = vatSubmissionService;
  (app as any).hmrcApiClient = hmrcApiClient;

  return app;
}
