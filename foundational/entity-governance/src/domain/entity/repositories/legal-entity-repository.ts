/**
 * Legal Entity Repository Interface
 *
 * Defines the contract for persisting and retrieving legal entities.
 */

import type { LegalEntity, CreateLegalEntityInput, UpdateLegalEntityInput } from '../models/legal-entity.js';

export interface LegalEntityFilters {
  status?: string;
  entityType?: string;
  jurisdictionCountry?: string;
  jurisdictionState?: string;
  searchTerm?: string;
}

export interface PaginationOptions {
  limit: number;
  offset: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface LegalEntityRepository {
  /**
   * Find a legal entity by ID
   */
  findById(id: string): Promise<LegalEntity | null>;

  /**
   * Find legal entities with filters and pagination
   */
  findMany(
    filters?: LegalEntityFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<LegalEntity>>;

  /**
   * Find all subsidiaries of a parent entity
   */
  findSubsidiaries(parentEntityId: string): Promise<LegalEntity[]>;

  /**
   * Find the parent entity of a subsidiary
   */
  findParent(subsidiaryEntityId: string): Promise<LegalEntity | null>;

  /**
   * Create a new legal entity
   */
  create(input: CreateLegalEntityInput, createdBy?: string): Promise<LegalEntity>;

  /**
   * Update an existing legal entity
   */
  update(id: string, input: UpdateLegalEntityInput, updatedBy?: string): Promise<LegalEntity>;

  /**
   * Soft delete a legal entity
   */
  delete(id: string, deletedBy?: string): Promise<void>;

  /**
   * Update tax ID (called from external event)
   */
  updateTaxId(entityId: string, taxId: string): Promise<void>;

  /**
   * Check if an entity exists
   */
  exists(id: string): Promise<boolean>;

  /**
   * Count entities matching filters
   */
  count(filters?: LegalEntityFilters): Promise<number>;
}
