/**
 * Shared Types for Contracts & Legal Service
 */

import { Contract, Party, Document, ContractTemplate, LegalMatter, Property, EmploymentAgreement } from '@prisma/client';

// Re-export Prisma types for convenience
export type { Contract, Party, Document, ContractTemplate, LegalMatter, Property, EmploymentAgreement };

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
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Contract summary for lists
 */
export interface ContractSummary {
  id: string;
  contractNumber: string;
  title: string;
  type: string;
  status: string;
  value: number | null;
  currency: string;
  effectiveDate: Date | null;
  expiryDate: Date | null;
  partiesCount: number;
}

/**
 * Contract statistics
 */
export interface ContractStats {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  totalValue: number;
  expiringIn30Days: number;
  expiringIn90Days: number;
}

/**
 * Legal matter summary
 */
export interface MatterSummary {
  id: string;
  matterNumber: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  estimatedCost: number | null;
  actualCost: number | null;
}

/**
 * Dashboard data
 */
export interface DashboardData {
  contracts: ContractStats;
  matters: {
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
  };
  recentActivity: Array<{
    id: string;
    type: string;
    description: string;
    entityType: string;
    entityId: string;
    performedAt: Date;
  }>;
}
