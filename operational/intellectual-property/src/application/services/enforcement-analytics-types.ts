/**
 * Enforcement Analytics Types
 *
 * Type definitions for enforcement analytics and metrics.
 *
 * @module application/services
 */

import type {
  EnforcementType,
  EnforcementStatus,
  EnforcementPriority,
  IPAssetType,
} from '../../domain/entities/enforcement-matter.entity.js';

// ============================================================================
// Period Types
// ============================================================================

/**
 * Analytics period granularity.
 */
export type AnalyticsPeriodGranularity = 'day' | 'week' | 'month' | 'quarter' | 'year';

/**
 * Analytics date range filter.
 */
export interface AnalyticsPeriod {
  from: Date;
  to: Date;
  granularity?: AnalyticsPeriodGranularity;
}

// ============================================================================
// Case Outcome Analytics
// ============================================================================

/**
 * Possible case outcomes.
 */
export type CaseOutcome = 'win' | 'loss' | 'settlement' | 'abandoned' | 'ongoing';

/**
 * Outcome breakdown by category.
 */
export interface OutcomeBreakdown {
  win: number;
  loss: number;
  settlement: number;
  abandoned: number;
  ongoing: number;
}

/**
 * Outcome rates as percentages.
 */
export interface OutcomeRates {
  winRate: number;
  lossRate: number;
  settlementRate: number;
  abandonedRate: number;
}

/**
 * Outcomes by matter type.
 */
export interface OutcomesByType {
  type: EnforcementType;
  outcomes: OutcomeBreakdown;
  rates: OutcomeRates;
  totalCases: number;
}

/**
 * Outcomes by jurisdiction.
 */
export interface OutcomesByJurisdiction {
  jurisdiction: string;
  outcomes: OutcomeBreakdown;
  rates: OutcomeRates;
  totalCases: number;
}

/**
 * Outcome trend data point.
 */
export interface OutcomeTrendPoint {
  period: string;
  periodStart: Date;
  periodEnd: Date;
  outcomes: OutcomeBreakdown;
  rates: OutcomeRates;
  totalCases: number;
}

/**
 * Complete case outcome analytics.
 */
export interface CaseOutcomeAnalytics {
  period: AnalyticsPeriod;
  overall: {
    outcomes: OutcomeBreakdown;
    rates: OutcomeRates;
    totalCases: number;
  };
  byType: OutcomesByType[];
  byJurisdiction: OutcomesByJurisdiction[];
  trends: OutcomeTrendPoint[];
}

// ============================================================================
// Resolution Time Analytics
// ============================================================================

/**
 * Time metrics in days.
 */
export interface TimeMetrics {
  average: number;
  median: number;
  min: number;
  max: number;
  standardDeviation: number;
}

/**
 * Resolution time by stage.
 */
export interface StageTimeBreakdown {
  investigation: TimeMetrics;
  ceaseAndDesist: TimeMetrics;
  negotiation: TimeMetrics;
  litigation: TimeMetrics;
  settlement: TimeMetrics;
}

/**
 * Resolution time by matter type.
 */
export interface ResolutionTimeByType {
  type: EnforcementType;
  overallTime: TimeMetrics;
  byStage: StageTimeBreakdown;
  casesAnalyzed: number;
}

/**
 * Industry benchmark comparison.
 */
export interface IndustryBenchmark {
  category: string;
  industryAverage: number;
  ourAverage: number;
  percentile: number;
  comparison: 'faster' | 'slower' | 'similar';
}

/**
 * Bottleneck identification.
 */
export interface Bottleneck {
  stage: string;
  averageDelay: number;
  expectedDuration: number;
  delayPercentage: number;
  affectedCases: number;
  recommendations: string[];
}

/**
 * Complete resolution time analytics.
 */
export interface ResolutionTimeAnalytics {
  period: AnalyticsPeriod;
  overall: TimeMetrics;
  byType: ResolutionTimeByType[];
  byStage: StageTimeBreakdown;
  benchmarks: IndustryBenchmark[];
  bottlenecks: Bottleneck[];
  casesAnalyzed: number;
}

// ============================================================================
// Cost Analytics
// ============================================================================

/**
 * Cost breakdown by category.
 */
export interface CostBreakdown {
  internalCounsel: number;
  outsideCounsel: number;
  courtFees: number;
  expertWitnesses: number;
  investigation: number;
  settlement: number;
  other: number;
  total: number;
}

/**
 * Cost vs recovery metrics.
 */
