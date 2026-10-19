/**
 * @ecosystem/gateway
 * API Gateway for the business ecosystem
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import proxy from '@fastify/http-proxy';
import { createLogger } from '@ecosystem/logging';
import { registerHealthCheck, healthRoutes, createMemoryHealthCheck } from '@ecosystem/health';
import { services, ServiceConfig } from './config/services.js';
import { authMiddleware, extractUserHeaders } from './middleware/auth.js';

const logger = createLogger({
  serviceName: 'gateway',
  level: (process.env.LOG_LEVEL as any) || 'info',
});

async function buildGateway() {
  const app = Fastify({
    logger: true,
    requestIdHeader: 'x-request-id',
    genReqId: () => crypto.randomUUID(),
  });

  // Security plugins
  await app.register(helmet);
  await app.register(cors, {
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  });

  // Rate limiting (global)
  await app.register(rateLimit, {
    max: 1000,
    timeWindow: '1 minute',
  });

  // JWT verification
  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'development-secret-change-in-production',
  });

  // Correlation ID handling
  app.addHook('onRequest', async (request, reply) => {
    request.correlationId = 
      (request.headers['x-correlation-id'] as string) || 
      crypto.randomUUID();
    reply.header('x-correlation-id', request.correlationId);
    reply.header('x-request-id', request.id);
  });

  // Register health checks
  registerHealthCheck(createMemoryHealthCheck());
  healthRoutes(app, { 
    service: 'gateway', 
    version: process.env.npm_package_version || '0.1.0' 
  });

  // Register proxy routes for each service
  for (const service of services) {
    await app.register(proxy, {
      upstream: service.upstream,
      prefix: service.prefix,
      rewritePrefix: '',
      
      // Pre-handler for auth
      preHandler: async (request, reply) => {
        await authMiddleware(request, reply, service);
      },

      // Add user context headers
      replyOptions: {
        rewriteRequestHeaders: (request, headers) => {
          const userHeaders = extractUserHeaders(request as any);
          return {
            ...headers,
            ...userHeaders,
          };
        },
      },
    });

    logger.info({ service: service.name, prefix: service.prefix }, 'Registered service route');
  }

  // Service discovery endpoint
  app.get('/api/v1/services', async () => {
    return {
      services: services.map(s => ({
        name: s.name,
        prefix: s.prefix,
        healthCheck: s.prefix + (s.healthCheck || '/health'),
      })),
    };
  });

  // Aggregate health check
  app.get('/api/v1/health/services', async () => {
    const results = await Promise.allSettled(
      services.map(async (service) => {
        const start = Date.now();
        try {
          const url = service.upstream + (service.healthCheck || '/health');
          const response = await fetch(url);
          return {
            name: service.name,
            status: response.ok ? 'healthy' : 'unhealthy',
            latencyMs: Date.now() - start,
          };
        } catch {
          return {
            name: service.name,
            status: 'unhealthy',
            latencyMs: Date.now() - start,
          };
        }
      })
    );

    const serviceHealth = results.map((r, i) => 
      r.status === 'fulfilled' ? r.value : { name: services[i]?.name ?? 'unknown', status: 'unhealthy' }
    );

    const allHealthy = serviceHealth.every(s => s.status === 'healthy');
    const anyHealthy = serviceHealth.some(s => s.status === 'healthy');

    return {
      status: allHealthy ? 'healthy' : anyHealthy ? 'degraded' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services: serviceHealth,
    };
  });

  return app;
}

async function start() {
  const app = await buildGateway();
  const port = parseInt(process.env.PORT || '8080');
  const host = process.env.HOST || '0.0.0.0';

  await app.listen({ port, host });
  logger.info({ port, host }, 'Gateway started');
}

start().catch((err) => {
  logger.error(err, 'Failed to start gateway');
  process.exit(1);
});
