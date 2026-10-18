/**
 * Enforcement Analytics Service
 *
 * Provides comprehensive analytics for IP enforcement matters including
 * case outcomes, resolution times, costs, success rates, and trends.
 *
 * @module application/services
 */

import type { Database } from '../../infrastructure/persistence/database.js';
import { sql } from 'drizzle-orm';
import {
  enforcementMatters,
  enforcementActions,
  enforcementParties,
} from '../../infrastructure/persistence/schema.js';
import type {
  EnforcementType,
  EnforcementStatus,
  EnforcementPriority,
  IPAssetType,
} from '../../domain/entities/enforcement-matter.entity.js';
import type {
  AnalyticsPeriod,
  AnalyticsPeriodGranularity,
  CaseOutcomeAnalytics,
  OutcomeBreakdown,
  OutcomeRates,
  OutcomesByType,
  OutcomesByJurisdiction,
  OutcomeTrendPoint,
  ResolutionTimeAnalytics,
  TimeMetrics,
  StageTimeBreakdown,
  ResolutionTimeByType,
  IndustryBenchmark,
  Bottleneck,
  CostAnalytics,
  CostBreakdown,
  CostRecoveryMetrics,
  CostByType,
  OutsideCounselSpend,
  CostProjection,
  CostTrendPoint,
  SuccessRateMetrics,
  SuccessCriteria,
  SuccessRateByDimension,
  SuccessByOpposingParty,
  SuccessRateTrendPoint,
  TrendVisualizationData,
  CaseCountTrend,
  SettlementTrend,
  TrendDataPoint,
  EnforcementAnalyticsSummary,
} from './enforcement-analytics-types.js';

// ============================================================================
// Types
// ============================================================================

interface MatterRecord {
  id: string;
  type: EnforcementType;
  status: EnforcementStatus;
  priority: EnforcementPriority;
  ipAssetType: string;
  jurisdiction: string;
  detectedDate: string;
  openedDate: string | null;
  resolvedDate: string | null;
  estimatedDamages: number | null;
  actualDamages: number | null;
  settlementAmount: number | null;
  estimatedCosts: number | null;
  actualCosts: number | null;
  outcome: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface PartyRecord {
  id: string;
  matterId: string;
  role: string;
  name: string;
  organization: string | null;
  firmName: string | null;
}

interface ActionRecord {
  id: string;
  matterId: string;
  actionType: string;
  status: string;
  cost: number | null;
  createdAt: Date;
  completedDate: string | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate standard deviation.
 */
function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map((value) => Math.pow(value - mean, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(avgSquareDiff);
}

/**
 * Calculate median.
 */
function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Calculate time metrics from array of durations.
 */
function calculateTimeMetrics(durations: number[]): TimeMetrics {
  if (durations.length === 0) {
    return { average: 0, median: 0, min: 0, max: 0, standardDeviation: 0 };
  }
  return {
    average: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
    median: calculateMedian(durations),
    min: Math.min(...durations),
    max: Math.max(...durations),
    standardDeviation: Math.round(calculateStandardDeviation(durations)),
  };
}

/**
 * Get period key for grouping.
 */
function getPeriodKey(date: Date, granularity: AnalyticsPeriodGranularity): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const week = Math.ceil(date.getDate() / 7);
  const quarter = Math.ceil(month / 3);

  switch (granularity) {
    case 'day':
      return date.toISOString().split('T')[0];
    case 'week':
      return `${year}-W${String(Math.ceil((date.getDate() + new Date(year, month - 1, 1).getDay()) / 7)).padStart(2, '0')}`;
    case 'month':
      return `${year}-${String(month).padStart(2, '0')}`;
    case 'quarter':
      return `${year}-Q${quarter}`;
    case 'year':
      return String(year);
  }
}

/**
 * Get period date range.
 */
function getPeriodRange(
  periodKey: string,
  granularity: AnalyticsPeriodGranularity
): { start: Date; end: Date } {
  switch (granularity) {
    case 'day': {
      const date = new Date(periodKey);
      return { start: date, end: new Date(date.getTime() + 24 * 60 * 60 * 1000 - 1) };
    }
    case 'week': {
      const [year, week] = periodKey.split('-W').map(Number);
      const start = new Date(year, 0, 1 + (week - 1) * 7);
      const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
      return { start, end };
    }
    case 'month': {
      const [year, month] = periodKey.split('-').map(Number);
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59, 999);
      return { start, end };
    }
    case 'quarter': {
      const [year, q] = periodKey.split('-Q').map(Number);
      const startMonth = (q - 1) * 3;
      const start = new Date(year, startMonth, 1);
      const end = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
      return { start, end };
    }
    case 'year': {
      const year = Number(periodKey);
      return { start: new Date(year, 0, 1), end: new Date(year, 11, 31, 23, 59, 59, 999) };
    }
  }
}

/**
 * Determine case outcome from matter status and outcome field.
 */
function determineCaseOutcome(matter: MatterRecord): 'win' | 'loss' | 'settlement' | 'abandoned' | 'ongoing' {
  if (['monitoring', 'investigation', 'cease_and_desist', 'negotiation', 'litigation'].includes(matter.status)) {
    return 'ongoing';
  }
  if (matter.status === 'abandoned') {
    return 'abandoned';
  }
  if (matter.status === 'settled') {
    return 'settlement';
  }
  if (matter.status === 'resolved') {
    const outcome = matter.outcome?.toLowerCase() ?? '';
    if (outcome.includes('win') || outcome.includes('favorable') || outcome.includes('success')) {
      return 'win';
    }
    if (outcome.includes('loss') || outcome.includes('unfavorable') || outcome.includes('dismiss')) {
      return 'loss';
    }
    // Default resolved cases with recovery as win
    if ((matter.actualDamages ?? 0) > 0 || (matter.settlementAmount ?? 0) > 0) {
      return 'win';
    }
    return 'loss';
  }
  return 'ongoing';
}

/**
 * Calculate outcome rates from breakdown.
 */
function calculateOutcomeRates(outcomes: OutcomeBreakdown): OutcomeRates {
  const totalClosed = outcomes.win + outcomes.loss + outcomes.settlement + outcomes.abandoned;
  if (totalClosed === 0) {
    return { winRate: 0, lossRate: 0, settlementRate: 0, abandonedRate: 0 };
  }
  return {
    winRate: Math.round((outcomes.win / totalClosed) * 100 * 10) / 10,
    lossRate: Math.round((outcomes.loss / totalClosed) * 100 * 10) / 10,
    settlementRate: Math.round((outcomes.settlement / totalClosed) * 100 * 10) / 10,
    abandonedRate: Math.round((outcomes.abandoned / totalClosed) * 100 * 10) / 10,
  };
}

// ============================================================================
// Service Implementation
// ============================================================================

/**
 * Enforcement Analytics Service
 */
export class EnforcementAnalyticsService {
  constructor(private readonly db: Database) {}

