/**
 * Valuation Analytics Service
 *
 * Provides comprehensive analytics for IP valuations including:
 * - Portfolio value tracking over time
 * - Valuation change analysis (gainers/losers, reasons)
 * - Methodology comparison across the portfolio
 * - Impairment tracking and indicators
 * - Proactive alerts for revaluation and market changes
 *
 * @module application/services
 */

import { eq, and, isNull, desc, gte, lte, asc, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../infrastructure/persistence/schema.js';
import type { ValuationMethodology, ValuationPurpose } from '../../domain/entities/ip-valuation.entity.js';
import type {
  IPAssetType,
  TrendGranularity,
  ValuationChangeReason,
  ImpairmentReason,
  PortfolioValueSnapshot,
  PortfolioValueTrend,
  TrendDataPoint,
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
  AlertSeverity,
  ValuationAlertType,
} from './valuation-analytics-types.js';

// ============================================================================
// SERVICE INTERFACES
// ============================================================================

/**
 * Result of portfolio value calculation.
 */
export interface PortfolioValueResult {
  snapshot: PortfolioValueSnapshot;
  trend?: PortfolioValueTrend;
}

/**
 * Result of valuation change analysis.
 */
export interface ChangeAnalysisResult {
  analysis: ValuationChangeAnalysis;
  changes: ValuationChange[];
}

/**
 * Result of methodology comparison.
 */
export interface MethodologyComparisonResult {
  comparison: MethodologyComparison;
  recommendations: Array<{
    assetId: string;
    assetName: string;
    recommendedMethodology: ValuationMethodology;
    reason: string;
  }>;
}

/**
 * Result of impairment analysis.
 */
export interface ImpairmentAnalysisResult {
  summary: ImpairmentSummary;
  atRiskAssets: Array<{
    assetId: string;
    assetName: string;
    riskLevel: 'low' | 'medium' | 'high';
    indicators: string[];
  }>;
}

/**
 * Result of alert check.
 */
export interface AlertCheckResult {
  summary: ValuationAlertSummary;
  newAlerts: ValuationAlert[];
}

// ============================================================================
// VALUATION ANALYTICS SERVICE
// ============================================================================

/**
 * Valuation Analytics Service
 *
 * Analyzes IP valuations to provide insights on portfolio value,
 * trends, methodology effectiveness, and impairment risks.
 */
export class ValuationAnalyticsService {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {}

  // ==========================================================================
  // PORTFOLIO VALUE TRACKING
  // ==========================================================================

  /**
   * Get the current portfolio value snapshot.
   */
  async getPortfolioValueSnapshot(
    filters: ValuationAnalyticsFilters = {}
  ): Promise<PortfolioValueSnapshot> {
    const conditions = this.buildBaseConditions(filters);

    // Only count approved valuations for portfolio value
    conditions.push(eq(schema.ipValuations.status, 'approved'));

    const valuations = await this.db
      .select()
      .from(schema.ipValuations)
      .where(and(...conditions))
      .orderBy(desc(schema.ipValuations.valuationDate));

    // Get the most recent valuation for each asset
    const latestByAsset = new Map<string, typeof valuations[0]>();
    for (const v of valuations) {
      const assets = v.ipAssets as Array<{ type: string; id: string; name: string }>;
      for (const asset of assets) {
        const key = `${asset.type}:${asset.id}`;
        if (!latestByAsset.has(key)) {
          latestByAsset.set(key, v);
        }
      }
    }

    const uniqueValuations = Array.from(latestByAsset.values());
    const values = uniqueValuations
      .map(v => v.selectedValue)
      .filter((v): v is number => v !== null);

    // Calculate breakdown by asset type
    const valueByAssetType: Record<IPAssetType, number> = {
      patent: 0,
      trademark: 0,
      copyright: 0,
      trade_secret: 0,
      license: 0,
    };

    const valueByBusinessUnit: Record<string, number> = {};

    for (const v of uniqueValuations) {
      const assets = v.ipAssets as Array<{ type: string; id: string; name: string; weight?: number }>;
      const value = v.selectedValue ?? 0;

      for (const asset of assets) {
        const assetType = this.normalizeAssetType(asset.type);
        const weight = asset.weight ?? (1 / assets.length);
        const weightedValue = Math.round(value * weight);

        valueByAssetType[assetType] = (valueByAssetType[assetType] ?? 0) + weightedValue;
      }

      // Extract business unit from assumptions or metadata if available
      const assumptions = v.assumptions as Array<{ category: string; description: string; value?: string }>;
      const businessUnit = this.extractBusinessUnit(assumptions) ?? 'Unassigned';
      valueByBusinessUnit[businessUnit] = (valueByBusinessUnit[businessUnit] ?? 0) + value;
    }

    const totalValue = values.reduce((sum, v) => sum + v, 0);
    const sortedValues = [...values].sort((a, b) => a - b);

    return {
      snapshotDate: new Date(),
      totalValue,
      currency: filters.currency ?? 'USD',
      valueByAssetType,
      valueByBusinessUnit,
      assetCount: latestByAsset.size,
      valuationCount: uniqueValuations.length,
      averageAssetValue: values.length > 0 ? Math.round(totalValue / values.length) : 0,
      medianAssetValue: values.length > 0 ? sortedValues[Math.floor(sortedValues.length / 2)] : 0,
      topAssetsValue: sortedValues.slice(-10).reduce((sum, v) => sum + v, 0),
    };
  }

  /**
   * Get portfolio value trend over time.
   */
  async getPortfolioValueTrend(
    filters: ValuationAnalyticsFilters,
    granularity: TrendGranularity = 'monthly'
  ): Promise<PortfolioValueTrend> {
    const dateRange = filters.dateRange ?? this.getDefaultDateRange();
    const conditions = this.buildBaseConditions(filters);
    conditions.push(eq(schema.ipValuations.status, 'approved'));
    conditions.push(gte(schema.ipValuations.valuationDate, dateRange.startDate.toISOString().split('T')[0]));
    conditions.push(lte(schema.ipValuations.valuationDate, dateRange.endDate.toISOString().split('T')[0]));

    const valuations = await this.db
      .select()
      .from(schema.ipValuations)
      .where(and(...conditions))
      .orderBy(asc(schema.ipValuations.valuationDate));

    // Group valuations by period
    const periods = this.generatePeriods(dateRange.startDate, dateRange.endDate, granularity);
    const periodData = new Map<string, typeof valuations>();

    for (const v of valuations) {
      const periodKey = this.getPeriodKey(new Date(v.valuationDate), granularity);
      const existing = periodData.get(periodKey) ?? [];
      existing.push(v);
      periodData.set(periodKey, existing);
    }

    // Build trend data points
    const totalDataPoints: TrendDataPoint[] = [];
    const trendsByAssetType: Record<IPAssetType, TrendSeries> = {} as any;
    const trendsByBusinessUnit: Record<string, TrendSeries> = {};

    let runningTotal = 0;
    let minValue = Infinity;
    let maxValue = 0;
    let valueSum = 0;
    let count = 0;

    for (const period of periods) {
      const periodKey = this.getPeriodKey(period, granularity);
      const periodValuations = periodData.get(periodKey) ?? [];

      // Calculate period totals
      const periodTotal = periodValuations.reduce((sum, v) => sum + (v.selectedValue ?? 0), 0);
      runningTotal += periodTotal;

      totalDataPoints.push({
        date: period,
        value: runningTotal,
        label: periodKey,
      });

      minValue = Math.min(minValue, runningTotal);
      maxValue = Math.max(maxValue, runningTotal);
      valueSum += runningTotal;
      count++;
    }

    const startValue = totalDataPoints[0]?.value ?? 0;
    const endValue = totalDataPoints[totalDataPoints.length - 1]?.value ?? 0;

    return {
      periodStart: dateRange.startDate,
      periodEnd: dateRange.endDate,
      granularity,
      totalTrend: {
        id: 'total',
        name: 'Total Portfolio Value',
        dataPoints: totalDataPoints,
        totalChange: endValue - startValue,
        percentageChange: startValue > 0 ? ((endValue - startValue) / startValue) * 100 : 0,
      },
      trendsByAssetType,
      trendsByBusinessUnit,
      statistics: {
        startValue,
        endValue,
        minValue: minValue === Infinity ? 0 : minValue,
        maxValue,
        averageValue: count > 0 ? Math.round(valueSum / count) : 0,
        volatility: this.calculateVolatility(totalDataPoints.map(p => p.value)),
      },
    };
  }

  /**
   * Get historical portfolio value snapshots.
   */
  async getHistoricalSnapshots(
    dateRange: DateRangeFilter,
    granularity: TrendGranularity = 'monthly'
  ): Promise<PortfolioValueSnapshot[]> {
    const periods = this.generatePeriods(dateRange.startDate, dateRange.endDate, granularity);
    const snapshots: PortfolioValueSnapshot[] = [];

    for (let i = 0; i < periods.length; i++) {
      const asOfDate = periods[i];
      const snapshot = await this.getPortfolioValueSnapshot({
        dateRange: { startDate: new Date(0), endDate: asOfDate },
      });
      snapshot.snapshotDate = asOfDate;

      if (i > 0) {
        const previousSnapshot = snapshots[i - 1];
        snapshot.changeFromPrevious = {
          absoluteChange: snapshot.totalValue - previousSnapshot.totalValue,
          percentageChange: previousSnapshot.totalValue > 0
            ? ((snapshot.totalValue - previousSnapshot.totalValue) / previousSnapshot.totalValue) * 100
            : 0,
          periodDays: Math.round((asOfDate.getTime() - periods[i - 1].getTime()) / (1000 * 60 * 60 * 24)),
        };
      }

      snapshots.push(snapshot);
    }

    return snapshots;
  }

  // ==========================================================================
  // VALUATION CHANGE ANALYSIS
  // ==========================================================================

  /**
   * Analyze valuation changes over a period.
   */
  async analyzeValuationChanges(
    filters: ValuationAnalyticsFilters
  ): Promise<ValuationChangeAnalysis> {
    const dateRange = filters.dateRange ?? this.getDefaultDateRange();
    const conditions = this.buildBaseConditions(filters);
    conditions.push(gte(schema.ipValuations.valuationDate, dateRange.startDate.toISOString().split('T')[0]));
    conditions.push(lte(schema.ipValuations.valuationDate, dateRange.endDate.toISOString().split('T')[0]));

    const valuations = await this.db
      .select()
      .from(schema.ipValuations)
      .where(and(...conditions))
      .orderBy(asc(schema.ipValuations.valuationDate));

    // Group by asset to find sequential valuations
    const assetValuations = new Map<string, typeof valuations>();

    for (const v of valuations) {
      const assets = v.ipAssets as Array<{ type: string; id: string; name: string }>;
      for (const asset of assets) {
        const key = `${asset.type}:${asset.id}`;
        const existing = assetValuations.get(key) ?? [];
        existing.push(v);
        assetValuations.set(key, existing);
      }
    }

    // Calculate changes
    const changes: ValuationChange[] = [];
    const changesByReason: Record<ValuationChangeReason, { count: number; totalChange: number; averageChange: number }> = {} as any;
    const changesByAssetType: Record<IPAssetType, { count: number; totalChange: number; averageChange: number }> = {} as any;

    for (const [key, vals] of Array.from(assetValuations.entries())) {
      if (vals.length < 2) continue;

      const [assetType, assetId] = key.split(':');
      const sortedVals = vals.sort((a, b) =>
        new Date(a.valuationDate).getTime() - new Date(b.valuationDate).getTime()
      );

      for (let i = 1; i < sortedVals.length; i++) {
        const previous = sortedVals[i - 1];
        const current = sortedVals[i];

        if (previous.selectedValue === null || current.selectedValue === null) continue;

        const absoluteChange = current.selectedValue - previous.selectedValue;
        const percentageChange = previous.selectedValue > 0
          ? ((current.selectedValue - previous.selectedValue) / previous.selectedValue) * 100
          : 0;

        const primaryReason = this.determineChangeReason(previous, current);

        const change: ValuationChange = {
          valuationId: current.id,
          valuationNumber: current.valuationNumber ?? '',
          assetName: this.getAssetName(current),
          assetType: this.normalizeAssetType(assetType),
          previousValue: previous.selectedValue,
          currentValue: current.selectedValue,
          absoluteChange,
          percentageChange,
          previousDate: new Date(previous.valuationDate),
          currentDate: new Date(current.valuationDate),
          primaryReason,
          additionalReasons: [],
          previousMethodology: previous.methodology,
          currentMethodology: current.methodology,
          methodologyChanged: previous.methodology !== current.methodology,
          currency: current.currency,
        };

        changes.push(change);

        // Aggregate by reason
        if (!changesByReason[primaryReason]) {
          changesByReason[primaryReason] = { count: 0, totalChange: 0, averageChange: 0 };
        }
        changesByReason[primaryReason].count++;
        changesByReason[primaryReason].totalChange += absoluteChange;

        // Aggregate by asset type
        const normalizedType = this.normalizeAssetType(assetType);
        if (!changesByAssetType[normalizedType]) {
          changesByAssetType[normalizedType] = { count: 0, totalChange: 0, averageChange: 0 };
        }
        changesByAssetType[normalizedType].count++;
        changesByAssetType[normalizedType].totalChange += absoluteChange;
      }
    }

    // Calculate averages
    for (const reason of Object.keys(changesByReason) as ValuationChangeReason[]) {
      changesByReason[reason].averageChange = Math.round(
        changesByReason[reason].totalChange / changesByReason[reason].count
      );
    }
    for (const type of Object.keys(changesByAssetType) as IPAssetType[]) {
      changesByAssetType[type].averageChange = Math.round(
        changesByAssetType[type].totalChange / changesByAssetType[type].count
      );
    }

    // Sort changes for gainers/losers
    const sortedByAbsolute = [...changes].sort((a, b) => b.absoluteChange - a.absoluteChange);
    const sortedByPercentage = [...changes].sort((a, b) => b.percentageChange - a.percentageChange);

    const netValueChange = changes.reduce((sum, c) => sum + c.absoluteChange, 0);

    return {
      periodStart: dateRange.startDate,
      periodEnd: dateRange.endDate,
      totalRevaluations: changes.length,
      netValueChange,
      netPercentageChange: this.calculateNetPercentageChange(changes),
      largestGainers: sortedByAbsolute.slice(0, 10).filter(c => c.absoluteChange > 0),
      largestLosers: sortedByAbsolute.slice(-10).filter(c => c.absoluteChange < 0).reverse(),
      largestPercentageGainers: sortedByPercentage.slice(0, 10).filter(c => c.percentageChange > 0),
      largestPercentageLosers: sortedByPercentage.slice(-10).filter(c => c.percentageChange < 0).reverse(),
      changesByReason,
      changesByAssetType,
      revaluationTriggers: this.calculateRevaluationTriggers(changes),
    };
  }

  /**
   * Get detailed changes for a specific asset.
   */
  async getAssetValuationHistory(
    assetType: string,
    assetId: string
  ): Promise<ValuationChange[]> {
    const valuations = await this.db
      .select()
      .from(schema.ipValuations)
      .where(and(
        isNull(schema.ipValuations.deletedAt),
        sql`${schema.ipValuations.ipAssets}::jsonb @> ${JSON.stringify([{ type: assetType, id: assetId }])}::jsonb`
      ))
      .orderBy(asc(schema.ipValuations.valuationDate));

    const changes: ValuationChange[] = [];

    for (let i = 1; i < valuations.length; i++) {
      const previous = valuations[i - 1];
      const current = valuations[i];

      if (previous.selectedValue === null || current.selectedValue === null) continue;

      const absoluteChange = current.selectedValue - previous.selectedValue;
      const percentageChange = previous.selectedValue > 0
        ? ((current.selectedValue - previous.selectedValue) / previous.selectedValue) * 100
        : 0;

      changes.push({
        valuationId: current.id,
        valuationNumber: current.valuationNumber ?? '',
        assetName: this.getAssetName(current),
        assetType: this.normalizeAssetType(assetType),
        previousValue: previous.selectedValue,
        currentValue: current.selectedValue,
        absoluteChange,
        percentageChange,
        previousDate: new Date(previous.valuationDate),
        currentDate: new Date(current.valuationDate),
        primaryReason: this.determineChangeReason(previous, current),
        additionalReasons: [],
        previousMethodology: previous.methodology,
        currentMethodology: current.methodology,
        methodologyChanged: previous.methodology !== current.methodology,
        currency: current.currency,
      });
    }

    return changes;
  }

  // ==========================================================================
  // METHODOLOGY COMPARISON
  // ==========================================================================

  /**
   * Compare valuation methodologies across the portfolio.
   */
  async compareMethodologies(
    filters: ValuationAnalyticsFilters = {}
  ): Promise<MethodologyComparison> {
    const conditions = this.buildBaseConditions(filters);

    const valuations = await this.db
      .select()
      .from(schema.ipValuations)
      .where(and(...conditions))
      .orderBy(desc(schema.ipValuations.valuationDate));

    // Calculate methodology distribution
    const methodologyDistribution: MethodologyComparison['methodologyDistribution'] = {} as any;
    const methodologyByAssetType: Record<IPAssetType, Record<ValuationMethodology, number>> = {} as any;
    const methodologyByPurpose: Record<ValuationPurpose, Record<ValuationMethodology, number>> = {} as any;

    for (const v of valuations) {
      const methodology = v.methodology;
      const value = v.selectedValue ?? 0;

      if (!methodologyDistribution[methodology]) {
        methodologyDistribution[methodology] = { count: 0, percentage: 0, totalValue: 0, averageValue: 0 };
      }
      methodologyDistribution[methodology].count++;
      methodologyDistribution[methodology].totalValue += value;

      // By asset type
      const assets = v.ipAssets as Array<{ type: string; id: string }>;
      for (const asset of assets) {
        const assetType = this.normalizeAssetType(asset.type);
        if (!methodologyByAssetType[assetType]) {
          methodologyByAssetType[assetType] = {} as any;
        }
        methodologyByAssetType[assetType][methodology] =
          (methodologyByAssetType[assetType][methodology] ?? 0) + 1;
      }

      // By purpose
      const purpose = v.purpose;
      if (!methodologyByPurpose[purpose]) {
        methodologyByPurpose[purpose] = {} as any;
      }
      methodologyByPurpose[purpose][methodology] =
        (methodologyByPurpose[purpose][methodology] ?? 0) + 1;
    }

    // Calculate percentages and averages
    const totalValuations = valuations.length;
    for (const methodology of Object.keys(methodologyDistribution) as ValuationMethodology[]) {
      const dist = methodologyDistribution[methodology];
      dist.percentage = totalValuations > 0 ? (dist.count / totalValuations) * 100 : 0;
      dist.averageValue = dist.count > 0 ? Math.round(dist.totalValue / dist.count) : 0;
    }

    // Find assets with multiple methodology valuations
    const assetValuations = new Map<string, typeof valuations>();
    for (const v of valuations) {
      const assets = v.ipAssets as Array<{ type: string; id: string; name: string }>;
      for (const asset of assets) {
        const key = `${asset.type}:${asset.id}`;
        const existing = assetValuations.get(key) ?? [];
        existing.push(v);
        assetValuations.set(key, existing);
      }
    }

    const assetsWithMultipleMethodologies: AssetMethodologyComparison[] = [];
    let totalVariance = 0;
    let varianceCount = 0;

    for (const [key, vals] of Array.from(assetValuations.entries())) {
      const methodologies = new Set(vals.map(v => v.methodology));
      if (methodologies.size > 1) {
        const [assetType, assetId] = key.split(':');
        const assetName = this.getAssetName(vals[0]);

        const valuationsByMethodology: Record<ValuationMethodology, any[]> = {} as any;
        const latestValueByMethodology: Record<ValuationMethodology, number> = {} as any;

        for (const v of vals) {
          if (!valuationsByMethodology[v.methodology]) {
            valuationsByMethodology[v.methodology] = [];
          }
          valuationsByMethodology[v.methodology].push({
            valuationId: v.id,
            methodology: v.methodology,
            selectedValue: v.selectedValue ?? 0,
            lowValue: v.lowValue ?? undefined,
            highValue: v.highValue ?? undefined,
            valuationDate: new Date(v.valuationDate),
            purpose: v.purpose,
          });
          latestValueByMethodology[v.methodology] = v.selectedValue ?? 0;
        }

        const values = Object.values(latestValueByMethodology);
        const minValue = Math.min(...values);
        const maxValue = Math.max(...values);
        const range = maxValue - minValue;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
        const standardDeviation = Math.sqrt(variance);

        const rangePercentage = mean > 0 ? (range / mean) * 100 : 0;
        totalVariance += rangePercentage;
        varianceCount++;

        assetsWithMultipleMethodologies.push({
          assetId,
          assetName,
          assetType: this.normalizeAssetType(assetType),
          valuationsByMethodology,
          latestValueByMethodology,
          methodologyVariance: {
            minValue,
            maxValue,
            range,
            rangePercentage,
            standardDeviation,
          },
        });
      }
    }

    return {
      analysisDate: new Date(),
      totalAssetsAnalyzed: assetValuations.size,
      methodologyDistribution,
      assetsWithMultipleMethodologies,
      averageMethodologyVariance: varianceCount > 0 ? totalVariance / varianceCount : 0,
      methodologyByAssetType,
      methodologyByPurpose,
    };
  }

  // ==========================================================================
  // IMPAIRMENT TRACKING
  // ==========================================================================

  /**
   * Get impairment summary for a period.
   */
  async getImpairmentSummary(
    filters: ValuationAnalyticsFilters = {}
  ): Promise<ImpairmentSummary> {
    const dateRange = filters.dateRange ?? this.getDefaultDateRange();

    // Find valuations where value decreased significantly (indicating impairment)
    const conditions = this.buildBaseConditions(filters);
    conditions.push(gte(schema.ipValuations.valuationDate, dateRange.startDate.toISOString().split('T')[0]));
    conditions.push(lte(schema.ipValuations.valuationDate, dateRange.endDate.toISOString().split('T')[0]));

    const valuations = await this.db
      .select()
      .from(schema.ipValuations)
      .where(and(...conditions))
      .orderBy(asc(schema.ipValuations.valuationDate));

    // Analyze for impairments (value decreases > 10%)
    const events: ImpairmentEvent[] = [];
    const impairmentsByMonth = new Map<string, { month: Date; count: number; amount: number }>();
    const impairmentsByReason: ImpairmentSummary['impairmentsByReason'] = {} as any;
    const impairmentsByAssetType: ImpairmentSummary['impairmentsByAssetType'] = {} as any;

    const assetValuations = new Map<string, typeof valuations>();
    for (const v of valuations) {
      const assets = v.ipAssets as Array<{ type: string; id: string; name: string }>;
      for (const asset of assets) {
        const key = `${asset.type}:${asset.id}`;
        const existing = assetValuations.get(key) ?? [];
        existing.push(v);
        assetValuations.set(key, existing);
      }
    }

    let eventId = 0;
    for (const [key, vals] of Array.from(assetValuations.entries())) {
      const [assetType, assetId] = key.split(':');
      const sortedVals = vals.sort((a, b) =>
        new Date(a.valuationDate).getTime() - new Date(b.valuationDate).getTime()
      );

      for (let i = 1; i < sortedVals.length; i++) {
        const previous = sortedVals[i - 1];
        const current = sortedVals[i];

        if (!previous.selectedValue || !current.selectedValue) continue;

        const decrease = previous.selectedValue - current.selectedValue;
        const decreasePercent = (decrease / previous.selectedValue) * 100;

        // Consider > 10% decrease as potential impairment
        if (decreasePercent > 10) {
          const impairmentAmount = decrease;
          const reason = this.determineImpairmentReason(previous, current);
          const monthKey = `${new Date(current.valuationDate).getFullYear()}-${new Date(current.valuationDate).getMonth() + 1}`;

          const event: ImpairmentEvent = {
            id: `IMP-${++eventId}`,
            valuationId: current.id,
            assetId,
            assetName: this.getAssetName(current),
            assetType: this.normalizeAssetType(assetType),
            impairmentDate: new Date(current.valuationDate),
            carryingValueBefore: previous.selectedValue,
            fairValueAtImpairment: current.selectedValue,
            impairmentAmount,
            impairmentPercentage: decreasePercent,
            primaryReason: reason,
            additionalFactors: [],
            reversible: reason !== 'asset_damage' && reason !== 'abandonment',
          };

          events.push(event);

          // Aggregate by month
          if (!impairmentsByMonth.has(monthKey)) {
            impairmentsByMonth.set(monthKey, {
              month: new Date(current.valuationDate),
              count: 0,
              amount: 0,
            });
          }
          const monthData = impairmentsByMonth.get(monthKey)!;
          monthData.count++;
          monthData.amount += impairmentAmount;

          // Aggregate by reason
          if (!impairmentsByReason[reason]) {
            impairmentsByReason[reason] = { count: 0, totalAmount: 0, percentage: 0 };
          }
          impairmentsByReason[reason].count++;
          impairmentsByReason[reason].totalAmount += impairmentAmount;

          // Aggregate by asset type
          const normalizedType = this.normalizeAssetType(assetType);
          if (!impairmentsByAssetType[normalizedType]) {
            impairmentsByAssetType[normalizedType] = { count: 0, totalAmount: 0, percentage: 0 };
          }
          impairmentsByAssetType[normalizedType].count++;
          impairmentsByAssetType[normalizedType].totalAmount += impairmentAmount;
        }
      }
    }

    const totalImpairmentAmount = events.reduce((sum, e) => sum + e.impairmentAmount, 0);

    // Calculate percentages
    for (const reason of Object.keys(impairmentsByReason) as ImpairmentReason[]) {
      impairmentsByReason[reason].percentage = events.length > 0
        ? (impairmentsByReason[reason].count / events.length) * 100
        : 0;
    }
    for (const type of Object.keys(impairmentsByAssetType) as IPAssetType[]) {
      impairmentsByAssetType[type].percentage = events.length > 0
        ? (impairmentsByAssetType[type].count / events.length) * 100
        : 0;
    }

    // Identify assets with impairment indicators
    const assetsWithIndicators = await this.identifyImpairmentIndicators(filters);

    return {
      periodStart: dateRange.startDate,
      periodEnd: dateRange.endDate,
      totalEvents: events.length,
      totalImpairmentAmount,
      averageImpairmentAmount: events.length > 0 ? Math.round(totalImpairmentAmount / events.length) : 0,
      impairmentsByMonth: Array.from(impairmentsByMonth.values()).sort((a, b) =>
        a.month.getTime() - b.month.getTime()
      ),
      impairmentsByReason,
      impairmentsByAssetType,
      assetsWithIndicators,
      events,
    };
  }

  /**
   * Identify assets with impairment indicators.
   */
  private async identifyImpairmentIndicators(
    filters: ValuationAnalyticsFilters
  ): Promise<ImpairmentSummary['assetsWithIndicators']> {
    const conditions = this.buildBaseConditions(filters);
    conditions.push(eq(schema.ipValuations.status, 'approved'));

    const valuations = await this.db
      .select()
      .from(schema.ipValuations)
      .where(and(...conditions))
      .orderBy(desc(schema.ipValuations.valuationDate));

    const indicators: ImpairmentSummary['assetsWithIndicators'] = [];
    const seen = new Set<string>();

    for (const v of valuations) {
      const assets = v.ipAssets as Array<{ type: string; id: string; name: string }>;

      for (const asset of assets) {
        const key = `${asset.type}:${asset.id}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const assetIndicators: string[] = [];
        let riskLevel: 'low' | 'medium' | 'high' = 'low';

        // Check for old valuation (> 2 years)
        const valuationAge = (Date.now() - new Date(v.valuationDate).getTime()) / (1000 * 60 * 60 * 24 * 365);
        if (valuationAge > 2) {
          assetIndicators.push('Valuation older than 2 years');
          riskLevel = 'medium';
        }

        // Check for expiration approaching (if applicable)
        if (v.expirationDate) {
          const daysUntilExpiration = (new Date(v.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
          if (daysUntilExpiration < 180) {
            assetIndicators.push('Valuation expiring within 6 months');
            riskLevel = riskLevel === 'medium' ? 'high' : 'medium';
          }
        }

        // Check for significant uncertainty (high variance)
        if (v.lowValue && v.highValue && v.midValue) {
          const range = v.highValue - v.lowValue;
          const rangePercent = (range / v.midValue) * 100;
          if (rangePercent > 50) {
            assetIndicators.push('High valuation uncertainty (>50% range)');
            riskLevel = riskLevel === 'low' ? 'medium' : 'high';
          }
        }

        if (assetIndicators.length > 0) {
          indicators.push({
            assetId: asset.id,
            assetName: asset.name,
            assetType: this.normalizeAssetType(asset.type),
            indicators: assetIndicators,
            estimatedImpairmentRisk: riskLevel,
          });
        }
      }
    }

    return indicators;
  }

  // ==========================================================================
  // VALUATION ALERTS
  // ==========================================================================

  /**
   * Get valuation alerts summary.
   */
  async getValuationAlerts(
    filters: ValuationAnalyticsFilters = {}
  ): Promise<ValuationAlertSummary> {
    const conditions = this.buildBaseConditions(filters);
    conditions.push(eq(schema.ipValuations.status, 'approved'));

    const valuations = await this.db
      .select()
      .from(schema.ipValuations)
      .where(and(...conditions))
      .orderBy(desc(schema.ipValuations.valuationDate));

    const alerts: ValuationAlert[] = [];
    let alertId = 0;
    const now = new Date();

    for (const v of valuations) {
      const assets = v.ipAssets as Array<{ type: string; id: string; name: string }>;
      const assetName = this.getAssetName(v);
      const assetType = assets[0] ? this.normalizeAssetType(assets[0].type) : undefined;

      // Check for revaluation due (> 1 year since last valuation)
      const daysSinceValuation = (now.getTime() - new Date(v.valuationDate).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceValuation > 365) {
        const daysOverdue = Math.round(daysSinceValuation - 365);
        alerts.push({
          id: `ALERT-${++alertId}`,
          type: 'revaluation_due',
          severity: daysOverdue > 180 ? 'high' : daysOverdue > 90 ? 'medium' : 'low',
          title: `Revaluation overdue: ${assetName}`,
          description: `Last valuation was ${Math.round(daysSinceValuation)} days ago. Annual revaluation recommended.`,
          assetName,
          assetType,
          valuationId: v.id,
          createdAt: now,
          dueDate: new Date(new Date(v.valuationDate).getTime() + 365 * 24 * 60 * 60 * 1000),
          daysUntilDue: -daysOverdue,
          acknowledged: false,
          recommendedAction: 'Schedule revaluation analysis',
        });
      }

      // Check for expiration approaching
      if (v.expirationDate) {
        const daysUntilExpiration = (new Date(v.expirationDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        if (daysUntilExpiration > 0 && daysUntilExpiration < 90) {
          alerts.push({
            id: `ALERT-${++alertId}`,
            type: 'expiration_approaching',
            severity: daysUntilExpiration < 30 ? 'high' : 'medium',
            title: `Valuation expiring soon: ${assetName}`,
            description: `Valuation expires in ${Math.round(daysUntilExpiration)} days.`,
            assetName,
            assetType,
            valuationId: v.id,
            createdAt: now,
            dueDate: new Date(v.expirationDate),
            daysUntilDue: Math.round(daysUntilExpiration),
            acknowledged: false,
            recommendedAction: 'Initiate revaluation before expiration',
          });
        }
      }

      // Check for end of useful life (based on projection years)
      if (v.projectionYears && v.valuationDate) {
        const usefulLifeEnd = new Date(v.valuationDate);
        usefulLifeEnd.setFullYear(usefulLifeEnd.getFullYear() + v.projectionYears);
        const daysUntilEnd = (usefulLifeEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

        if (daysUntilEnd > 0 && daysUntilEnd < 365) {
          alerts.push({
            id: `ALERT-${++alertId}`,
            type: 'end_of_useful_life_approaching',
            severity: daysUntilEnd < 90 ? 'high' : daysUntilEnd < 180 ? 'medium' : 'low',
            title: `End of useful life approaching: ${assetName}`,
            description: `Useful life ends in ${Math.round(daysUntilEnd)} days based on ${v.projectionYears}-year projection.`,
            assetName,
            assetType,
            valuationId: v.id,
            createdAt: now,
            dueDate: usefulLifeEnd,
            daysUntilDue: Math.round(daysUntilEnd),
            acknowledged: false,
            recommendedAction: 'Review asset strategy and potential extension or disposition',
          });
        }
      }
    }

    // Sort alerts by severity and due date
    alerts.sort((a, b) => {
      const severityOrder: Record<AlertSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return (a.daysUntilDue ?? 999) - (b.daysUntilDue ?? 999);
    });

    // Calculate summary
    const bySeverity: Record<AlertSeverity, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    const byType: Record<ValuationAlertType, number> = {} as any;

    for (const alert of alerts) {
      bySeverity[alert.severity]++;
      byType[alert.type] = (byType[alert.type] ?? 0) + 1;
    }

    return {
      totalAlerts: alerts.length,
      bySeverity,
      byType,
      criticalAlerts: alerts.filter(a => a.severity === 'critical'),
      alertsDueThisWeek: alerts.filter(a => a.daysUntilDue !== undefined && a.daysUntilDue <= 7 && a.daysUntilDue > 0),
      alertsDueThisMonth: alerts.filter(a => a.daysUntilDue !== undefined && a.daysUntilDue <= 30 && a.daysUntilDue > 0),
      overdueAlerts: alerts.filter(a => a.daysUntilDue !== undefined && a.daysUntilDue < 0),
      allAlerts: alerts,
    };
  }

  /**
   * Get alerts for a specific asset.
   */
  async getAssetAlerts(
    assetType: string,
    assetId: string
  ): Promise<ValuationAlert[]> {
    const summary = await this.getValuationAlerts({});
    return summary.allAlerts.filter(a =>
      a.metadata?.assetId === assetId ||
      (a.assetType === this.normalizeAssetType(assetType))
    );
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /**
   * Build base query conditions from filters.
   */
  private buildBaseConditions(filters: ValuationAnalyticsFilters): any[] {
    const conditions: any[] = [isNull(schema.ipValuations.deletedAt)];

    if (filters.methodologies?.length) {
      conditions.push(sql`${schema.ipValuations.methodology} = ANY(${filters.methodologies})`);
    }

    if (filters.purposes?.length) {
      conditions.push(sql`${schema.ipValuations.purpose} = ANY(${filters.purposes})`);
    }

    if (filters.minValue !== undefined) {
      conditions.push(gte(schema.ipValuations.selectedValue, filters.minValue));
    }

    if (filters.maxValue !== undefined) {
      conditions.push(lte(schema.ipValuations.selectedValue, filters.maxValue));
    }

    if (filters.approvedOnly) {
      conditions.push(eq(schema.ipValuations.status, 'approved'));
    }

    return conditions;
  }

  /**
   * Get default date range (last 12 months).
   */
  private getDefaultDateRange(): DateRangeFilter {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1);
    return { startDate, endDate };
  }

  /**
   * Normalize asset type to IPAssetType.
   */
  private normalizeAssetType(type: string): IPAssetType {
    const normalized = type.toLowerCase().replace(/[_\s-]/g, '_');
    if (['patent', 'trademark', 'copyright', 'trade_secret', 'license'].includes(normalized)) {
      return normalized as IPAssetType;
    }
    return 'patent'; // Default
  }

  /**
   * Extract business unit from assumptions.
   */
  private extractBusinessUnit(assumptions: Array<{ category: string; description: string; value?: string }>): string | undefined {
    const businessUnitAssumption = assumptions?.find(
      a => a.category.toLowerCase().includes('business') || a.category.toLowerCase().includes('unit')
    );
    return businessUnitAssumption?.value;
  }

  /**
   * Get asset name from valuation.
   */
  private getAssetName(valuation: { title: string; ipAssets: unknown }): string {
    const assets = valuation.ipAssets as Array<{ type: string; id: string; name: string }>;
    if (assets.length === 1) {
      return assets[0].name;
    }
    return valuation.title;
  }

  /**
   * Determine the primary reason for valuation change.
   */
  private determineChangeReason(
    previous: typeof schema.ipValuations.$inferSelect,
    current: typeof schema.ipValuations.$inferSelect
  ): ValuationChangeReason {
    if (previous.methodology !== current.methodology) {
      return 'methodology_change';
    }

    const previousValue = previous.selectedValue ?? 0;
    const currentValue = current.selectedValue ?? 0;
    const changePercent = Math.abs((currentValue - previousValue) / previousValue) * 100;

    if (changePercent > 20) {
      if (currentValue < previousValue) {
        return 'impairment';
      }
      return 'market_conditions';
    }

    return 'revaluation_scheduled';
  }

  /**
   * Determine impairment reason.
   */
  private determineImpairmentReason(
    _previous: typeof schema.ipValuations.$inferSelect,
    _current: typeof schema.ipValuations.$inferSelect
  ): ImpairmentReason {
    // In a real implementation, this would analyze assumptions and notes
    return 'market_decline';
  }

  /**
   * Calculate net percentage change from a list of changes.
   */
  private calculateNetPercentageChange(changes: ValuationChange[]): number {
    if (changes.length === 0) return 0;

    const totalPrevious = changes.reduce((sum, c) => sum + c.previousValue, 0);
    const totalCurrent = changes.reduce((sum, c) => sum + c.currentValue, 0);

    return totalPrevious > 0 ? ((totalCurrent - totalPrevious) / totalPrevious) * 100 : 0;
  }

  /**
   * Calculate revaluation triggers summary.
   */
  private calculateRevaluationTriggers(changes: ValuationChange[]): Array<{
    trigger: string;
    count: number;
    percentage: number;
  }> {
    const triggers = new Map<string, number>();

    for (const change of changes) {
      const trigger = change.primaryReason;
      triggers.set(trigger, (triggers.get(trigger) ?? 0) + 1);
    }

    return Array.from(triggers.entries()).map(([trigger, count]) => ({
      trigger,
      count,
      percentage: changes.length > 0 ? (count / changes.length) * 100 : 0,
    })).sort((a, b) => b.count - a.count);
  }

  /**
   * Generate period dates for trend analysis.
   */
  private generatePeriods(start: Date, end: Date, granularity: TrendGranularity): Date[] {
    const periods: Date[] = [];
    const current = new Date(start);

    while (current <= end) {
      periods.push(new Date(current));

      switch (granularity) {
        case 'daily':
          current.setDate(current.getDate() + 1);
          break;
        case 'weekly':
          current.setDate(current.getDate() + 7);
          break;
        case 'monthly':
          current.setMonth(current.getMonth() + 1);
          break;
        case 'quarterly':
          current.setMonth(current.getMonth() + 3);
          break;
        case 'yearly':
          current.setFullYear(current.getFullYear() + 1);
          break;
      }
    }

    return periods;
  }

  /**
   * Get period key for grouping.
   */
  private getPeriodKey(date: Date, granularity: TrendGranularity): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const week = this.getWeekNumber(date);

    switch (granularity) {
      case 'daily':
        return `${year}-${month}-${day}`;
      case 'weekly':
        return `${year}-W${week.toString().padStart(2, '0')}`;
      case 'monthly':
        return `${year}-${month}`;
      case 'quarterly':
        const quarter = Math.ceil((date.getMonth() + 1) / 3);
        return `${year}-Q${quarter}`;
      case 'yearly':
        return `${year}`;
    }
  }

  /**
   * Get ISO week number.
   */
  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  /**
   * Calculate volatility (standard deviation of returns).
   */
  private calculateVolatility(values: number[]): number {
    if (values.length < 2) return 0;

    const returns: number[] = [];
    for (let i = 1; i < values.length; i++) {
      if (values[i - 1] > 0) {
        returns.push((values[i] - values[i - 1]) / values[i - 1]);
      }
    }

    if (returns.length === 0) return 0;

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;

    return Math.sqrt(variance) * 100; // Return as percentage
  }
}

// Export singleton factory
export function createValuationAnalyticsService(
  db: PostgresJsDatabase<typeof schema>
): ValuationAnalyticsService {
  return new ValuationAnalyticsService(db);
}
