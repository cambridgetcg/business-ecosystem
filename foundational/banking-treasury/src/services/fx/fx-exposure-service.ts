/**
 * FX Exposure Service
 *
 * Manages FX exposure tracking, hedging strategies, and risk calculations.
 *
 * @see docs/research/nuances/18_FX_EXPOSURE_MANAGEMENT.md
 * @module services/fx
 */

import type { Money } from '../../types/financial.js';
import type {
  FXExposure,
  FXRate,
  CurrencyPair,
  HedgeInstrument,
  HedgingPolicy,
  HedgeRecommendation,
  FXExposureSummary,
  CurrencyExposureSummary,
  MaturityBucket,
  FXAlert,
  FXAlertType,
  ExposurePosition,
  VaRResult,
} from './types.js';

/**
 * FX rate provider interface.
 */
export interface IFXRateProvider {
  getRate(pair: CurrencyPair): Promise<FXRate>;
  getRates(pairs: CurrencyPair[]): Promise<FXRate[]>;
}

/**
 * Exposure data source interface.
 */
export interface IExposureDataSource {
  getExposures(entityId: string): Promise<FXExposure[]>;
  getExposuresByType(entityId: string, type: string): Promise<FXExposure[]>;
}

/**
 * Hedge repository interface.
 */
export interface IHedgeRepository {
  getActiveHedges(entityId: string): Promise<HedgeInstrument[]>;
  getHedgesByCurrency(entityId: string, currency: string): Promise<HedgeInstrument[]>;
  saveHedge(hedge: HedgeInstrument): Promise<void>;
}

/**
 * FX Exposure Service
 *
 * Provides comprehensive FX risk management:
 * - Exposure aggregation and tracking
 * - Hedge ratio monitoring
 * - Policy enforcement
 * - Hedge recommendations
 * - VaR calculations
 */
export class FXExposureService {
  private readonly rateProvider: IFXRateProvider;
  private readonly exposureSource: IExposureDataSource;
  private readonly hedgeRepository: IHedgeRepository;
  private readonly policies: Map<string, HedgingPolicy[]> = new Map();
  private readonly alertHistory: FXAlert[] = [];

  constructor(
    rateProvider: IFXRateProvider,
    exposureSource: IExposureDataSource,
    hedgeRepository: IHedgeRepository
  ) {
    this.rateProvider = rateProvider;
    this.exposureSource = exposureSource;
    this.hedgeRepository = hedgeRepository;
  }

  /**
   * Get consolidated FX exposure summary.
   */
  async getExposureSummary(
    entityId: string,
    baseCurrency: string = 'USD'
  ): Promise<FXExposureSummary> {
    const exposures = await this.exposureSource.getExposures(entityId);
    const hedges = await this.hedgeRepository.getActiveHedges(entityId);

    const exposuresByCurrency = new Map<string, CurrencyExposureSummary>();
    let totalGrossExposure = 0;
    let totalNetExposure = 0;
    let totalHedgedAmount = 0;

    // Group exposures by currency
    const byCurrency = new Map<string, FXExposure[]>();
    for (const exposure of exposures) {
      const existing = byCurrency.get(exposure.currency) ?? [];
      existing.push(exposure);
      byCurrency.set(exposure.currency, existing);
    }

    // Group hedges by currency
    const hedgesByCurrency = new Map<string, HedgeInstrument[]>();
    for (const hedge of hedges) {
      const currency = hedge.direction === 'sell'
        ? hedge.currencyPair.baseCurrency
        : hedge.currencyPair.quoteCurrency;
      const existing = hedgesByCurrency.get(currency) ?? [];
      existing.push(hedge);
      hedgesByCurrency.set(currency, existing);
    }

    // Calculate per-currency summary
    for (const [currency, currencyExposures] of byCurrency) {
      const currencyHedges = hedgesByCurrency.get(currency) ?? [];
      const summary = this.calculateCurrencySummary(
        currency,
        baseCurrency,
        currencyExposures,
        currencyHedges
      );
      exposuresByCurrency.set(currency, summary);

      totalGrossExposure += Math.abs(summary.grossLong.amount) + Math.abs(summary.grossShort.amount);
      totalNetExposure += Math.abs(summary.netExposure.amount);
      totalHedgedAmount += Math.abs(summary.hedgedAmount.amount);
    }

    const overallHedgeRatio = totalNetExposure > 0
      ? totalHedgedAmount / (totalNetExposure + totalHedgedAmount)
      : 1.0;

    // Simplified VaR (95% confidence, 1-day holding period)
    const var95 = this.calculateSimplifiedVaR(totalNetExposure, baseCurrency);

    return {
      entityId,
      baseCurrency,
      asOfDate: new Date(),
      exposuresByCurrency,
      totalGrossExposure: { amount: totalGrossExposure, currency: baseCurrency },
      totalNetExposure: { amount: totalNetExposure, currency: baseCurrency },
      totalHedgedAmount: { amount: totalHedgedAmount, currency: baseCurrency },
      overallHedgeRatio,
      var95,
    };
  }

