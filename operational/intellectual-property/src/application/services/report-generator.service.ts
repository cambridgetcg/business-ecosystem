/**
 * Report Generator Service
 *
 * Generates portfolio summary and analysis reports for IP assets.
 * Supports JSON, HTML, and PDF output formats.
 *
 * @module application/services
 */

import { randomUUID } from 'crypto';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { isNull, sql, desc, gte, lte, and, eq, inArray } from 'drizzle-orm';
import * as schema from '../../infrastructure/persistence/schema.js';
import {
  DeadlineStore,
  deadlineStore,
  type Deadline,
} from '../../infrastructure/aws/dynamodb-deadline-store.js';
import type {
  ReportFormat,
  ReportGenerationOptions,
  PortfolioSummaryReport,
  ComplianceReport,
  DeadlineCalendarReport,
  ValuationReport,
  GeneratedReport,
  AssetInventory,
  StatusBreakdown,
  DeadlineEntry,
  ComplianceStatusSummary,
  ComplianceIssue,
  ValuationSummary,
  EnforcementSummary,
  RecentValuation,
  RecentEnforcementMatter,
  ComplianceItem,
  CalendarMonth,
  CalendarDay,
  ValuationDetailEntry,
  MethodologyAnalysis,
} from './report-types.js';
import { generatePortfolioSummaryHTML } from './report-templates/portfolio-summary.template.js';
import { generateComplianceReportHTML } from './report-templates/compliance-report.template.js';
import { generateDeadlineCalendarHTML } from './report-templates/deadline-calendar.template.js';
import { generateValuationReportHTML } from './report-templates/valuation-report.template.js';

/**
 * Report Generator Service.
 *
 * Generates comprehensive reports for IP portfolio analysis.
 */
export class ReportGeneratorService {
  constructor(
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly deadlineStoreInstance: DeadlineStore = deadlineStore
  ) {}

  // ============================================================================
  // PORTFOLIO SUMMARY REPORT
  // ============================================================================

  /**
   * Generate a portfolio summary report.
   */
  async generatePortfolioSummary(
    options: ReportGenerationOptions = { format: 'json' }
  ): Promise<GeneratedReport<PortfolioSummaryReport>> {
    const asOfDate = options.asOfDate ?? new Date();
    const reportId = randomUUID();

    // Gather all data in parallel
    const [
      assetInventory,
      statusBreakdown,
      deadlineCalendar,
      complianceStatus,
      valuationSummary,
      enforcementSummary,
    ] = await Promise.all([
      this.getAssetInventory(asOfDate),
      this.getStatusBreakdown(),
      this.getDeadlineCalendar(90),
      this.getComplianceStatusSummary(),
      this.getValuationSummary(),
      this.getEnforcementSummary(),
    ]);

    // Calculate executive summary
    const totalAssets = assetInventory.reduce((sum, a) => sum + a.total, 0);
    const totalActive = statusBreakdown.active;
    const portfolioHealthScore = this.calculatePortfolioHealthScore(
      complianceStatus,
      deadlineCalendar.overdueItems.length,
      enforcementSummary.activeMatterCount
    );

    const keyHighlights = this.generateKeyHighlights(
      assetInventory,
      valuationSummary,
      complianceStatus
    );

    const criticalAlerts = this.generateCriticalAlerts(
      deadlineCalendar.overdueItems,
      complianceStatus.issues,
      enforcementSummary
    );

    const report: PortfolioSummaryReport = {
      reportId,
      reportType: 'portfolio_summary',
      generatedAt: new Date().toISOString(),
      asOfDate: asOfDate.toISOString(),
      title: options.customTitle ?? 'IP Portfolio Summary Report',
      executiveSummary: {
        totalAssets,
        totalActiveAssets: totalActive,
        portfolioHealthScore,
        keyHighlights,
        criticalAlerts,
      },
      assetInventory,
      statusBreakdown,
      deadlineCalendar,
      complianceStatus,
      valuationSummary,
      enforcementSummary,
    };

    return this.formatReport(report, options.format, 'portfolio-summary');
  }

  // ============================================================================
  // COMPLIANCE REPORT
  // ============================================================================

