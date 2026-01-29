/**
 * Drizzle Database Connection
 * Centralized connection management for Drizzle ORM with PostgreSQL
 */

import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { Pool, PoolConfig } from 'pg';
import { BaseDatabaseConnection } from '../connection.js';
import type { DatabaseConfig } from '../types.js';

export interface DrizzleConfig extends DatabaseConfig {
  schema?: Record<string, unknown>;
}

export class DrizzleConnection extends BaseDatabaseConnection {
  private pool: Pool | null = null;
  private db: NodePgDatabase<Record<string, unknown>> | null = null;
  private schema: Record<string, unknown>;

  constructor(config: DrizzleConfig) {
    super(config);
    this.schema = config.schema || {};
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    const poolConfig: PoolConfig = {
      connectionString: this.config.url,
      max: this.config.poolMax || 20,
      min: this.config.poolMin || 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };

    if (this.config.ssl) {
      poolConfig.ssl = { rejectUnauthorized: false };
    }

    this.pool = new Pool(poolConfig);
    
    // Test connection
    const client = await this.pool.connect();
    client.release();

    this.db = drizzle(this.pool, { schema: this.schema });
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.db = null;
      this.connected = false;
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.db) return false;
    try {
      await this.db.execute(sql`SELECT 1`);
      return true;
    } catch {
      return false;
    }
  }

  getDb(): NodePgDatabase<Record<string, unknown>> {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db;
  }

  getPool(): Pool {
    if (!this.pool) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.pool;
  }

  getPoolStats(): { total: number; idle: number; waiting: number } {
    if (!this.pool) {
      return { total: 0, idle: 0, waiting: 0 };
    }
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };
  }
}

// Singleton factory for simple use cases
let defaultConnection: DrizzleConnection | null = null;

export function createConnection(config: DrizzleConfig): DrizzleConnection {
  return new DrizzleConnection(config);
}

export function getDefaultConnection(): DrizzleConnection {
  if (!defaultConnection) {
    throw new Error('Default connection not initialized. Call initDefaultConnection() first.');
  }
  return defaultConnection;
}

export function initDefaultConnection(config: DrizzleConfig): DrizzleConnection {
  if (defaultConnection) {
    return defaultConnection;
  }
  defaultConnection = new DrizzleConnection(config);
  return defaultConnection;
}

export async function closeDefaultConnection(): Promise<void> {
  if (defaultConnection) {
    await defaultConnection.disconnect();
    defaultConnection = null;
  }
}
