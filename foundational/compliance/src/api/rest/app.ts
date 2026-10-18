/**
 * Compliance Service REST API
 *
 * Fastify application for the compliance service.
 *
 * @module api/rest/app
 */

import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { obligationRoutes } from './routes/obligations.js';
import { requirementRoutes } from './routes/requirements.js';
import { calendarRoutes } from './routes/calendar.js';
import { findingRoutes } from './routes/findings.js';
import { boiRoutes } from './routes/boi.js';
import { controlRoutes } from './routes/controls.js';
import { policyRoutes } from './routes/policies.js';
import { procedureRoutes } from './routes/procedures.js';
import { attestationRoutes } from './routes/attestations.js';
import { dashboardRoutes } from './routes/dashboard.js';
import type { Database } from '../../infrastructure/persistence/index.js';

export interface AppOptions {
  db: Database;
  logger?: boolean;
}

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: options.logger ?? true,
  });

  // Security middleware
  await fastify.register(cors, {
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  });

  await fastify.register(helmet, {
    contentSecurityPolicy: false,
  });

  // Health check
  fastify.get('/health', async () => ({
    status: 'healthy',
    service: 'compliance',
    timestamp: new Date().toISOString(),
  }));

  // Readiness check
  fastify.get('/ready', async () => ({
    status: 'ready',
    service: 'compliance',
    timestamp: new Date().toISOString(),
  }));

  // API routes
  await fastify.register(obligationRoutes, {
    prefix: '/api/v1',
    db: options.db,
  });

  await fastify.register(requirementRoutes, {
    prefix: '/api/v1',
    db: options.db,
  });

  await fastify.register(calendarRoutes, {
    prefix: '/api/v1',
    db: options.db,
  });

  await fastify.register(findingRoutes, {
    prefix: '/api/v1',
    db: options.db,
  });

  await fastify.register(boiRoutes, {
    prefix: '/api/v1',
    db: options.db,
  });

  await fastify.register(controlRoutes, {
    prefix: '/api/v1',
    db: options.db,
  });

  await fastify.register(policyRoutes, {
    prefix: '/api/v1',
    db: options.db,
  });

  await fastify.register(procedureRoutes, {
    prefix: '/api/v1',
    db: options.db,
  });

  await fastify.register(attestationRoutes, {
    prefix: '/api/v1',
    db: options.db,
  });

  await fastify.register(dashboardRoutes, {
    prefix: '/api/v1',
    db: options.db,
  });

  // Error handler
  fastify.setErrorHandler((error, request, reply) => {
    fastify.log.error(error);

    const statusCode = error.statusCode ?? 500;
    const message = statusCode === 500 ? 'Internal Server Error' : error.message;

    reply.status(statusCode).send({
      error: message,
      statusCode,
      timestamp: new Date().toISOString(),
    });
  });

  return fastify;
}

export async function startServer(options: AppOptions): Promise<FastifyInstance> {
  const app = await buildApp(options);
  const port = parseInt(process.env.PORT ?? '3007', 10);
  const host = process.env.HOST ?? '0.0.0.0';

  try {
    await app.listen({ port, host });
    console.log(`Compliance service listening on ${host}:${port}`);
    return app;
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}
