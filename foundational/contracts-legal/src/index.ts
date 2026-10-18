import 'reflect-metadata';
import { buildApp } from './api/rest/app.js';
import { env } from './env.js';
import { initializeDatabase } from './infrastructure/persistence/index.js';
import { initializeEventBus, shutdownEventBus } from './infrastructure/messaging/index.js';

const start = async (): Promise<void> => {
  // Initialize database
  initializeDatabase(env.DATABASE_URL);
  console.log('[ContractsLegal] Database initialized');

  // Initialize event bus for cross-service communication
  try {
    await initializeEventBus(env.RABBITMQ_URL);
  } catch (error) {
    console.error('[ContractsLegal] Event bus initialization failed, continuing without messaging:', error);
  }

  const app = await buildApp();

  // Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    console.log(`[ContractsLegal] Received ${signal}, shutting down...`);
    await shutdownEventBus();
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  console.log(`[ContractsLegal] Server running on http://localhost:${env.PORT}`);
  console.log(`[ContractsLegal] API docs at http://localhost:${env.PORT}/docs`);
};

start().catch(console.error);
