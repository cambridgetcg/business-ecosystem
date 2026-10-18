/**
 * Dashboard Service
 *
 * Aggregates portfolio data for dashboard displays, providing summary
 * statistics, deadline tracking, compliance status, and activity feeds.
 *
 * @module application/services
 */

import type { Database } from '../../infrastructure/persistence/database.js';
import { sql } from 'drizzle-orm';
import {
  patents,
  trademarks,
  copyrights,
  licenses,
  tradeSecrets,
  domainNames,
  patentMaintenanceFees,
  enforcementMatters,
  ipValuations,
  ipAuditLog,
} from '../../infrastructure/persistence/schema.js';
import { deadlineStore, type Deadline } from '../../infrastructure/aws/dynamodb-deadline-store.js';

// ============================================================================
// Types
// ============================================================================

export type AssetType = 'patent' | 'trademark' | 'copyright' | 'trade_secret' | 'license' | 'domain';

export interface AssetCountByStatus {
  status: string;
  count: number;
}

export interface AssetSummary {
  type: AssetType;
  total: number;
  byStatus: AssetCountByStatus[];
}

export interface PortfolioSummary {
  assets: AssetSummary[];
  totalAssets: number;
  totalValuation: number | null;
  valuationCurrency: string;
  lastUpdated: Date;
}

export interface DeadlineSummaryByType {
  assetType: string;
  overdue: number;
  dueThisWeek: number;
  dueThisMonth: number;
}

export interface DeadlineSummaryByPriority {
  priority: string;
  count: number;
}

export interface UpcomingDeadline {
  id: string;
  assetId: string;
  assetType: string;
  deadlineType: string;
  dueDate: Date;
  priority: string;
  description?: string;
}

export interface DeadlinesDashboard {
  summary: {
    overdue: number;
    dueThisWeek: number;
    dueThisMonth: number;
    total: number;
  };
  byAssetType: DeadlineSummaryByType[];
  byPriority: DeadlineSummaryByPriority[];
  upcoming: UpcomingDeadline[];
}

export interface TrademarkComplianceStatus {
  section8: { compliant: number; dueSoon: number; overdue: number };
  section9: { compliant: number; dueSoon: number; overdue: number };
  section15: { compliant: number; dueSoon: number; overdue: number };
}

export interface PatentMaintenanceStatus {
  paid: number;
  upcoming: number;
  gracePeriod: number;
  overdue: number;
}

export interface DomainRenewalStatus {
  current: number;
  expiringThisMonth: number;
  expiringThisQuarter: number;
  expired: number;
}

export interface ComplianceDashboard {
  trademarkCompliance: TrademarkComplianceStatus;
  patentMaintenance: PatentMaintenanceStatus;
  domainRenewals: DomainRenewalStatus;
  overallScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface EnforcementSummaryByStatus {
  status: string;
  count: number;
}

export interface EnforcementSummaryByPriority {
  priority: string;
  count: number;
}

export interface RecentEnforcementActivity {
  matterId: string;
  matterNumber: string | null;
  title: string;
  activityType: string;
  activityDate: Date;
  description: string;
}

export interface EnforcementDashboard {
  activeMatters: number;
  totalMatters: number;
  byStatus: EnforcementSummaryByStatus[];
  byPriority: EnforcementSummaryByPriority[];
  recentActivity: RecentEnforcementActivity[];
  totalEstimatedDamages: number;
  totalSettlements: number;
}

export interface ValuationByAssetType {
  assetType: string;
  totalValue: number;
  count: number;
}

export interface RecentValuation {
  id: string;
  valuationNumber: string | null;
  title: string;
  status: string;
  selectedValue: number | null;
  currency: string;
  approvedDate: Date | null;
}

export interface ValuationsDashboard {
  totalPortfolioValue: number;
  currency: string;
  byAssetType: ValuationByAssetType[];
  recentValuations: RecentValuation[];
  pendingCount: number;
  approvedCount: number;
}

export interface ActivityEvent {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId: string;
  occurredAt: Date;
  metadata?: Record<string, unknown>;
}

export interface ActivityByType {
  type: string;
  count: number;
}

export interface ActivityTimeline {
  date: string;
  count: number;
}

export interface ActivityDashboard {
  recentEvents: ActivityEvent[];
  byType: ActivityByType[];
  timeline: ActivityTimeline[];
  totalEventsLast30Days: number;
}

// ============================================================================
// Dashboard Service
// ============================================================================

export class DashboardService {
  constructor(private readonly db: Database) {}

