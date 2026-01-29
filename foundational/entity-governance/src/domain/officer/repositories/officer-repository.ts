/**
 * Officer Repository Interface
 *
 * Defines the contract for persisting and retrieving officers.
 */

import type { Officer, CreateOfficerInput, UpdateOfficerInput } from '../models/officer.js';

export interface OfficerFilters {
  entityId?: string;
  title?: string;
  isActive?: boolean;
}

export interface OfficerRepository {
  /**
   * Find an officer by ID
   */
  findById(id: string): Promise<Officer | null>;

  /**
   * Find all officers for a legal entity
   */
  findByEntityId(entityId: string, includeTerminated?: boolean): Promise<Officer[]>;

  /**
   * Find officers with filters
   */
  findMany(filters?: OfficerFilters): Promise<Officer[]>;

  /**
   * Create a new officer
   */
  create(input: CreateOfficerInput, createdBy?: string): Promise<Officer>;

  /**
   * Update an officer
   */
  update(id: string, input: UpdateOfficerInput, updatedBy?: string): Promise<Officer>;

  /**
   * Terminate an officer
   */
  terminate(id: string, terminationDate: Date, updatedBy?: string): Promise<Officer>;

  /**
   * Soft delete an officer record
   */
  delete(id: string, deletedBy?: string): Promise<void>;

  /**
   * Check if an entity has an officer with a specific title
   */
  existsByTitle(entityId: string, title: string): Promise<boolean>;

  /**
   * Count active officers for an entity
   */
  countByEntityId(entityId: string): Promise<number>;
}