  // ==========================================================================
  // Case Outcome Analytics
  // ==========================================================================

  /**
   * Get case outcome analytics.
   */
  async getCaseOutcomeAnalytics(period: AnalyticsPeriod): Promise<CaseOutcomeAnalytics> {
    const granularity = period.granularity ?? 'month';
    const matters = await this.getMattersInPeriod(period);

    // Calculate overall outcomes
    const overall = this.calculateOverallOutcomes(matters);

    // Calculate outcomes by type
    const byType = this.calculateOutcomesByType(matters);

    // Calculate outcomes by jurisdiction
    const byJurisdiction = this.calculateOutcomesByJurisdiction(matters);

    // Calculate trends
    const trends = this.calculateOutcomeTrends(matters, granularity);

    return {
      period,
      overall,
      byType,
      byJurisdiction,
      trends,
    };
  }

  private calculateOverallOutcomes(matters: MatterRecord[]): {
    outcomes: OutcomeBreakdown;
    rates: OutcomeRates;
    totalCases: number;
  } {
    const outcomes: OutcomeBreakdown = {
      win: 0,
      loss: 0,
      settlement: 0,
      abandoned: 0,
      ongoing: 0,
    };

    for (const matter of matters) {
      const outcome = determineCaseOutcome(matter);
      outcomes[outcome]++;
    }

    return {
      outcomes,
      rates: calculateOutcomeRates(outcomes),
      totalCases: matters.length,
    };
  }

  private calculateOutcomesByType(matters: MatterRecord[]): OutcomesByType[] {
    const byType = new Map<EnforcementType, MatterRecord[]>();

    for (const matter of matters) {
      const existing = byType.get(matter.type) ?? [];
      existing.push(matter);
      byType.set(matter.type, existing);
    }

    return Array.from(byType.entries()).map(([type, typeMatters]) => {
      const { outcomes, rates, totalCases } = this.calculateOverallOutcomes(typeMatters);
      return { type, outcomes, rates, totalCases };
    });
  }

  private calculateOutcomesByJurisdiction(matters: MatterRecord[]): OutcomesByJurisdiction[] {
    const byJurisdiction = new Map<string, MatterRecord[]>();

    for (const matter of matters) {
      const existing = byJurisdiction.get(matter.jurisdiction) ?? [];
      existing.push(matter);
      byJurisdiction.set(matter.jurisdiction, existing);
    }

    return Array.from(byJurisdiction.entries()).map(([jurisdiction, jurisdictionMatters]) => {
      const { outcomes, rates, totalCases } = this.calculateOverallOutcomes(jurisdictionMatters);
      return { jurisdiction, outcomes, rates, totalCases };
    });
  }

  private calculateOutcomeTrends(
    matters: MatterRecord[],
    granularity: AnalyticsPeriodGranularity
  ): OutcomeTrendPoint[] {
    const byPeriod = new Map<string, MatterRecord[]>();

    for (const matter of matters) {
      const resolvedDate = matter.resolvedDate ? new Date(matter.resolvedDate) : null;
      if (!resolvedDate) continue;

      const periodKey = getPeriodKey(resolvedDate, granularity);
      const existing = byPeriod.get(periodKey) ?? [];
      existing.push(matter);
      byPeriod.set(periodKey, existing);
    }

    return Array.from(byPeriod.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([periodKey, periodMatters]) => {
        const { outcomes, rates, totalCases } = this.calculateOverallOutcomes(periodMatters);
        const range = getPeriodRange(periodKey, granularity);
        return {
          period: periodKey,
          periodStart: range.start,
          periodEnd: range.end,
          outcomes,
          rates,
          totalCases,
        };
      });
  }

  // ==========================================================================
  // Resolution Time Analytics
  // ==========================================================================

  /**
   * Get resolution time analytics.
   */
  async getResolutionTimeAnalytics(period: AnalyticsPeriod): Promise<ResolutionTimeAnalytics> {
    const matters = await this.getResolvedMattersInPeriod(period);
    const actions = await this.getActionsForMatters(matters.map((m) => m.id));

    // Calculate overall resolution times
    const overallDurations = matters
      .filter((m) => m.openedDate && m.resolvedDate)
      .map((m) => {
        const opened = new Date(m.openedDate!);
        const resolved = new Date(m.resolvedDate!);
        return Math.ceil((resolved.getTime() - opened.getTime()) / (24 * 60 * 60 * 1000));
      });

    const overall = calculateTimeMetrics(overallDurations);

    // Calculate by type
    const byType = this.calculateResolutionTimeByType(matters, actions);

    // Calculate by stage
    const byStage = this.calculateStageTimeBreakdown(matters, actions);

    // Industry benchmarks (static for now, could be configurable)
    const benchmarks = this.getIndustryBenchmarks(overall.average);

    // Identify bottlenecks
    const bottlenecks = this.identifyBottlenecks(byStage);

    return {
      period,
      overall,
      byType,
      byStage,
      benchmarks,
      bottlenecks,
      casesAnalyzed: matters.length,
    };
  }