  /**
   * Get portfolio summary with counts by asset type and status.
   */
  async getPortfolioSummary(): Promise<PortfolioSummary> {
    const [
      patentStats,
      trademarkStats,
      copyrightStats,
      tradeSecretStats,
      licenseStats,
      domainStats,
      valuationTotal,
    ] = await Promise.all([
      this.getAssetStats('patent', patents, 'status'),
      this.getAssetStats('trademark', trademarks, 'status'),
      this.getAssetStats('copyright', copyrights, 'status'),
      this.getAssetStats('trade_secret', tradeSecrets, 'status'),
      this.getAssetStats('license', licenses, 'status'),
      this.getAssetStats('domain', domainNames, 'status'),
      this.getTotalApprovedValuation(),
    ]);

    const assets: AssetSummary[] = [
      patentStats,
      trademarkStats,
      copyrightStats,
      tradeSecretStats,
      licenseStats,
      domainStats,
    ];

    const totalAssets = assets.reduce((sum, a) => sum + a.total, 0);

    return {
      assets,
      totalAssets,
      totalValuation: valuationTotal.total,
      valuationCurrency: 'USD',
      lastUpdated: new Date(),
    };
  }

  /**
   * Get deadlines dashboard data.
   */
  async getDeadlinesDashboard(): Promise<DeadlinesDashboard> {
    const now = new Date();
    const oneWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const oneMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Get deadlines from DynamoDB
    const [pendingDeadlines, overdueDeadlines] = await Promise.all([
      deadlineStore.getDeadlinesByStatus('pending', 1000),
      deadlineStore.getOverdueDeadlines(1000),
    ]);

    const allDeadlines = [...pendingDeadlines, ...overdueDeadlines];

    // Calculate summary
    const overdue = overdueDeadlines.length;
    let dueThisWeek = 0;
    let dueThisMonth = 0;

    const byAssetTypeMap = new Map<string, { overdue: number; dueThisWeek: number; dueThisMonth: number }>();
    const byPriorityMap = new Map<string, number>();

    for (const deadline of allDeadlines) {
      const dueDate = new Date(deadline.dueDate);
      const isOverdue = dueDate < now;

      // Get or create asset type entry
      let assetEntry = byAssetTypeMap.get(deadline.assetType);
      if (!assetEntry) {
        assetEntry = { overdue: 0, dueThisWeek: 0, dueThisMonth: 0 };
        byAssetTypeMap.set(deadline.assetType, assetEntry);
      }

      // Count by priority
      byPriorityMap.set(deadline.priority, (byPriorityMap.get(deadline.priority) || 0) + 1);

      if (isOverdue) {
        assetEntry.overdue++;
      } else {
        if (dueDate <= oneWeek) {
          dueThisWeek++;
          assetEntry.dueThisWeek++;
        }
        if (dueDate <= oneMonth) {
          dueThisMonth++;
          assetEntry.dueThisMonth++;
        }
      }
    }

    // Get upcoming deadlines (next 10)
    const upcoming = pendingDeadlines
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 10)
      .map((d) => ({
        id: d.deadlineId,
        assetId: d.assetId,
        assetType: d.assetType,
        deadlineType: d.deadlineType,
        dueDate: new Date(d.dueDate),
        priority: d.priority,
        description: d.description,
      }));

    return {
      summary: {
        overdue,
        dueThisWeek,
        dueThisMonth,
        total: allDeadlines.length,
      },
      byAssetType: Array.from(byAssetTypeMap.entries()).map(([assetType, counts]) => ({
        assetType,
        ...counts,
      })),
      byPriority: Array.from(byPriorityMap.entries()).map(([priority, count]) => ({
        priority,
        count,
      })),
      upcoming,
    };
  }

