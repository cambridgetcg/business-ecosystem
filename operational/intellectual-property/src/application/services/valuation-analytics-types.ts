/**
 * Valuation Analytics Types
 *
 * Type definitions for IP valuation analytics, trend analysis,
 * and portfolio value tracking.
 *
 * @module application/services
 */

import type { ValuationMethodology, ValuationPurpose } from '../../domain/entities/ip-valuation.entity.js';

/**
 * Asset types for valuation grouping.
 */
export type IPAssetType = 'patent' | 'trademark' | 'copyright' | 'trade_secret' | 'license';

/**
 * Time period granularity for trend analysis.
 */
export type TrendGranularity = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

/**
 * Reason for valuation change.
 */
export type ValuationChangeReason =
  | 'methodology_change'
  | 'market_conditions'
  | 'asset_performance'
  | 'legal_status_change'
  | 'revaluation_scheduled'
  | 'impairment'
  | 'new_valuation'
  | 'asset_acquisition'
  | 'asset_disposition'
  | 'currency_fluctuation'
  | 'other';

/**
 * Alert type for valuation notifications.
 */
export type ValuationAlertType =
  | 'revaluation_due'
  | 'market_change_significant'
  | 'end_of_useful_life_approaching'
  | 'impairment_indicator'
  | 'expiration_approaching'
  | 'methodology_review_recommended'
  | 'large_value_change';

/**
 * Severity level for alerts.
 */
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Impairment reason categories.
 */
export type ImpairmentReason =
  | 'market_decline'
  | 'technological_obsolescence'
  | 'legal_challenges'
  | 'competitive_displacement'
  | 'regulatory_change'
  | 'reduced_earnings_potential'
  | 'asset_damage'
  | 'abandonment'
  | 'other';

// ============================================================================
// PORTFOLIO VALUE TRACKING
// ============================================================================

/**
 * Portfolio value at a specific point in time.
 */
export interface PortfolioValueSnapshot {
  /** Snapshot date */
  snapshotDate: Date;
  /** Total portfolio value in cents */
  totalValue: number;
  /** Currency code */
  currency: string;
  /** Breakdown by asset type */
  valueByAssetType: Record<IPAssetType, number>;
  /** Breakdown by business unit/product line */
  valueByBusinessUnit: Record<string, number>;
  /** Number of valued assets */
  assetCount: number;
  /** Number of valuations contributing to total */
  valuationCount: number;
  /** Average asset value */
  averageAssetValue: number;
  /** Median asset value */
  medianAssetValue: number;
  /** Value of top 10 assets */
  topAssetsValue: number;
  /** Change from previous snapshot */
  changeFromPrevious?: {
    absoluteChange: number;
    percentageChange: number;
    periodDays: number;
  };
}

/**
 * Single trend data point for charting.
 */
export interface TrendDataPoint {
  /** Date/time of the data point */
  date: Date;
  /** Value at this point in cents */
  value: number;
  /** Optional label/annotation */
  label?: string;
  /** Metadata for the data point */
  metadata?: Record<string, unknown>;
}

/**
 * Trend series for a specific category.
 */
export interface TrendSeries {
  /** Series identifier */
  id: string;
  /** Display name */
  name: string;
  /** Data points in chronological order */
  dataPoints: TrendDataPoint[];
  /** Total change over the period */
  totalChange: number;
  /** Percentage change over the period */
  percentageChange: number;
  /** Moving average (if calculated) */
  movingAverage?: number;
}

/**
 * Portfolio value trend over time.
 */
export interface PortfolioValueTrend {
  /** Start of the trend period */
  periodStart: Date;
  /** End of the trend period */
  periodEnd: Date;
  /** Granularity of data points */
  granularity: TrendGranularity;
  /** Total portfolio trend */
  totalTrend: TrendSeries;
  /** Trends by asset type */
  trendsByAssetType: Record<IPAssetType, TrendSeries>;
  /** Trends by business unit */
  trendsByBusinessUnit: Record<string, TrendSeries>;
  /** Overall statistics */
  statistics: {
    startValue: number;
    endValue: number;
    minValue: number;
    maxValue: number;
    averageValue: number;
    volatility: number;
  };
}

// ============================================================================
// VALUATION CHANGE ANALYSIS
// ============================================================================

/**
 * Analysis of a single valuation change.
 */
