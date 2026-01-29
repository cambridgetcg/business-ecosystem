import Fastify, { type FastifyInstance, type FastifyError, type FastifyRequest, type FastifyReply } from 'fastify';
import { env } from '../../env.js';
import { accountRoutes } from './routes/accounts.js';
import { paymentRoutes } from './routes/payments.js';
import { treasuryRoutes } from './routes/treasury.js';

export async function buildApp(): Promise<FastifyInstance> {
  const loggerConfig = env.NODE_ENV === 'development' 
    ? {
        level: env.LOG_LEVEL,
        transport: {
          target: 'pino-pretty',
          options: { colorize: true },
        },
      }
    : { level: env.LOG_LEVEL };

  const app = Fastify({ logger: loggerConfig });

  // Health check
  app.get('/health', async () => ({
    status: 'ok',
    service: 'banking-treasury',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  }));

  // Readiness check
  app.get('/ready', async () => ({
    status: 'ready',
    service: 'banking-treasury',
  }));

  // API routes
  await app.register(accountRoutes, { prefix: '/api/v1' });
  await app.register(paymentRoutes, { prefix: '/api/v1' });
  await app.register(treasuryRoutes, { prefix: '/api/v1' });

  // Global error handler
  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    app.log.error({ err: error, requestId: request.id }, 'Request error');
    
    // Validation errors
    if (error.validation) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'Invalid request data',
        details: error.validation,
      });
    }

    // Not found
    if (error.statusCode === 404) {
      return reply.status(404).send({
        error: 'Not Found',
        message: error.message,
      });
    }

    // Default to 500
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred',
    });
  });

  return app;
}
