/**
 * Forecast Accuracy Tracking Service
 *
 * Tracks and analyzes forecast accuracy against actuals.
 * Target: 5% MAPE at 30-day horizon.
 *
 * @module services/forecasting
 */

import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../../infrastructure/database.js';

const logger = pino({ name: 'forecast-accuracy-service' });

/**
 * Forecast accuracy metrics.
 */
export interface AccuracyMetrics {
  forecastId: string;
  entityId: string;
  period: string;
  forecastDate: string;
  horizon: number; // days
  forecastedInflows: number;
  actualInflows: number;
  forecastedOutflows: number;
  actualOutflows: number;
  forecastedBalance: number;
  actualBalance: number;
  inflowVariance: number;
  inflowVariancePercent: number;
  outflowVariance: number;
  outflowVariancePercent: number;
  balanceVariance: number;
  balanceVariancePercent: number;
  mape: number; // Mean Absolute Percentage Error
  meetsTarget: boolean; // 5% MAPE target
  trackedAt: Date;
}

/**
 * Aggregate accuracy summary.
 */
export interface AccuracySummary {
  entityId: string;
  period: string;
  horizon: number;
  forecastCount: number;
  averageMape: number;
  medianMape: number;
  bestMape: number;
  worstMape: number;
  targetMet: number;
  targetMissed: number;
  targetComplianceRate: number;
  trend: 'improving' | 'stable' | 'declining';
  insights: string[];
}

/**
 * Forecast Accuracy Service
 */
export class ForecastAccuracyService {
  private readonly TARGET_MAPE = 5.0; // 5% MAPE target

  /**
   * Track accuracy for a specific forecast against actuals.
   */
  async trackAccuracy(
    forecastId: string,
    actuals: {
      inflows: number;
      outflows: number;
      balance: number;
      asOfDate: string;
    }
  ): Promise<AccuracyMetrics> {
    const pool = await getPool();

    // Get the original forecast
    const forecastResult = await pool.query(`
      SELECT
        f.*,
        EXTRACT(DAY FROM ($1::date - f.created_at::date)) as horizon
      FROM banking.cash_forecasts f
      WHERE f.id = $2
    `, [actuals.asOfDate, forecastId]);

    if (forecastResult.rows.length === 0) {
      throw new Error(`Forecast not found: ${forecastId}`);
    }

    const forecast = forecastResult.rows[0];

    // Calculate variances
    const forecastedInflows = parseFloat(forecast.projected_inflows);
    const forecastedOutflows = parseFloat(forecast.projected_outflows);
    const forecastedBalance = parseFloat(forecast.projected_balance);

    const inflowVariance = actuals.inflows - forecastedInflows;
    const outflowVariance = actuals.outflows - forecastedOutflows;
    const balanceVariance = actuals.balance - forecastedBalance;

    const inflowVariancePercent = forecastedInflows !== 0
      ? (inflowVariance / forecastedInflows) * 100
      : 0;
    const outflowVariancePercent = forecastedOutflows !== 0
      ? (outflowVariance / forecastedOutflows) * 100
      : 0;
    const balanceVariancePercent = forecastedBalance !== 0
      ? (balanceVariance / forecastedBalance) * 100
      : 0;

    // Calculate MAPE (Mean Absolute Percentage Error)
    // Using balance as the primary metric
    const mape = Math.abs(balanceVariancePercent);

    const metrics: AccuracyMetrics = {
      forecastId,
      entityId: forecast.entity_id,
      period: forecast.period,
      forecastDate: forecast.created_at.toISOString().split('T')[0],
      horizon: parseInt(forecast.horizon),
      forecastedInflows,
      actualInflows: actuals.inflows,
      forecastedOutflows,
      actualOutflows: actuals.outflows,
      forecastedBalance,
      actualBalance: actuals.balance,
      inflowVariance,
      inflowVariancePercent,
      outflowVariance,
      outflowVariancePercent,
      balanceVariance,
      balanceVariancePercent,
      mape,
      meetsTarget: mape <= this.TARGET_MAPE,
      trackedAt: new Date(),
    };

    // Store accuracy metrics
    const accuracyId = uuidv4();
    await pool.query(`
      INSERT INTO banking.forecast_accuracy (
        id, forecast_id, entity_id, period, horizon,
        forecasted_balance, actual_balance, variance, variance_percent, mape,
        meets_target, tracked_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
    `, [
      accuracyId,
      forecastId,
      forecast.entity_id,
      forecast.period,
      metrics.horizon,
      forecastedBalance,
      actuals.balance,
      balanceVariance,
      balanceVariancePercent,
      mape,
      metrics.meetsTarget,
    ]);

    logger.info({
      forecastId,
      entityId: forecast.entity_id,
      mape,
      meetsTarget: metrics.meetsTarget,
    }, 'Forecast accuracy tracked');

    return metrics;
  }

