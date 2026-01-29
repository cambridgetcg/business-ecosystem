/**
 * Unit of Work - Transaction management for repositories
 * @module @ecosystem/repository
 */

import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Pool, PoolClient } from 'pg';

// =============================================================================
// Interfaces
// =============================================================================

/**
 * Unit of Work interface for explicit transaction control
 */
export interface UnitOfWork {
  /** Start a new transaction */
  begin(): Promise<void>;
  /** Commit the current transaction */
  commit(): Promise<void>;
  /** Rollback the current transaction */
  rollback(): Promise<void>;
  /** Check if a transaction is currently active */
  isActive(): boolean;
}

/**
 * Transaction manager for automatic transaction handling
 */
export interface TransactionManager {
  /** Execute function within a transaction (auto commit/rollback) */
  runInTransaction<T>(fn: () => Promise<T>): Promise<T>;
}

/**
 * Combined interface for repositories that need transaction support
 */
export interface TransactionalUnitOfWork extends UnitOfWork, TransactionManager {}

// =============================================================================
// Type Definitions
// =============================================================================

export type DrizzleDb = NodePgDatabase<Record<string, unknown>>;

/**
 * Transaction context passed to repository operations
 */
export interface TransactionContext {
  /** The database connection/transaction to use */
  db: DrizzleDb;
  /** Whether this is within an active transaction */
  inTransaction: boolean;
}

// =============================================================================
// Base Implementation
// =============================================================================

/**
 * Abstract base class for Unit of Work implementations
 */
export abstract class BaseUnitOfWork implements TransactionalUnitOfWork {
  protected transactionActive = false;

  abstract begin(): Promise<void>;
  abstract commit(): Promise<void>;
  abstract rollback(): Promise<void>;

  isActive(): boolean {
    return this.transactionActive;
  }

  /**
   * Execute function within a transaction with automatic commit/rollback
   */
  async runInTransaction<T>(fn: () => Promise<T>): Promise<T> {
    await this.begin();
    try {
      const result = await fn();
      await this.commit();
      return result;
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }
}

// =============================================================================
// Drizzle Implementation
// =============================================================================

/**
 * Drizzle-based Unit of Work implementation using pg Pool
 */
export class DrizzleUnitOfWork extends BaseUnitOfWork {
  private readonly pool: Pool;
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

  /**
   * Get the underlying client for direct queries
   */
  getClient(): PoolClient {
    if (!this.client) {
      throw new Error('No active transaction - call begin() first');
    }
    return this.client;
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

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
 * Execute a function within a Drizzle transaction
 * Uses Drizzle's native transaction support
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
 * Create a transaction manager for a specific database pool
 */
export function createTransactionManager(pool: Pool): TransactionManager {
  return {
    runInTransaction: async <T>(fn: () => Promise<T>): Promise<T> => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn();
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

/**
 * Create a Unit of Work factory for a specific pool
 */
export function createUnitOfWorkFactory(pool: Pool): () => DrizzleUnitOfWork {
  return () => new DrizzleUnitOfWork(pool);
}
