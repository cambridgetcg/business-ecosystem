/**
 * Base Repository - Abstract implementation with common functionality
 * @module @ecosystem/repository
 */

import type {
  Entity,
  PaginatedResult,
  PaginationParams,
  QueryFilter,
  QueryOptions,
} from '../interfaces/types.js';
import type { Repository } from '../interfaces/repository.interface.js';

/**
 * Abstract base repository with common implementations
 */
export abstract class BaseRepository<T extends Entity> implements Repository<T> {
  protected readonly entityName: string;

  constructor(entityName: string) {
    this.entityName = entityName;
  }

  // =============================================================================
  // Abstract Methods (must be implemented by concrete classes)
  // =============================================================================

  abstract findById(id: string, options?: QueryOptions): Promise<T | null>;
  abstract findAll(params?: PaginationParams, options?: QueryOptions): Promise<PaginatedResult<T>>;
  abstract findBy(filters: QueryFilter[], options?: QueryOptions): Promise<T[]>;
  abstract create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  abstract update(id: string, data: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>): Promise<T>;
  abstract delete(id: string): Promise<void>;
  abstract exists(id: string, options?: QueryOptions): Promise<boolean>;
  abstract count(filters?: QueryFilter[], options?: QueryOptions): Promise<number>;

  // =============================================================================
  // Default Implementations
  // =============================================================================

  /**
   * Find single entity matching filters
   */
  async findOneBy(filters: QueryFilter[], options?: QueryOptions): Promise<T | null> {
    const results = await this.findBy(filters, options);
    if (results.length === 0) return null;
    if (results.length > 1) {
      throw new Error(`Expected single ${this.entityName}, found ${results.length}`);
    }
    return results[0] ?? null;
  }

  // =============================================================================
  // Helper Methods
  // =============================================================================

  /**
   * Create paginated result from data
   */
  protected paginate<U>(
    data: U[],
    total: number,
    params: PaginationParams
  ): PaginatedResult<U> {
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

  /**
   * Validate pagination parameters
   */
  protected normalizePagination(params?: PaginationParams): Required<PaginationParams> {
    return {
      page: Math.max(1, params?.page ?? 1),
      limit: Math.min(100, Math.max(1, params?.limit ?? 20)),
      sortBy: params?.sortBy ?? 'createdAt',
      sortOrder: params?.sortOrder ?? 'desc',
    };
  }

  /**
   * Calculate offset from pagination params
   */
  protected calculateOffset(params: PaginationParams): number {
    return (params.page - 1) * params.limit;
  }

  /**
   * Generate entity ID (can be overridden for custom ID generation)
   */
  protected generateId(): string {
    return crypto.randomUUID();
  }

  /**
   * Get current timestamp
   */
  protected now(): Date {
    return new Date();
  }
}
