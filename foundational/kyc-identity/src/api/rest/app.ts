import Fastify from 'fastify';
import { env } from '../../env.js';
import { identityRoutes, documentRoutes, verificationRoutes } from './routes/index.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
  });

  // Global error handler. Set before the routes are registered: a plugin
  // context takes its parent's error handler when it loads, so a handler set
  // afterwards never reached the /api/v1 routes.
  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);

    if (error.message === 'Missing x-tenant-id header') {
      return reply.status(400).send({ error: 'Missing required x-tenant-id header' });
    }

    if (error.name === 'ZodError') {
      return reply.status(400).send({ error: 'Validation error', details: error });
    }

    // Fastify's own client errors (route schema validation, unparsable
    // bodies) keep their status.
    if (error.statusCode !== undefined && error.statusCode < 500) {
      return reply.status(error.statusCode).send({ error: error.message });
    }

    return reply.status(500).send({ error: 'Internal server error' });
  });

  // Health check
  app.get('/health', () => ({ status: 'ok' }));

  // Register API routes under /api/v1
  await app.register(async (api) => {
    await api.register(identityRoutes);
    await api.register(documentRoutes);
    await api.register(verificationRoutes);
  }, { prefix: '/api/v1' });

  return app;
}