  private calculateResolutionTimeByType(
    matters: MatterRecord[],
    actions: ActionRecord[]
  ): ResolutionTimeByType[] {
    const byType = new Map<EnforcementType, MatterRecord[]>();

    for (const matter of matters) {
      const existing = byType.get(matter.type) ?? [];
      existing.push(matter);
      byType.set(matter.type, existing);
    }

    return Array.from(byType.entries()).map(([type, typeMatters]) => {
      const durations = typeMatters
        .filter((m) => m.openedDate && m.resolvedDate)
        .map((m) => {
          const opened = new Date(m.openedDate!);
          const resolved = new Date(m.resolvedDate!);
          return Math.ceil((resolved.getTime() - opened.getTime()) / (24 * 60 * 60 * 1000));
        });

      const matterIds = new Set(typeMatters.map((m) => m.id));
      const typeActions = actions.filter((a) => matterIds.has(a.matterId));

      return {
        type,
        overallTime: calculateTimeMetrics(durations),
        byStage: this.calculateStageTimeBreakdown(typeMatters, typeActions),
        casesAnalyzed: typeMatters.length,
      };
    });
  }

  private calculateStageTimeBreakdown(
    matters: MatterRecord[],
    actions: ActionRecord[]
  ): StageTimeBreakdown {
    // Group actions by matter and type
    const actionsByMatter = new Map<string, ActionRecord[]>();
    for (const action of actions) {
      const existing = actionsByMatter.get(action.matterId) ?? [];
      existing.push(action);
      actionsByMatter.set(action.matterId, existing);
    }

    const stageDurations: Record<string, number[]> = {
      investigation: [],
      ceaseAndDesist: [],
      negotiation: [],
      litigation: [],
      settlement: [],
    };

    for (const matter of matters) {
      const matterActions = actionsByMatter.get(matter.id) ?? [];

      // Estimate stage durations from action types
      const investigationActions = matterActions.filter((a) => a.actionType === 'investigation');
      const cdActions = matterActions.filter((a) => a.actionType === 'cease_and_desist');
      const negotiationActions = matterActions.filter((a) => a.actionType === 'negotiation');
      const litigationActions = matterActions.filter((a) =>
        ['court_filing', 'motion', 'discovery'].includes(a.actionType)
      );
      const settlementActions = matterActions.filter((a) => a.actionType === 'settlement_offer');

      // Calculate durations for each stage based on action timestamps
      if (investigationActions.length > 0) {
        const sorted = investigationActions.sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        const first = new Date(sorted[0].createdAt);
        const last = sorted[sorted.length - 1].completedDate
          ? new Date(sorted[sorted.length - 1].completedDate!)
          : new Date(sorted[sorted.length - 1].createdAt);
        stageDurations.investigation.push(
          Math.max(1, Math.ceil((last.getTime() - first.getTime()) / (24 * 60 * 60 * 1000)))
        );
      }

      if (cdActions.length > 0) {
        // C&D typically takes 30-60 days for response
        stageDurations.ceaseAndDesist.push(45);
      }

      if (negotiationActions.length > 0) {
        const sorted = negotiationActions.sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        const first = new Date(sorted[0].createdAt);
        const last = sorted[sorted.length - 1].completedDate
          ? new Date(sorted[sorted.length - 1].completedDate!)
          : new Date(sorted[sorted.length - 1].createdAt);
        stageDurations.negotiation.push(
          Math.max(1, Math.ceil((last.getTime() - first.getTime()) / (24 * 60 * 60 * 1000)))
        );
      }

      if (litigationActions.length > 0) {
        const sorted = litigationActions.sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        const first = new Date(sorted[0].createdAt);
        const last = sorted[sorted.length - 1].completedDate
          ? new Date(sorted[sorted.length - 1].completedDate!)
          : new Date(sorted[sorted.length - 1].createdAt);
        stageDurations.litigation.push(
          Math.max(1, Math.ceil((last.getTime() - first.getTime()) / (24 * 60 * 60 * 1000)))
        );
      }

      if (settlementActions.length > 0) {
        const sorted = settlementActions.sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        const first = new Date(sorted[0].createdAt);
        const last = sorted[sorted.length - 1].completedDate
          ? new Date(sorted[sorted.length - 1].completedDate!)
          : new Date(sorted[sorted.length - 1].createdAt);
        stageDurations.settlement.push(
          Math.max(1, Math.ceil((last.getTime() - first.getTime()) / (24 * 60 * 60 * 1000)))
        );
      }
    }

    return {
      investigation: calculateTimeMetrics(stageDurations.investigation),
      ceaseAndDesist: calculateTimeMetrics(stageDurations.ceaseAndDesist),
      negotiation: calculateTimeMetrics(stageDurations.negotiation),
      litigation: calculateTimeMetrics(stageDurations.litigation),
      settlement: calculateTimeMetrics(stageDurations.settlement),
    };
  }

  private getIndustryBenchmarks(ourAverage: number): IndustryBenchmark[] {
    // Industry benchmarks (these would ideally come from a configuration or external data source)
    const benchmarks: IndustryBenchmark[] = [
      {
        category: 'Patent Infringement (US)',
        industryAverage: 730,
        ourAverage,
        percentile: ourAverage < 730 ? Math.round(((730 - ourAverage) / 730) * 100) : 50,
        comparison: ourAverage < 650 ? 'faster' : ourAverage > 810 ? 'slower' : 'similar',
      },
      {
        category: 'Trademark Infringement',
        industryAverage: 365,
        ourAverage,
        percentile: ourAverage < 365 ? Math.round(((365 - ourAverage) / 365) * 100) : 50,
        comparison: ourAverage < 320 ? 'faster' : ourAverage > 410 ? 'slower' : 'similar',
      },
      {
        category: 'Trade Secret Misappropriation',
        industryAverage: 548,
        ourAverage,
        percentile: ourAverage < 548 ? Math.round(((548 - ourAverage) / 548) * 100) : 50,
        comparison: ourAverage < 480 ? 'faster' : ourAverage > 616 ? 'slower' : 'similar',
      },
    ];

    return benchmarks;
  }

