/**
 * Corporate Security Service Entry Point
 */

import { createApp } from './api/rest/app.js';
import { env } from './env.js';
import { initializeEventBus, shutdownEventBus } from './infrastructure/messaging/index.js';

async function main() {
  console.log('[CorporateSecurity] Starting service...');

  // Initialize event bus for cross-service communication
  try {
    await initializeEventBus(env.RABBITMQ_URL);
  } catch (error) {
    console.error('[CorporateSecurity] Event bus initialization failed, continuing without messaging:', error);
  }

  const app = await createApp();

  // Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    console.log(`[CorporateSecurity] Received ${signal}, shutting down...`);
    try {
      await shutdownEventBus();
      await app.close();
      console.log('[CorporateSecurity] Shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('[CorporateSecurity] Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`[CorporateSecurity] Service running on http://localhost:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();

// Export for testing
export { createApp };
export * from './domain/index.js';
export * from './application/services/index.js';
export * from './infrastructure/messaging/index.js';
