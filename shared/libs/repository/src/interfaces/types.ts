/**
 * Core Repository Types
 * @module @ecosystem/repository
 */

import { z } from 'zod';

// =============================================================================
// Entity Types
// =============================================================================

/**
 * Base entity with standard fields
 */
export interface Entity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Entity with audit trail fields
 */
export interface AuditableEntity extends Entity {
  createdBy: string;
  updatedBy: string;
  version: number;
}

/**
 * Entity that supports soft deletion
 */
export interface SoftDeletableEntity extends Entity {
  deletedAt: Date | null;
  deletedBy: string | null;
}

/**
 * Entity with multi-tenant isolation
 */
export interface TenantEntity extends Entity {
  tenantId: string;
}

/**
 * Full-featured entity combining all traits
 */
export interface FullEntity extends AuditableEntity, SoftDeletableEntity, TenantEntity {}

// =============================================================================
// Query Types
// =============================================================================

/**
 * Filter operators for query building
 */
export type FilterOperator =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'nin'
  | 'like'
  | 'ilike'
  | 'between'
  | 'isNull'
  | 'isNotNull';

/**
 * Query filter specification
 */
export interface QueryFilter {
  field: string;
  operator: FilterOperator;
  value: unknown;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated result wrapper
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Query options for repository methods
 */
export interface QueryOptions {
  /** Include soft-deleted records */
  includeSoftDeleted?: boolean;
  /** Tenant ID for multi-tenant queries */
  tenantId?: string;
  /** Lock rows for update */
  forUpdate?: boolean;
}

// =============================================================================
// Validation Schemas
// =============================================================================

export const entitySchema = z.object({
  id: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const auditableEntitySchema = entitySchema.extend({
  createdBy: z.string(),
  updatedBy: z.string(),
  version: z.number().int().min(1),
});

export const softDeletableEntitySchema = entitySchema.extend({
  deletedAt: z.date().nullable(),
  deletedBy: z.string().nullable(),
});

export const paginationParamsSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const queryFilterSchema = z.object({
  field: z.string().min(1),
  operator: z.enum([
    'eq', 'ne', 'gt', 'gte', 'lt', 'lte',
    'in', 'nin', 'like', 'ilike', 'between',
    'isNull', 'isNotNull'
  ]),
  value: z.unknown(),
});

// =============================================================================
// Error Types
// =============================================================================

export class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}

export class EntityNotFoundError extends RepositoryError {
  constructor(entityType: string, id: string) {
    super(`${entityType} not found: ${id}`, 'ENTITY_NOT_FOUND');
    this.name = 'EntityNotFoundError';
  }
}

export class ConcurrencyError extends RepositoryError {
  constructor(entityType: string, id: string, expectedVersion: number) {
    super(
      `Concurrency conflict on ${entityType} ${id}: expected version ${expectedVersion}`,
      'CONCURRENCY_CONFLICT'
    );
    this.name = 'ConcurrencyError';
  }
}

export class ValidationError extends RepositoryError {
  constructor(message: string, public readonly errors: z.ZodError) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}
