/**
 * Drizzle Repository Base Class
 * Implements the Repository pattern with Drizzle ORM
 */

import { eq, and, gt, gte, lt, lte, inArray, like, between, sql, SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { PgTable, PgColumn } from 'drizzle-orm/pg-core';
import { BaseRepository } from '../repository.js';
import type { Entity, PaginatedResult, PaginationParams, QueryFilter } from '../types.js';

export type DrizzleDb = NodePgDatabase<Record<string, unknown>>;

export interface TableConfig<T> {
  table: PgTable;
  columns: {
    id: PgColumn;
    createdAt: PgColumn;
    updatedAt: PgColumn;
    [key: string]: PgColumn;
  };
  mapToEntity: (row: Record<string, unknown>) => T;
  mapToInsert: (data: Partial<T>) => Record<string, unknown>;
}

export abstract class DrizzleRepository<T extends Entity> extends BaseRepository<T> {
  protected db: DrizzleDb;
  protected tableConfig: TableConfig<T>;

  constructor(db: DrizzleDb, tableConfig: TableConfig<T>) {
    super();
    this.db = db;
    this.tableConfig = tableConfig;
  }

  async findById(id: string): Promise<T | null> {
    const { table, columns, mapToEntity } = this.tableConfig;
    const results = await this.db
      .select()
      .from(table)
      .where(eq(columns.id, id))
      .limit(1);

    if (results.length === 0) return null;
    return mapToEntity(results[0] as Record<string, unknown>);
  }

  async findAll(params?: PaginationParams): Promise<PaginatedResult<T>> {
    const { table, mapToEntity } = this.tableConfig;
    const page = params?.page || 1;
    const limit = params?.limit || 20;
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(table);
    const total = countResult[0]?.count || 0;

    // Get paginated data
    let query = this.db.select().from(table);

    if (params?.sortBy) {
      const column = this.tableConfig.columns[params.sortBy];
      if (column) {
        const direction = params.sortOrder === 'desc' ? sql`DESC` : sql`ASC`;
        query = query.orderBy(sql`${column} ${direction}`) as typeof query;
      }
    }

    const results = await query.limit(limit).offset(offset);
    const data = results.map((row) => mapToEntity(row as Record<string, unknown>));

    return this.paginate(data, total, { page, limit, ...params });
  }

  async findBy(filters: QueryFilter[]): Promise<T[]> {
    const { table, mapToEntity } = this.tableConfig;

    if (filters.length === 0) {
      const results = await this.db.select().from(table);
      return results.map((row) => mapToEntity(row as Record<string, unknown>));
    }

    const conditions = this.buildConditions(filters);
    const results = await this.db
      .select()
      .from(table)
      .where(and(...conditions));

    return results.map((row) => mapToEntity(row as Record<string, unknown>));
  }

  async create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const { table, mapToEntity, mapToInsert } = this.tableConfig;
    const insertData = mapToInsert(data as Partial<T>);

    const results = await this.db
      .insert(table)
      .values(insertData)
      .returning();

    return mapToEntity(results[0] as Record<string, unknown>);
  }

  async update(id: string, data: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>): Promise<T> {
    const { table, columns, mapToEntity, mapToInsert } = this.tableConfig;
    const updateData = {
      ...mapToInsert(data as Partial<T>),
      updatedAt: new Date(),
    };

    const results = await this.db
      .update(table)
      .set(updateData)
      .where(eq(columns.id, id))
      .returning();

    if (results.length === 0) {
      throw new Error('Entity not found: ' + id);
    }

    return mapToEntity(results[0] as Record<string, unknown>);
  }

  async delete(id: string): Promise<void> {
    const { table, columns } = this.tableConfig;
    await this.db.delete(table).where(eq(columns.id, id));
  }

  async exists(id: string): Promise<boolean> {
    const { table, columns } = this.tableConfig;
    const results = await this.db
      .select({ id: columns.id })
      .from(table)
      .where(eq(columns.id, id))
      .limit(1);

    return results.length > 0;
  }

  async count(filters?: QueryFilter[]): Promise<number> {
    const { table } = this.tableConfig;

    if (!filters || filters.length === 0) {
      const result = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(table);
      return result[0]?.count || 0;
    }

    const conditions = this.buildConditions(filters);
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(table)
      .where(and(...conditions));

    return result[0]?.count || 0;
  }

  protected buildConditions(filters: QueryFilter[]): SQL[] {
    return filters.map((filter) => {
      const column = this.tableConfig.columns[filter.field];
      if (!column) {
        throw new Error('Unknown column: ' + filter.field);
      }

      switch (filter.operator) {
        case 'eq':
          return eq(column, filter.value);
        case 'ne':
          return sql`${column} != ${filter.value}`;
        case 'gt':
          return gt(column, filter.value as number);
        case 'gte':
          return gte(column, filter.value as number);
        case 'lt':
          return lt(column, filter.value as number);
        case 'lte':
          return lte(column, filter.value as number);
        case 'in':
          return inArray(column, filter.value as unknown[]);
        case 'like':
          return like(column, filter.value as string);
        case 'between': {
          const [min, max] = filter.value as [unknown, unknown];
          return between(column, min, max);
        }
        default:
          // Unreachable for typed callers; filters can still arrive untyped.
          throw new Error('Unsupported operator: ' + String(filter.operator));
      }
    });
  }
}
