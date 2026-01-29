/**
 * Patent Query Handler
 * Handles queries for patent retrieval.
 */

import type { PatentRepository, FindAllOptions, CountFilters } from '../../infrastructure/persistence/patent.repository.js';
import type { Patent } from '../../domain/entities/patent.entity.js';
import type { CacheService, CacheSetOptions } from '../../infrastructure/cache/index.js';
import { CacheKeys, CacheTTL } from '../../infrastructure/cache/index.js';
import type {
  GetPatentQuery,
  ListPatentsQuery,
  CountPatentsQuery,
} from '../queries/index.js';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export class PatentQueryHandler {
  constructor(
    private readonly repository: PatentRepository,
    private readonly cache?: CacheService
  ) {}

  async getPatent(query: GetPatentQuery): Promise<Patent | null> {
    const cacheKey = CacheKeys.patent.byId(query.patentId);

    if (this.cache) {
      const cached = await this.cache.get<Patent>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const patent = await this.repository.findById(query.patentId);

    if (patent && this.cache) {
      await this.cache.set(cacheKey, patent, { ttl: CacheTTL.ENTITY });
    }

    return patent;
  }

  async listPatents(query: ListPatentsQuery): Promise<PaginatedResult<Patent>> {
    const options: FindAllOptions = {
      limit: query.limit,
      offset: query.offset,
      status: query.status,
    };

    const [patents, total] = await Promise.all([
      this.repository.findAll(options),
      this.countPatents({
        status: query.status,
        type: query.type,
        assigneeId: query.assigneeId,
      }),
    ]);

    return {
      data: patents,
      total,
      limit: query.limit,
      offset: query.offset,
      hasMore: query.offset + patents.length < total,
    };
  }

  async countPatents(query: CountPatentsQuery): Promise<number> {
    const filters: CountFilters = {};

    if (query.status) {
      filters.status = query.status;
    }

    return this.repository.count(filters);
  }

  async getPatentsByAssignee(assigneeId: string, limit = 20, offset = 0): Promise<Patent[]> {
    return this.repository.findAll({ limit, offset });
  }

  async getPatentByApplicationNumber(applicationNumber: string): Promise<Patent | null> {
    return this.repository.findByApplicationNumber(applicationNumber);
  }

  async getPatentByPatentNumber(patentNumber: string): Promise<Patent | null> {
    return this.repository.findByPatentNumber(patentNumber);
  }

  /**
   * Invalidate cache for a specific patent
   */
  async invalidateCache(patentId: string): Promise<void> {
    if (this.cache) {
      await this.cache.delete(CacheKeys.patent.byId(patentId));
      await this.cache.deletePattern('patents:list:*');
      await this.cache.deletePattern('patents:count:*');
    }
  }
}
