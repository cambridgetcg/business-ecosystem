/**
 * Data Privacy Service Entry Point
 */

import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { initializePrisma, disconnectPrisma } from './lib/prisma.js';
import { logger } from './lib/logger.js';
import { eventPublisher } from './lib/events.js';
import { serverConfig, serviceConfig } from './env.js';

async function main() {
  logger.info({
    service: serviceConfig.name,
    version: serviceConfig.version,
    env: serverConfig.nodeEnv,
  }, 'Starting Data Privacy service...');

  // Initialize database connection
  const prisma = await initializePrisma();

  // Connect to RabbitMQ for event publishing
  await eventPublisher.connect();

  // Create application
  const app = createApp({ prisma });

  // Start server
  const { port, host } = serverConfig;

  const server = serve({
    fetch: app.fetch,
    port,
    hostname: host,
  }, (info) => {
    logger.info({
      port: info.port,
      host,
      env: serverConfig.nodeEnv,
      version: serviceConfig.version,
    }, `Data-Privacy service running at http://${host}:${info.port}`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Received shutdown signal');

    server.close(() => {
      logger.info('HTTP server closed');
    });

    await eventPublisher.disconnect();
    logger.info('RabbitMQ connection closed');

    await disconnectPrisma();
    logger.info('Database connection closed');

    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  logger.error({ error }, 'Failed to start service');
  process.exit(1);
});
