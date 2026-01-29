/**
 * Database connection management
 */

import type { DatabaseConfig } from './types.js';

export interface DatabaseConnection {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  healthCheck(): Promise<boolean>;
}

export abstract class BaseDatabaseConnection implements DatabaseConnection {
  protected config: DatabaseConfig;
  protected connected = false;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract healthCheck(): Promise<boolean>;

  isConnected(): boolean {
    return this.connected;
  }
}