  private identifyBottlenecks(byStage: StageTimeBreakdown): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];

    // Expected durations (configurable)
    const expectedDurations: Record<string, number> = {
      investigation: 30,
      ceaseAndDesist: 45,
      negotiation: 60,
      litigation: 365,
      settlement: 30,
    };

    const stages = Object.entries(byStage) as [keyof StageTimeBreakdown, TimeMetrics][];

    for (const [stage, metrics] of stages) {
      const expected = expectedDurations[stage] ?? 30;
      if (metrics.average > expected * 1.2) {
        const delayPercentage = Math.round(((metrics.average - expected) / expected) * 100);
        bottlenecks.push({
          stage,
          averageDelay: Math.round(metrics.average - expected),
          expectedDuration: expected,
          delayPercentage,
          affectedCases: metrics.average > 0 ? 1 : 0, // Simplified - would need more data
          recommendations: this.getBottleneckRecommendations(stage, delayPercentage),
        });
      }
    }

    return bottlenecks.sort((a, b) => b.delayPercentage - a.delayPercentage);
  }

  private getBottleneckRecommendations(stage: string, delayPercentage: number): string[] {
    const recommendations: string[] = [];

    if (stage === 'investigation') {
      recommendations.push('Consider engaging specialized investigators earlier');
      recommendations.push('Implement parallel investigation workflows');
      if (delayPercentage > 50) {
        recommendations.push('Review investigation scope and prioritization criteria');
      }
    } else if (stage === 'ceaseAndDesist') {
      recommendations.push('Use template C&D letters with pre-approved language');
      recommendations.push('Establish shorter internal review cycles');
    } else if (stage === 'negotiation') {
      recommendations.push('Set firm negotiation deadlines upfront');
      recommendations.push('Consider mediation for complex cases');
      if (delayPercentage > 50) {
        recommendations.push('Evaluate litigation as alternative to extended negotiations');
      }
    } else if (stage === 'litigation') {
      recommendations.push('Pursue early case evaluation and settlement');
      recommendations.push('Consider specialized litigation venues');
      if (delayPercentage > 30) {
        recommendations.push('Engage litigation support resources earlier');
      }
    } else if (stage === 'settlement') {
      recommendations.push('Prepare settlement frameworks in advance');
      recommendations.push('Establish clear settlement authority guidelines');
    }

    return recommendations;
  }

  // ==========================================================================
  // Cost Analytics
  // ==========================================================================

  /**
   * Get cost analytics.
   */
  async getCostAnalytics(period: AnalyticsPeriod): Promise<CostAnalytics> {
    const granularity = period.granularity ?? 'month';
    const matters = await this.getMattersInPeriod(period);
    const actions = await this.getActionsForMatters(matters.map((m) => m.id));
    const parties = await this.getPartiesForMatters(matters.map((m) => m.id));

    // Calculate overall costs
    const overall = this.calculateOverallCosts(matters, actions);

    // Calculate costs by type
    const byType = this.calculateCostsByType(matters, actions);

    // Analyze outside counsel spend
    const outsideCounselSpend = this.analyzeOutsideCounselSpend(matters, parties, actions);

    // Generate cost projections for active matters
    const activeMatters = matters.filter((m) =>
      ['monitoring', 'investigation', 'cease_and_desist', 'negotiation', 'litigation'].includes(m.status)
    );
    const projections = this.generateCostProjections(activeMatters, actions);

    // Calculate cost trends
    const trends = this.calculateCostTrends(matters, actions, granularity);

    return {
      period,
      overall,
      byType,
      outsideCounselSpend,
      projections,
      trends,
      currency: 'USD',
    };
  }

  private calculateOverallCosts(
    matters: MatterRecord[],
    actions: ActionRecord[]
  ): { costs: CostBreakdown; recovery: CostRecoveryMetrics } {
    let totalActualCosts = 0;
    let totalRecoveries = 0;
    let settlementTotal = 0;

    for (const matter of matters) {
      totalActualCosts += matter.actualCosts ?? 0;
      totalRecoveries += (matter.actualDamages ?? 0) + (matter.settlementAmount ?? 0);
      settlementTotal += matter.settlementAmount ?? 0;
    }

    // Breakdown costs from actions
    const costBreakdown: CostBreakdown = {
      internalCounsel: 0,
      outsideCounsel: 0,
      courtFees: 0,
      expertWitnesses: 0,
      investigation: 0,
      settlement: settlementTotal,
      other: 0,
      total: totalActualCosts,
    };

    for (const action of actions) {
      const cost = action.cost ?? 0;
      switch (action.actionType) {
        case 'investigation':
          costBreakdown.investigation += cost;
          break;
        case 'court_filing':
        case 'motion':
          costBreakdown.courtFees += cost;
          break;
        default:
          costBreakdown.other += cost;
      }
    }

    // Estimate internal/outside counsel split (typically 30/70)
    const legalCosts = totalActualCosts - costBreakdown.investigation - costBreakdown.courtFees - costBreakdown.other;
    costBreakdown.internalCounsel = Math.round(legalCosts * 0.3);
    costBreakdown.outsideCounsel = Math.round(legalCosts * 0.7);

    const netRecovery = totalRecoveries - totalActualCosts;
    const costRecoveryRatio = totalActualCosts > 0 ? totalRecoveries / totalActualCosts : 0;

    return {
      costs: costBreakdown,
      recovery: {
        totalCosts: totalActualCosts,
        totalRecoveries,
        netRecovery,
        returnOnEnforcement: Math.round(costRecoveryRatio * 100),
        costRecoveryRatio: Math.round(costRecoveryRatio * 100) / 100,
      },
    };
  }

  private calculateCostsByType(matters: MatterRecord[], actions: ActionRecord[]): CostByType[] {
    const byType = new Map<EnforcementType, MatterRecord[]>();

    for (const matter of matters) {
      const existing = byType.get(matter.type) ?? [];
      existing.push(matter);
      byType.set(matter.type, existing);
    }

    return Array.from(byType.entries()).map(([type, typeMatters]) => {
      const matterIds = new Set(typeMatters.map((m) => m.id));
      const typeActions = actions.filter((a) => matterIds.has(a.matterId));
      const { costs } = this.calculateOverallCosts(typeMatters, typeActions);

      return {
        type,
        costs,
        averageCostPerCase: typeMatters.length > 0 ? Math.round(costs.total / typeMatters.length) : 0,
        casesAnalyzed: typeMatters.length,
      };
    });
  }

  private analyzeOutsideCounselSpend(
    matters: MatterRecord[],
    parties: PartyRecord[],
    actions: ActionRecord[]
  ): OutsideCounselSpend[] {
    // Group matters by outside counsel
    const counselMatters = new Map<string, { matters: MatterRecord[]; party: PartyRecord }>();

    for (const party of parties) {
      if (party.role === 'external_counsel' && party.firmName) {
        const matter = matters.find((m) => m.id === party.matterId);
        if (matter) {
          const existing = counselMatters.get(party.firmName);
          if (existing) {
            existing.matters.push(matter);
          } else {
            counselMatters.set(party.firmName, { matters: [matter], party });
          }
        }
      }
    }

    return Array.from(counselMatters.entries()).map(([firmName, { matters: firmMatters }]) => {
      const totalSpend = firmMatters.reduce((sum, m) => sum + (m.actualCosts ?? 0), 0) * 0.7; // Assume 70% is outside counsel
      const successfulCases = firmMatters.filter(
        (m) => m.status === 'settled' || (m.status === 'resolved' && determineCaseOutcome(m) === 'win')
      ).length;

      const specializations = [...new Set(firmMatters.map((m) => m.type))];

      return {
        firmName,
        totalSpend: Math.round(totalSpend),
        casesHandled: firmMatters.length,
        averagePerCase: firmMatters.length > 0 ? Math.round(totalSpend / firmMatters.length) : 0,
        successRate: firmMatters.length > 0 ? Math.round((successfulCases / firmMatters.length) * 100) : 0,
        specializations,
      };
    });
  }

  private generateCostProjections(
    activeMatters: MatterRecord[],
    actions: ActionRecord[]
  ): CostProjection[] {
    return activeMatters.slice(0, 10).map((matter) => {
      const matterActions = actions.filter((a) => a.matterId === matter.id);
      const currentCosts = matter.actualCosts ?? 0;

      // Project based on status and type
      const projectionMultipliers: Record<EnforcementStatus, number> = {
        monitoring: 5,
        investigation: 3,
        cease_and_desist: 2,
        negotiation: 1.5,
        litigation: 1.2,
        settled: 1,
        resolved: 1,
        abandoned: 1,
      };

      const multiplier = projectionMultipliers[matter.status] ?? 1;
      const projectedTotal = Math.round(Math.max(currentCosts, matter.estimatedCosts ?? 50000) * multiplier);

      // Estimate completion date
      const avgDaysPerStage: Record<EnforcementStatus, number> = {
        monitoring: 180,
        investigation: 120,
        cease_and_desist: 90,
        negotiation: 60,
        litigation: 365,
        settled: 0,
        resolved: 0,
        abandoned: 0,
      };

      const daysRemaining = avgDaysPerStage[matter.status] ?? 90;
      const projectedCompletionDate = new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000);

      return {
        matterId: matter.id,
        matterTitle: matter.outcome ?? `Matter ${matter.id.slice(0, 8)}`,
        currentCosts,
        projectedTotalCost: projectedTotal,
        projectedCompletionDate,
        confidenceLevel: currentCosts > 0 ? 'medium' : 'low',
        assumptions: [
          `Based on current status: ${matter.status}`,
          `Historical average for ${matter.type} matters`,
          currentCosts > 0 ? 'Includes actual costs to date' : 'No costs recorded yet',
        ],
      };
    });
  }

  private calculateCostTrends(
    matters: MatterRecord[],
    actions: ActionRecord[],
    granularity: AnalyticsPeriodGranularity
  ): CostTrendPoint[] {
    const byPeriod = new Map<string, { matters: MatterRecord[]; actions: ActionRecord[] }>();

    for (const matter of matters) {
      const date = new Date(matter.updatedAt);
      const periodKey = getPeriodKey(date, granularity);

      const existing = byPeriod.get(periodKey) ?? { matters: [], actions: [] };
      existing.matters.push(matter);
      byPeriod.set(periodKey, existing);
    }

    for (const action of actions) {
      const date = new Date(action.createdAt);
      const periodKey = getPeriodKey(date, granularity);

      const existing = byPeriod.get(periodKey) ?? { matters: [], actions: [] };
      existing.actions.push(action);
      byPeriod.set(periodKey, existing);
    }

    return Array.from(byPeriod.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([periodKey, { matters: periodMatters, actions: periodActions }]) => {
        const { costs } = this.calculateOverallCosts(periodMatters, periodActions);
        const range = getPeriodRange(periodKey, granularity);

        return {
          period: periodKey,
          periodStart: range.start,
          periodEnd: range.end,
          costs,
          casesActive: periodMatters.filter((m) =>
            ['monitoring', 'investigation', 'cease_and_desist', 'negotiation', 'litigation'].includes(m.status)
          ).length,
        };
      });
  }

  // ==========================================================================
  // Success Rate Metrics
  // ==========================================================================

  /**
   * Get success rate metrics.
   */
  async getSuccessRateMetrics(
    period: AnalyticsPeriod,
    criteria: SuccessCriteria = 'favorable_outcome'
  ): Promise<SuccessRateMetrics> {
    const granularity = period.granularity ?? 'month';
    const matters = await this.getResolvedMattersInPeriod(period);
    const parties = await this.getPartiesForMatters(matters.map((m) => m.id));

    // Calculate overall success
    const overall = this.calculateOverallSuccess(matters, criteria);

    // Calculate by matter type
    const byMatterType = this.calculateSuccessByDimension(matters, criteria, (m) => m.type);

    // Calculate by opposing party
    const byOpposingParty = this.calculateSuccessByOpposingParty(matters, parties, criteria);

    // Calculate by jurisdiction
    const byJurisdiction = this.calculateSuccessByDimension(matters, criteria, (m) => m.jurisdiction);

    // Calculate by IP asset type
    const byIPAssetType = this.calculateSuccessByDimension(
      matters,
      criteria,
      (m) => m.ipAssetType as IPAssetType
    );

    // Calculate trends
    const trends = this.calculateSuccessTrends(matters, criteria, granularity);

    return {
      period,
      overall: {
        ...overall,
        criteria,
      },
      byMatterType,
      byOpposingParty,
      byJurisdiction,
      byIPAssetType,
      trends,
    };
  }

  private isSuccessful(matter: MatterRecord, criteria: SuccessCriteria): boolean {
    switch (criteria) {
      case 'favorable_outcome':
        return determineCaseOutcome(matter) === 'win' || determineCaseOutcome(matter) === 'settlement';
      case 'recovery_exceeds_cost':
        const recovery = (matter.actualDamages ?? 0) + (matter.settlementAmount ?? 0);
        return recovery > (matter.actualCosts ?? 0);
      case 'stopped_infringement':
        return matter.status === 'resolved' || matter.status === 'settled';
      case 'settlement_achieved':
        return matter.status === 'settled';
    }
  }

  private calculateOverallSuccess(
    matters: MatterRecord[],
    criteria: SuccessCriteria
  ): { successCount: number; totalCases: number; successRate: number } {
    const successCount = matters.filter((m) => this.isSuccessful(m, criteria)).length;
    const successRate = matters.length > 0 ? Math.round((successCount / matters.length) * 100 * 10) / 10 : 0;

    return { successCount, totalCases: matters.length, successRate };
  }

  private calculateSuccessByDimension<T extends string>(
    matters: MatterRecord[],
    criteria: SuccessCriteria,
    getDimension: (matter: MatterRecord) => T
  ): SuccessRateByDimension<T>[] {
    const byDimension = new Map<T, MatterRecord[]>();

    for (const matter of matters) {
      const dimension = getDimension(matter);
      const existing = byDimension.get(dimension) ?? [];
      existing.push(matter);
      byDimension.set(dimension, existing);
    }

    return Array.from(byDimension.entries()).map(([dimension, dimensionMatters]) => {
      const { successCount, totalCases, successRate } = this.calculateOverallSuccess(dimensionMatters, criteria);
      return { dimension, successCount, totalCases, successRate };
    });
  }

  private calculateSuccessByOpposingParty(
    matters: MatterRecord[],
    parties: PartyRecord[],
    criteria: SuccessCriteria
  ): SuccessByOpposingParty[] {
    type PartyType = 'individual' | 'small_business' | 'corporation' | 'multinational' | 'unknown';

    // Classify parties by type
    const classifyParty = (party: PartyRecord | undefined): PartyType => {
      if (!party) return 'unknown';
      const org = party.organization?.toLowerCase() ?? '';
      if (org.includes('corporation') || org.includes('inc') || org.includes('llc')) {
        if (org.includes('international') || org.includes('global')) {
          return 'multinational';
        }
        return 'corporation';
      }
      if (org.includes('llp') || org.includes('company') || org.includes('co')) {
        return 'small_business';
      }
      if (!party.organization) {
        return 'individual';
      }
      return 'unknown';
    };

    const byPartyType = new Map<PartyType, { matters: MatterRecord[]; settlements: number[] }>();

    for (const matter of matters) {
      const infringer = parties.find(
        (p) => p.matterId === matter.id && (p.role === 'infringer' || p.role === 'defendant')
      );
      const partyType = classifyParty(infringer);

      const existing = byPartyType.get(partyType) ?? { matters: [], settlements: [] };
      existing.matters.push(matter);
      if (matter.settlementAmount) {
        existing.settlements.push(matter.settlementAmount);
      }
      byPartyType.set(partyType, existing);
    }

    return Array.from(byPartyType.entries()).map(([partyType, { matters: typeMatters, settlements }]) => {
      const { successCount, successRate } = this.calculateOverallSuccess(typeMatters, criteria);
      const averageSettlement = settlements.length > 0
        ? Math.round(settlements.reduce((a, b) => a + b, 0) / settlements.length)
        : 0;

      return {
        partyType,
        successCount,
        totalCases: typeMatters.length,
        successRate,
        averageSettlement,
      };
    });
  }

  private calculateSuccessTrends(
    matters: MatterRecord[],
    criteria: SuccessCriteria,
    granularity: AnalyticsPeriodGranularity
  ): SuccessRateTrendPoint[] {
    const byPeriod = new Map<string, MatterRecord[]>();

    for (const matter of matters) {
      const resolvedDate = matter.resolvedDate ? new Date(matter.resolvedDate) : null;
      if (!resolvedDate) continue;

      const periodKey = getPeriodKey(resolvedDate, granularity);
      const existing = byPeriod.get(periodKey) ?? [];
      existing.push(matter);
      byPeriod.set(periodKey, existing);
    }

    return Array.from(byPeriod.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([periodKey, periodMatters]) => {
        const { successRate } = this.calculateOverallSuccess(periodMatters, criteria);
        const range = getPeriodRange(periodKey, granularity);

        return {
          period: periodKey,
          periodStart: range.start,
          periodEnd: range.end,
          successRate,
          casesResolved: periodMatters.length,
        };
      });
  }

  // ==========================================================================
  // Trend Visualization Data
  // ==========================================================================

  /**
   * Get trend visualization data.
   */
  async getTrendVisualizationData(period: AnalyticsPeriod): Promise<TrendVisualizationData> {
    const granularity = period.granularity ?? 'month';
    const matters = await this.getMattersInPeriod(period);
    const actions = await this.getActionsForMatters(matters.map((m) => m.id));

    // Calculate case count trends
    const caseCounts = this.calculateCaseCountTrends(matters, granularity);

    // Calculate settlement trends
    const settlements = this.calculateSettlementTrends(matters, granularity);

    // Calculate cost trends
    const costs = this.calculateCostTrends(matters, actions, granularity);

    // Calculate resolution time trends
    const resolutionTimes = this.calculateResolutionTimeTrends(matters, granularity);

    // Calculate success rate trends
    const successRates = this.calculateSuccessTrends(
      matters.filter((m) => m.resolvedDate),
      'favorable_outcome',
      granularity
    );

    return {
      period,
      caseCounts,
      settlements,
      costs,
      resolutionTimes,
      successRates,
    };
  }

  private calculateCaseCountTrends(
    matters: MatterRecord[],
    granularity: AnalyticsPeriodGranularity
  ): CaseCountTrend[] {
    const openedByPeriod = new Map<string, number>();
    const closedByPeriod = new Map<string, number>();

    for (const matter of matters) {
      // Track opened
      if (matter.openedDate) {
        const periodKey = getPeriodKey(new Date(matter.openedDate), granularity);
        openedByPeriod.set(periodKey, (openedByPeriod.get(periodKey) ?? 0) + 1);
      }

      // Track closed
      if (matter.resolvedDate) {
        const periodKey = getPeriodKey(new Date(matter.resolvedDate), granularity);
        closedByPeriod.set(periodKey, (closedByPeriod.get(periodKey) ?? 0) + 1);
      }
    }

    const allPeriods = new Set([...openedByPeriod.keys(), ...closedByPeriod.keys()]);
    const sortedPeriods = Array.from(allPeriods).sort();

    let runningActive = 0;
    return sortedPeriods.map((periodKey) => {
      const opened = openedByPeriod.get(periodKey) ?? 0;
      const closed = closedByPeriod.get(periodKey) ?? 0;
      runningActive += opened - closed;

      const range = getPeriodRange(periodKey, granularity);

      return {
        period: periodKey,
        periodStart: range.start,
        periodEnd: range.end,
        opened,
        closed,
        netChange: opened - closed,
        activeAtEnd: runningActive,
      };
    });
  }

  private calculateSettlementTrends(
    matters: MatterRecord[],
    granularity: AnalyticsPeriodGranularity
  ): SettlementTrend[] {
    const byPeriod = new Map<string, { total: number; count: number }>();

    for (const matter of matters) {
      if (!matter.settlementAmount || !matter.resolvedDate) continue;

      const periodKey = getPeriodKey(new Date(matter.resolvedDate), granularity);
      const existing = byPeriod.get(periodKey) ?? { total: 0, count: 0 };
      existing.total += matter.settlementAmount;
      existing.count++;
      byPeriod.set(periodKey, existing);
    }

    return Array.from(byPeriod.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([periodKey, { total, count }]) => {
        const range = getPeriodRange(periodKey, granularity);

        return {
          period: periodKey,
          periodStart: range.start,
          periodEnd: range.end,
          totalAmount: total,
          averageAmount: count > 0 ? Math.round(total / count) : 0,
          count,
        };
      });
  }

  private calculateResolutionTimeTrends(
    matters: MatterRecord[],
    granularity: AnalyticsPeriodGranularity
  ): TrendDataPoint[] {
    const byPeriod = new Map<string, number[]>();

    for (const matter of matters) {
      if (!matter.openedDate || !matter.resolvedDate) continue;

      const periodKey = getPeriodKey(new Date(matter.resolvedDate), granularity);
      const duration = Math.ceil(
        (new Date(matter.resolvedDate).getTime() - new Date(matter.openedDate).getTime()) /
          (24 * 60 * 60 * 1000)
      );

      const existing = byPeriod.get(periodKey) ?? [];
      existing.push(duration);
      byPeriod.set(periodKey, existing);
    }

    return Array.from(byPeriod.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([periodKey, durations]) => {
        const range = getPeriodRange(periodKey, granularity);
        const average = durations.length > 0
          ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
          : 0;

        return {
          period: periodKey,
          periodStart: range.start,
          periodEnd: range.end,
          value: average,
          label: `${average} days`,
        };
      });
  }

  // ==========================================================================
  // Dashboard Summary
  // ==========================================================================

  /**
   * Get analytics summary for dashboard.
   */
  async getAnalyticsSummary(period: AnalyticsPeriod): Promise<EnforcementAnalyticsSummary> {
    const matters = await this.getMattersInPeriod(period);

    const activeCases = matters.filter((m) =>
      ['monitoring', 'investigation', 'cease_and_desist', 'negotiation', 'litigation'].includes(m.status)
    ).length;

    const closedThisPeriod = matters.filter(
      (m) =>
        ['settled', 'resolved', 'abandoned'].includes(m.status) &&
        m.resolvedDate &&
        new Date(m.resolvedDate) >= period.from &&
        new Date(m.resolvedDate) <= period.to
    ).length;

    const resolvedMatters = matters.filter(
      (m) => ['settled', 'resolved'].includes(m.status)
    );
    const wins = resolvedMatters.filter((m) => determineCaseOutcome(m) === 'win' || determineCaseOutcome(m) === 'settlement').length;
    const winRate = resolvedMatters.length > 0 ? Math.round((wins / resolvedMatters.length) * 100) : 0;

    // Calculate average resolution time
    const durations = resolvedMatters
      .filter((m) => m.openedDate && m.resolvedDate)
      .map((m) => {
        const opened = new Date(m.openedDate!);
        const resolved = new Date(m.resolvedDate!);
        return Math.ceil((resolved.getTime() - opened.getTime()) / (24 * 60 * 60 * 1000));
      });
    const averageResolutionDays = durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

    const totalCostsThisPeriod = matters.reduce((sum, m) => sum + (m.actualCosts ?? 0), 0);
    const totalRecoveriesThisPeriod = matters.reduce(
      (sum, m) => sum + (m.actualDamages ?? 0) + (m.settlementAmount ?? 0),
      0
    );

    const criticalCases = matters.filter((m) => m.priority === 'critical' &&
      ['monitoring', 'investigation', 'cease_and_desist', 'negotiation', 'litigation'].includes(m.status)
    ).length;

    // Simplified upcoming deadlines count
    const upcomingDeadlines = matters.filter((m) =>
      ['monitoring', 'investigation', 'cease_and_desist', 'negotiation', 'litigation'].includes(m.status)
    ).length;

    return {
      period,
      activeCases,
      closedThisPeriod,
      winRate,
      averageResolutionDays,
      totalCostsThisPeriod,
      totalRecoveriesThisPeriod,
      criticalCases,
      upcomingDeadlines,
    };
  }

  // ==========================================================================
  // Data Access Helpers
  // ==========================================================================

  private async getMattersInPeriod(period: AnalyticsPeriod): Promise<MatterRecord[]> {
    const results = await this.db
      .select()
      .from(enforcementMatters)
      .where(
        sql`${enforcementMatters.deletedAt} IS NULL
            AND (${enforcementMatters.createdAt} >= ${period.from.toISOString()}
                 OR ${enforcementMatters.updatedAt} >= ${period.from.toISOString()})
            AND ${enforcementMatters.createdAt} <= ${period.to.toISOString()}`
      );

    return results.map((r) => ({
      id: r.id,
      type: r.type,
      status: r.status,
      priority: r.priority,
      ipAssetType: r.ipAssetType,
      jurisdiction: r.jurisdiction,
      detectedDate: r.detectedDate,
      openedDate: r.openedDate,
      resolvedDate: r.resolvedDate,
      estimatedDamages: r.estimatedDamages,
      actualDamages: r.actualDamages,
      settlementAmount: r.settlementAmount,
      estimatedCosts: r.estimatedCosts,
      actualCosts: r.actualCosts,
      outcome: r.outcome,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  private async getResolvedMattersInPeriod(period: AnalyticsPeriod): Promise<MatterRecord[]> {
    const results = await this.db
      .select()
      .from(enforcementMatters)
      .where(
        sql`${enforcementMatters.deletedAt} IS NULL
            AND ${enforcementMatters.status} IN ('settled', 'resolved', 'abandoned')
            AND ${enforcementMatters.resolvedDate} >= ${period.from.toISOString().split('T')[0]}
            AND ${enforcementMatters.resolvedDate} <= ${period.to.toISOString().split('T')[0]}`
      );

    return results.map((r) => ({
      id: r.id,
      type: r.type,
      status: r.status,
      priority: r.priority,
      ipAssetType: r.ipAssetType,
      jurisdiction: r.jurisdiction,
      detectedDate: r.detectedDate,
      openedDate: r.openedDate,
      resolvedDate: r.resolvedDate,
      estimatedDamages: r.estimatedDamages,
      actualDamages: r.actualDamages,
      settlementAmount: r.settlementAmount,
      estimatedCosts: r.estimatedCosts,
      actualCosts: r.actualCosts,
      outcome: r.outcome,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  private async getActionsForMatters(matterIds: string[]): Promise<ActionRecord[]> {
    if (matterIds.length === 0) return [];

    const results = await this.db
      .select()
      .from(enforcementActions)
      .where(
        sql`${enforcementActions.deletedAt} IS NULL
            AND ${enforcementActions.matterId} IN (${sql.join(
          matterIds.map((id) => sql`${id}`),
          sql`, `
        )})`
      );

    return results.map((r) => ({
      id: r.id,
      matterId: r.matterId,
      actionType: r.actionType,
      status: r.status,
      cost: r.cost,
      createdAt: r.createdAt,
      completedDate: r.completedDate,
    }));
  }

  private async getPartiesForMatters(matterIds: string[]): Promise<PartyRecord[]> {
    if (matterIds.length === 0) return [];

    const results = await this.db
      .select()
      .from(enforcementParties)
      .where(
        sql`${enforcementParties.deletedAt} IS NULL
            AND ${enforcementParties.matterId} IN (${sql.join(
          matterIds.map((id) => sql`${id}`),
          sql`, `
        )})`
      );

    return results.map((r) => ({
      id: r.id,
      matterId: r.matterId,
      role: r.role,
      name: r.name,
      organization: r.organization,
      firmName: r.firmName,
    }));
  }
}

// ============================================================================
// Factory & Singleton
// ============================================================================

let enforcementAnalyticsServiceInstance: EnforcementAnalyticsService | null = null;

export function getEnforcementAnalyticsService(db: Database): EnforcementAnalyticsService {
  if (!enforcementAnalyticsServiceInstance) {
    enforcementAnalyticsServiceInstance = new EnforcementAnalyticsService(db);
  }
  return enforcementAnalyticsServiceInstance;
}

export const createEnforcementAnalyticsService = (db: Database): EnforcementAnalyticsService =>
  new EnforcementAnalyticsService(db);