export interface CostRecoveryMetrics {
  totalCosts: number;
  totalRecoveries: number;
  netRecovery: number;
  returnOnEnforcement: number;
  costRecoveryRatio: number;
}

/**
 * Cost by matter type.
 */
export interface CostByType {
  type: EnforcementType;
  costs: CostBreakdown;
  averageCostPerCase: number;
  casesAnalyzed: number;
}

/**
 * Outside counsel spend analysis.
 */
export interface OutsideCounselSpend {
  firmName: string;
  totalSpend: number;
  casesHandled: number;
  averagePerCase: number;
  successRate: number;
  specializations: EnforcementType[];
}

/**
 * Cost projection for active matters.
 */
export interface CostProjection {
  matterId: string;
  matterTitle: string;
  currentCosts: number;
  projectedTotalCost: number;
  projectedCompletionDate: Date;
  confidenceLevel: 'low' | 'medium' | 'high';
  assumptions: string[];
}

/**
 * Cost trend data point.
 */
export interface CostTrendPoint {
  period: string;
  periodStart: Date;
  periodEnd: Date;
  costs: CostBreakdown;
  casesActive: number;
}

/**
 * Complete cost analytics.
 */
export interface CostAnalytics {
  period: AnalyticsPeriod;
  overall: {
    costs: CostBreakdown;
    recovery: CostRecoveryMetrics;
  };
  byType: CostByType[];
  outsideCounselSpend: OutsideCounselSpend[];
  projections: CostProjection[];
  trends: CostTrendPoint[];
  currency: string;
}

// ============================================================================
// Success Rate Metrics
// ============================================================================

/**
 * Success criteria definition.
 */
export type SuccessCriteria = 'favorable_outcome' | 'recovery_exceeds_cost' | 'stopped_infringement' | 'settlement_achieved';

/**
 * Success rate by dimension.
 */
export interface SuccessRateByDimension<T> {
  dimension: T;
  successCount: number;
  totalCases: number;
  successRate: number;
}

/**
 * Success by opposing party type.
 */
export interface SuccessByOpposingParty {
  partyType: 'individual' | 'small_business' | 'corporation' | 'multinational' | 'unknown';
  successCount: number;
  totalCases: number;
  successRate: number;
  averageSettlement: number;
}

/**
 * Success rate trend point.
 */
export interface SuccessRateTrendPoint {
  period: string;
  periodStart: Date;
  periodEnd: Date;
  successRate: number;
  casesResolved: number;
}

/**
 * Complete success rate metrics.
 */
export interface SuccessRateMetrics {
  period: AnalyticsPeriod;
  overall: {
    successCount: number;
    totalCases: number;
    successRate: number;
    criteria: SuccessCriteria;
  };
  byMatterType: SuccessRateByDimension<EnforcementType>[];
  byOpposingParty: SuccessByOpposingParty[];
  byJurisdiction: SuccessRateByDimension<string>[];
  byIPAssetType: SuccessRateByDimension<IPAssetType>[];
  trends: SuccessRateTrendPoint[];
}

// ============================================================================
// Trend Visualization Data
// ============================================================================

/**
 * Generic trend data point.
 */
export interface TrendDataPoint {
  period: string;
  periodStart: Date;
  periodEnd: Date;
  value: number;
  label?: string;
}

/**
 * Case count trend data.
 */
export interface CaseCountTrend {
  period: string;
  periodStart: Date;
  periodEnd: Date;
  opened: number;
  closed: number;
  netChange: number;
  activeAtEnd: number;
}

/**
 * Settlement amount trend data.
 */
export interface SettlementTrend {
  period: string;
  periodStart: Date;
  periodEnd: Date;
  totalAmount: number;
  averageAmount: number;
  count: number;
}

/**
 * Complete trend visualization data.
 */
export interface TrendVisualizationData {
  period: AnalyticsPeriod;
  caseCounts: CaseCountTrend[];
  settlements: SettlementTrend[];
  costs: CostTrendPoint[];
  resolutionTimes: TrendDataPoint[];
  successRates: SuccessRateTrendPoint[];
}

// ============================================================================
// Dashboard Summary
// ============================================================================

/**
 * Quick summary for dashboard display.
 */
export interface EnforcementAnalyticsSummary {
  period: AnalyticsPeriod;
  activeCases: number;
  closedThisPeriod: number;
  winRate: number;
  averageResolutionDays: number;
  totalCostsThisPeriod: number;
  totalRecoveriesThisPeriod: number;
  criticalCases: number;
  upcomingDeadlines: number;
}
