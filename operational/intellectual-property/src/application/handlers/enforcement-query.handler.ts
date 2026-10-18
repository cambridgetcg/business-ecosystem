/**
 * Enforcement Query Handler
 *
 * CQRS query handler for enforcement matter queries.
 *
 * @module application/handlers
 */

import type {
  EnforcementRepository,
  EnforcementSearchFilters,
} from '../../infrastructure/persistence/enforcement.repository.js';
import type {
  EnforcementMatter,
  EnforcementStatus,
  EnforcementPriority,
  IPAssetType,
} from '../../domain/entities/enforcement-matter.entity.js';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export class EnforcementQueryHandler {
  constructor(private readonly repository: EnforcementRepository) {}

  /**
   * Get matter by ID.
   */
  async getMatterById(matterId: string): Promise<EnforcementMatter | null> {
    return this.repository.findById(matterId);
  }

  /**
   * Get matter by matter number.
   */
  async getMatterByNumber(matterNumber: string): Promise<EnforcementMatter | null> {
    return this.repository.findByMatterNumber(matterNumber);
  }

  /**
   * Get matters by IP asset.
   */
  async getMattersByIPAsset(
    ipAssetType: IPAssetType,
    ipAssetId: string
  ): Promise<EnforcementMatter[]> {
    return this.repository.findByIPAsset(ipAssetType, ipAssetId);
  }

  /**
   * Get matters by status.
   */
  async getMattersByStatus(
    status: EnforcementStatus | EnforcementStatus[],
    limit?: number
  ): Promise<EnforcementMatter[]> {
    return this.repository.findByStatus(status, limit);
  }

  /**
   * Get matters by priority.
   */
  async getMattersByPriority(
    priority: EnforcementPriority,
    limit?: number
  ): Promise<EnforcementMatter[]> {
    return this.repository.findByPriority(priority, limit);
  }

  /**
   * Get matters assigned to a user.
   */
  async getMattersAssignedTo(userId: string): Promise<EnforcementMatter[]> {
    return this.repository.findAssignedTo(userId);
  }

  /**
   * Get matters with upcoming action deadlines.
   */
  async getMattersWithUpcomingActions(daysAhead: number): Promise<EnforcementMatter[]> {
    return this.repository.findWithUpcomingActions(daysAhead);
  }

  /**
   * Search matters with filters.
   */
  async searchMatters(filters: EnforcementSearchFilters): Promise<PaginatedResult<EnforcementMatter>> {
    const { matters, total } = await this.repository.search(filters);
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;

    return {
      data: matters,
      total,
      limit,
      offset,
      hasMore: offset + matters.length < total,
    };
  }

  /**
   * Get all open matters.
   */
  async getOpenMatters(limit?: number): Promise<EnforcementMatter[]> {
    return this.repository.findByStatus(
      ['monitoring', 'investigation', 'cease_and_desist', 'negotiation', 'litigation'],
      limit
    );
  }

  /**
   * Get critical matters.
   */
  async getCriticalMatters(): Promise<EnforcementMatter[]> {
    return this.repository.findByPriority('critical');
  }

  /**
   * Get matters in litigation.
   */
  async getMattersInLitigation(): Promise<EnforcementMatter[]> {
    return this.repository.findByStatus('litigation');
  }

  /**
   * Get matters statistics.
   */
  async getStatistics(): Promise<{
    total: number;
    byStatus: Record<EnforcementStatus, number>;
    byPriority: Record<EnforcementPriority, number>;
    byType: Record<string, number>;
    totalEstimatedDamages: number;
    totalSettlementAmounts: number;
    totalCosts: number;
  }> {
    // Get all matters (in practice, you'd want a more efficient query)
    const { matters } = await this.repository.search({ limit: 10000 });

    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let totalEstimatedDamages = 0;
    let totalSettlementAmounts = 0;
    let totalCosts = 0;

    for (const matter of matters) {
      // Count by status
      byStatus[matter.status] = (byStatus[matter.status] ?? 0) + 1;

      // Count by priority
      byPriority[matter.priority] = (byPriority[matter.priority] ?? 0) + 1;

      // Count by type
      byType[matter.type] = (byType[matter.type] ?? 0) + 1;

      // Sum financials
      totalEstimatedDamages += matter.estimatedDamages ?? 0;
      totalSettlementAmounts += matter.settlementAmount ?? 0;
      totalCosts += matter.actualCosts ?? 0;
    }

    return {
      total: matters.length,
      byStatus: byStatus as Record<EnforcementStatus, number>,
      byPriority: byPriority as Record<EnforcementPriority, number>,
      byType,
      totalEstimatedDamages,
      totalSettlementAmounts,
      totalCosts,
    };
  }
}