export interface ValuationChange {
  /** Valuation ID */
  valuationId: string;
  /** Valuation number */
  valuationNumber: string;
  /** Asset or portfolio being valued */
  assetName: string;
  /** Asset type */
  assetType: IPAssetType;
  /** Business unit */
  businessUnit?: string;
  /** Previous value in cents */
  previousValue: number;
  /** Current value in cents */
  currentValue: number;
  /** Absolute change in cents */
  absoluteChange: number;
  /** Percentage change */
  percentageChange: number;
  /** Date of previous valuation */
  previousDate: Date;
  /** Date of current valuation */
  currentDate: Date;
  /** Primary reason for change */
  primaryReason: ValuationChangeReason;
  /** Additional reasons */
  additionalReasons: ValuationChangeReason[];
  /** Methodology used (previous) */
  previousMethodology: ValuationMethodology;
  /** Methodology used (current) */
  currentMethodology: ValuationMethodology;
  /** Whether methodology changed */
  methodologyChanged: boolean;
  /** Currency */
  currency: string;
}

/**
 * Summary of valuation changes over a period.
 */
export interface ValuationChangeAnalysis {
  /** Analysis period start */
  periodStart: Date;
  /** Analysis period end */
  periodEnd: Date;
  /** Total number of revaluations */
  totalRevaluations: number;
  /** Net change in portfolio value (cents) */
  netValueChange: number;
  /** Net percentage change */
  netPercentageChange: number;
  /** Largest gainers by absolute value */
  largestGainers: ValuationChange[];
  /** Largest losers by absolute value */
  largestLosers: ValuationChange[];
  /** Largest gainers by percentage */
  largestPercentageGainers: ValuationChange[];
  /** Largest losers by percentage */
  largestPercentageLosers: ValuationChange[];
  /** Changes by reason */
  changesByReason: Record<ValuationChangeReason, {
    count: number;
    totalChange: number;
    averageChange: number;
  }>;
  /** Changes by asset type */
  changesByAssetType: Record<IPAssetType, {
    count: number;
    totalChange: number;
    averageChange: number;
  }>;
  /** Revaluation triggers summary */
  revaluationTriggers: Array<{
    trigger: string;
    count: number;
    percentage: number;
  }>;
}

// ============================================================================
// METHODOLOGY COMPARISON
// ============================================================================

/**
 * Valuation comparison across methodologies.
 */
export interface MethodologyValuation {
  /** Valuation ID */
  valuationId: string;
  /** Methodology used */
  methodology: ValuationMethodology;
  /** Selected value in cents */
  selectedValue: number;
  /** Low value in cents */
  lowValue?: number;
  /** High value in cents */
  highValue?: number;
  /** Valuation date */
  valuationDate: Date;
  /** Purpose of valuation */
  purpose: ValuationPurpose;
}

/**
 * Methodology comparison for a single asset.
 */
export interface AssetMethodologyComparison {
  /** Asset ID */
  assetId: string;
  /** Asset name */
  assetName: string;
  /** Asset type */
  assetType: IPAssetType;
  /** Valuations by methodology */
  valuationsByMethodology: Record<ValuationMethodology, MethodologyValuation[]>;
  /** Latest value by methodology */
  latestValueByMethodology: Record<ValuationMethodology, number>;
  /** Variance between methodologies */
  methodologyVariance: {
    minValue: number;
    maxValue: number;
    range: number;
    rangePercentage: number;
    standardDeviation: number;
  };
  /** Recommended methodology based on purpose */
  recommendedMethodology?: ValuationMethodology;
}

/**
 * Portfolio-wide methodology analysis.
 */
export interface MethodologyComparison {
  /** Analysis date */
  analysisDate: Date;
  /** Total assets analyzed */
  totalAssetsAnalyzed: number;
  /** Distribution of methodologies used */
  methodologyDistribution: Record<ValuationMethodology, {
    /** Number of valuations using this methodology */
    count: number;
    /** Percentage of total */
    percentage: number;
    /** Total value of assets valued with this methodology (cents) */
    totalValue: number;
    /** Average value per valuation */
    averageValue: number;
  }>;
  /** Assets with multiple methodology valuations */
  assetsWithMultipleMethodologies: AssetMethodologyComparison[];
  /** Average variance when multiple methodologies used */
  averageMethodologyVariance: number;
  /** Methodology preferences by asset type */
  methodologyByAssetType: Record<IPAssetType, Record<ValuationMethodology, number>>;
  /** Methodology preferences by purpose */
  methodologyByPurpose: Record<ValuationPurpose, Record<ValuationMethodology, number>>;
}

// ============================================================================
// IMPAIRMENT TRACKING
// ============================================================================

/**
 * Single impairment event.
 */
