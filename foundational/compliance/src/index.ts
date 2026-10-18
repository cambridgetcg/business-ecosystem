/**
 * @foundational/compliance
 *
 * Compliance domain for the business ecosystem.
 * Handles regulatory requirement tracking, BOI/CTA filing,
 * compliance obligation management, and audit finding remediation.
 */

// Domain entities
export * from './domain/entities/index.js';

// Application services
export { ComplianceService } from './application/services/index.js';

// Infrastructure
export {
  initializeDatabase,
  getDatabase,
  closeDatabase,
  checkDatabaseHealth,
  type Database,
} from './infrastructure/persistence/index.js';

export {
  initializeEventBus,
  shutdownEventBus,
  getEventBus,
  getGlobalEventPublisher,
  ComplianceEventTypes,
  ExternalEventTypes,
} from './infrastructure/messaging/index.js';

// API
export { buildApp, startServer } from './api/rest/app.js';

// =============================================================================
// Standalone Server Entry Point
// =============================================================================

import { initializeDatabase, closeDatabase, checkDatabaseHealth } from './infrastructure/persistence/index.js';
import { initializeEventBus, shutdownEventBus } from './infrastructure/messaging/index.js';
import { ComplianceService } from './application/services/index.js';
import { buildApp } from './api/rest/app.js';

async function main(): Promise<void> {
  console.log('[Compliance] Starting compliance service...');

  // Initialize database
  const db = initializeDatabase(process.env.DATABASE_URL);

  // Create compliance service
  const complianceService = new ComplianceService(db);

  // Initialize event bus (if RabbitMQ URL is provided)
  await initializeEventBus(process.env.RABBITMQ_URL, complianceService);

  // Build and start the API server
  const app = await buildApp({ db, logger: true });

  const port = parseInt(process.env.PORT ?? '3007', 10);
  const host = process.env.HOST ?? '0.0.0.0';

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`[Compliance] Received ${signal}, shutting down gracefully...`);

    try {
      await app.close();
      await shutdownEventBus();
      await closeDatabase();
      console.log('[Compliance] Shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('[Compliance] Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    await app.listen({ port, host });
    console.log(`[Compliance] Service listening on ${host}:${port}`);

    // Check database health
    const dbHealthy = await checkDatabaseHealth();
    console.log(`[Compliance] Database health: ${dbHealthy ? 'OK' : 'FAILED'}`);
  } catch (error) {
    console.error('[Compliance] Failed to start server:', error);
    process.exit(1);
  }
}

// Only run main if this is the entry point
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch((error) => {
    console.error('[Compliance] Fatal error:', error);
    process.exit(1);
  });
}