  /**
   * Get accuracy summary for an entity.
   */
  async getAccuracySummary(
    entityId: string,
    period?: string,
    horizon?: number,
    lookbackDays = 90
  ): Promise<AccuracySummary> {
    const pool = await getPool();

    let query = `
      SELECT
        mape,
        meets_target,
        tracked_at,
        period,
        horizon
      FROM banking.forecast_accuracy
      WHERE entity_id = $1
        AND tracked_at >= NOW() - $2::interval
    `;
    const params: unknown[] = [entityId, `${lookbackDays} days`];
    let paramIndex = 3;

    if (period) {
      query += ` AND period = $${paramIndex++}`;
      params.push(period);
    }
    if (horizon) {
      query += ` AND horizon <= $${paramIndex++}`;
      params.push(horizon);
    }

    query += ' ORDER BY tracked_at';

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return {
        entityId,
        period: period || 'all',
        horizon: horizon || 30,
        forecastCount: 0,
        averageMape: 0,
        medianMape: 0,
        bestMape: 0,
        worstMape: 0,
        targetMet: 0,
        targetMissed: 0,
        targetComplianceRate: 0,
        trend: 'stable',
        insights: ['No forecast data available for analysis'],
      };
    }

    const mapeValues = result.rows.map(r => parseFloat(r.mape));
    const sortedMape = [...mapeValues].sort((a, b) => a - b);

    const targetMet = result.rows.filter(r => r.meets_target).length;
    const targetMissed = result.rows.length - targetMet;

    // Calculate trend (compare recent 30 days vs previous 30 days)
    const midpoint = Math.floor(result.rows.length / 2);
    const firstHalfAvg = mapeValues.slice(0, midpoint).reduce((a, b) => a + b, 0) / midpoint || 0;
    const secondHalfAvg = mapeValues.slice(midpoint).reduce((a, b) => a + b, 0) / (mapeValues.length - midpoint) || 0;

    let trend: 'improving' | 'stable' | 'declining';
    const trendThreshold = 0.5; // 0.5% difference threshold
    if (secondHalfAvg < firstHalfAvg - trendThreshold) {
      trend = 'improving';
    } else if (secondHalfAvg > firstHalfAvg + trendThreshold) {
      trend = 'declining';
    } else {
      trend = 'stable';
    }

    // Generate insights
    const insights: string[] = [];
    const avgMape = mapeValues.reduce((a, b) => a + b, 0) / mapeValues.length;

    if (avgMape <= this.TARGET_MAPE) {
      insights.push(`Forecasting accuracy meets target (${avgMape.toFixed(2)}% MAPE vs ${this.TARGET_MAPE}% target)`);
    } else {
      insights.push(`Forecasting accuracy below target (${avgMape.toFixed(2)}% MAPE vs ${this.TARGET_MAPE}% target)`);
    }

    if (trend === 'improving') {
      insights.push('Forecast accuracy is improving over time');
    } else if (trend === 'declining') {
      insights.push('Forecast accuracy has been declining - consider reviewing forecasting model');
    }

    const complianceRate = (targetMet / result.rows.length) * 100;
    if (complianceRate < 80) {
      insights.push(`Only ${complianceRate.toFixed(1)}% of forecasts meet the target - model tuning recommended`);
    }

