/**
 * Prisma Client Singleton for Data Privacy Service
 */

import { PrismaClient } from '#prisma';
import { logger } from './logger.js';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export async function initializePrisma(): Promise<PrismaClient> {
  if (global.prisma) {
    logger.info('Prisma client already initialized');
    return global.prisma;
  }

  logger.info('Initializing Prisma client...');

  const isDev = process.env.NODE_ENV !== 'production';

  const client = new PrismaClient({
    log: isDev
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'warn' },
          { emit: 'event', level: 'error' },
        ]
      : [
          { emit: 'event', level: 'warn' },
          { emit: 'event', level: 'error' },
        ],
  });

  client.$on('warn', (e) => {
    logger.warn({ message: e.message }, 'Prisma warning');
  });

  client.$on('error', (e) => {
    logger.error({ message: e.message }, 'Prisma error');
  });

  try {
    await client.$connect();
    logger.info('Prisma client connected to database');
  } catch (error) {
    logger.error({ error }, 'Failed to connect to database');
    throw error;
  }

  global.prisma = client;
  return client;
}

export async function disconnectPrisma(): Promise<void> {
  if (!global.prisma) {
    return;
  }

  logger.info('Disconnecting Prisma client...');
  await global.prisma.$disconnect();
  global.prisma = undefined;
  logger.info('Prisma client disconnected');
}

export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  latencyMs?: number;
  error?: string;
}> {
  const client = global.prisma;

  if (!client) {
    return { healthy: false, error: 'Prisma client not initialized' };
  }

  const start = Date.now();

  try {
    await client.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - start;
    return { healthy: true, latencyMs };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export type { PrismaClient };
