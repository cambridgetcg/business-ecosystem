/**
 * Operational Data Aggregator
 * Combines data from all operational domains into unified views
 */

import { pino } from 'pino';
import type { DomainClient } from './domain-client.js';
import type {
  OperationalDomain,
  EntityOperationalOverview,
  PendingAction,
  ExpiringItem,
  ComplianceOverview,
  EntityOverviewQuery,
  PendingActionsQuery,
  ExpiringItemsQuery,
  DomainSummary,
} from './types.js';

const logger = pino({ name: 'operational-aggregator' });

export interface ComplianceClientConfig {
  baseUrl: string;
  timeout?: number;
}

export class OperationalAggregator {
  private domainClients: Map<OperationalDomain, DomainClient>;
  private complianceUrl: string;
  private complianceTimeout: number;

  constructor(
    domainClients: Map<OperationalDomain, DomainClient>,
    complianceConfig?: ComplianceClientConfig
  ) {
    this.domainClients = domainClients;
    this.complianceUrl = complianceConfig?.baseUrl || 'http://localhost:3021';
    this.complianceTimeout = complianceConfig?.timeout || 10000;
  }

  /**
   * Get comprehensive operational overview for an entity
   */
  async getEntityOverview(query: EntityOverviewQuery): Promise<EntityOperationalOverview> {
    const { entityId, includeDomains, includeCompliance = true, 
            includePendingActions = true, includeExpiringItems = true,
            expiringWithinDays = 30 } = query;

    logger.info({ entityId }, 'Fetching entity operational overview');

    const domains = includeDomains || 
      Array.from(this.domainClients.keys());

    // Fetch all data in parallel
    const [domainSummaries, pendingActions, expiringItems, compliance] = await Promise.all([
      this.fetchDomainSummaries(entityId, domains),
      includePendingActions ? this.fetchPendingActions({ entityId, domains }) : [],
      includeExpiringItems ? this.fetchExpiringItems({ entityId, domains, withinDays: expiringWithinDays }) : [],
      includeCompliance ? this.fetchComplianceOverview(entityId) : this.defaultComplianceOverview(),
    ]);

    const domainMap: { [K in OperationalDomain]?: DomainSummary } = {};
    for (const summary of domainSummaries) {
      domainMap[summary.domain] = summary;
    }

    return {
      entityId,
      domains: domainMap,
      pendingActions,
      expiringItems,
      complianceStatus: compliance,
      lastUpdated: new Date(),
    };
  }

  private async fetchDomainSummaries(
    entityId: string,
    domains: OperationalDomain[]
  ): Promise<DomainSummary[]> {
    const promises = domains.map(async (domain) => {
      const client = this.domainClients.get(domain);
      if (!client) return null;

      try {
        return await client.getSummary(entityId);
      } catch (error) {
        logger.error({ domain, entityId, error }, 'Failed to fetch domain summary');
        return {
          domain,
          activeCount: 0,
          pendingCount: 0,
          recentActivity: [],
          healthStatus: 'critical' as const,
        };
      }
    });

    const results = await Promise.all(promises);
    return results.filter((r): r is DomainSummary => r !== null);
  }

  /**
   * Get all pending actions across operational domains
   */
  async fetchPendingActions(query: PendingActionsQuery): Promise<PendingAction[]> {
    const { entityId, domains, priority, assignee, dueBefore, limit = 100, offset = 0 } = query;

    const targetDomains = domains || 
      Array.from(this.domainClients.keys());

    const promises = targetDomains.map(async (domain) => {
      const client = this.domainClients.get(domain);
      if (!client) return [];

      try {
        return await client.getPendingActions(entityId);
      } catch (error) {
        logger.error({ domain, entityId, error }, 'Failed to fetch pending actions');
        return [];
      }
    });

    const results = await Promise.all(promises);
    let actions = results.flat();

    // Apply filters
    if (priority) {
      actions = actions.filter(a => a.priority === priority);
    }
    if (assignee) {
      actions = actions.filter(a => a.assignee === assignee);
    }
    if (dueBefore) {
      actions = actions.filter(a => a.dueDate && a.dueDate <= dueBefore);
    }

    // Sort by priority (high first) then due date
    actions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      return a.dueDate ? -1 : 1;
    });

    return actions.slice(offset, offset + limit);
  }

  /**
   * Get all items expiring within specified days
   */
  async fetchExpiringItems(query: ExpiringItemsQuery): Promise<ExpiringItem[]> {
    const { entityId, domains, withinDays, renewalRequiredOnly = false, 
            limit = 100, offset = 0 } = query;

    const targetDomains = domains || 
      Array.from(this.domainClients.keys());

    const promises = targetDomains.map(async (domain) => {
      const client = this.domainClients.get(domain);
      if (!client || !entityId) return [];

      try {
        return await client.getExpiringItems(entityId, withinDays);
      } catch (error) {
        logger.error({ domain, entityId, error }, 'Failed to fetch expiring items');
        return [];
      }
    });

    const results = await Promise.all(promises);
    let items = results.flat();

    // Calculate days until expiry
    const now = new Date();
    items = items.map(item => ({
      ...item,
      daysUntilExpiry: Math.ceil(
        (new Date(item.expirationDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      ),
    }));

    // Apply filters
    if (renewalRequiredOnly) {
      items = items.filter(i => i.renewalRequired);
    }

    // Sort by expiration date (soonest first)
    items.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

    return items.slice(offset, offset + limit);
  }

  /**
   * Fetch compliance overview from compliance aggregator service
   */
  private async fetchComplianceOverview(entityId: string): Promise<ComplianceOverview> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.complianceTimeout);

      const response = await fetch(
        `${this.complianceUrl}/entities/${entityId}/compliance`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);

      if (!response.ok) {
        return this.defaultComplianceOverview();
      }

      const data = await response.json() as {
        overallStatus: ComplianceOverview['overallStatus'];
        domains: Record<string, {
          status: ComplianceOverview['domainStatuses'][OperationalDomain];
          openFindings: number;
        }>;
        totalFindings: number;
        criticalFindings: number;
      };

      const domainStatuses: ComplianceOverview['domainStatuses'] = {};
      for (const [domain, status] of Object.entries(data.domains || {})) {
        domainStatuses[domain as OperationalDomain] = {
          status: status.status?.status || 'pending',
          openFindings: status.openFindings || 0,
          criticalFindings: 0,
        };
      }

      return {
        overallStatus: data.overallStatus || 'pending',
        domainStatuses,
        totalFindings: data.totalFindings || 0,
        criticalFindings: data.criticalFindings || 0,
      };
    } catch (error) {
      logger.error({ entityId, error }, 'Failed to fetch compliance overview');
      return this.defaultComplianceOverview();
    }
  }

  private defaultComplianceOverview(): ComplianceOverview {
    return {
      overallStatus: 'pending',
      domainStatuses: {},
      totalFindings: 0,
      criticalFindings: 0,
    };
  }

  /**
   * Get health status of all domain services
   */
  async getDomainsHealth(): Promise<Map<OperationalDomain, { status: string; timestamp: Date }>> {
    const health = new Map<OperationalDomain, { status: string; timestamp: Date }>();

    const promises = Array.from(this.domainClients.entries()).map(
      async ([domain, client]) => {
        const result = await client.getHealth();
        health.set(domain, { status: result.status, timestamp: result.timestamp });
      }
    );

    await Promise.all(promises);
    return health;
  }
}
