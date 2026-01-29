/**
 * Redis Cache Client
 *
 * Provides caching infrastructure for banking-treasury.
 * Supports both standalone Redis URL and ElastiCache configuration.
 */

import { createClient, type RedisClientType } from 'redis';
import { env } from '../../env.js';

let client: RedisClientType | null = null;
let isConnecting = false;

/**
 * Get Redis connection URL from environment
 */
function getRedisUrl(): string {
  if (env.REDIS_URL) {
    return env.REDIS_URL;
  }

  if (env.REDIS_HOST) {
    return `redis://${env.REDIS_HOST}:${env.REDIS_PORT}`;
  }

  // Default for local development
  return `redis://localhost:${env.REDIS_PORT}`;
}

/**
 * Initialize Redis client with connection handling
 */
export async function getRedisClient(): Promise<RedisClientType> {
  if (client?.isOpen) {
    return client;
  }

  if (isConnecting) {
    // Wait for existing connection attempt
    await new Promise(resolve => setTimeout(resolve, 100));
    return getRedisClient();
  }

  isConnecting = true;

  try {
    const url = getRedisUrl();

    client = createClient({
      url,
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('Redis: Max reconnection attempts reached');
            return new Error('Redis max retries reached');
          }
          return Math.min(retries * 100, 3000);
        },
      },
    });

    client.on('error', (err) => {
      console.error('Redis client error:', err.message);
    });

    client.on('connect', () => {
      console.log('Redis: Connected');
    });

    client.on('reconnecting', () => {
      console.log('Redis: Reconnecting...');
    });

    await client.connect();

    // Test connection
    await client.ping();
    console.log('Redis connection established');

    return client;
  } finally {
    isConnecting = false;
  }
}

/**
 * Close Redis connection gracefully
 */
export async function closeRedisClient(): Promise<void> {
  if (client?.isOpen) {
    await client.quit();
    client = null;
    console.log('Redis connection closed');
  }
}

/**
 * Check if Redis is available
 */
export async function isRedisAvailable(): Promise<boolean> {
  if (!env.ENABLE_CACHING) {
    return false;
  }

  try {
    const redisClient = await getRedisClient();
    const pong = await redisClient.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  await closeRedisClient();
});