  /**
   * Generate a compliance status report.
   */
  async generateComplianceReport(
    options: ReportGenerationOptions = { format: 'json' }
  ): Promise<GeneratedReport<ComplianceReport>> {
    const asOfDate = options.asOfDate ?? new Date();
    const reportId = randomUUID();

    const [deadlines, maintenanceFees] = await Promise.all([
      this.deadlineStoreInstance.getDeadlinesByStatus('pending', { limit: 500 }),
      this.getMaintenanceFees(),
    ]);

    // Convert to compliance items
    const items = this.convertToComplianceItems(deadlines, maintenanceFees);

    // Calculate overall compliance
    const compliantCount = items.filter(i => i.status === 'compliant').length;
    const nonCompliantCount = items.filter(i => i.status === 'non_compliant').length;
    const pendingCount = items.filter(i => i.status === 'pending').length;
    const waivedCount = items.filter(i => i.status === 'waived').length;
    const totalRequirements = items.length;
    const score = totalRequirements > 0
      ? Math.round(((compliantCount + waivedCount) / totalRequirements) * 100)
      : 100;

    // Group by category and jurisdiction
    const byCategory = this.groupComplianceByCategory(items);
    const byJurisdiction = this.groupComplianceByJurisdiction(items);

    // Get critical issues (non-compliant items)
    const criticalIssues = items.filter(i => i.status === 'non_compliant');

    // Get upcoming deadlines (next 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const upcomingDeadlines = items.filter(i => {
      const dueDate = new Date(i.dueDate);
      return i.status === 'pending' && dueDate <= thirtyDaysFromNow;
    });

    const report: ComplianceReport = {
      reportId,
      reportType: 'compliance',
      generatedAt: new Date().toISOString(),
      asOfDate: asOfDate.toISOString(),
      title: options.customTitle ?? 'IP Compliance Status Report',
      overallCompliance: {
        score,
        totalRequirements,
        compliantCount,
        nonCompliantCount,
        pendingCount,
        waivedCount,
      },
      byCategory,
      byJurisdiction,
      criticalIssues,
      upcomingDeadlines,
      trend: [], // Historical trend would require additional data collection
      items,
    };

    return this.formatReport(report, options.format, 'compliance-report');
  }

  // ============================================================================
  // DEADLINE CALENDAR REPORT
  // ============================================================================

  /**
   * Generate a deadline calendar report.
   */
  async generateDeadlineCalendar(
    daysAhead = 90,
    options: ReportGenerationOptions = { format: 'json' }
  ): Promise<GeneratedReport<DeadlineCalendarReport>> {
    const reportId = randomUUID();
    const periodStart = new Date();
    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + daysAhead);

    const [upcoming, overdue] = await Promise.all([
      this.deadlineStoreInstance.getUpcomingDeadlines(daysAhead, 500),
      this.deadlineStoreInstance.getOverdueDeadlines(100),
    ]);

    // Convert to deadline entries
    const allDeadlines = upcoming.map(d => this.deadlineToEntry(d));
    const overdueDeadlines = overdue.map(d => this.deadlineToEntry(d));
    const criticalDeadlines = allDeadlines.filter(
      d => d.priority === 'critical' || d.priority === 'high'
    );

    // Calculate statistics
    const statistics = this.calculateDeadlineStatistics(allDeadlines, overdueDeadlines);

    // Build calendar months
    const months = this.buildCalendarMonths(allDeadlines, periodStart, periodEnd);

    const report: DeadlineCalendarReport = {
      reportId,
      reportType: 'deadline_calendar',
      generatedAt: new Date().toISOString(),
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      title: options.customTitle ?? `IP Deadline Calendar (${daysAhead} Days)`,
      statistics,
      months,
      overdueDeadlines,
      criticalDeadlines,
      allDeadlines,
    };

    return this.formatReport(report, options.format, 'deadline-calendar');
  }

  // ============================================================================
  // VALUATION REPORT
  // ============================================================================

  /**
   * Generate a valuation summary report.
   */
  async generateValuationReport(
    options: ReportGenerationOptions = { format: 'json' }
  ): Promise<GeneratedReport<ValuationReport>> {
    const asOfDate = options.asOfDate ?? new Date();
    const reportId = randomUUID();

    // Fetch all valuations
    const valuations = await this.db
      .select()
      .from(schema.ipValuations)
      .where(isNull(schema.ipValuations.deletedAt))
      .orderBy(desc(schema.ipValuations.valuationDate));

    // Convert to detail entries
    const allValuations = valuations.map(v => this.valuationToDetailEntry(v));

    // Calculate portfolio summary
    const approvedValuations = allValuations.filter(v => v.status === 'approved');
    const draftValuations = allValuations.filter(v => v.status === 'draft');
    const pendingValuations = allValuations.filter(v => v.status === 'in_progress' || v.status === 'review');
    const expiredValuations = allValuations.filter(v => v.isExpired);

    const totalApprovedValue = approvedValuations.reduce((sum, v) => sum + (v.value.selected ?? 0), 0);
    const totalDraftValue = draftValuations.reduce((sum, v) => sum + (v.value.selected ?? 0), 0);
    const totalPendingValue = pendingValuations.reduce((sum, v) => sum + (v.value.selected ?? 0), 0);

    const totalAssetCount = allValuations.reduce((sum, v) => sum + v.assets.length, 0);
    const averageValuePerAsset = totalAssetCount > 0
      ? Math.round(totalApprovedValue / totalAssetCount)
      : 0;

    // Group by methodology
    const byMethodology = this.calculateMethodologyAnalysis(allValuations);

    // Group by purpose
    const byPurpose = this.groupValuationsByPurpose(allValuations);

    // Group by status
    const byStatus = this.groupValuationsByStatus(allValuations);

    // Recent valuations (last 10)
    const recentValuations = allValuations.slice(0, 10);

    const report: ValuationReport = {
      reportId,
      reportType: 'valuation',
      generatedAt: new Date().toISOString(),
      asOfDate: asOfDate.toISOString(),
      title: options.customTitle ?? 'IP Valuation Summary Report',
      portfolioSummary: {
        totalApprovedValue,
        totalDraftValue,
        totalPendingValue,
        currency: 'USD',
        valuationCount: allValuations.length,
        expiredValuationCount: expiredValuations.length,
        averageValuePerAsset,
      },
      byMethodology,
      byPurpose,
      byStatus,
      recentValuations,
      expiredValuations,
      allValuations,
    };

    return this.formatReport(report, options.format, 'valuation-report');
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private async getAssetInventory(asOfDate: Date): Promise<AssetInventory[]> {
    const thirtyDaysAgo = new Date(asOfDate);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Query counts for each asset type
    const [patents, trademarks, copyrights, tradeSecrets, licenses, domains] = await Promise.all([
      this.getAssetTypeInventory('patent', schema.patents, thirtyDaysAgo),
      this.getAssetTypeInventory('trademark', schema.trademarks, thirtyDaysAgo),
      this.getAssetTypeInventory('copyright', schema.copyrights, thirtyDaysAgo),
      this.getAssetTypeInventory('trade_secret', schema.tradeSecrets, thirtyDaysAgo),
      this.getAssetTypeInventory('license', schema.licenses, thirtyDaysAgo),
      this.getAssetTypeInventory('domain', schema.domainNames, thirtyDaysAgo),
    ]);

    return [patents, trademarks, copyrights, tradeSecrets, licenses, domains];
  }

  private async getAssetTypeInventory(
    type: AssetInventory['type'],
    table: any,
    thirtyDaysAgo: Date
  ): Promise<AssetInventory> {
    const [countResult, recentAdded, recentModified] = await Promise.all([
      this.db.select({ count: sql<number>`count(*)` }).from(table).where(isNull(table.deletedAt)),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(table)
        .where(and(isNull(table.deletedAt), gte(table.createdAt, thirtyDaysAgo))),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(table)
        .where(and(isNull(table.deletedAt), gte(table.updatedAt, thirtyDaysAgo))),
    ]);

    // Get status breakdown if the table has a status column
    const byStatus: Record<string, number> = {};
    if ('status' in table) {
      const statusCounts = await this.db
        .select({
          status: table.status,
          count: sql<number>`count(*)`,
        })
        .from(table)
        .where(isNull(table.deletedAt))
        .groupBy(table.status);

      for (const row of statusCounts) {
        byStatus[row.status] = Number(row.count);
      }
    }

    return {
      type,
      total: Number(countResult[0]?.count ?? 0),
      byStatus,
      recentActivity: {
        added: Number(recentAdded[0]?.count ?? 0),
        modified: Number(recentModified[0]?.count ?? 0),
        period: '30 days',
      },
    };
  }

  private async getStatusBreakdown(): Promise<StatusBreakdown> {
    // Aggregate status across all asset types
    const activeStatuses = ['active', 'granted', 'registered'];
    const pendingStatuses = ['pending', 'draft', 'provisional', 'published'];
    const expiredStatuses = ['expired', 'lapsed'];
    const abandonedStatuses = ['abandoned', 'cancelled', 'terminated'];

    let active = 0;
    let pending = 0;
    let expired = 0;
    let abandoned = 0;
    let other = 0;

    const tables = [
      { table: schema.patents, statusField: schema.patents.status },
      { table: schema.trademarks, statusField: schema.trademarks.status },
      { table: schema.licenses, statusField: schema.licenses.status },
    ];

    for (const { table, statusField } of tables) {
      const counts = await this.db
        .select({
          status: statusField,
          count: sql<number>`count(*)`,
        })
        .from(table)
        .where(isNull(table.deletedAt))
        .groupBy(statusField);

      for (const row of counts) {
        const count = Number(row.count);
        const status = row.status.toLowerCase();

        if (activeStatuses.includes(status)) active += count;
        else if (pendingStatuses.includes(status)) pending += count;
        else if (expiredStatuses.includes(status)) expired += count;
        else if (abandonedStatuses.includes(status)) abandoned += count;
        else other += count;
      }
    }

    return { active, pending, expired, abandoned, other };
  }

  private async getDeadlineCalendar(daysAhead: number): Promise<{
    totalUpcoming: number;
    byWeek: Array<{ weekStart: string; weekEnd: string; deadlines: DeadlineEntry[] }>;
    overdueItems: DeadlineEntry[];
  }> {
    const [upcoming, overdue] = await Promise.all([
      this.deadlineStoreInstance.getUpcomingDeadlines(daysAhead, 200),
      this.deadlineStoreInstance.getOverdueDeadlines(50),
    ]);

    const upcomingEntries = upcoming.map(d => this.deadlineToEntry(d));
    const overdueEntries = overdue.map(d => this.deadlineToEntry(d));

    // Group by week
    const byWeek: Array<{ weekStart: string; weekEnd: string; deadlines: DeadlineEntry[] }> = [];
    const now = new Date();

    for (let i = 0; i < Math.ceil(daysAhead / 7); i++) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() + i * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const weekDeadlines = upcomingEntries.filter(d => {
        const dueDate = new Date(d.dueDate);
        return dueDate >= weekStart && dueDate <= weekEnd;
      });

      byWeek.push({
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
        deadlines: weekDeadlines,
      });
    }

    return {
      totalUpcoming: upcomingEntries.length,
      byWeek,
      overdueItems: overdueEntries,
    };
  }

  private async getComplianceStatusSummary(): Promise<ComplianceStatusSummary> {
    const [pendingDeadlines, overdueDeadlines, maintenanceFees] = await Promise.all([
      this.deadlineStoreInstance.getDeadlinesByStatus('pending', { limit: 100 }),
      this.deadlineStoreInstance.getOverdueDeadlines(100),
      this.getMaintenanceFees(),
    ]);

    const criticalOverdue = overdueDeadlines.filter(d => d.priority === 'critical' || d.priority === 'high');
    const upcomingCritical = pendingDeadlines.filter(d => d.priority === 'critical').length;

    // Check maintenance fee status
    const overdueMaintenanceFees = maintenanceFees.filter(f => f.status === 'missed');
    const maintenanceFeesUpToDate = overdueMaintenanceFees.length === 0;

    // Check renewal status (look at deadlines of type 'renewal')
    const overdueRenewals = overdueDeadlines.filter(d => d.deadlineType.includes('renewal'));
    const renewalsUpToDate = overdueRenewals.length === 0;

    // Generate compliance issues
    const issues: ComplianceIssue[] = [];

    for (const deadline of criticalOverdue) {
      issues.push({
        severity: deadline.priority === 'critical' ? 'critical' : 'major',
        category: deadline.deadlineType,
        description: `Overdue: ${deadline.title}`,
        assetId: deadline.assetId,
        assetType: deadline.assetType,
        dueDate: deadline.dueDate,
        recommendedAction: 'Address immediately to avoid potential IP loss',
      });
    }

    const complianceScore = this.calculateComplianceScore(
      overdueDeadlines.length,
      pendingDeadlines.length,
      maintenanceFeesUpToDate,
      renewalsUpToDate
    );

    return {
      maintenanceFeesUpToDate,
      renewalsUpToDate,
      overdueItems: overdueDeadlines.length,
      upcomingCritical,
      complianceScore,
      issues,
    };
  }

  private async getValuationSummary(): Promise<ValuationSummary> {
    const valuations = await this.db
      .select()
      .from(schema.ipValuations)
      .where(isNull(schema.ipValuations.deletedAt))
      .orderBy(desc(schema.ipValuations.valuationDate))
      .limit(100);

    const approvedValuations = valuations.filter(v => v.status === 'approved');
    const pendingValuations = valuations.filter(v => v.status === 'in_progress' || v.status === 'review');

    const totalApprovedValue = approvedValuations.reduce((sum, v) => sum + (v.selectedValue ?? 0), 0);
    const totalPendingValue = pendingValuations.reduce((sum, v) => sum + (v.selectedValue ?? 0), 0);

    // Group by methodology
    const byMethodology: Record<string, { count: number; totalValue: number }> = {};
    for (const v of valuations) {
      if (!byMethodology[v.methodology]) {
        byMethodology[v.methodology] = { count: 0, totalValue: 0 };
      }
      byMethodology[v.methodology].count++;
      byMethodology[v.methodology].totalValue += v.selectedValue ?? 0;
    }

    // Group by purpose
    const byPurpose: Record<string, { count: number; totalValue: number }> = {};
    for (const v of valuations) {
      if (!byPurpose[v.purpose]) {
        byPurpose[v.purpose] = { count: 0, totalValue: 0 };
      }
      byPurpose[v.purpose].count++;
      byPurpose[v.purpose].totalValue += v.selectedValue ?? 0;
    }

    const recentValuations: RecentValuation[] = valuations.slice(0, 5).map(v => ({
      id: v.id,
      valuationNumber: v.valuationNumber ?? '',
      title: v.title,
      status: v.status,
      selectedValue: v.selectedValue ?? undefined,
      currency: v.currency,
      valuationDate: v.valuationDate,
      methodology: v.methodology,
    }));

    return {
      totalApprovedValue,
      totalPendingValue,
      currency: 'USD',
      valuationCount: valuations.length,
      byMethodology,
      byPurpose,
      recentValuations,
    };
  }

  private async getEnforcementSummary(): Promise<EnforcementSummary> {
    const activeStatuses = ['monitoring', 'investigation', 'cease_and_desist', 'negotiation', 'litigation'] as const;

    const matters = await this.db
      .select()
      .from(schema.enforcementMatters)
      .where(and(
        isNull(schema.enforcementMatters.deletedAt),
        inArray(schema.enforcementMatters.status, [...activeStatuses])
      ))
      .orderBy(desc(schema.enforcementMatters.detectedDate))
      .limit(50);

    const activeMatterCount = matters.length;
    const totalEstimatedDamages = matters.reduce((sum, m) => sum + (m.estimatedDamages ?? 0), 0);
    const totalActualCosts = matters.reduce((sum, m) => sum + (m.actualCosts ?? 0), 0);

    // Group by status
    const byStatus: Record<string, number> = {};
    for (const m of matters) {
      byStatus[m.status] = (byStatus[m.status] ?? 0) + 1;
    }

    // Group by type
    const byType: Record<string, number> = {};
    for (const m of matters) {
      byType[m.type] = (byType[m.type] ?? 0) + 1;
    }

    // Group by priority
    const byPriority: Record<string, number> = {};
    for (const m of matters) {
      byPriority[m.priority] = (byPriority[m.priority] ?? 0) + 1;
    }

    const recentMatters: RecentEnforcementMatter[] = matters.slice(0, 5).map(m => ({
      id: m.id,
      matterNumber: m.matterNumber ?? undefined,
      title: m.title,
      status: m.status,
      priority: m.priority,
      type: m.type,
      detectedDate: m.detectedDate,
      estimatedDamages: m.estimatedDamages ?? undefined,
    }));

    return {
      activeMatterCount,
      totalEstimatedDamages,
      totalActualCosts,
      byStatus,
      byType,
      byPriority,
      recentMatters,
    };
  }

  private async getMaintenanceFees(): Promise<Array<typeof schema.patentMaintenanceFees.$inferSelect>> {
    return this.db
      .select()
      .from(schema.patentMaintenanceFees)
      .where(isNull(schema.patentMaintenanceFees.deletedAt))
      .orderBy(desc(schema.patentMaintenanceFees.dueDate))
      .limit(100);
  }

  private deadlineToEntry(d: Deadline): DeadlineEntry {
    return {
      id: d.deadlineId,
      assetId: d.assetId,
      assetType: d.assetType,
      assetTitle: d.title,
      deadlineType: d.deadlineType,
      dueDate: d.dueDate,
      priority: d.priority,
      status: d.status,
      amount: d.amount,
      currency: d.currency,
      jurisdiction: d.jurisdiction,
      description: d.description,
    };
  }

  private convertToComplianceItems(
    deadlines: Deadline[],
    maintenanceFees: Array<typeof schema.patentMaintenanceFees.$inferSelect>
  ): ComplianceItem[] {
    const items: ComplianceItem[] = [];

    // Convert deadlines to compliance items
    for (const d of deadlines) {
      const now = new Date();
      const dueDate = new Date(d.dueDate);
      const status: ComplianceItem['status'] =
        d.status === 'completed' ? 'compliant' :
        d.status === 'waived' ? 'waived' :
        dueDate < now ? 'non_compliant' : 'pending';

      items.push({
        id: d.deadlineId,
        assetId: d.assetId,
        assetType: d.assetType,
        assetTitle: d.title,
        requirementType: d.deadlineType,
        dueDate: d.dueDate,
        status,
        jurisdiction: d.jurisdiction ?? 'US',
        description: d.description ?? '',
        amount: d.amount,
        currency: d.currency,
      });
    }

    // Convert maintenance fees to compliance items
    for (const f of maintenanceFees) {
      const status: ComplianceItem['status'] =
        f.status === 'paid' ? 'compliant' :
        f.status === 'missed' ? 'non_compliant' : 'pending';

      items.push({
        id: f.id,
        assetId: f.patentId,
        assetType: 'patent',
        assetTitle: `Patent Maintenance Fee ${f.feeNumber}`,
        requirementType: 'maintenance_fee',
        dueDate: f.dueDate,
        status,
        jurisdiction: f.jurisdiction,
        description: `Maintenance fee ${f.feeNumber} for patent`,
        amount: f.paidAmount ?? undefined,
        currency: 'USD',
      });
    }

    return items;
  }

  private groupComplianceByCategory(items: ComplianceItem[]): Record<string, {
    total: number;
    compliant: number;
    nonCompliant: number;
    pending: number;
  }> {
    const result: Record<string, { total: number; compliant: number; nonCompliant: number; pending: number }> = {};

    for (const item of items) {
      const category = item.requirementType;
      if (!result[category]) {
        result[category] = { total: 0, compliant: 0, nonCompliant: 0, pending: 0 };
      }
      result[category].total++;
      if (item.status === 'compliant' || item.status === 'waived') result[category].compliant++;
      else if (item.status === 'non_compliant') result[category].nonCompliant++;
      else result[category].pending++;
    }

    return result;
  }

  private groupComplianceByJurisdiction(items: ComplianceItem[]): Record<string, {
    total: number;
    compliant: number;
    nonCompliant: number;
    pending: number;
  }> {
    const result: Record<string, { total: number; compliant: number; nonCompliant: number; pending: number }> = {};

    for (const item of items) {
      const jurisdiction = item.jurisdiction;
      if (!result[jurisdiction]) {
        result[jurisdiction] = { total: 0, compliant: 0, nonCompliant: 0, pending: 0 };
      }
      result[jurisdiction].total++;
      if (item.status === 'compliant' || item.status === 'waived') result[jurisdiction].compliant++;
      else if (item.status === 'non_compliant') result[jurisdiction].nonCompliant++;
      else result[jurisdiction].pending++;
    }

    return result;
  }

  private calculateDeadlineStatistics(
    upcoming: DeadlineEntry[],
    overdue: DeadlineEntry[]
  ): {
    totalUpcoming: number;
    totalOverdue: number;
    byPriority: Record<string, number>;
    byAssetType: Record<string, number>;
    byDeadlineType: Record<string, number>;
    totalAmount: number;
    currency: string;
  } {
    const all = [...upcoming, ...overdue];

    const byPriority: Record<string, number> = {};
    const byAssetType: Record<string, number> = {};
    const byDeadlineType: Record<string, number> = {};
    let totalAmount = 0;

    for (const d of all) {
      byPriority[d.priority] = (byPriority[d.priority] ?? 0) + 1;
      byAssetType[d.assetType] = (byAssetType[d.assetType] ?? 0) + 1;
      byDeadlineType[d.deadlineType] = (byDeadlineType[d.deadlineType] ?? 0) + 1;
      totalAmount += d.amount ?? 0;
    }

    return {
      totalUpcoming: upcoming.length,
      totalOverdue: overdue.length,
      byPriority,
      byAssetType,
      byDeadlineType,
      totalAmount,
      currency: 'USD',
    };
  }

  private buildCalendarMonths(
    deadlines: DeadlineEntry[],
    periodStart: Date,
    periodEnd: Date
  ): CalendarMonth[] {
    const months: CalendarMonth[] = [];
    const current = new Date(periodStart);
    current.setDate(1);

    while (current <= periodEnd) {
      const year = current.getFullYear();
      const month = current.getMonth() + 1;
      const monthName = current.toLocaleString('en-US', { month: 'long' });

      const daysInMonth = new Date(year, month, 0).getDate();
      const days: CalendarDay[] = [];

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        const dateStr = date.toISOString().split('T')[0];
        const dayDeadlines = deadlines.filter(d => d.dueDate.startsWith(dateStr));

        days.push({
          date: dateStr,
          dayOfWeek: date.toLocaleString('en-US', { weekday: 'long' }),
          isWeekend: date.getDay() === 0 || date.getDay() === 6,
          isHoliday: false, // Would need holiday calendar integration
          deadlines: dayDeadlines,
        });
      }

      const monthDeadlines = deadlines.filter(d => {
        const dueDate = new Date(d.dueDate);
        return dueDate.getFullYear() === year && dueDate.getMonth() === month - 1;
      });

      months.push({
        year,
        month,
        monthName,
        days,
        totalDeadlines: monthDeadlines.length,
        criticalDeadlines: monthDeadlines.filter(d => d.priority === 'critical').length,
        highPriorityDeadlines: monthDeadlines.filter(d => d.priority === 'high').length,
      });

      current.setMonth(current.getMonth() + 1);
    }

    return months;
  }

  private valuationToDetailEntry(
    v: typeof schema.ipValuations.$inferSelect
  ): ValuationDetailEntry {
    const expirationDate = v.expirationDate ? new Date(v.expirationDate) : undefined;
    const isExpired = expirationDate ? new Date() > expirationDate : false;

    return {
      id: v.id,
      valuationNumber: v.valuationNumber ?? undefined,
      title: v.title,
      status: v.status,
      purpose: v.purpose,
      methodology: v.methodology,
      valuationDate: v.valuationDate,
      effectiveDate: v.effectiveDate,
      expirationDate: v.expirationDate ?? undefined,
      isExpired,
      value: {
        low: v.lowValue ?? undefined,
        mid: v.midValue ?? undefined,
        high: v.highValue ?? undefined,
        selected: v.selectedValue ?? undefined,
        currency: v.currency,
      },
      assets: (v.ipAssets as any) ?? [],
      preparedBy: v.preparedBy,
      reviewedBy: v.reviewedBy ?? undefined,
      approvedBy: v.approvedBy ?? undefined,
      approvedDate: v.approvedDate ?? undefined,
      externalAppraiser: v.externalAppraiser ?? undefined,
    };
  }

  private calculateMethodologyAnalysis(valuations: ValuationDetailEntry[]): MethodologyAnalysis[] {
    const grouped: Record<string, ValuationDetailEntry[]> = {};

    for (const v of valuations) {
      if (!grouped[v.methodology]) {
        grouped[v.methodology] = [];
      }
      grouped[v.methodology].push(v);
    }

    return Object.entries(grouped).map(([methodology, vals]) => {
      const values = vals.map(v => v.value.selected ?? 0).filter(v => v > 0);
      const totalValue = values.reduce((sum, v) => sum + v, 0);
      const averageValue = values.length > 0 ? Math.round(totalValue / values.length) : 0;
      const minValue = values.length > 0 ? Math.min(...values) : 0;
      const maxValue = values.length > 0 ? Math.max(...values) : 0;

      return {
        methodology,
        valuationCount: vals.length,
        totalValue,
        averageValue,
        minValue,
        maxValue,
      };
    });
  }

  private groupValuationsByPurpose(valuations: ValuationDetailEntry[]): Record<string, {
    count: number;
    totalValue: number;
    averageValue: number;
  }> {
    const result: Record<string, { count: number; totalValue: number; averageValue: number }> = {};

    for (const v of valuations) {
      if (!result[v.purpose]) {
        result[v.purpose] = { count: 0, totalValue: 0, averageValue: 0 };
      }
      result[v.purpose].count++;
      result[v.purpose].totalValue += v.value.selected ?? 0;
    }

    for (const purpose in result) {
      result[purpose].averageValue = result[purpose].count > 0
        ? Math.round(result[purpose].totalValue / result[purpose].count)
        : 0;
    }

    return result;
  }

  private groupValuationsByStatus(valuations: ValuationDetailEntry[]): Record<string, {
    count: number;
    totalValue: number;
  }> {
    const result: Record<string, { count: number; totalValue: number }> = {};

    for (const v of valuations) {
      if (!result[v.status]) {
        result[v.status] = { count: 0, totalValue: 0 };
      }
      result[v.status].count++;
      result[v.status].totalValue += v.value.selected ?? 0;
    }

    return result;
  }

  private calculatePortfolioHealthScore(
    compliance: ComplianceStatusSummary,
    overdueCount: number,
    activeEnforcementCount: number
  ): number {
    let score = 100;

    // Deduct for compliance issues
    score -= Math.min(compliance.overdueItems * 5, 30);
    score -= Math.min(compliance.upcomingCritical * 2, 10);

    // Deduct for overdue items
    score -= Math.min(overdueCount * 3, 20);

    // Deduct for enforcement matters (they represent potential issues)
    score -= Math.min(activeEnforcementCount * 2, 10);

    // Bonus for good compliance
    if (compliance.maintenanceFeesUpToDate) score += 5;
    if (compliance.renewalsUpToDate) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  private calculateComplianceScore(
    overdueCount: number,
    pendingCount: number,
    maintenanceUpToDate: boolean,
    renewalsUpToDate: boolean
  ): number {
    let score = 100;

    score -= overdueCount * 10;
    score -= pendingCount * 1;
    if (!maintenanceUpToDate) score -= 15;
    if (!renewalsUpToDate) score -= 15;

    return Math.max(0, Math.min(100, score));
  }

  private generateKeyHighlights(
    inventory: AssetInventory[],
    valuations: ValuationSummary,
    compliance: ComplianceStatusSummary
  ): string[] {
    const highlights: string[] = [];

    const totalAssets = inventory.reduce((sum, a) => sum + a.total, 0);
    highlights.push(`Managing ${totalAssets} total IP assets across ${inventory.length} categories`);

    if (valuations.totalApprovedValue > 0) {
      const formattedValue = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: valuations.currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(valuations.totalApprovedValue / 100);
      highlights.push(`Total approved portfolio valuation: ${formattedValue}`);
    }

    if (compliance.complianceScore >= 90) {
      highlights.push('Excellent compliance standing with all obligations up to date');
    } else if (compliance.complianceScore >= 70) {
      highlights.push('Good compliance standing with minor items requiring attention');
    }

    const recentAdded = inventory.reduce((sum, a) => sum + a.recentActivity.added, 0);
    if (recentAdded > 0) {
      highlights.push(`${recentAdded} new IP assets added in the last 30 days`);
    }

    return highlights;
  }

  private generateCriticalAlerts(
    overdueItems: DeadlineEntry[],
    complianceIssues: ComplianceIssue[],
    enforcement: EnforcementSummary
  ): string[] {
    const alerts: string[] = [];

    if (overdueItems.length > 0) {
      const criticalOverdue = overdueItems.filter(d => d.priority === 'critical');
      if (criticalOverdue.length > 0) {
        alerts.push(`${criticalOverdue.length} critical deadline(s) overdue - immediate action required`);
      } else {
        alerts.push(`${overdueItems.length} deadline(s) overdue - review required`);
      }
    }

    const criticalIssues = complianceIssues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      alerts.push(`${criticalIssues.length} critical compliance issue(s) requiring immediate attention`);
    }

    if (enforcement.byPriority.critical && enforcement.byPriority.critical > 0) {
      alerts.push(`${enforcement.byPriority.critical} critical enforcement matter(s) active`);
    }

    return alerts;
  }

  private formatReport<T>(
    data: T,
    format: ReportFormat,
    baseFilename: string
  ): GeneratedReport<T> {
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${baseFilename}-${timestamp}`;

    switch (format) {
      case 'html': {
        let html: string;
        if ((data as any).reportType === 'portfolio_summary') {
          html = generatePortfolioSummaryHTML(data as unknown as PortfolioSummaryReport);
        } else if ((data as any).reportType === 'compliance') {
          html = generateComplianceReportHTML(data as unknown as ComplianceReport);
        } else if ((data as any).reportType === 'deadline_calendar') {
          html = generateDeadlineCalendarHTML(data as unknown as DeadlineCalendarReport);
        } else if ((data as any).reportType === 'valuation') {
          html = generateValuationReportHTML(data as unknown as ValuationReport);
        } else {
          html = `<html><body><pre>${JSON.stringify(data, null, 2)}</pre></body></html>`;
        }

        return {
          data,
          format: 'html',
          content: html,
          contentType: 'text/html',
          filename: `${filename}.html`,
        };
      }

      case 'pdf': {
        // PDF generation would require a library like pdfkit or puppeteer
        // For now, we return the HTML that can be converted to PDF
        let html: string;
        if ((data as any).reportType === 'portfolio_summary') {
          html = generatePortfolioSummaryHTML(data as unknown as PortfolioSummaryReport);
        } else if ((data as any).reportType === 'compliance') {
          html = generateComplianceReportHTML(data as unknown as ComplianceReport);
        } else if ((data as any).reportType === 'deadline_calendar') {
          html = generateDeadlineCalendarHTML(data as unknown as DeadlineCalendarReport);
        } else if ((data as any).reportType === 'valuation') {
          html = generateValuationReportHTML(data as unknown as ValuationReport);
        } else {
          html = `<html><body><pre>${JSON.stringify(data, null, 2)}</pre></body></html>`;
        }

        // In production, this would use puppeteer or pdfkit to generate actual PDF
        // For now, return HTML with PDF content type indication
        return {
          data,
          format: 'pdf',
          content: html, // Would be PDF buffer in production
          contentType: 'application/pdf',
          filename: `${filename}.pdf`,
        };
      }

      case 'json':
      default:
        return {
          data,
          format: 'json',
          content: JSON.stringify(data, null, 2),
          contentType: 'application/json',
          filename: `${filename}.json`,
        };
    }
  }
}

/**
 * Create a report generator service instance.
 */
export function createReportGeneratorService(
  db: PostgresJsDatabase<typeof schema>,
  deadlineStoreInstance: DeadlineStore = deadlineStore
): ReportGeneratorService {
  return new ReportGeneratorService(db, deadlineStoreInstance);
}

export default ReportGeneratorService;