export interface ImpairmentEvent {
  /** Impairment ID */
  id: string;
  /** Valuation ID */
  valuationId: string;
  /** Asset ID */
  assetId: string;
  /** Asset name */
  assetName: string;
  /** Asset type */
  assetType: IPAssetType;
  /** Business unit */
  businessUnit?: string;
  /** Date impairment recognized */
  impairmentDate: Date;
  /** Carrying value before impairment (cents) */
  carryingValueBefore: number;
  /** Fair value at impairment (cents) */
  fairValueAtImpairment: number;
  /** Impairment amount (cents) */
  impairmentAmount: number;
  /** Impairment as percentage of carrying value */
  impairmentPercentage: number;
  /** Primary reason */
  primaryReason: ImpairmentReason;
  /** Additional factors */
  additionalFactors: ImpairmentReason[];
  /** Whether impairment is reversible */
  reversible: boolean;
  /** Expected recovery amount if reversible */
  expectedRecovery?: number;
  /** Notes */
  notes?: string;
}

/**
 * Summary of impairments over a period.
 */
export interface ImpairmentSummary {
  /** Analysis period start */
  periodStart: Date;
  /** Analysis period end */
  periodEnd: Date;
  /** Total impairment events */
  totalEvents: number;
  /** Total impairment amount (cents) */
  totalImpairmentAmount: number;
  /** Average impairment amount */
  averageImpairmentAmount: number;
  /** Impairments by period (monthly) */
  impairmentsByMonth: Array<{
    month: Date;
    count: number;
    amount: number;
  }>;
  /** Impairments by reason */
  impairmentsByReason: Record<ImpairmentReason, {
    count: number;
    totalAmount: number;
    percentage: number;
  }>;
  /** Impairments by asset type */
  impairmentsByAssetType: Record<IPAssetType, {
    count: number;
    totalAmount: number;
    percentage: number;
  }>;
  /** Assets with impairment indicators (not yet impaired) */
  assetsWithIndicators: Array<{
    assetId: string;
    assetName: string;
    assetType: IPAssetType;
    indicators: string[];
    estimatedImpairmentRisk: 'low' | 'medium' | 'high';
  }>;
  /** All impairment events in period */
  events: ImpairmentEvent[];
}

// ============================================================================
// VALUATION ALERTS
// ============================================================================

/**
 * Single valuation alert.
 */
export interface ValuationAlert {
  /** Alert ID */
  id: string;
  /** Alert type */
  type: ValuationAlertType;
  /** Severity */
  severity: AlertSeverity;
  /** Title */
  title: string;
  /** Description */
  description: string;
  /** Asset ID (if asset-specific) */
  assetId?: string;
  /** Asset name */
  assetName?: string;
  /** Asset type */
  assetType?: IPAssetType;
  /** Valuation ID (if valuation-specific) */
  valuationId?: string;
  /** Created date */
  createdAt: Date;
  /** Due date (for action items) */
  dueDate?: Date;
  /** Days until due */
  daysUntilDue?: number;
  /** Whether alert has been acknowledged */
  acknowledged: boolean;
  /** Acknowledged by */
  acknowledgedBy?: string;
  /** Acknowledged date */
  acknowledgedAt?: Date;
  /** Recommended action */
  recommendedAction?: string;
  /** Related data */
  metadata?: Record<string, unknown>;
}

/**
 * Alert summary grouped by type and severity.
 */
export interface ValuationAlertSummary {
  /** Total active alerts */
  totalAlerts: number;
  /** Alerts by severity */
  bySeverity: Record<AlertSeverity, number>;
  /** Alerts by type */
  byType: Record<ValuationAlertType, number>;
  /** Critical alerts requiring immediate attention */
  criticalAlerts: ValuationAlert[];
  /** Alerts due within 7 days */
  alertsDueThisWeek: ValuationAlert[];
  /** Alerts due within 30 days */
  alertsDueThisMonth: ValuationAlert[];
  /** Overdue alerts */
  overdueAlerts: ValuationAlert[];
  /** All alerts */
  allAlerts: ValuationAlert[];
}

// ============================================================================
// QUERY PARAMETERS
// ============================================================================

/**
 * Date range filter for analytics queries.
 */
export interface DateRangeFilter {
  /** Start date (inclusive) */
  startDate: Date;
  /** End date (inclusive) */
  endDate: Date;
}

/**
 * Common filters for valuation analytics.
 */
export interface ValuationAnalyticsFilters {
  /** Date range */
  dateRange?: DateRangeFilter;
  /** Filter by asset types */
  assetTypes?: IPAssetType[];
  /** Filter by business units */
  businessUnits?: string[];
  /** Filter by methodologies */
  methodologies?: ValuationMethodology[];
  /** Filter by purposes */
  purposes?: ValuationPurpose[];
  /** Minimum value threshold (cents) */
  minValue?: number;
  /** Maximum value threshold (cents) */
  maxValue?: number;
  /** Include only approved valuations */
  approvedOnly?: boolean;
  /** Currency for value aggregations */
  currency?: string;
}