  /**
   * Get compliance dashboard data.
   */
  async getComplianceDashboard(): Promise<ComplianceDashboard> {
    const [trademarkCompliance, patentMaintenance, domainRenewals] = await Promise.all([
      this.getTrademarkComplianceStatus(),
      this.getPatentMaintenanceStatus(),
      this.getDomainRenewalStatus(),
    ]);

    // Calculate overall compliance score (0-100)
    const totalItems =
      trademarkCompliance.section8.compliant +
      trademarkCompliance.section8.dueSoon +
      trademarkCompliance.section8.overdue +
      trademarkCompliance.section9.compliant +
      trademarkCompliance.section9.dueSoon +
      trademarkCompliance.section9.overdue +
      patentMaintenance.paid +
      patentMaintenance.upcoming +
      patentMaintenance.gracePeriod +
      patentMaintenance.overdue +
      domainRenewals.current +
      domainRenewals.expiringThisMonth +
      domainRenewals.expiringThisQuarter +
      domainRenewals.expired;

    const overdueItems =
      trademarkCompliance.section8.overdue +
      trademarkCompliance.section9.overdue +
      patentMaintenance.overdue +
      domainRenewals.expired;

    const atRiskItems =
      trademarkCompliance.section8.dueSoon +
      trademarkCompliance.section9.dueSoon +
      patentMaintenance.gracePeriod +
      domainRenewals.expiringThisMonth;

    const overallScore = totalItems > 0
      ? Math.round(((totalItems - overdueItems - atRiskItems * 0.5) / totalItems) * 100)
      : 100;

    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (overallScore >= 90) riskLevel = 'low';
    else if (overallScore >= 70) riskLevel = 'medium';
    else if (overallScore >= 50) riskLevel = 'high';
    else riskLevel = 'critical';

    return {
      trademarkCompliance,
      patentMaintenance,
      domainRenewals,
      overallScore,
      riskLevel,
    };
  }

  /**
   * Get enforcement dashboard data.
   */
  async getEnforcementDashboard(): Promise<EnforcementDashboard> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Get all enforcement matters
    const matters = await this.db
      .select()
      .from(enforcementMatters)
      .where(sql`${enforcementMatters.deletedAt} IS NULL`);

    const openStatuses = ['monitoring', 'investigation', 'cease_and_desist', 'negotiation', 'litigation'];
    const activeMatters = matters.filter((m) => openStatuses.includes(m.status));

    // Group by status
    const byStatusMap = new Map<string, number>();
    for (const matter of matters) {
      byStatusMap.set(matter.status, (byStatusMap.get(matter.status) || 0) + 1);
    }

    // Group by priority
    const byPriorityMap = new Map<string, number>();
    for (const matter of activeMatters) {
      byPriorityMap.set(matter.priority, (byPriorityMap.get(matter.priority) || 0) + 1);
    }

    // Calculate financial totals
    let totalEstimatedDamages = 0;
    let totalSettlements = 0;
    for (const matter of matters) {
      if (matter.estimatedDamages) totalEstimatedDamages += matter.estimatedDamages;
      if (matter.settlementAmount) totalSettlements += matter.settlementAmount;
    }

    // Get recent activity from audit log
    const recentLogs = await this.db
      .select()
      .from(ipAuditLog)
      .where(sql`${ipAuditLog.entityType} = 'enforcement_matter' AND ${ipAuditLog.occurredAt} >= ${thirtyDaysAgo}`)
      .orderBy(sql`${ipAuditLog.occurredAt} DESC`)
      .limit(20);

    const recentActivity: RecentEnforcementActivity[] = recentLogs.map((log) => {
      const matter = matters.find((m) => m.id === log.entityId);
      return {
        matterId: log.entityId,
        matterNumber: matter?.matterNumber ?? null,
        title: matter?.title ?? 'Unknown Matter',
        activityType: log.action,
        activityDate: log.occurredAt,
        description: `${log.action} on enforcement matter`,
      };
    });