  /**
   * Get hedge recommendations based on policy.
   */
  async getHedgeRecommendations(entityId: string): Promise<HedgeRecommendation[]> {
    const recommendations: HedgeRecommendation[] = [];
    const exposures = await this.exposureSource.getExposures(entityId);
    const policies = this.policies.get(entityId) ?? [];

    for (const policy of policies) {
      const currencyExposures = exposures.filter(e => e.currency === policy.currency);
      if (currencyExposures.length === 0) continue;

      // Calculate current hedge ratio for this currency
      const totalExposure = currencyExposures.reduce(
        (sum, e) => sum + e.netExposure.amount,
        0
      );
      const totalHedged = currencyExposures.reduce(
        (sum, e) => sum + e.hedgedAmount.amount,
        0
      );
      const currentRatio = totalExposure !== 0
        ? totalHedged / (Math.abs(totalExposure) + totalHedged)
        : 1.0;

      const recommendation = this.generateRecommendation(
        entityId,
        policy,
        currentRatio,
        totalExposure,
        totalHedged
      );

      if (recommendation) {
        recommendations.push(recommendation);
      }
    }

    return recommendations;
  }

  /**
   * Check exposures against policies and generate alerts.
   */
  async checkPolicyCompliance(entityId: string): Promise<FXAlert[]> {
    const alerts: FXAlert[] = [];
    const exposures = await this.exposureSource.getExposures(entityId);
    const policies = this.policies.get(entityId) ?? [];

    for (const policy of policies) {
      const currencyExposures = exposures.filter(e => e.currency === policy.currency);
      if (currencyExposures.length === 0) continue;

      // Calculate current hedge ratio
      const totalExposure = currencyExposures.reduce(
        (sum, e) => sum + Math.abs(e.netExposure.amount),
        0
      );
      const totalHedged = currencyExposures.reduce(
        (sum, e) => sum + e.hedgedAmount.amount,
        0
      );
      const currentRatio = totalExposure > 0 ? totalHedged / totalExposure : 1.0;

      // Check hedge ratio bounds
      if (currentRatio < policy.minHedgeRatio) {
        alerts.push(this.createAlert(
          entityId,
          'hedge_ratio_breach',
          'warning',
          `${policy.currency} hedge ratio ${(currentRatio * 100).toFixed(1)}% below minimum ${(policy.minHedgeRatio * 100).toFixed(1)}%`,
          policy.currency,
          currentRatio,
          policy.minHedgeRatio
        ));
      } else if (currentRatio > policy.maxHedgeRatio) {
        alerts.push(this.createAlert(
          entityId,
          'hedge_ratio_breach',
          'info',
          `${policy.currency} hedge ratio ${(currentRatio * 100).toFixed(1)}% exceeds maximum ${(policy.maxHedgeRatio * 100).toFixed(1)}%`,
          policy.currency,
          currentRatio,
          policy.maxHedgeRatio
        ));
      }
    }

    return alerts;
  }

  /**
   * Calculate VaR for the portfolio.
   */
  async calculateVaR(
    entityId: string,
    baseCurrency: string,
    confidenceLevel: number = 0.95,
    holdingPeriodDays: number = 1
  ): Promise<VaRResult> {
    const exposures = await this.exposureSource.getExposures(entityId);

    const componentVaR = new Map<string, Money>();
    let totalUndiversified = 0;

    // Calculate component VaR for each currency
    for (const exposure of exposures) {
      if (exposure.netExposure.amount === 0) continue;

      // Get historical volatility (simplified - using typical values)
      const volatility = this.getTypicalVolatility(exposure.currency, baseCurrency);
      const scaledVol = volatility * Math.sqrt(holdingPeriodDays);
      const zScore = this.getZScore(confidenceLevel);

      const currencyVaR = Math.abs(exposure.netExposure.amount) * scaledVol * zScore;
      componentVaR.set(exposure.currency, {
        amount: currencyVaR,
        currency: baseCurrency,
      });
      totalUndiversified += currencyVaR;
    }

    // Apply diversification benefit (simplified - using typical correlation)
    const diversificationFactor = 0.7; // Assume 30% diversification benefit
    const totalVaR = totalUndiversified * diversificationFactor;
    const diversificationBenefit = totalUndiversified - totalVaR;

    return {
      entityId,
      baseCurrency,
      calculationDate: new Date(),
      confidenceLevel,
      holdingPeriodDays,
      method: 'parametric',
      totalVaR: { amount: totalVaR, currency: baseCurrency },
      componentVaR,
      diversificationBenefit: { amount: diversificationBenefit, currency: baseCurrency },
    };
  }

