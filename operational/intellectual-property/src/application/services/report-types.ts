/**
 * Report Types for IP Portfolio Reporting
 *
 * Type definitions for various report formats and generation options.
 *
 * @module application/services
 */

// ============================================================================
// REPORT OUTPUT FORMATS
// ============================================================================

/**
 * Supported output formats for reports.
 */
export type ReportFormat = 'json' | 'html' | 'pdf';

/**
 * Report generation options.
 */
export interface ReportGenerationOptions {
  /** Output format */
  format: ReportFormat;
  /** As of date for the report (defaults to now) */
  asOfDate?: Date | undefined;
  /** Include archived items */
  includeArchived?: boolean | undefined;
  /** Tenant/organization ID filter */
  tenantId?: string | undefined;
  /** Custom title override */
  customTitle?: string | undefined;
  /** Include detailed breakdowns */
  includeDetails?: boolean | undefined;
}

// ============================================================================
// PORTFOLIO SUMMARY REPORT
// ============================================================================

/**
 * IP asset inventory by type.
 */
export interface AssetInventory {
  type: 'patent' | 'trademark' | 'copyright' | 'trade_secret' | 'license' | 'domain';
  total: number;
  byStatus: Record<string, number>;
  recentActivity: {
    added: number;
    modified: number;
    period: string;
  };
}

/**
 * Asset status breakdown.
 */
export interface StatusBreakdown {
  active: number;
  pending: number;
  expired: number;
  abandoned: number;
  other: number;
}

/**
 * Deadline calendar entry.
 */
export interface DeadlineEntry {
  id: string;
  assetId: string;
  assetType: string;
  assetTitle: string;
  deadlineType: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  amount?: number;
  currency?: string;
  jurisdiction?: string;
  description?: string;
}

/**
 * Compliance status summary.
 */
export interface ComplianceStatusSummary {
  maintenanceFeesUpToDate: boolean;
  renewalsUpToDate: boolean;
  overdueItems: number;
  upcomingCritical: number;
  complianceScore: number; // 0-100
  issues: ComplianceIssue[];
}

/**
 * Individual compliance issue.
 */
export interface ComplianceIssue {
  severity: 'critical' | 'major' | 'minor';
  category: string;
  description: string;
  assetId?: string;
  assetType?: string;
  dueDate?: string;
  recommendedAction: string;
}

/**
 * Valuation summary.
 */
export interface ValuationSummary {
  totalApprovedValue: number;
  totalPendingValue: number;
  currency: string;
  valuationCount: number;
  byMethodology: Record<string, { count: number; totalValue: number }>;
  byPurpose: Record<string, { count: number; totalValue: number }>;
  recentValuations: RecentValuation[];
}

/**
 * Recent valuation entry.
 */
export interface RecentValuation {
  id: string;
  valuationNumber: string;
  title: string;
  status: string;
  selectedValue?: number;
  currency: string;
  valuationDate: string;
  methodology: string;
}

/**
 * Enforcement summary.
 */
export interface EnforcementSummary {
  activeMatterCount: number;
  totalEstimatedDamages: number;
  totalActualCosts: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
  recentMatters: RecentEnforcementMatter[];
}

/**
 * Recent enforcement matter entry.
 */
export interface RecentEnforcementMatter {
  id: string;
  matterNumber?: string;
  title: string;
  status: string;
  priority: string;
  type: string;
  detectedDate: string;
  estimatedDamages?: number;
}

/**
 * Portfolio Summary Report.
 */
export interface PortfolioSummaryReport {
  /** Report metadata */
  reportId: string;
  reportType: 'portfolio_summary';
  generatedAt: string;
  asOfDate: string;
  generatedBy?: string;
  title: string;

  /** Executive summary */
  executiveSummary: {
    totalAssets: number;
    totalActiveAssets: number;
    portfolioHealthScore: number; // 0-100
    keyHighlights: string[];
    criticalAlerts: string[];
  };

  /** IP asset inventory by type */
  assetInventory: AssetInventory[];

  /** Asset status breakdown */
  statusBreakdown: StatusBreakdown;

  /** Deadline calendar (upcoming 90 days) */
  deadlineCalendar: {
    totalUpcoming: number;
    byWeek: Array<{
      weekStart: string;
      weekEnd: string;
      deadlines: DeadlineEntry[];
    }>;
    overdueItems: DeadlineEntry[];
  };

  /** Compliance status */
  complianceStatus: ComplianceStatusSummary;

  /** Valuation summary */
  valuationSummary: ValuationSummary;

  /** Enforcement summary */
  enforcementSummary: EnforcementSummary;
}

// ============================================================================
// COMPLIANCE REPORT
// ============================================================================

/**
 * Detailed compliance item.
 */
export interface ComplianceItem {
  id: string;
  assetId: string;
  assetType: string;
  assetTitle: string;
  requirementType: string;
  dueDate: string;
  status: 'compliant' | 'non_compliant' | 'pending' | 'waived';
  jurisdiction: string;
  description: string;
  amount?: number;
  currency?: string;
  lastAction?: string;
  lastActionDate?: string;
  responsibleParty?: string;
  notes?: string;
}

