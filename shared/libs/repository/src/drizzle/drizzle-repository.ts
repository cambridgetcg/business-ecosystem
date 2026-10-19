/**
 * Drizzle Repository - Concrete implementation with Drizzle ORM
 * @module @ecosystem/repository
 */

import {
  eq, and, gt, gte, lt, lte, ne,
  inArray, notInArray, like, ilike, between,
  isNull, isNotNull, sql, SQL, asc, desc
} from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { PgTable, PgColumn } from 'drizzle-orm/pg-core';

import { BaseRepository } from '../base/base-repository.js';
import type {
  Entity,
  PaginatedResult,
  PaginationParams,
  QueryFilter,
  QueryOptions,
  FilterOperator,
} from '../interfaces/types.js';
import { EntityNotFoundError, RepositoryError } from '../interfaces/types.js';

// =============================================================================
// Types
// =============================================================================

export type DrizzleDb = NodePgDatabase<Record<string, unknown>>;

/**
 * Table configuration for mapping between Drizzle and domain entities
 */
export interface TableConfig<T extends Entity> {
  /** Drizzle table reference */
  table: PgTable;

  /** Column mappings */
  columns: {
    id: PgColumn;
    createdAt: PgColumn;
    updatedAt: PgColumn;
    deletedAt?: PgColumn;
    tenantId?: PgColumn;
    version?: PgColumn;
    [key: string]: PgColumn | undefined;
  };

  /** Map database row to domain entity */
  toDomain: (row: Record<string, unknown>) => T;

  /** Map domain entity to database insert/update */
  toPersistence: (data: Partial<T>) => Record<string, unknown>;
}

// =============================================================================
// Drizzle Repository Implementation
// =============================================================================

/**
 * Drizzle-based repository implementation
 */
export class DrizzleRepository<T extends Entity> extends BaseRepository<T> {
  protected readonly db: DrizzleDb;
  protected readonly config: TableConfig<T>;

  constructor(
    db: DrizzleDb,
    config: TableConfig<T>,
    entityName: string
  ) {
    super(entityName);
    this.db = db;
    this.config = config;
  }

  // =============================================================================
  // CRUD Operations
  // =============================================================================

  async findById(id: string, options?: QueryOptions): Promise<T | null> {
    const conditions = this.buildBaseConditions(options);
    conditions.push(eq(this.config.columns.id, id));

    const results = await this.db
      .select()
      .from(this.config.table)
      .where(and(...conditions))
      .limit(1);

    if (results.length === 0) return null;
    return this.config.toDomain(results[0] as Record<string, unknown>);
  }

  async findAll(
    params?: PaginationParams,
    options?: QueryOptions
  ): Promise<PaginatedResult<T>> {
    const normalizedParams = this.normalizePagination(params);
    const offset = this.calculateOffset(normalizedParams);
    const conditions = this.buildBaseConditions(options);

    // Get total count
    let countQuery = this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(this.config.table);

    if (conditions.length > 0) {
      countQuery = countQuery.where(and(...conditions)) as typeof countQuery;
    }

    const countResult = await countQuery;
    const total = countResult[0]?.count ?? 0;

    // Get paginated data
    let dataQuery = this.db.select().from(this.config.table);

    if (conditions.length > 0) {
      dataQuery = dataQuery.where(and(...conditions)) as typeof dataQuery;
    }

    // Apply sorting
    const sortColumn = this.config.columns[normalizedParams.sortBy];
    if (sortColumn) {
      const orderFn = normalizedParams.sortOrder === 'desc' ? desc : asc;
      dataQuery = dataQuery.orderBy(orderFn(sortColumn)) as typeof dataQuery;
    }

    const results = await dataQuery.limit(normalizedParams.limit).offset(offset);
    const data = results.map(row => this.config.toDomain(row as Record<string, unknown>));

    return this.paginate(data, total, normalizedParams);
  }

  async findBy(filters: QueryFilter[], options?: QueryOptions): Promise<T[]> {
    const conditions = this.buildBaseConditions(options);
    conditions.push(...this.buildFilterConditions(filters));

    let query = this.db.select().from(this.config.table);

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const results = await query;
    return results.map(row => this.config.toDomain(row as Record<string, unknown>));
  }

