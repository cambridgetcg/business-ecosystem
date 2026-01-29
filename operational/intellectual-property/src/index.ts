/**
 * Intellectual Property Service Entry Point
 * Framework: Fastify (per BACKBONE.md standards)
 */

import 'reflect-metadata';
import { buildApp } from './api/rest/app.js';
import { createPool, getDatabase, closePool } from './infrastructure/persistence/database.js';
import { createCacheService } from './infrastructure/cache/index.js';
import { createEventPublisher } from './infrastructure/messaging/index.js';

const start = async () => {
  // Database setup with optimized pooling
  const pool = createPool({
    connectionString: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/ecosystem_dev',
    maxConnections: parseInt(process.env.DB_POOL_MAX ?? '20'),
    minConnections: parseInt(process.env.DB_POOL_MIN ?? '2'),
    idleTimeoutMs: parseInt(process.env.DB_IDLE_TIMEOUT ?? '30000'),
    connectionTimeoutMs: parseInt(process.env.DB_CONNECT_TIMEOUT ?? '5000'),
    ssl: process.env.DB_SSL === 'true',
  });

  const db = getDatabase(pool);

  // Cache setup - uses Redis if REDIS_URL is set, otherwise in-memory
  const cache = createCacheService({
    redisUrl: process.env.REDIS_URL,
    keyPrefix: 'ip-svc',
    defaultTtlSeconds: parseInt(process.env.CACHE_TTL ?? '300'),
    enabled: process.env.CACHE_ENABLED !== 'false',
  });

  // Event publisher setup - uses RabbitMQ if RABBITMQ_URL is set, otherwise in-memory
  const eventPublisher = createEventPublisher({
    rabbitmqUrl: process.env.RABBITMQ_URL,
    exchange: process.env.RABBITMQ_EXCHANGE ?? 'ecosystem.ip',
    enabled: process.env.EVENTS_ENABLED !== 'false',
  });

  // Connect event publisher if using RabbitMQ
  if (process.env.RABBITMQ_URL) {
    await eventPublisher.connect();
  }

  // Build app with dependencies
  const app = await buildApp({ db, pool, cache, eventPublisher });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down gracefully...`);
    await app.close();
    await eventPublisher.disconnect();
    await cache.close();
    await closePool();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Start server
  const port = parseInt(process.env.PORT ?? '3014');
  const host = process.env.HOST ?? '0.0.0.0';

  try {
    await app.listen({ port, host });
    console.log(`Intellectual-Property service running at http://${host}:${port}`);
    console.log(`API Documentation available at http://${host}:${port}/docs`);
    const cacheType = process.env.REDIS_URL ? 'Redis' : 'In-Memory';
    console.log(`Cache: ${cacheType}`);
    const eventingType = process.env.RABBITMQ_URL ? 'RabbitMQ' : 'In-Memory';
    console.log(`Events: ${eventingType}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