    return {
      entityId,
      period: period || 'all',
      horizon: horizon || 30,
      forecastCount: result.rows.length,
      averageMape: avgMape,
      medianMape: sortedMape[Math.floor(sortedMape.length / 2)],
      bestMape: sortedMape[0],
      worstMape: sortedMape[sortedMape.length - 1],
      targetMet,
      targetMissed,
      targetComplianceRate: complianceRate,
      trend,
      insights,
    };
  }

  /**
   * Get accuracy trend over time.
   */
  async getAccuracyTrend(
    entityId: string,
    granularity: 'daily' | 'weekly' | 'monthly' = 'weekly',
    lookbackDays = 90
  ): Promise<Array<{ date: string; mape: number; count: number }>> {
    const pool = await getPool();

    let dateGroup: string;
    switch (granularity) {
      case 'daily':
        dateGroup = "DATE(tracked_at)";
        break;
      case 'weekly':
        dateGroup = "DATE_TRUNC('week', tracked_at)";
        break;
      case 'monthly':
        dateGroup = "DATE_TRUNC('month', tracked_at)";
        break;
    }

    const result = await pool.query(`
      SELECT
        ${dateGroup} as date,
        AVG(mape) as avg_mape,
        COUNT(*) as count
      FROM banking.forecast_accuracy
      WHERE entity_id = $1
        AND tracked_at >= NOW() - $2::interval
      GROUP BY ${dateGroup}
      ORDER BY date
    `, [entityId, `${lookbackDays} days`]);

    return result.rows.map(row => ({
      date: row.date.toISOString().split('T')[0],
      mape: parseFloat(row.avg_mape),
      count: parseInt(row.count),
    }));
  }

  /**
   * Auto-track accuracy for forecasts that have reached their end date.
   */
  async autoTrackMaturedForecasts(): Promise<number> {
    const pool = await getPool();

    // Find forecasts that have matured but haven't been tracked yet
    const maturedForecasts = await pool.query(`
      SELECT f.id, f.entity_id, f.projected_balance
      FROM banking.cash_forecasts f
      WHERE f.end_date < CURRENT_DATE
        AND NOT EXISTS (
          SELECT 1 FROM banking.forecast_accuracy fa
          WHERE fa.forecast_id = f.id
        )
      LIMIT 100
    `);

    let trackedCount = 0;

    for (const forecast of maturedForecasts.rows) {
      try {
        // Get actual balance at forecast end date
        // This would normally come from actual balance data
        // For now, we'll get the current system balance as a proxy
        const actualResult = await pool.query(`
          SELECT
            SUM(CASE WHEN type IN ('credit', 'inflow') THEN amount_value ELSE 0 END) as inflows,
            SUM(CASE WHEN type IN ('debit', 'outflow') THEN amount_value ELSE 0 END) as outflows
          FROM banking.transactions
          WHERE entity_id = $1
            AND status = 'completed'
            AND created_at::date BETWEEN
              (SELECT start_date FROM banking.cash_forecasts WHERE id = $2)
              AND (SELECT end_date FROM banking.cash_forecasts WHERE id = $2)
        `, [forecast.entity_id, forecast.id]);

        const actuals = {
          inflows: parseFloat(actualResult.rows[0]?.inflows || '0'),
          outflows: parseFloat(actualResult.rows[0]?.outflows || '0'),
          balance: parseFloat(actualResult.rows[0]?.inflows || '0') - parseFloat(actualResult.rows[0]?.outflows || '0'),
          asOfDate: new Date().toISOString().split('T')[0],
        };

        await this.trackAccuracy(forecast.id, actuals);
        trackedCount++;
      } catch (error) {
        logger.warn({ forecastId: forecast.id, error }, 'Failed to auto-track forecast accuracy');
      }
    }

    if (trackedCount > 0) {
      logger.info({ trackedCount }, 'Auto-tracked matured forecasts');
    }

    return trackedCount;
  }
}

// Singleton instance
export const forecastAccuracyService = new ForecastAccuracyService();
