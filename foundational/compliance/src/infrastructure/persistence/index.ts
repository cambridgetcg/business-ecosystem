/**
 * Database Connection Management
 *
 * Provides database initialization, pooling, and graceful shutdown.
 */

import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { Sql } from 'postgres';
import * as schema from './schema.js';

export type Database = PostgresJsDatabase<typeof schema>;

let client: Sql | null = null;
let db: Database | null = null;

/**
 * Initialize database connection
 */
export function initializeDatabase(connectionString?: string): Database {
  if (db) {
    return db;
  }

  const url = connectionString || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/compliance';

  client = postgres(url, {
    max: 20,
    idle_timeout: 30,
    connect_timeout: 10,
    prepare: false,
  });

  db = drizzle(client, { schema });

  console.log('[Compliance] Database connection initialized');
  return db;
}

/**
 * Get the database instance (must be initialized first)
 */
export function getDatabase(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

/**
 * Close database connection gracefully
 */
export async function closeDatabase(): Promise<void> {
  if (client) {
    await client.end();
    client = null;
    db = null;
    console.log('[Compliance] Database connection closed');
  }
}

/**
 * Check database health
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  if (!client) {
    return false;
  }

  try {
    await client`SELECT 1`;
    return true;
  } catch (error) {
    console.error('[Compliance] Database health check failed:', error);
    return false;
  }
}

export { schema };
