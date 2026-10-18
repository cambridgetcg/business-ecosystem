import 'reflect-metadata';
import { buildApp } from './api/rest/app.js';
import { env } from './env.js';
import { initializeEventBus, shutdownEventBus } from './infrastructure/messaging/index.js';

const start = async (): Promise<void> => {
  // Initialize event bus (optional - graceful degradation if unavailable)
  await initializeEventBus(env.RABBITMQ_URL);

  const app = await buildApp();

  // Graceful shutdown
  app.addHook('onClose', async () => {
    await shutdownEventBus();
  });

  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  console.log(`Server running on http://localhost:${env.PORT}`);
};

start().catch(console.error);
