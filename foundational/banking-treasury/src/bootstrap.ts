/**
 * Application Bootstrap
 *
 * Initializes all application dependencies and starts the service.
 * This is the single entry point for configuring the application.
 *
 * @module bootstrap
 */

import type { FastifyInstance } from 'fastify';
import { initializeContainer, registerServices, TOKENS, resolve, isRegistered } from './core/di/index.js';
import { EventBus, registerAllEventHandlers } from './core/events/index.js';

/**
 * Application instance with all initialized components.
 */
export interface Application {
  app?: FastifyInstance | undefined;
  eventBus: EventBus;
  shutdown: () => Promise<void>;
}

/**
 * Bootstrap options.
 */
export interface BootstrapOptions {
  /** Skip starting the HTTP server (for testing) */
  skipServer?: boolean;
  /** Custom port override */
  port?: number;
}

/**
 * Bootstrap the application.
 *
 * This function:
 * 1. Initializes the DI container
 * 2. Sets up event handlers
 * 3. Registers all services
 * 4. Optionally builds the HTTP server
 *
 * @returns Initialized application instance
 */
export async function bootstrap(options: BootstrapOptions = {}): Promise<Application> {
  console.log('Bootstrapping Banking-Treasury service...');
  const nodeEnv = process.env['NODE_ENV'] ?? 'development';
  console.log(`Environment: ${nodeEnv}`);

  // Initialize DI container
  console.log('Initializing dependency injection container...');
  await initializeContainer({});

  // Get event bus and set up handlers
  const eventBus = resolve<EventBus>(TOKENS.EventBus);

  console.log('Registering event handlers...');
  registerAllEventHandlers(eventBus);

  // Register application services
  console.log('Registering application services...');
  registerServices();

  let app: FastifyInstance | undefined;

  // Build HTTP application if not skipped
  if (!options.skipServer) {
    try {
      // Dynamically import the app builder
      const { buildApp } = await import('./api/rest/app.js');
      console.log('Building HTTP server...');
      app = await buildApp();

      const port = options.port ?? parseInt(process.env['PORT'] ?? '3000', 10);
      await app.listen({ port, host: '0.0.0.0' });
      console.log(`Banking-Treasury service running on http://localhost:${port}`);
    } catch (error) {
      console.log('HTTP server not built (app.ts may not exist yet)');
    }
  }

  // Create shutdown handler
  const shutdown = async (): Promise<void> => {
    console.log('Shutting down Banking-Treasury service...');

    if (app) {
      try {
        await app.close();
        console.log('HTTP server closed');
      } catch (error) {
        console.error('Error closing HTTP server:', error);
      }
    }

    eventBus.clear();
    console.log('Event handlers cleared');
    console.log('Shutdown complete');
  };

  return {
    app,
    eventBus,
    shutdown,
  };
}

/**
 * Setup process signal handlers for graceful shutdown.
 */
export function setupSignalHandlers(application: Application): void {
  const handleSignal = async (signal: string): Promise<void> => {
    console.log(`Received ${signal}, initiating graceful shutdown...`);
    await application.shutdown();
    process.exit(0);
  };

  process.on('SIGTERM', () => handleSignal('SIGTERM'));
  process.on('SIGINT', () => handleSignal('SIGINT'));

  process.on('uncaughtException', async (error) => {
    console.error('Uncaught Exception:', error);
    await application.shutdown();
    process.exit(1);
  });

  process.on('unhandledRejection', async (reason) => {
    console.error('Unhandled Rejection:', reason);
    await application.shutdown();
    process.exit(1);
  });
}

/**
 * Main entry point.
 */
export async function main(): Promise<void> {
  try {
    const application = await bootstrap();
    setupSignalHandlers(application);
  } catch (error) {
    console.error('Failed to bootstrap application:', error);
    process.exit(1);
  }
}
