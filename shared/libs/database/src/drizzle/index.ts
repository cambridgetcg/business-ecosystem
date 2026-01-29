/**
 * @ecosystem/database/drizzle
 * Drizzle ORM integration for the business ecosystem
 */

// Connection management
export {
  DrizzleConnection,
  createConnection,
  getDefaultConnection,
  initDefaultConnection,
  closeDefaultConnection,
  type DrizzleConfig,
} from './connection.js';

// Repository pattern
export {
  DrizzleRepository,
  type DrizzleDb,
  type TableConfig,
} from './repository.js';

// Transaction management
export {
  DrizzleTransaction,
  withTransaction,
  withDrizzleTransaction,
  createTransactionManager,
} from './transaction.js';

// Re-export common Drizzle utilities
export { sql, eq, and, or, gt, gte, lt, lte, inArray, like, between, isNull, isNotNull, desc, asc } from 'drizzle-orm';
