/**
 * Repository Interface - Domain layer abstraction for data access
 * @module @ecosystem/repository
 */

import type {
  Entity,
  PaginatedResult,
  PaginationParams,
  QueryFilter,
  QueryOptions,
} from './types.js';

/**
 * Base repository interface with standard CRUD operations
 */
export interface Repository<T extends Entity> {
  /**
   * Find entity by ID
   */
  findById(id: string, options?: QueryOptions): Promise<T | null>;

  /**
   * Find all entities with optional pagination
   */
  findAll(params?: PaginationParams, options?: QueryOptions): Promise<PaginatedResult<T>>;

  /**
   * Find entities matching filters
   */
  findBy(filters: QueryFilter[], options?: QueryOptions): Promise<T[]>;

  /**
   * Find single entity matching filters (throws if multiple found)
   */
  findOneBy(filters: QueryFilter[], options?: QueryOptions): Promise<T | null>;

  /**
   * Create new entity
   */
  create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;

  /**
   * Update existing entity
   */
  update(id: string, data: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>): Promise<T>;

  /**
   * Delete entity (hard delete by default)
   */
  delete(id: string): Promise<void>;

  /**
   * Check if entity exists
   */
  exists(id: string, options?: QueryOptions): Promise<boolean>;

  /**
   * Count entities matching optional filters
   */
  count(filters?: QueryFilter[], options?: QueryOptions): Promise<number>;
}

/**
 * Repository with soft delete support
 */
export interface SoftDeleteRepository<T extends Entity> extends Repository<T> {
  /**
   * Soft delete entity (set deletedAt)
   */
  softDelete(id: string, deletedBy?: string): Promise<void>;

  /**
   * Restore soft-deleted entity
   */
  restore(id: string): Promise<T>;

  /**
   * Permanently delete soft-deleted entities older than retention period
   */
  purge(olderThanDays: number): Promise<number>;
}

/**
 * Repository with optimistic concurrency control
 */
export interface VersionedRepository<T extends Entity> extends Repository<T> {
  /**
   * Update with version check (throws ConcurrencyError on mismatch)
   */
  updateWithVersion(
    id: string,
    data: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>,
    expectedVersion: number
  ): Promise<T>;
}

/**
 * Repository with multi-tenant isolation
 */
export interface TenantRepository<T extends Entity> extends Repository<T> {
  /**
   * Find by ID within tenant scope
   */
  findByIdForTenant(id: string, tenantId: string): Promise<T | null>;

  /**
   * Find all for a specific tenant
   */
  findAllForTenant(
    tenantId: string,
    params?: PaginationParams
  ): Promise<PaginatedResult<T>>;

  /**
   * Count entities for a specific tenant
   */
  countForTenant(tenantId: string, filters?: QueryFilter[]): Promise<number>;
}

/**
 * Repository with bulk operations
 */
export interface BulkRepository<T extends Entity> extends Repository<T> {
  /**
   * Create multiple entities in a single operation
   */
  createMany(data: Array<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>): Promise<T[]>;

  /**
   * Update multiple entities matching filters
   */
  updateMany(
    filters: QueryFilter[],
    data: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<number>;

  /**
   * Delete multiple entities matching filters
   */
  deleteMany(filters: QueryFilter[]): Promise<number>;

  /**
   * Upsert (insert or update) entity
   */
  upsert(
    data: Omit<T, 'createdAt' | 'updatedAt'>,
    conflictKeys: (keyof T)[]
  ): Promise<T>;
}

/**
 * Full-featured repository combining all capabilities
 */
export interface FullRepository<T extends Entity>
  extends Repository<T>,
    SoftDeleteRepository<T>,
    VersionedRepository<T>,
    BulkRepository<T> {}
