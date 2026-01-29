import 'reflect-metadata';
import { buildApp } from './api/rest/app.js';
import { env } from './env.js';

const start = async (): Promise<void> => {
  const app = await buildApp();
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  console.log(`Server running on http://localhost:${env.PORT}`);
};

start().catch(console.error);
