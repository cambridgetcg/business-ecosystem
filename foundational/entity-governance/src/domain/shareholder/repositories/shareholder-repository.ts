/**
 * Shareholder Repository Interface
 *
 * Defines the contract for persisting and retrieving shareholders.
 */

import type { Shareholder, CreateShareholderInput, UpdateShareholderInput } from '../models/shareholder.js';

export interface ShareholderFilters {
  entityId?: string;
  shareholderType?: string;
}

export interface ShareholderRepository {
  /**
   * Find a shareholder by ID
   */
  findById(id: string): Promise<Shareholder | null>;

  /**
   * Find all shareholders for a legal entity
   */
  findByEntityId(entityId: string): Promise<Shareholder[]>;

  /**
   * Find shareholders with filters
   */
  findMany(filters?: ShareholderFilters): Promise<Shareholder[]>;

  /**
   * Create a new shareholder
   */
  create(input: CreateShareholderInput, createdBy?: string): Promise<Shareholder>;

  /**
   * Update a shareholder
   */
  update(id: string, input: UpdateShareholderInput, updatedBy?: string): Promise<Shareholder>;

  /**
   * Soft delete a shareholder record
   */
  delete(id: string, deletedBy?: string): Promise<void>;

  /**
   * Count shareholders for an entity
   */
  countByEntityId(entityId: string): Promise<number>;
}