    return {
      activeMatters: activeMatters.length,
      totalMatters: matters.length,
      byStatus: Array.from(byStatusMap.entries()).map(([status, count]) => ({ status, count })),
      byPriority: Array.from(byPriorityMap.entries()).map(([priority, count]) => ({ priority, count })),
      recentActivity,
      totalEstimatedDamages,
      totalSettlements,
    };
  }

  /**
   * Get valuations dashboard data.
   */
  async getValuationsDashboard(): Promise<ValuationsDashboard> {
    const valuations = await this.db
      .select()
      .from(ipValuations)
      .where(sql`${ipValuations.deletedAt} IS NULL`);

    // Filter approved valuations
    const approvedValuations = valuations.filter((v) => v.status === 'approved');

    // Calculate total portfolio value from approved valuations
    let totalPortfolioValue = 0;
    const byAssetTypeMap = new Map<string, { totalValue: number; count: number }>();

    for (const valuation of approvedValuations) {
      const value = valuation.selectedValue ?? valuation.midValue ?? 0;
      totalPortfolioValue += value;

      // Aggregate by asset types in the valuation
      for (const asset of valuation.ipAssets ?? []) {
        const existing = byAssetTypeMap.get(asset.type) || { totalValue: 0, count: 0 };
        const weight = asset.weight ?? 1 / (valuation.ipAssets?.length ?? 1);
        existing.totalValue += value * weight;
        existing.count++;
        byAssetTypeMap.set(asset.type, existing);
      }
    }

    // Get recent valuations
    const recentValuations = valuations
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5)
      .map((v) => ({
        id: v.id,
        valuationNumber: v.valuationNumber,
        title: v.title,
        status: v.status,
        selectedValue: v.selectedValue,
        currency: v.currency,
        approvedDate: v.approvedDate ? new Date(v.approvedDate) : null,
      }));

    // Count pending and approved
    const pendingStatuses = ['draft', 'in_progress', 'review'];
    const pendingCount = valuations.filter((v) => pendingStatuses.includes(v.status)).length;
    const approvedCount = approvedValuations.length;

    return {
      totalPortfolioValue,
      currency: 'USD',
      byAssetType: Array.from(byAssetTypeMap.entries()).map(([assetType, data]) => ({
        assetType,
        totalValue: Math.round(data.totalValue),
        count: data.count,
      })),
      recentValuations,
      pendingCount,
      approvedCount,
    };
  }

  /**
   * Get activity dashboard data.
   */
  async getActivityDashboard(): Promise<ActivityDashboard> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Get recent events from audit log
    const logs = await this.db
      .select()
      .from(ipAuditLog)
      .where(sql`${ipAuditLog.occurredAt} >= ${thirtyDaysAgo}`)
      .orderBy(sql`${ipAuditLog.occurredAt} DESC`)
      .limit(50);

    const recentEvents: ActivityEvent[] = logs.map((log) => ({
      id: log.id,
      entityType: log.entityType,
      entityId: log.entityId,
      action: log.action,
      actorId: log.actorId,
      occurredAt: log.occurredAt,
      metadata: log.metadata as Record<string, unknown> | undefined,
    }));

    // Group by type (entity type)
    const byTypeMap = new Map<string, number>();
    for (const log of logs) {
      byTypeMap.set(log.entityType, (byTypeMap.get(log.entityType) || 0) + 1);
    }

    // Build timeline (daily counts)
    const timelineMap = new Map<string, number>();
    for (const log of logs) {
      const dateKey = log.occurredAt.toISOString().split('T')[0];
      timelineMap.set(dateKey, (timelineMap.get(dateKey) || 0) + 1);
    }

    // Fill in missing days
    const timeline: ActivityTimeline[] = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateKey = date.toISOString().split('T')[0];
      timeline.push({
        date: dateKey,
        count: timelineMap.get(dateKey) || 0,
      });
    }

    return {
      recentEvents,
      byType: Array.from(byTypeMap.entries()).map(([type, count]) => ({ type, count })),
      timeline,
      totalEventsLast30Days: logs.length,
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private async getAssetStats(
    type: AssetType,
    table: typeof patents | typeof trademarks | typeof copyrights | typeof tradeSecrets | typeof licenses | typeof domainNames,
    statusColumn: string
  ): Promise<AssetSummary> {
    const results = await this.db
      .select({
        status: sql<string>`${sql.identifier(statusColumn)}`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(table)
      .where(sql`deleted_at IS NULL`)
      .groupBy(sql`${sql.identifier(statusColumn)}`);

    const byStatus: AssetCountByStatus[] = results.map((r) => ({
      status: r.status,
      count: r.count,
    }));

    const total = byStatus.reduce((sum, s) => sum + s.count, 0);

    return { type, total, byStatus };
  }

  private async getTotalApprovedValuation(): Promise<{ total: number | null }> {
    const result = await this.db
      .select({
        total: sql<number>`COALESCE(SUM(COALESCE(selected_value, mid_value, 0)), 0)::int`,
      })
      .from(ipValuations)
      .where(sql`${ipValuations.status} = 'approved' AND ${ipValuations.deletedAt} IS NULL`);

    return { total: result[0]?.total ?? null };
  }

  private async getTrademarkComplianceStatus(): Promise<TrademarkComplianceStatus> {
    // Trademark compliance is based on registration dates and renewal requirements
    // Section 8: Declaration of Use (between 5th and 6th year after registration)
    // Section 9: Renewal (every 10 years)
    // Section 15: Declaration of Incontestability (after 5 years of continuous use)

    const now = new Date();
    const sixMonthsFromNow = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);

    const registeredTrademarks = await this.db
      .select()
      .from(trademarks)
      .where(sql`${trademarks.status} = 'registered' AND ${trademarks.deletedAt} IS NULL`);

    let section8 = { compliant: 0, dueSoon: 0, overdue: 0 };
    let section9 = { compliant: 0, dueSoon: 0, overdue: 0 };
    let section15 = { compliant: 0, dueSoon: 0, overdue: 0 };

    for (const tm of registeredTrademarks) {
      if (!tm.registrationDate) continue;

      const regDate = new Date(tm.registrationDate);
      const yearsSinceReg = (now.getTime() - regDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);

      // Section 8 (5-6 years)
      if (yearsSinceReg >= 5 && yearsSinceReg < 6) {
        section8.dueSoon++;
      } else if (yearsSinceReg >= 6 && yearsSinceReg < 7) {
        section8.overdue++;
      } else if (yearsSinceReg >= 7 || yearsSinceReg < 5) {
        section8.compliant++;
      }

      // Section 9 (every 10 years)
      const decadesSinceReg = Math.floor(yearsSinceReg / 10);
      const yearsIntoDecade = yearsSinceReg - decadesSinceReg * 10;
      if (yearsIntoDecade >= 9.5) {
        section9.dueSoon++;
      } else if (yearsIntoDecade >= 10) {
        section9.overdue++;
      } else {
        section9.compliant++;
      }

      // Section 15 (after 5 years)
      if (yearsSinceReg >= 4.5 && yearsSinceReg < 5) {
        section15.dueSoon++;
      } else if (yearsSinceReg >= 5 && yearsSinceReg < 6) {
        section15.overdue++;
      } else {
        section15.compliant++;
      }
    }

    return { section8, section9, section15 };
  }

  private async getPatentMaintenanceStatus(): Promise<PatentMaintenanceStatus> {
    const fees = await this.db
      .select()
      .from(patentMaintenanceFees)
      .where(sql`${patentMaintenanceFees.deletedAt} IS NULL`);

    let paid = 0;
    let upcoming = 0;
    let gracePeriod = 0;
    let overdue = 0;

    for (const fee of fees) {
      switch (fee.status) {
        case 'paid':
          paid++;
          break;
        case 'upcoming':
        case 'payable':
          upcoming++;
          break;
        case 'grace_period':
          gracePeriod++;
          break;
        case 'missed':
          overdue++;
          break;
      }
    }

    return { paid, upcoming, gracePeriod, overdue };
  }

  private async getDomainRenewalStatus(): Promise<DomainRenewalStatus> {
    const now = new Date();
    const oneMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const threeMonths = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const domains = await this.db
      .select()
      .from(domainNames)
      .where(sql`${domainNames.deletedAt} IS NULL`);

    let current = 0;
    let expiringThisMonth = 0;
    let expiringThisQuarter = 0;
    let expired = 0;

    for (const domain of domains) {
      if (!domain.expirationDate) {
        current++;
        continue;
      }

      const expDate = new Date(domain.expirationDate);

      if (expDate < now) {
        expired++;
      } else if (expDate <= oneMonth) {
        expiringThisMonth++;
      } else if (expDate <= threeMonths) {
        expiringThisQuarter++;
      } else {
        current++;
      }
    }

    return { current, expiringThisMonth, expiringThisQuarter, expired };
  }
}

// Singleton instance
let dashboardServiceInstance: DashboardService | null = null;

export function getDashboardService(db: Database): DashboardService {
  if (!dashboardServiceInstance) {
    dashboardServiceInstance = new DashboardService(db);
  }
  return dashboardServiceInstance;
}

export const createDashboardService = (db: Database): DashboardService => new DashboardService(db);
