/**
 * @ecosystem/repository
 * Repository pattern abstraction layer for the business ecosystem
 *
 * Usage:
 * - Base interfaces: import { Repository, Entity } from '@ecosystem/repository'
 * - Drizzle implementation: import { DrizzleRepository, TableConfig } from '@ecosystem/repository'
 * - Soft delete: import { SoftDeleteDrizzleRepository } from '@ecosystem/repository'
 * - Audit support: import { withAudit, AuditContext } from '@ecosystem/repository'
 * - Transactions: import { withTransaction, DrizzleUnitOfWork } from '@ecosystem/repository'
 *
 * @module @ecosystem/repository
 */

// =============================================================================
// Core Types and Interfaces
// =============================================================================

export type {
  // Entity types
  Entity,
  AuditableEntity,
  SoftDeletableEntity,
  TenantEntity,
  FullEntity,

  // Query types
  FilterOperator,
  QueryFilter,
  QueryOptions,
  PaginationParams,
  PaginatedResult,
} from './interfaces/types.js';

export {
  // Error types
  RepositoryError,
  EntityNotFoundError,
  ConcurrencyError,

  // Zod schemas
  entitySchema,
  auditableEntitySchema,
  softDeletableEntitySchema,
  paginationParamsSchema,
} from './interfaces/types.js';

// =============================================================================
// Repository Interfaces
// =============================================================================

export type {
  Repository,
  SoftDeleteRepository,
  VersionedRepository,
  TenantRepository,
  BulkRepository,
  FullRepository,
} from './interfaces/repository.interface.js';

// =============================================================================
// Base Repository
// =============================================================================

export { BaseRepository } from './base/base-repository.js';

// =============================================================================
// Drizzle Implementation
// =============================================================================

export {
  DrizzleRepository,
  type DrizzleDb,
  type TableConfig,
} from './drizzle/drizzle-repository.js';

// =============================================================================
// Mixins
// =============================================================================

export {
  SoftDeleteDrizzleRepository,
  type SoftDeleteTableConfig,
} from './mixins/soft-delete.mixin.js';

// =============================================================================
// Decorators
// =============================================================================

export {
  AuditableRepositoryDecorator,
  withAudit,
  defaultAuditContext,
  type AuditContext,
} from './decorators/auditable.decorator.js';

// =============================================================================
// Unit of Work / Transactions
// =============================================================================

export {
  // Interfaces
  type UnitOfWork,
  type TransactionManager,
  type TransactionalUnitOfWork,
  type TransactionContext,

  // Implementations
  BaseUnitOfWork,
  DrizzleUnitOfWork,

  // Utility functions
  withTransaction,
  withDrizzleTransaction,
  createTransactionManager,
  createUnitOfWorkFactory,
} from './unit-of-work/unit-of-work.js';
