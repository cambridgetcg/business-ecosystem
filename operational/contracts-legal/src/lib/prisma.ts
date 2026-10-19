/**
 * Prisma Client Singleton
 *
 * Provides a single PrismaClient instance for the entire application.
 * Includes connection handling for AWS RDS with IAM authentication support.
 */

import { PrismaClient } from '#prisma';
import { Signer } from '@aws-sdk/rds-signer';
import { logger } from './logger.js';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

/**
 * Configuration for Prisma client
 */
interface PrismaConfig {
  datasourceUrl?: string;
  log?: Array<'query' | 'info' | 'warn' | 'error'>;
}

/**
 * Generate IAM authentication token for RDS
 */
async function generateRdsAuthToken(): Promise<string> {
  const region = process.env.AWS_REGION || 'us-east-1';
  const hostname = process.env.RDS_HOSTNAME;
  const port = parseInt(process.env.RDS_PORT || '5432', 10);
  const username = process.env.RDS_USERNAME || 'contracts_admin';

  if (!hostname) {
    throw new Error('RDS_HOSTNAME environment variable is required for IAM authentication');
  }

  const signer = new Signer({
    region,
    hostname,
    port,
    username,
  });

  const token = await signer.getAuthToken();
  return token;
}

/**
 * Build database URL with IAM authentication token
 */
async function buildDatabaseUrl(): Promise<string> {
  const useIamAuth = process.env.AWS_RDS_USE_IAM_AUTH === 'true';

  if (!useIamAuth) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL environment variable is required');
    }
    return url;
  }

  const hostname = process.env.RDS_HOSTNAME;
  const port = process.env.RDS_PORT || '5432';
  const database = process.env.RDS_DATABASE || 'contracts_legal';
  const username = process.env.RDS_USERNAME || 'contracts_admin';

  if (!hostname) {
    throw new Error('RDS_HOSTNAME is required when using IAM authentication');
  }

  const token = await generateRdsAuthToken();
  const encodedToken = encodeURIComponent(token);

  return `postgresql://${username}:${encodedToken}@${hostname}:${port}/${database}?schema=public&sslmode=require`;
}

/**
 * Create Prisma client with configuration
 */
async function createPrismaClient(config?: PrismaConfig): Promise<PrismaClient> {
  const isDev = process.env.NODE_ENV !== 'production';

  const logLevels: Array<'query' | 'info' | 'warn' | 'error'> = config?.log ?? (isDev
    ? ['query', 'warn', 'error']
    : ['warn', 'error']);

  const datasourceUrl = config?.datasourceUrl ?? await buildDatabaseUrl();

  const client = new PrismaClient({
    log: logLevels.map(level => ({
      emit: 'event' as const,
      level,
    })),
    datasourceUrl,
  });

  // Log events
  client.$on('query', (e) => {
    if (isDev) {
      logger.debug({
        query: e.query,
        params: e.params,
        duration: e.duration,
      }, 'Prisma query');
    }
  });

  client.$on('warn', (e) => {
    logger.warn({ message: e.message }, 'Prisma warning');
  });

  client.$on('error', (e) => {
    logger.error({ message: e.message }, 'Prisma error');
  });

  return client;
}

/**
 * Get or create singleton Prisma client
 */
export async function getPrisma(): Promise<PrismaClient> {
  if (global.prisma) {
    return global.prisma;
  }

  const client = await createPrismaClient();

  if (process.env.NODE_ENV !== 'production') {
    global.prisma = client;
  }

  return client;
}

/**
 * Synchronous getter for Prisma client (use after initialization)
 */
export function prisma(): PrismaClient {
  if (!global.prisma) {
    throw new Error('Prisma client not initialized. Call initializePrisma() first.');
  }
  return global.prisma;
}

/**
 * Initialize Prisma client (call at app startup)
 */
export async function initializePrisma(): Promise<PrismaClient> {
  if (global.prisma) {
    logger.info('Prisma client already initialized');
    return global.prisma;
  }

  logger.info('Initializing Prisma client...');

  const client = await createPrismaClient();

  // Test connection
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

/**
 * Disconnect Prisma client (call at app shutdown)
 */
export async function disconnectPrisma(): Promise<void> {
  if (!global.prisma) {
    return;
  }

  logger.info('Disconnecting Prisma client...');
  await global.prisma.$disconnect();
  global.prisma = undefined;
  logger.info('Prisma client disconnected');
}

/**
 * Health check for database connection
 */
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
