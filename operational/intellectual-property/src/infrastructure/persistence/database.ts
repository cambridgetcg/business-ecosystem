/**
 * Database Connection - Drizzle ORM Setup
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

export interface DatabaseConfig {
  connectionString: string;
  maxConnections?: number;
  minConnections?: number;
  idleTimeoutMs?: number;
  connectionTimeoutMs?: number;
  ssl?: boolean;
}

let pool: Pool | null = null;

export function createPool(config: DatabaseConfig): Pool {
  if (pool) return pool;

  pool = new Pool({
    connectionString: config.connectionString,
    max: config.maxConnections ?? 20,
    min: config.minConnections ?? 2,
    idleTimeoutMillis: config.idleTimeoutMs ?? 30000,
    connectionTimeoutMillis: config.connectionTimeoutMs ?? 5000,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
  });

  // Log pool events in development
  if (process.env.NODE_ENV === 'development') {
    pool.on('error', (err) => {
      console.error('[Database] Pool error:', err.message);
    });
  }

  return pool;
}

export function getDatabase(poolInstance: Pool) {
  return drizzle(poolInstance, { schema });
}

export type Database = ReturnType<typeof getDatabase>;

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
