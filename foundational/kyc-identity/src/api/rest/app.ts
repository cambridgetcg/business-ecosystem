import Fastify from 'fastify';
import { env } from '../../env.js';
import { identityRoutes, documentRoutes, verificationRoutes } from './routes/index.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
  });

  // Health check
  app.get('/health', () => ({ status: 'ok' }));

  // Register API routes under /api/v1
  await app.register(async (api) => {
    await api.register(identityRoutes);
    await api.register(documentRoutes);
    await api.register(verificationRoutes);
  }, { prefix: '/api/v1' });

  // Global error handler
  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);

    if (error.message === 'Missing x-tenant-id header') {
      return reply.status(400).send({ error: 'Missing required x-tenant-id header' });
    }

    if (error.name === 'ZodError') {
      return reply.status(400).send({ error: 'Validation error', details: error });
    }

    return reply.status(500).send({ error: 'Internal server error' });
  });

  return app;
}