  /**
   * Get maturing hedges that need attention.
   */
  async getMaturingHedges(
    entityId: string,
    withinDays: number = 30
  ): Promise<HedgeInstrument[]> {
    const hedges = await this.hedgeRepository.getActiveHedges(entityId);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + withinDays);

    return hedges.filter(h =>
      h.status === 'active' && h.maturityDate <= cutoff
    );
  }

  /**
   * Configure hedging policy.
   */
  setPolicy(entityId: string, policy: HedgingPolicy): void {
    const existing = this.policies.get(entityId) ?? [];
    const filtered = existing.filter(p =>
      p.currency !== policy.currency || p.exposureType !== policy.exposureType
    );
    filtered.push(policy);
    this.policies.set(entityId, filtered);
  }

  /**
   * Get alert history.
   */
  getAlertHistory(entityId?: string): FXAlert[] {
    if (entityId) {
      return this.alertHistory.filter(a => a.entityId === entityId);
    }
    return [...this.alertHistory];
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private calculateCurrencySummary(
    currency: string,
    baseCurrency: string,
    exposures: FXExposure[],
    hedges: HedgeInstrument[]
  ): CurrencyExposureSummary {
    let grossLong = 0;
    let grossShort = 0;

    for (const exposure of exposures) {
      for (const position of exposure.positions) {
        if (position.amount.amount > 0) {
          grossLong += position.amount.amount;
        } else {
          grossShort += Math.abs(position.amount.amount);
        }
      }
    }

    const netExposure = grossLong - grossShort;
    const hedgedAmount = hedges.reduce((sum, h) => sum + h.notionalAmount.amount, 0);
    const hedgeRatio = Math.abs(netExposure) > 0
      ? hedgedAmount / Math.abs(netExposure)
      : 1.0;

    const maturityProfile = this.buildMaturityProfile(exposures, hedges, baseCurrency);

    return {
      currency,
      grossLong: { amount: grossLong, currency },
      grossShort: { amount: grossShort, currency },
      netExposure: { amount: netExposure, currency },
      hedgedAmount: { amount: hedgedAmount, currency },
      hedgeRatio,
      maturityProfile,
    };
  }

  private buildMaturityProfile(
    exposures: FXExposure[],
    hedges: HedgeInstrument[],
    baseCurrency: string
  ): MaturityBucket[] {
    const buckets: MaturityBucket[] = [
      { bucket: '0-30d', exposure: { amount: 0, currency: baseCurrency }, hedged: { amount: 0, currency: baseCurrency } },
      { bucket: '31-60d', exposure: { amount: 0, currency: baseCurrency }, hedged: { amount: 0, currency: baseCurrency } },
      { bucket: '61-90d', exposure: { amount: 0, currency: baseCurrency }, hedged: { amount: 0, currency: baseCurrency } },
      { bucket: '91-180d', exposure: { amount: 0, currency: baseCurrency }, hedged: { amount: 0, currency: baseCurrency } },
      { bucket: '181-365d', exposure: { amount: 0, currency: baseCurrency }, hedged: { amount: 0, currency: baseCurrency } },
      { bucket: '>365d', exposure: { amount: 0, currency: baseCurrency }, hedged: { amount: 0, currency: baseCurrency } },
    ];

    const now = new Date();

    // Assign exposures to buckets
    for (const exposure of exposures) {
      for (const position of exposure.positions) {
        if (!position.maturityDate) continue;
        const daysToMaturity = Math.floor(
          (position.maturityDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        const bucket = this.getBucket(daysToMaturity, buckets);
        if (bucket) {
          bucket.exposure.amount += Math.abs(position.amount.amount);
        }
      }
    }

    // Assign hedges to buckets
    for (const hedge of hedges) {
      const daysToMaturity = Math.floor(
        (hedge.maturityDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      const bucket = this.getBucket(daysToMaturity, buckets);
      if (bucket) {
        bucket.hedged.amount += hedge.notionalAmount.amount;
      }
    }

    return buckets;
  }

  private getBucket(
    days: number,
    buckets: { bucket: string; exposure: Money; hedged: Money }[]
  ): { bucket: string; exposure: Money; hedged: Money } | undefined {
    if (days <= 30) return buckets[0];
    if (days <= 60) return buckets[1];
    if (days <= 90) return buckets[2];
    if (days <= 180) return buckets[3];
    if (days <= 365) return buckets[4];
    return buckets[5];
  }

  private generateRecommendation(
    entityId: string,
    policy: HedgingPolicy,
    currentRatio: number,
    totalExposure: number,
    totalHedged: number
  ): HedgeRecommendation | null {
    const gapToTarget = policy.targetHedgeRatio - currentRatio;

    // No action needed if within acceptable range
    if (Math.abs(gapToTarget) < 0.05) {
      return null;
    }

    const absExposure = Math.abs(totalExposure);
    const suggestedAmount = absExposure * Math.abs(gapToTarget);

    let action: HedgeRecommendation['action'];
    let priority: HedgeRecommendation['priority'];
    let rationale: string;

    if (gapToTarget > 0) {
      action = 'increase_hedge';
      rationale = `Current hedge ratio ${(currentRatio * 100).toFixed(1)}% is below target ${(policy.targetHedgeRatio * 100).toFixed(1)}%`;
      priority = currentRatio < policy.minHedgeRatio ? 'high' : 'medium';
    } else {
      action = 'reduce_hedge';
      rationale = `Current hedge ratio ${(currentRatio * 100).toFixed(1)}% exceeds target ${(policy.targetHedgeRatio * 100).toFixed(1)}%`;
      priority = currentRatio > policy.maxHedgeRatio ? 'high' : 'low';
    }

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 1);

    return {
      recommendationId: `rec-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      entityId,
      currency: policy.currency,
      action,
      currentHedgeRatio: currentRatio,
      targetHedgeRatio: policy.targetHedgeRatio,
      suggestedAmount: { amount: suggestedAmount, currency: policy.currency },
      suggestedInstrument: policy.allowedInstruments[0] ?? 'forward',
      suggestedTenorDays: Math.min(90, policy.maxTenorDays),
      rationale,
      priority,
      validUntil,
    };
  }

  private calculateSimplifiedVaR(netExposure: number, baseCurrency: string): Money {
    // Simplified VaR using typical FX volatility
    const avgVolatility = 0.10; // 10% annual volatility
    const dailyVol = avgVolatility / Math.sqrt(252);
    const zScore = 1.645; // 95% confidence
    return {
      amount: Math.abs(netExposure) * dailyVol * zScore,
      currency: baseCurrency,
    };
  }

  private getTypicalVolatility(currency: string, baseCurrency: string): number {
    // Typical daily volatilities for major pairs vs USD
    const volatilities: Record<string, number> = {
      EUR: 0.006,
      GBP: 0.007,
      JPY: 0.006,
      CHF: 0.006,
      CAD: 0.005,
      AUD: 0.008,
      NZD: 0.008,
      CNY: 0.003,
      INR: 0.004,
      BRL: 0.012,
      MXN: 0.009,
      ZAR: 0.012,
    };
    return volatilities[currency] ?? 0.008;
  }

  private getZScore(confidenceLevel: number): number {
    // Z-scores for common confidence levels
    if (confidenceLevel >= 0.99) return 2.326;
    if (confidenceLevel >= 0.95) return 1.645;
    if (confidenceLevel >= 0.90) return 1.282;
    return 1.0;
  }

  private createAlert(
    entityId: string,
    alertType: FXAlertType,
    severity: 'info' | 'warning' | 'critical',
    message: string,
    currency: string | undefined,
    currentValue: number,
    threshold: number
  ): FXAlert {
    const alert: FXAlert = {
      alertId: `fxalert-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      entityId,
      alertType,
      severity,
      message,
      currency,
      currentValue,
      threshold,
      triggeredAt: new Date(),
      acknowledged: false,
    };

    this.alertHistory.push(alert);
    return alert;
  }
}
