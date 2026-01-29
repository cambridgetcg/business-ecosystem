/**
 * Contracts & Legal Service Entry Point
 */

import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { initializePrisma, disconnectPrisma } from './lib/prisma.js';
import { logger } from './lib/logger.js';

async function main() {
  logger.info('Starting Contracts & Legal service...');

  // Initialize database connection
  const prisma = await initializePrisma();

  // Create application
  const app = createApp({ prisma });

  // Start server
  const port = parseInt(process.env.PORT || '3011', 10);
  const host = process.env.HOST || '0.0.0.0';

  const server = serve({
    fetch: app.fetch,
    port,
    hostname: host,
  }, (info) => {
    logger.info({
      port: info.port,
      host,
      env: process.env.NODE_ENV || 'development',
    }, 'Contracts-Legal service running at http://' + host + ':' + info.port);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Received shutdown signal');

    server.close(() => {
      logger.info('HTTP server closed');
    });

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
