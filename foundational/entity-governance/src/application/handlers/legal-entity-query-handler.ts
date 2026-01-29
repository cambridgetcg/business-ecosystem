/**
 * Legal Entity Query Handler
 *
 * Handles queries for legal entity retrieval.
 */

import type { LegalEntityRepository, PaginatedResult, LegalEntityFilters } from '../../domain/entity/repositories/legal-entity-repository.js';
import type { LegalEntity } from '../../domain/entity/models/legal-entity.js';
import type { GetLegalEntityQuery, ListLegalEntitiesQuery } from '../queries/index.js';

export class LegalEntityQueryHandler {
  constructor(private readonly repository: LegalEntityRepository) {}

  async getLegalEntity(query: GetLegalEntityQuery): Promise<LegalEntity | null> {
    return this.repository.findById(query.entityId);
  }

  async listLegalEntities(query: ListLegalEntitiesQuery): Promise<PaginatedResult<LegalEntity>> {
    const filters: LegalEntityFilters = {};
    
    if (query.status !== undefined) {
      filters.status = query.status;
    }
    if (query.entityType !== undefined) {
      filters.entityType = query.entityType;
    }
    if (query.jurisdictionCountry !== undefined) {
      filters.jurisdictionCountry = query.jurisdictionCountry;
    }
    if (query.jurisdictionState !== undefined) {
      filters.jurisdictionState = query.jurisdictionState;
    }
    if (query.searchTerm !== undefined) {
      filters.searchTerm = query.searchTerm;
    }

    return this.repository.findMany(filters, {
      limit: query.limit,
      offset: query.offset,
    });
  }

  async getSubsidiaries(parentEntityId: string): Promise<LegalEntity[]> {
    return this.repository.findSubsidiaries(parentEntityId);
  }

  async getParent(subsidiaryEntityId: string): Promise<LegalEntity | null> {
    return this.repository.findParent(subsidiaryEntityId);
  }

  async countEntities(filters?: { status?: string; entityType?: string }): Promise<number> {
    return this.repository.count(filters);
  }
}
