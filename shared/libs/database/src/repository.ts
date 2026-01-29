/**
 * Base Repository Interface - Domain layer abstraction
 */

import type { Entity, PaginatedResult, PaginationParams, QueryFilter } from './types.js';

export interface Repository<T extends Entity> {
  findById(id: string): Promise<T | null>;
  findAll(params?: PaginationParams): Promise<PaginatedResult<T>>;
  findBy(filters: QueryFilter[]): Promise<T[]>;
  create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  update(id: string, data: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>): Promise<T>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
  count(filters?: QueryFilter[]): Promise<number>;
}

export abstract class BaseRepository<T extends Entity> implements Repository<T> {
  abstract findById(id: string): Promise<T | null>;
  abstract findAll(params?: PaginationParams): Promise<PaginatedResult<T>>;
  abstract findBy(filters: QueryFilter[]): Promise<T[]>;
  abstract create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  abstract update(id: string, data: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>): Promise<T>;
  abstract delete(id: string): Promise<void>;
  abstract exists(id: string): Promise<boolean>;
  abstract count(filters?: QueryFilter[]): Promise<number>;

  protected paginate<U>(data: U[], total: number, params: PaginationParams): PaginatedResult<U> {
    const totalPages = Math.ceil(total / params.limit);
    return {
      data,
      total,
      page: params.page,
      limit: params.limit,
      totalPages,
      hasNext: params.page < totalPages,
      hasPrev: params.page > 1,
    };
  }
}
