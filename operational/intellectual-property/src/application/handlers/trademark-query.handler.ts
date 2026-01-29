/**
 * Trademark Query Handler
 * Handles queries for trademark retrieval.
 */

import type { TrademarkRepository, FindAllOptions, CountFilters } from '../../infrastructure/persistence/trademark.repository.js';
import type { Trademark } from '../../domain/entities/trademark.entity.js';
import type { CacheService } from '../../infrastructure/cache/index.js';
import { CacheKeys, CacheTTL } from '../../infrastructure/cache/index.js';
import type {
  GetTrademarkQuery,
  ListTrademarksQuery,
  SearchTrademarksByMarkQuery,
  CountTrademarksQuery,
} from '../queries/index.js';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export class TrademarkQueryHandler {
  constructor(
    private readonly repository: TrademarkRepository,
    private readonly cache?: CacheService
  ) {}

  async getTrademark(query: GetTrademarkQuery): Promise<Trademark | null> {
    const cacheKey = CacheKeys.trademark.byId(query.trademarkId);

    if (this.cache) {
      const cached = await this.cache.get<Trademark>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const trademark = await this.repository.findById(query.trademarkId);

    if (trademark && this.cache) {
      await this.cache.set(cacheKey, trademark, { ttl: CacheTTL.ENTITY });
    }

    return trademark;
  }

  async listTrademarks(query: ListTrademarksQuery): Promise<PaginatedResult<Trademark>> {
    const options: FindAllOptions = {
      limit: query.limit,
      offset: query.offset,
      status: query.status,
    };

    const [trademarks, total] = await Promise.all([
      this.repository.findAll(options),
      this.countTrademarks({
        status: query.status,
        type: query.type,
        ownerId: query.ownerId,
      }),
    ]);

    return {
      data: trademarks,
      total,
      limit: query.limit,
      offset: query.offset,
      hasMore: query.offset + trademarks.length < total,
    };
  }

  async searchTrademarksByMark(query: SearchTrademarksByMarkQuery): Promise<PaginatedResult<Trademark>> {
    const trademarks = await this.repository.search(query.mark);

    // Apply pagination manually for search results
    const start = query.offset;
    const end = start + query.limit;
    const paginated = trademarks.slice(start, end);

    return {
      data: paginated,
      total: trademarks.length,
      limit: query.limit,
      offset: query.offset,
      hasMore: end < trademarks.length,
    };
  }

  async countTrademarks(query: CountTrademarksQuery): Promise<number> {
    const filters: CountFilters = {};

    if (query.status) {
      filters.status = query.status;
    }
    if (query.ownerId) {
      filters.ownerId = query.ownerId;
    }

    return this.repository.count(filters);
  }

  async getTrademarksByOwner(ownerId: string): Promise<Trademark[]> {
    return this.repository.findByOwnerId(ownerId);
  }

  async getTrademarkByRegistrationNumber(registrationNumber: string): Promise<Trademark | null> {
    return this.repository.findByRegistrationNumber(registrationNumber);
  }

  /**
   * Invalidate cache for a specific trademark
   */
  async invalidateCache(trademarkId: string): Promise<void> {
    if (this.cache) {
      await this.cache.delete(CacheKeys.trademark.byId(trademarkId));
      await this.cache.deletePattern('trademarks:list:*');
      await this.cache.deletePattern('trademarks:count:*');
    }
  }
}
