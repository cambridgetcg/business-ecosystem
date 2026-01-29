/**
 * Operational Gateway Types
 * Unified types for cross-operational queries
 */

import { z } from 'zod';

export const operationalDomainSchema = z.enum([
  'contracts-legal',
  'insurance',
  'intellectual-property',
  'data-privacy',
]);

export type OperationalDomain = z.infer<typeof operationalDomainSchema>;

export const documentStatusSchema = z.enum([
  'draft',
  'pending-review',
  'approved',
  'active',
  'expired',
  'terminated',
]);

export type DocumentStatus = z.infer<typeof documentStatusSchema>;

// Cross-domain entity overview
export interface EntityOperationalOverview {
  entityId: string;
  entityName?: string;
  domains: {
    [K in OperationalDomain]?: DomainSummary;
  };
  pendingActions: PendingAction[];
  expiringItems: ExpiringItem[];
  complianceStatus: ComplianceOverview;
  lastUpdated: Date;
}

export interface DomainSummary {
  domain: OperationalDomain;
  activeCount: number;
  pendingCount: number;
  recentActivity: RecentActivity[];
  healthStatus: 'healthy' | 'warning' | 'critical';
}

export interface RecentActivity {
  type: string;
  description: string;
  timestamp: Date;
  reference?: string;
}

export interface PendingAction {
  id: string;
  domain: OperationalDomain;
  type: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  dueDate?: Date;
  assignee?: string;
  reference: string;
}

export interface ExpiringItem {
  id: string;
  domain: OperationalDomain;
  type: string;
  description: string;
  expirationDate: Date;
  daysUntilExpiry: number;
  renewalRequired: boolean;
  reference: string;
}

export interface ComplianceOverview {
  overallStatus: 'compliant' | 'non-compliant' | 'pending' | 'not-applicable';
  domainStatuses: {
    [K in OperationalDomain]?: {
      status: 'compliant' | 'non-compliant' | 'pending' | 'not-applicable';
      openFindings: number;
      criticalFindings: number;
    };
  };
  totalFindings: number;
  criticalFindings: number;
}

// Domain client responses
export interface DomainHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  domain: OperationalDomain;
  timestamp: Date;
  details?: Record<string, unknown>;
}

export interface DomainDocumentsResponse {
  documents: DomainDocument[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DomainDocument {
  id: string;
  type: string;
  title: string;
  status: DocumentStatus;
  entityId: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

// Query parameters
export interface EntityOverviewQuery {
  entityId: string;
  includeDomains?: OperationalDomain[];
  includeCompliance?: boolean;
  includePendingActions?: boolean;
  includeExpiringItems?: boolean;
  expiringWithinDays?: number;
}

export interface PendingActionsQuery {
  entityId?: string;
  domains?: OperationalDomain[];
  priority?: 'high' | 'medium' | 'low';
  assignee?: string;
  dueBefore?: Date;
  limit?: number;
  offset?: number;
}

export interface ExpiringItemsQuery {
  entityId?: string;
  domains?: OperationalDomain[];
  withinDays: number;
  renewalRequiredOnly?: boolean;
  limit?: number;
  offset?: number;
}
