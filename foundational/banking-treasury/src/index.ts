import 'reflect-metadata';
import { buildApp } from './api/rest/app.js';
import { env } from './env.js';
import { getPool, closePool } from './infrastructure/database.js';
import { initializeEventBus, shutdownEventBus } from './infrastructure/messaging/index.js';

async function start(): Promise<void> {
  try {
    // Initialize database connection
    console.log('Initializing database connection...');
    const pool = await getPool();

    // Initialize event bus (optional - graceful degradation if unavailable)
    await initializeEventBus(env.RABBITMQ_URL, pool);

    // Build and start Fastify app
    const app = await buildApp();

    // Graceful shutdown
    app.addHook('onClose', async () => {
      await shutdownEventBus();
    });

    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`Banking-Treasury service running on http://localhost:${env.PORT}`);
    console.log(`Environment: ${env.NODE_ENV}`);
    console.log(`Event publishing: ${env.ENABLE_EVENT_PUBLISHING ? 'enabled' : 'disabled'}`);
    
  } catch (error) {
    console.error('Failed to start server:', error);
    await closePool();
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', async (error) => {
  console.error('Uncaught Exception:', error);
  await closePool();
  process.exit(1);
});

process.on('unhandledRejection', async (reason) => {
  console.error('Unhandled Rejection:', reason);
  await closePool();
  process.exit(1);
});

start();