/**
 * Compliance trend data point.
 */
export interface ComplianceTrendPoint {
  date: string;
  complianceScore: number;
  overdueCount: number;
  completedCount: number;
}

/**
 * Compliance Report.
 */
export interface ComplianceReport {
  reportId: string;
  reportType: 'compliance';
  generatedAt: string;
  asOfDate: string;
  title: string;

  /** Overall compliance metrics */
  overallCompliance: {
    score: number;
    totalRequirements: number;
    compliantCount: number;
    nonCompliantCount: number;
    pendingCount: number;
    waivedCount: number;
  };

  /** Compliance by category */
  byCategory: Record<string, {
    total: number;
    compliant: number;
    nonCompliant: number;
    pending: number;
  }>;

  /** Compliance by jurisdiction */
  byJurisdiction: Record<string, {
    total: number;
    compliant: number;
    nonCompliant: number;
    pending: number;
  }>;

  /** Critical issues requiring immediate attention */
  criticalIssues: ComplianceItem[];

  /** Upcoming compliance deadlines */
  upcomingDeadlines: ComplianceItem[];

  /** Historical compliance trend */
  trend: ComplianceTrendPoint[];

  /** All compliance items */
  items: ComplianceItem[];
}

// ============================================================================
// DEADLINE CALENDAR REPORT
// ============================================================================

/**
 * Calendar day with deadlines.
 */
export interface CalendarDay {
  date: string;
  dayOfWeek: string;
  isWeekend: boolean;
  isHoliday: boolean;
  deadlines: DeadlineEntry[];
}

/**
 * Calendar month view.
 */
export interface CalendarMonth {
  year: number;
  month: number;
  monthName: string;
  days: CalendarDay[];
  totalDeadlines: number;
  criticalDeadlines: number;
  highPriorityDeadlines: number;
}

/**
 * Deadline statistics.
 */
export interface DeadlineStatistics {
  totalUpcoming: number;
  totalOverdue: number;
  byPriority: Record<string, number>;
  byAssetType: Record<string, number>;
  byDeadlineType: Record<string, number>;
  totalAmount: number;
  currency: string;
}

/**
 * Deadline Calendar Report.
 */
export interface DeadlineCalendarReport {
  reportId: string;
  reportType: 'deadline_calendar';
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  title: string;

  /** Statistics summary */
  statistics: DeadlineStatistics;

  /** Calendar view by month */
  months: CalendarMonth[];

  /** Overdue deadlines */
  overdueDeadlines: DeadlineEntry[];

  /** Critical and high priority deadlines */
  criticalDeadlines: DeadlineEntry[];

  /** All deadlines in period */
  allDeadlines: DeadlineEntry[];
}

// ============================================================================
// VALUATION REPORT
// ============================================================================

/**
 * Valuation detail entry.
 */
export interface ValuationDetailEntry {
  id: string;
  valuationNumber?: string;
  title: string;
  status: string;
  purpose: string;
  methodology: string;
  valuationDate: string;
  effectiveDate: string;
  expirationDate?: string;
  isExpired: boolean;
  value: {
    low?: number;
    mid?: number;
    high?: number;
    selected?: number;
    currency: string;
  };
  assets: Array<{
    type: string;
    id: string;
    name: string;
    weight?: number;
  }>;
  preparedBy: string;
  reviewedBy?: string;
  approvedBy?: string;
  approvedDate?: string;
  externalAppraiser?: string;
}

/**
 * Valuation methodology analysis.
 */
export interface MethodologyAnalysis {
  methodology: string;
  valuationCount: number;
  totalValue: number;
  averageValue: number;
  minValue: number;
  maxValue: number;
}

/**
 * Valuation Report.
 */
export interface ValuationReport {
  reportId: string;
  reportType: 'valuation';
  generatedAt: string;
  asOfDate: string;
  title: string;

  /** Portfolio valuation summary */
  portfolioSummary: {
    totalApprovedValue: number;
    totalDraftValue: number;
    totalPendingValue: number;
    currency: string;
    valuationCount: number;
    expiredValuationCount: number;
    averageValuePerAsset: number;
  };

  /** By methodology */
  byMethodology: MethodologyAnalysis[];

  /** By purpose */
  byPurpose: Record<string, {
    count: number;
    totalValue: number;
    averageValue: number;
  }>;

  /** By status */
  byStatus: Record<string, {
    count: number;
    totalValue: number;
  }>;

  /** Recent valuations */
  recentValuations: ValuationDetailEntry[];

  /** Expired valuations needing refresh */
  expiredValuations: ValuationDetailEntry[];

  /** All valuations */
  allValuations: ValuationDetailEntry[];
}

// ============================================================================
// GENERATED REPORT OUTPUT
// ============================================================================

/**
 * Generated report output.
 */
export interface GeneratedReport<T> {
  /** Report data */
  data: T;
  /** Output format */
  format: ReportFormat;
  /** Rendered content (HTML or PDF buffer) */
  content?: string | Buffer;
  /** Content type for HTTP response */
  contentType: string;
  /** Suggested filename for download */
  filename: string;
}
