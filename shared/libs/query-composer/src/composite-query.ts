/**
 * Composite Query Builder
 * Type-safe builder for cross-domain queries
 */

import { pino } from 'pino';
import type { Logger } from 'pino';
import { QueryExecutor } from './query-executor.js';
import { DataLoader, createEntityLoader } from './data-loader.js';
import type { CompositeQueryResult, QueryOptions } from './types.js';

const logger: Logger = (pino as unknown as (options: object) => Logger)({ name: 'composite-query' });

/**
 * Service client interface for cross-domain queries
 */
export interface ServiceClients {
  entityGovernance: {
    getEntity(id: string, correlationId?: string): Promise<any>;
    getEntityTree(id: string, correlationId?: string): Promise<any>;
  };
  kycIdentity: {
    getIdentity(id: string, correlationId?: string): Promise<any>;
  };
  bankingTreasury: {
    getBankAccount(id: string, correlationId?: string): Promise<any>;
  };
  compliance: {
    getPolicies(correlationId?: string): Promise<any>;
  };
}

/**
 * Pre-built composite queries for common cross-domain scenarios
 */
export class CompositeQueries {
  private executor: QueryExecutor;
  private clients: ServiceClients;
  private entityLoader: DataLoader<string, any>;

  constructor(clients: ServiceClients) {
    this.clients = clients;
    this.executor = new QueryExecutor();
    this.entityLoader = createEntityLoader(
      async (ids) => {
        // Fetch entities in batch
        const results = await Promise.all(
          ids.map(id => this.clients.entityGovernance.getEntity(id).catch(() => null))
        );
        return results.filter(Boolean);
      },
      { batchDelayMs: 5, maxBatchSize: 50 }
    );
  }

  /**
   * Get entity with related KYC and compliance data
   */
  async getEntityWithCompliance(
    entityId: string,
    options?: QueryOptions
  ): Promise<CompositeQueryResult<{
    entity: any;
    kycStatus?: any;
    compliancePolicies?: any;
  }>> {
    const startTime = Date.now();
    const correlationId = options?.correlationId;

    logger.debug({ entityId, correlationId }, 'Fetching entity with compliance data');

    const result = await this.executor.withDependencies(
      {
        entity: {
          query: async () => this.clients.entityGovernance.getEntity(entityId, correlationId),
        },
        kycStatus: {
          query: async (ctx) => {
            const entity = ctx.entity as any;
            if (entity?.kycIdentityId) {
              return this.clients.kycIdentity.getIdentity(entity.kycIdentityId, correlationId);
            }
            return null;
          },
          dependsOn: ['entity'],
        },
        compliancePolicies: {
          query: async () => this.clients.compliance.getPolicies(correlationId),
        },
      },
      { correlationId }
    );

    return {
      data: {
        entity: result.data.entity,
        kycStatus: result.data.kycStatus,
        compliancePolicies: result.data.compliancePolicies,
      },
      meta: {
        totalExecutionTimeMs: Date.now() - startTime,
        steps: result.meta.sources.map(source => ({
          name: source,
          executionTimeMs: 0, // Would need per-step timing
          cached: false,
        })),
        correlationId,
      },
    };
  }

  /**
   * Get entity with financial overview
   */
  async getEntityWithFinancials(
    entityId: string,
    options?: QueryOptions
  ): Promise<CompositeQueryResult<{
    entity: any;
    bankAccounts?: any[];
    recentTransactions?: any[];
  }>> {
    const startTime = Date.now();
    const correlationId = options?.correlationId;

    logger.debug({ entityId, correlationId }, 'Fetching entity with financial data');

    const result = await this.executor.parallel(
      {
        entity: () => this.clients.entityGovernance.getEntity(entityId, correlationId),
        bankAccounts: () =>
          this.clients.bankingTreasury.getBankAccount(entityId, correlationId).catch(() => []),
      },
      { correlationId }
    );

    return {
      data: {
        entity: result.data.entity,
        bankAccounts: Array.isArray(result.data.bankAccounts)
          ? result.data.bankAccounts
          : [result.data.bankAccounts].filter(Boolean),
      },
      meta: {
        totalExecutionTimeMs: Date.now() - startTime,
        steps: result.meta.sources.map(source => ({
          name: source,
          executionTimeMs: 0,
          cached: false,
        })),
        correlationId,
      },
    };
  }

  /**
   * Get corporate structure with entity details
   */
  async getCorporateStructure(
    rootEntityId: string,
    options?: QueryOptions
  ): Promise<CompositeQueryResult<{
    tree: any;
    entities: Map<string, any>;
  }>> {
    const startTime = Date.now();
    const correlationId = options?.correlationId;

    logger.debug({ rootEntityId, correlationId }, 'Fetching corporate structure');

    // First get the tree structure
    const tree = await this.clients.entityGovernance.getEntityTree(rootEntityId, correlationId);

    // Extract all entity IDs from the tree
    const entityIds = this.extractEntityIds(tree);

    // Batch load all entities
    const entities = await this.entityLoader.loadMany(entityIds);

    return {
      data: { tree, entities },
      meta: {
        totalExecutionTimeMs: Date.now() - startTime,
        steps: [
          { name: 'tree', executionTimeMs: 0, cached: false },
          { name: 'entities', executionTimeMs: 0, cached: false },
        ],
        correlationId,
      },
    };
  }

  /**
   * Get entity dashboard with all related data
   */
  async getEntityDashboard(
    entityId: string,
    options?: QueryOptions
  ): Promise<CompositeQueryResult<{
    entity: any;
    kycStatus?: any;
    bankAccounts?: any[];
    compliancePolicies?: any;
  }>> {
    const startTime = Date.now();
    const correlationId = options?.correlationId;

    logger.debug({ entityId, correlationId }, 'Fetching entity dashboard');

    const result = await this.executor.withDependencies(
      {
        entity: {
          query: async () => this.clients.entityGovernance.getEntity(entityId, correlationId),
        },
        kycStatus: {
          query: async (ctx) => {
            const entity = ctx.entity as any;
            if (entity?.kycIdentityId) {
              return this.clients.kycIdentity.getIdentity(entity.kycIdentityId, correlationId);
            }
            return null;
          },
          dependsOn: ['entity'],
        },
        bankAccounts: {
          query: async () =>
            this.clients.bankingTreasury.getBankAccount(entityId, correlationId).catch(() => []),
        },
        compliancePolicies: {
          query: async () => this.clients.compliance.getPolicies(correlationId),
        },
      },
      { correlationId }
    );

    return {
      data: {
        entity: result.data.entity,
        kycStatus: result.data.kycStatus,
        bankAccounts: Array.isArray(result.data.bankAccounts)
          ? result.data.bankAccounts
          : [result.data.bankAccounts].filter(Boolean),
        compliancePolicies: result.data.compliancePolicies,
      },
      meta: {
        totalExecutionTimeMs: Date.now() - startTime,
        steps: result.meta.sources.map(source => ({
          name: source,
          executionTimeMs: 0,
          cached: false,
        })),
        correlationId,
      },
    };
  }

  private extractEntityIds(tree: any, ids: string[] = []): string[] {
    if (!tree) return ids;

    if (tree.id && !ids.includes(tree.id)) {
      ids.push(tree.id);
    }

    if (tree.children && Array.isArray(tree.children)) {
      for (const child of tree.children) {
        this.extractEntityIds(child, ids);
      }
    }

    return ids;
  }
}

/**
 * Create a CompositeQueries instance with service clients
 */
export function createCompositeQueries(clients: ServiceClients): CompositeQueries {
  return new CompositeQueries(clients);
}
