/**
 * @ecosystem/gateway
 * API Gateway for the business ecosystem
 *
 * Central entry point providing:
 * - Authentication & Authorization (JWT + RBAC)
 * - Rate limiting (global + per-service)
 * - Circuit breaker for resilience
 * - Request routing to downstream services
 * - Health aggregation
 * - Distributed tracing correlation
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import proxy from '@fastify/http-proxy';
import { createLogger } from '@ecosystem/logging';
import { registerHealthCheck, healthRoutes, createMemoryHealthCheck } from '@ecosystem/health';
import { services, ServiceConfig, getServicesByLayer, getCriticalServices } from './config/services.js';
import { authMiddleware, extractUserHeaders } from './middleware/auth.js';
import {
  circuitBreakerRegistry,
  createCircuitBreakerHandler,
  recordCircuitBreakerResult,
} from './middleware/circuit-breaker.js';
import { createRequestLoggingHooks } from './middleware/request-logger.js';

const logger = createLogger({
  serviceName: 'gateway',
  level: (process.env.LOG_LEVEL as any) || 'info',
});

declare module 'fastify' {
  interface FastifyRequest {
    correlationId?: string;
    requestId?: string;
  }
}

async function buildGateway() {
  const app = Fastify({
    logger: true,
    requestIdHeader: 'x-request-id',
    genReqId: () => crypto.randomUUID(),
  });

  // ==========================================================================
  // SECURITY PLUGINS
  // ==========================================================================

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  });

  await app.register(cors, {
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID', 'X-Request-ID'],
  });

  // Global rate limiting
  await app.register(rateLimit, {
    max: parseInt(process.env.RATE_LIMIT_MAX || '1000'),
    timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute',
    keyGenerator: (request) => {
      return request.headers['x-forwarded-for'] as string || request.ip;
    },
  });

  // JWT verification
  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'development-secret-change-in-production',
  });

  // ==========================================================================
  // REQUEST LIFECYCLE HOOKS
  // ==========================================================================

  const requestLogging = createRequestLoggingHooks();

  // Correlation ID handling
  app.addHook('onRequest', async (request, reply) => {
    request.correlationId =
      (request.headers['x-correlation-id'] as string) || crypto.randomUUID();
    request.requestId = request.id;
    reply.header('x-correlation-id', request.correlationId);
    reply.header('x-request-id', request.id);
    reply.header('x-gateway-version', process.env.npm_package_version || '0.1.0');

    requestLogging.onRequest(request);
  });

  app.addHook('onResponse', async (request, reply) => {
    requestLogging.onResponse(request, reply);
  });

  app.addHook('onError', async (request, reply, error) => {
    requestLogging.onError(request, reply, error);
  });

  // ==========================================================================
  // HEALTH ENDPOINTS
  // ==========================================================================

  registerHealthCheck(createMemoryHealthCheck());
  healthRoutes(app, {
    service: 'gateway',
    version: process.env.npm_package_version || '0.1.0',
  });

  // ==========================================================================
  // SERVICE PROXY ROUTES
  // ==========================================================================

  for (const service of services) {
    const circuitBreakerHandler = createCircuitBreakerHandler({
      serviceName: service.name,
      config: service.circuitBreaker,
    });

    await app.register(proxy, {
      upstream: service.upstream,
      prefix: service.prefix,
      rewritePrefix: '',
      http2: false,

      // Pre-handlers: circuit breaker check, then auth
      preHandler: async (request, reply) => {
        // Check circuit breaker first
        await circuitBreakerHandler(request, reply);
        if (reply.sent) return;

        // Then authenticate
        await authMiddleware(request, reply, service);
      },

      // Add user context and tracing headers
      replyOptions: {
        rewriteRequestHeaders: (request, headers) => {
          const userHeaders = extractUserHeaders(request as any);
          return {
            ...headers,
            ...userHeaders,
            'x-forwarded-service': 'gateway',
          };
        },
        onResponse: (request, reply, res) => {
          // Record result to circuit breaker
          const statusCode = res.statusCode;
          if (statusCode >= 500) {
            recordCircuitBreakerResult(request as any, reply as any, new Error(`Status ${statusCode}`));
          } else {
            recordCircuitBreakerResult(request as any, reply as any);
          }
          reply.send(res);
        },
      },
    });

    logger.info(
      { service: service.name, prefix: service.prefix, layer: service.layer },
      'Registered service route'
    );
  }

  // ==========================================================================
  // SERVICE DISCOVERY ENDPOINTS
  // ==========================================================================

  app.get('/api/v1/services', async () => {
    return {
      services: services.map((s) => ({
        name: s.name,
        prefix: s.prefix,
        layer: s.layer,
        critical: s.critical || false,
        healthCheck: s.prefix + (s.healthCheck || '/health'),
      })),
      layers: {
        foundational: getServicesByLayer('foundational').map((s) => s.name),
        operational: getServicesByLayer('operational').map((s) => s.name),
        orchestration: getServicesByLayer('orchestration').map((s) => s.name),
      },
    };
  });

  // ==========================================================================
  // HEALTH AGGREGATION
  // ==========================================================================

  app.get('/api/v1/health/services', async () => {
    const results = await Promise.allSettled(
      services.map(async (service) => {
        const start = Date.now();
        const circuitBreaker = circuitBreakerRegistry.get(service.name);
        const stats = circuitBreaker.getStats();

        // If circuit is open, don't even try
        if (stats.state === 'OPEN') {
          return {
            name: service.name,
            layer: service.layer,
            status: 'circuit_open',
            latencyMs: 0,
            circuitState: stats.state,
          };
        }

        try {
          const url = service.upstream + (service.healthCheck || '/health');
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);

          const response = await fetch(url, { signal: controller.signal });
          clearTimeout(timeout);

          return {
            name: service.name,
            layer: service.layer,
            status: response.ok ? 'healthy' : 'unhealthy',
            latencyMs: Date.now() - start,
            circuitState: stats.state,
          };
        } catch {
          return {
            name: service.name,
            layer: service.layer,
            status: 'unhealthy',
            latencyMs: Date.now() - start,
            circuitState: stats.state,
          };
        }
      })
    );

    const serviceHealth = results.map((r, i) =>
      r.status === 'fulfilled'
        ? r.value
        : { name: services[i].name, layer: services[i].layer, status: 'unhealthy' }
    );

    const healthyCount = serviceHealth.filter((s) => s.status === 'healthy').length;
    const criticalServices = getCriticalServices();
    const criticalHealthy = serviceHealth.filter(
      (s) => criticalServices.some((cs) => cs.name === s.name) && s.status === 'healthy'
    ).length;

    let overallStatus: 'healthy' | 'degraded' | 'critical' | 'unhealthy';
    if (healthyCount === services.length) {
      overallStatus = 'healthy';
    } else if (criticalHealthy === criticalServices.length) {
      overallStatus = 'degraded';
    } else if (criticalHealthy > 0) {
      overallStatus = 'critical';
    } else {
      overallStatus = 'unhealthy';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      summary: {
        total: services.length,
        healthy: healthyCount,
        unhealthy: services.length - healthyCount,
        criticalHealthy: criticalHealthy,
        criticalTotal: criticalServices.length,
      },
      services: serviceHealth,
    };
  });

  // ==========================================================================
  // CIRCUIT BREAKER MANAGEMENT
  // ==========================================================================

  app.get('/api/v1/admin/circuit-breakers', async () => {
    return {
      breakers: circuitBreakerRegistry.getAllStats(),
      timestamp: new Date().toISOString(),
    };
  });

  app.post('/api/v1/admin/circuit-breakers/:serviceName/reset', async (request) => {
    const { serviceName } = request.params as { serviceName: string };
    circuitBreakerRegistry.reset(serviceName);
    return {
      message: `Circuit breaker for ${serviceName} reset`,
      timestamp: new Date().toISOString(),
    };
  });

  app.post('/api/v1/admin/circuit-breakers/reset-all', async () => {
    circuitBreakerRegistry.reset();
    return {
      message: 'All circuit breakers reset',
      timestamp: new Date().toISOString(),
    };
  });

  // ==========================================================================
  // ERROR HANDLERS
  // ==========================================================================

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      error: 'Not Found',
      message: `Route ${request.method} ${request.url} not found`,
      timestamp: new Date().toISOString(),
    });
  });

  app.setErrorHandler((error, request, reply) => {
    logger.error({ error, url: request.url, method: request.method }, 'Gateway error');

    const statusCode = error.statusCode || 500;
    reply.code(statusCode).send({
      error: error.name || 'Internal Server Error',
      message: statusCode < 500 ? error.message : 'An internal error occurred',
      correlationId: request.correlationId,
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}

async function start() {
  const app = await buildGateway();
  const port = parseInt(process.env.PORT || '8080');
  const host = process.env.HOST || '0.0.0.0';

  await app.listen({ port, host });

  logger.info({ port, host }, 'Gateway started');
  logger.info(
    {
      services: services.length,
      layers: {
        foundational: getServicesByLayer('foundational').length,
        operational: getServicesByLayer('operational').length,
        orchestration: getServicesByLayer('orchestration').length,
      },
      features: {
        circuitBreaker: true,
        rateLimit: true,
        jwt: true,
        cors: true,
      },
    },
    'Gateway configuration'
  );
}

start().catch((err) => {
  logger.error(err, 'Failed to start gateway');
  process.exit(1);
});
