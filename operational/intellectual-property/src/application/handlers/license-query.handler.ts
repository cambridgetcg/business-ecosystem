/**
 * License Query Handler
 * Handles queries for license retrieval.
 */

import type { LicenseRepository, FindAllOptions, CountFilters } from '../../infrastructure/persistence/license.repository.js';
import type { License } from '../../domain/entities/license.entity.js';
import type { CacheService } from '../../infrastructure/cache/index.js';
import { CacheKeys, CacheTTL } from '../../infrastructure/cache/index.js';
import type {
  GetLicenseQuery,
  ListLicensesQuery,
  GetLicensesByAssetQuery,
  GetLicensesByPartyQuery,
  CountLicensesQuery,
  GetSublicensesQuery,
} from '../queries/index.js';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export class LicenseQueryHandler {
  constructor(
    private readonly repository: LicenseRepository,
    private readonly cache?: CacheService
  ) {}

  async getLicense(query: GetLicenseQuery): Promise<License | null> {
    const cacheKey = CacheKeys.license.byId(query.licenseId);

    if (this.cache) {
      const cached = await this.cache.get<License>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const license = await this.repository.findById(query.licenseId);

    if (license && this.cache) {
      await this.cache.set(cacheKey, license, { ttl: CacheTTL.ENTITY });
    }

    return license;
  }

  async listLicenses(query: ListLicensesQuery): Promise<PaginatedResult<License>> {
    const options: FindAllOptions = {
      limit: query.limit,
      offset: query.offset,
      status: query.status,
      licenseType: query.licenseType,
      ipType: query.ipType,
    };

    const [licenses, total] = await Promise.all([
      this.repository.findAll(options),
      this.countLicenses({
        status: query.status,
        licenseType: query.licenseType,
        ipType: query.ipType,
      }),
    ]);

    return {
      data: licenses,
      total,
      limit: query.limit,
      offset: query.offset,
      hasMore: query.offset + licenses.length < total,
    };
  }

  async getLicensesByAsset(query: GetLicensesByAssetQuery): Promise<License[]> {
    const licenses = await this.repository.findByAsset(query.ipType, query.ipAssetId);

    if (!query.includeInactive) {
      return licenses.filter(l => l.status === 'active');
    }

    return licenses;
  }

  async getLicensesByParty(query: GetLicensesByPartyQuery): Promise<PaginatedResult<License>> {
    let licenses: License[];

    if (query.role === 'licensor') {
      licenses = await this.repository.findByLicensor(query.partyId);
    } else if (query.role === 'licensee') {
      licenses = await this.repository.findByLicensee(query.partyId);
    } else {
      licenses = await this.repository.findByParty(query.partyId);
    }

    // Filter by status if specified
    if (query.status) {
      licenses = licenses.filter(l => l.status === query.status);
    }

    // Apply pagination
    const total = licenses.length;
    const start = query.offset;
    const end = start + query.limit;
    const paginated = licenses.slice(start, end);

    return {
      data: paginated,
      total,
      limit: query.limit,
      offset: query.offset,
      hasMore: end < total,
    };
  }

  async countLicenses(query: CountLicensesQuery): Promise<number> {
    const filters: CountFilters = {};

    if (query.status) {
      filters.status = query.status;
    }
    if (query.licenseType) {
      filters.licenseType = query.licenseType;
    }
    if (query.ipType) {
      filters.ipType = query.ipType;
    }

    return this.repository.count(filters);
  }

  async getSublicenses(query: GetSublicensesQuery): Promise<License[]> {
    // Get all licenses and filter by sublicenseOf
    const allLicenses = await this.repository.findAll({ limit: 1000 });
    return allLicenses.filter(l => l.sublicenseOf === query.parentLicenseId);
  }

  async getLicenseByNumber(licenseNumber: string): Promise<License | null> {
    return this.repository.findByLicenseNumber(licenseNumber);
  }

  /**
   * Invalidate cache for a specific license
   */
  async invalidateCache(licenseId: string): Promise<void> {
    if (this.cache) {
      await this.cache.delete(CacheKeys.license.byId(licenseId));
      await this.cache.deletePattern('licenses:list:*');
      await this.cache.deletePattern('licenses:count:*');
    }
  }
}
