/**
 * @foundational/tax
 *
 * UK Tax Service for the business ecosystem.
 *
 * Handles UK tax compliance including:
 * - Corporation Tax (FY2023/24+ rates with marginal relief)
 * - VAT (MTD compliant, 9-box format)
 * - PAYE / National Insurance
 *
 * @module @foundational/tax
 */

// Domain Value Objects
export * from './domain/value-objects/index.js';

// UK Tax Registration
export * from './domain/uk-registration/index.js';

// Corporation Tax
export * from './domain/corporation-tax/index.js';

// VAT
export * from './domain/vat/index.js';

// PAYE
export * from './domain/paye/index.js';

// Tax Provision
export * from './domain/tax-provision/index.js';

// Tax Calendar
export * from './domain/tax-calendar/index.js';

// Penalties
export * from './domain/penalties/index.js';

// Legacy entities (for backwards compatibility)
export * from './domain/entities/index.js';

// Infrastructure
export { getDb, healthCheck, closeDatabase } from './infrastructure/persistence/database.js';
export * from './infrastructure/persistence/repositories/index.js';
export * from './infrastructure/messaging/index.js';

// API
export { buildApp } from './api/rest/app.js';

// Start server if run directly
import { buildApp } from './api/rest/app.js';
import { env } from './env.js';
import { initializeEventBus, shutdownEventBus } from './infrastructure/messaging/index.js';
import { UKTaxRegistrationRepository } from './infrastructure/persistence/repositories/index.js';
import { getDb } from './infrastructure/persistence/database.js';

const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  const start = async () => {
    try {
      // Initialize database
      const db = getDb();

      // Initialize event bus for consuming external events
      const registrationRepository = new UKTaxRegistrationRepository(db as any);
      await initializeEventBus(env.RABBITMQ_URL, {
        registrationRepository,
        logger: console,
      });

      // Build and start Fastify app
      const app = await buildApp();

      // Graceful shutdown
      app.addHook('onClose', async () => {
        await shutdownEventBus();
      });

      await app.listen({ port: env.PORT, host: '0.0.0.0' });
      console.log(`UK Tax Service listening on port ${env.PORT}`);
      console.log(`API docs available at http://localhost:${env.PORT}/docs`);
      console.log(`Event bus: ${env.RABBITMQ_URL ? 'enabled' : 'disabled'}`);
    } catch (err) {
      console.error('Failed to start server:', err);
      process.exit(1);
    }
  };

  start();
}
