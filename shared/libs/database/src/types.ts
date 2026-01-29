/**
 * Core database types
 */

export interface Entity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditableEntity extends Entity {
  createdBy: string;
  updatedBy: string;
  version: number;
}

export interface SoftDeletableEntity extends Entity {
  deletedAt: Date | null;
  deletedBy: string | null;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface QueryFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'like' | 'between';
  value: unknown;
}

export interface DatabaseConfig {
  url: string;
  poolMin?: number;
  poolMax?: number;
  ssl?: boolean;
  debug?: boolean;
}