  async create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const now = this.now();
    const insertData = {
      ...this.config.toPersistence(data as Partial<T>),
      id: this.generateId(),
      createdAt: now,
      updatedAt: now,
    };

    const results = await this.db
      .insert(this.config.table)
      .values(insertData)
      .returning();

    return this.config.toDomain(results[0] as Record<string, unknown>);
  }

  async update(
    id: string,
    data: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<T> {
    const updateData = {
      ...this.config.toPersistence(data as Partial<T>),
      updatedAt: this.now(),
    };

    const results = await this.db
      .update(this.config.table)
      .set(updateData)
      .where(eq(this.config.columns.id, id))
      .returning();

    if (results.length === 0) {
      throw new EntityNotFoundError(this.entityName, id);
    }

    return this.config.toDomain(results[0] as Record<string, unknown>);
  }

  async delete(id: string): Promise<void> {
    const result = await this.db
      .delete(this.config.table)
      .where(eq(this.config.columns.id, id))
      .returning({ id: this.config.columns.id });

    if (result.length === 0) {
      throw new EntityNotFoundError(this.entityName, id);
    }
  }

  async exists(id: string, options?: QueryOptions): Promise<boolean> {
    const conditions = this.buildBaseConditions(options);
    conditions.push(eq(this.config.columns.id, id));

    const results = await this.db
      .select({ id: this.config.columns.id })
      .from(this.config.table)
      .where(and(...conditions))
      .limit(1);

    return results.length > 0;
  }

  async count(filters?: QueryFilter[], options?: QueryOptions): Promise<number> {
    const conditions = this.buildBaseConditions(options);

    if (filters && filters.length > 0) {
      conditions.push(...this.buildFilterConditions(filters));
    }

    let query = this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(this.config.table);

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const result = await query;
    return result[0]?.count ?? 0;
  }

  // =============================================================================
  // Condition Builders
  // =============================================================================

  /**
   * Build base conditions (soft delete, tenant isolation)
   */
  protected buildBaseConditions(options?: QueryOptions): SQL[] {
    const conditions: SQL[] = [];

    // Soft delete filter
    if (!options?.includeSoftDeleted && this.config.columns.deletedAt) {
      conditions.push(isNull(this.config.columns.deletedAt));
    }

    // Tenant isolation
    if (options?.tenantId && this.config.columns.tenantId) {
      conditions.push(eq(this.config.columns.tenantId, options.tenantId));
    }

    return conditions;
  }

  /**
   * Build filter conditions from QueryFilter array
   */
  protected buildFilterConditions(filters: QueryFilter[]): SQL[] {
    return filters.map(filter => this.buildCondition(filter));
  }

  /**
   * Build single condition from QueryFilter
   */
  protected buildCondition(filter: QueryFilter): SQL {
    const column = this.config.columns[filter.field];
    if (!column) {
      throw new RepositoryError(
        `Unknown column: ${filter.field}`,
        'UNKNOWN_COLUMN'
      );
    }

    return this.applyOperator(column, filter.operator, filter.value);
  }

  /**
   * Apply filter operator to column
   */
  protected applyOperator(
    column: PgColumn,
    operator: FilterOperator,
    value: unknown
  ): SQL {
    switch (operator) {
      case 'eq':
        return eq(column, value);
      case 'ne':
        return ne(column, value);
      case 'gt':
        return gt(column, value as number);
      case 'gte':
        return gte(column, value as number);
      case 'lt':
        return lt(column, value as number);
      case 'lte':
        return lte(column, value as number);
      case 'in':
        return inArray(column, value as unknown[]);
      case 'nin':
        return notInArray(column, value as unknown[]);
      case 'like':
        return like(column, value as string);
      case 'ilike':
        return ilike(column, value as string);
      case 'between': {
        const [min, max] = value as [unknown, unknown];
        return between(column, min, max);
      }
      case 'isNull':
        return isNull(column);
      case 'isNotNull':
        return isNotNull(column);
      default:
        // Unreachable for typed callers; filters can still arrive untyped.
        throw new RepositoryError(
          `Unsupported operator: ${String(operator)}`,
          'UNSUPPORTED_OPERATOR'
        );
    }
  }
}
