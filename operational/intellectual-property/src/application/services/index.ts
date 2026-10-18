/**
 * Application Services
 *
 * Exports all application-level services.
 *
 * @module application/services
 */

export {
  DeadlineGeneratorService,
  deadlineGeneratorService,
  type DeadlineGenerationEvent,
  type DeadlineGenerationResult,
} from './deadline-generator.service.js';

export {
  DeadlineMonitorService,
  deadlineMonitorService,
  type MonitorRunResult,
  type DeadlineSummary,
} from './deadline-monitor.service.js';

export {
  EscalationEngineService,
  escalationEngineService,
  type EscalationResult,
} from './escalation-engine.service.js';

export {
  EventOrchestratorService,
  eventOrchestratorService,
  type OrchestrationResult,
  type EventContext,
} from './event-orchestrator.service.js';

export {
  EcosystemIntegrationService,
  ecosystemIntegrationService,
  type TargetService,
} from './ecosystem-integration.service.js';

export {
  DashboardService,
  createDashboardService,
  getDashboardService,
  type AssetType,
  type AssetCountByStatus,
  type AssetSummary,
  type PortfolioSummary,
  type DeadlineSummaryByType,
  type DeadlineSummaryByPriority,
  type UpcomingDeadline,
  type DeadlinesDashboard,
  type TrademarkComplianceStatus as DashboardTrademarkComplianceStatus,
  type PatentMaintenanceStatus,
  type DomainRenewalStatus,
  type ComplianceDashboard,
  type EnforcementSummaryByStatus,
  type EnforcementSummaryByPriority,
  type RecentEnforcementActivity,
  type EnforcementDashboard,
  type ValuationByAssetType,
  type RecentValuation,
  type ValuationsDashboard,
  type ActivityEvent,
  type ActivityByType,
  type ActivityTimeline,
  type ActivityDashboard,
} from './dashboard.service.js';

export {
  ComplianceDashboardService,
  getComplianceDashboardService,
  createComplianceDashboardService,
} from './compliance-dashboard.service.js';

export * from './compliance-types.js';

export {
  EnforcementAnalyticsService,
  createEnforcementAnalyticsService,
  getEnforcementAnalyticsService,
} from './enforcement-analytics.service.js';

export type {
  AnalyticsPeriod,
  AnalyticsPeriodGranularity,
  CaseOutcome,
  OutcomeBreakdown,
  OutcomeRates,
  OutcomesByType,
  OutcomesByJurisdiction,
  OutcomeTrendPoint,
  CaseOutcomeAnalytics,
  TimeMetrics,
  StageTimeBreakdown,
  ResolutionTimeByType,
  IndustryBenchmark,
  Bottleneck,
  ResolutionTimeAnalytics,
  CostBreakdown,
  CostRecoveryMetrics,
  CostByType,
  OutsideCounselSpend,
  CostProjection,
  CostTrendPoint,
  CostAnalytics,
  SuccessCriteria,
  SuccessRateByDimension,
  SuccessByOpposingParty,
  SuccessRateTrendPoint,
  SuccessRateMetrics,
  TrendDataPoint,
  CaseCountTrend,
  SettlementTrend,
  TrendVisualizationData,
  EnforcementAnalyticsSummary,
} from './enforcement-analytics-types.js';

export {
  ValuationAnalyticsService,
  createValuationAnalyticsService,
  type PortfolioValueResult,
  type ChangeAnalysisResult,
  type MethodologyComparisonResult,
  type ImpairmentAnalysisResult,
  type AlertCheckResult,
} from './valuation-analytics.service.js';

export type {
  IPAssetType,
  TrendGranularity,
  ValuationChangeReason,
  ImpairmentReason,
  ValuationAlertType,
  AlertSeverity,
  PortfolioValueSnapshot,
  PortfolioValueTrend,
  TrendDataPoint as ValuationTrendDataPoint,
  TrendSeries,
  ValuationChange,
  ValuationChangeAnalysis,
  MethodologyComparison,
  AssetMethodologyComparison,
  ImpairmentSummary,
  ImpairmentEvent,
  ValuationAlert,
  ValuationAlertSummary,
  ValuationAnalyticsFilters,
  DateRangeFilter,
} from './valuation-analytics-types.js';

export {
  ReportGeneratorService,
  createReportGeneratorService,
} from './report-generator.service.js';

export type {
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
  RecentValuation as ReportRecentValuation,
  RecentEnforcementMatter,
  ComplianceItem,
  ComplianceTrendPoint,
  CalendarMonth,
  CalendarDay,
  DeadlineStatistics,
  ValuationDetailEntry,
  MethodologyAnalysis,
} from './report-types.js';
