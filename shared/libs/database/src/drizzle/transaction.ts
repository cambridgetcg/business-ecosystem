/**
 * Drizzle Transaction Management
 * Implements Unit of Work pattern with Drizzle ORM
 */

import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Pool, PoolClient } from 'pg';
import { BaseUnitOfWork } from '../unit-of-work.js';

export type DrizzleDb = NodePgDatabase<Record<string, unknown>>;

export class DrizzleTransaction extends BaseUnitOfWork {
  private pool: Pool;
  private client: PoolClient | null = null;

  constructor(pool: Pool) {
    super();
    this.pool = pool;
  }

  async begin(): Promise<void> {
    if (this.transactionActive) {
      throw new Error('Transaction already active');
    }
    this.client = await this.pool.connect();
    await this.client.query('BEGIN');
    this.transactionActive = true;
  }

  async commit(): Promise<void> {
    if (!this.transactionActive || !this.client) {
      throw new Error('No active transaction');
    }
    try {
      await this.client.query('COMMIT');
    } finally {
      this.client.release();
      this.client = null;
      this.transactionActive = false;
    }
  }

  async rollback(): Promise<void> {
    if (!this.transactionActive || !this.client) {
      throw new Error('No active transaction');
    }
    try {
      await this.client.query('ROLLBACK');
    } finally {
      this.client.release();
      this.client = null;
      this.transactionActive = false;
    }
  }

  getClient(): PoolClient {
    if (!this.client) {
      throw new Error('No active transaction');
    }
    return this.client;
  }
}

/**
 * Execute a function within a database transaction
 * Automatically commits on success, rolls back on error
 */
export async function withTransaction<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Drizzle-native transaction using the db.transaction() method
 */
export async function withDrizzleTransaction<T>(
  db: DrizzleDb,
  fn: (tx: DrizzleDb) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    return fn(tx as unknown as DrizzleDb);
  });
}

/**
 * Create a transaction manager for a specific database
 */
export function createTransactionManager(pool: Pool) {
  return {
    runInTransaction: <T>(fn: (client: PoolClient) => Promise<T>) =>
      withTransaction(pool, fn),
  };
}
