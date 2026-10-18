/**
 * Cash Position Service
 *
 * Real-time cash position aggregation, projections, and liquidity alerts.
 *
 * @see docs/research/nuances/17_LIQUIDITY_STRESS_MANAGEMENT.md
 * @module services/cash-management
 */

import type { Money } from '../../types/financial.js';
import type {
  CashPosition,
  ConsolidatedPosition,
  ProjectedPosition,
  AccountBalance,
  FXRateSnapshot,
  DataFreshness,
  LiquidityAlert,
  LiquidityAlertType,
  LiquidityThreshold,
  ScheduledCashFlow,
  ProjectionHorizon,
} from './types.js';

/**
 * Account data source interface.
 */
export interface IAccountDataSource {
  getAccountBalance(accountId: string): Promise<AccountBalance>;
  getAccountsByEntity(entityId: string): Promise<string[]>;
}

/**
 * FX rate source interface.
 */
export interface IFXRateSource {
  getRate(baseCurrency: string, quoteCurrency: string): Promise<FXRateSnapshot>;
}

/**
 * Cash flow source interface.
 */
export interface ICashFlowSource {
  getScheduledFlows(entityId: string, horizon: ProjectionHorizon): Promise<ScheduledCashFlow[]>;
}

/**
 * Cash Position Service
 *
 * Provides real-time cash visibility with:
 * - Multi-account aggregation
 * - Currency conversion
 * - Position projections
 * - Liquidity alerts
 */
export class CashPositionService {
  private readonly accountSource: IAccountDataSource;
  private readonly fxSource: IFXRateSource;
  private readonly cashFlowSource: ICashFlowSource;
  private readonly thresholds: Map<string, LiquidityThreshold[]> = new Map();
  private readonly alertHistory: LiquidityAlert[] = [];

  constructor(
    accountSource: IAccountDataSource,
    fxSource: IFXRateSource,
    cashFlowSource: ICashFlowSource
  ) {
    this.accountSource = accountSource;
    this.fxSource = fxSource;
    this.cashFlowSource = cashFlowSource;
  }

  /**
   * Get real-time cash position for an entity.
   */
  async getPosition(entityId: string, baseCurrency: string = 'USD'): Promise<CashPosition> {
    const accountIds = await this.accountSource.getAccountsByEntity(entityId);
    const balances = await Promise.all(
      accountIds.map(id => this.accountSource.getAccountBalance(id))
    );

    const balancesByCurrency = new Map<string, Money>();
    const balancesByBank = new Map<string, Money>();
    const balancesByAccount = new Map<string, AccountBalance>();
    const fxRatesUsed: FXRateSnapshot[] = [];

    let totalInBase = 0;
    let oldestData = new Date();
    let newestData = new Date(0);
    const staleAccounts: string[] = [];

    for (const balance of balances) {
      // Track by account
      balancesByAccount.set(balance.accountId, balance);

      // Track by currency
      const currencyTotal = balancesByCurrency.get(balance.availableBalance.currency);
      balancesByCurrency.set(balance.availableBalance.currency, {
        amount: (currencyTotal?.amount ?? 0) + balance.availableBalance.amount,
        currency: balance.availableBalance.currency,
      });

      // Track by bank
      const bankTotal = balancesByBank.get(balance.bankId);
      const bankAmount = bankTotal?.amount ?? 0;

      // Convert to base currency for bank totals
      if (balance.availableBalance.currency !== baseCurrency) {
        const rate = await this.fxSource.getRate(balance.availableBalance.currency, baseCurrency);
        fxRatesUsed.push(rate);
        const convertedAmount = balance.availableBalance.amount * rate.rate;
        balancesByBank.set(balance.bankId, {
          amount: bankAmount + convertedAmount,
          currency: baseCurrency,
        });
        totalInBase += convertedAmount;
      } else {
        balancesByBank.set(balance.bankId, {
          amount: bankAmount + balance.availableBalance.amount,
          currency: baseCurrency,
        });
        totalInBase += balance.availableBalance.amount;
      }

      // Track freshness
      if (balance.lastUpdated < oldestData) {
        oldestData = balance.lastUpdated;
      }
      if (balance.lastUpdated > newestData) {
        newestData = balance.lastUpdated;
      }

      // Check for stale data (>5 minutes old)
      const staleThreshold = 5 * 60 * 1000;
      if (Date.now() - balance.lastUpdated.getTime() > staleThreshold) {
        staleAccounts.push(balance.accountId);
      }
    }

    const dataFreshness = this.calculateFreshness(oldestData, newestData, staleAccounts);

    return {
      entityId,
      timestamp: new Date(),
      balancesByCurrency,
      balancesByBank,
      balancesByAccount,
      totalInBaseCurrency: { amount: totalInBase, currency: baseCurrency },
      baseCurrency,
      fxRatesUsed,
      dataFreshness,
    };
  }

  /**
   * Get consolidated position across multiple entities.
   */
  async getConsolidatedPosition(
    entityIds: string[],
    baseCurrency: string = 'USD'
  ): Promise<ConsolidatedPosition> {
    const entityPositions = new Map<string, CashPosition>();
    const consolidatedByCurrency = new Map<string, Money>();
    const consolidatedByBank = new Map<string, Money>();
    let totalInBase = 0;
    let intercompanyEliminations = 0;

    for (const entityId of entityIds) {
      const position = await this.getPosition(entityId, baseCurrency);
      entityPositions.set(entityId, position);

      // Aggregate by currency
      for (const [currency, amount] of position.balancesByCurrency) {
        const current = consolidatedByCurrency.get(currency);
        consolidatedByCurrency.set(currency, {
          amount: (current?.amount ?? 0) + amount.amount,
          currency,
        });
      }

      // Aggregate by bank
      for (const [bankId, amount] of position.balancesByBank) {
        const current = consolidatedByBank.get(bankId);
        consolidatedByBank.set(bankId, {
          amount: (current?.amount ?? 0) + amount.amount,
          currency: baseCurrency,
        });
      }

      totalInBase += position.totalInBaseCurrency.amount;
    }

    // Calculate intercompany eliminations using the intercompany service
    // This removes internal transactions between related entities for accurate consolidation
    if (entityIds.length >= 2) {
      try {
        // Import dynamically to avoid circular dependencies
        const { createIntercompanyService } = await import('./intercompany-service.js');
        const intercompanyService = createIntercompanyService();
        const eliminations = await intercompanyService.calculateEliminations(entityIds, baseCurrency);

        intercompanyEliminations = eliminations.totalElimination.amount;

        // Log any warnings from elimination calculation
        if (eliminations.warnings.length > 0) {
          console.warn('Intercompany elimination warnings:', eliminations.warnings);
        }
      } catch (error) {
        // Log but don't fail - eliminations are supplementary
        console.warn('Failed to calculate intercompany eliminations:', error);
      }
    }

    return {
      timestamp: new Date(),
      entityPositions,
      consolidatedByCurrency,
      consolidatedByBank,
      totalInBaseCurrency: { amount: totalInBase, currency: baseCurrency },
      baseCurrency,
      intercompanyEliminations: { amount: intercompanyEliminations, currency: baseCurrency },
    };
  }

  /**
   * Project future cash position.
   */
  async projectPosition(
    entityId: string,
    horizon: ProjectionHorizon,
    baseCurrency: string = 'USD'
  ): Promise<ProjectedPosition> {
    const currentPosition = await this.getPosition(entityId, baseCurrency);
    const scheduledFlows = await this.cashFlowSource.getScheduledFlows(entityId, horizon);

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + horizon.days);

    // Calculate projected balance
    let projectedBalance = currentPosition.totalInBaseCurrency.amount;
    const inflows: ScheduledCashFlow[] = [];
    const outflows: ScheduledCashFlow[] = [];

    for (const flow of scheduledFlows) {
      if (flow.expectedDate <= endDate) {
        // Convert to base currency if needed
        let amount = flow.amount.amount;
        if (flow.amount.currency !== baseCurrency) {
          const rate = await this.fxSource.getRate(flow.amount.currency, baseCurrency);
          amount = amount * rate.rate;
        }

        if (flow.type === 'inflow') {
          projectedBalance += amount;
          inflows.push(flow);
        } else {
          projectedBalance -= amount;
          outflows.push(flow);
        }
      }
    }

    // Calculate confidence based on flow certainty
    const totalFlows = scheduledFlows.length;
    const committedFlows = scheduledFlows.filter(f => f.certainty === 'committed').length;
    const expectedFlows = scheduledFlows.filter(f => f.certainty === 'expected').length;
    const confidenceLevel = totalFlows > 0
      ? (committedFlows * 1.0 + expectedFlows * 0.7) / totalFlows
      : 1.0;

    return {
      entityId,
      projectionDate: endDate,
      horizon,
      projectedBalance: { amount: projectedBalance, currency: baseCurrency },
      expectedInflows: inflows,
      expectedOutflows: outflows,
      confidenceLevel,
      assumptions: [
        {
          category: 'Timing',
          description: 'Cash flows occur on expected dates',
          impact: 'medium',
        },
        {
          category: 'FX Rates',
          description: 'Current FX rates remain stable',
          impact: horizon.days > 30 ? 'high' : 'low',
        },
      ],
    };
  }

  /**
   * Check liquidity alerts for a position.
   */
  async checkLiquidityAlerts(position: CashPosition): Promise<LiquidityAlert[]> {
    const alerts: LiquidityAlert[] = [];
    const entityThresholds = this.thresholds.get(position.entityId) ?? [];

    for (const threshold of entityThresholds) {
      const currencyBalance = position.balancesByCurrency.get(threshold.currency);
      const balance = currencyBalance?.amount ?? 0;

      // Check minimum balance
      if (balance < threshold.minimumBalance.amount) {
        alerts.push(this.createAlert(
          position.entityId,
          'low_balance',
          'critical',
          `${threshold.currency} balance ${balance.toFixed(2)} below minimum ${threshold.minimumBalance.amount.toFixed(2)}`,
          balance,
          threshold.minimumBalance.amount
        ));
      } else if (balance < threshold.targetBalance.amount) {
        alerts.push(this.createAlert(
          position.entityId,
          'low_balance',
          'warning',
          `${threshold.currency} balance ${balance.toFixed(2)} below target ${threshold.targetBalance.amount.toFixed(2)}`,
          balance,
          threshold.targetBalance.amount
        ));
      }

      // Check maximum balance
      if (threshold.maximumBalance && balance > threshold.maximumBalance.amount) {
        alerts.push(this.createAlert(
          position.entityId,
          'high_balance',
          'info',
          `${threshold.currency} balance ${balance.toFixed(2)} exceeds maximum ${threshold.maximumBalance.amount.toFixed(2)}`,
          balance,
          threshold.maximumBalance.amount
        ));
      }
    }

    // Check data freshness
    if (position.dataFreshness.staleAccounts.length > 0) {
      alerts.push(this.createAlert(
        position.entityId,
        'stale_data',
        'warning',
        `${position.dataFreshness.staleAccounts.length} account(s) have stale balance data`,
        position.dataFreshness.staleAccounts.length,
        0
      ));
    }

    // Check concentration risk (>50% with single bank)
    const totalBalance = position.totalInBaseCurrency.amount;
    for (const [bankId, bankBalance] of position.balancesByBank) {
      const concentration = bankBalance.amount / totalBalance;
      if (concentration > 0.5) {
        alerts.push(this.createAlert(
          position.entityId,
          'concentration_risk',
          'warning',
          `${(concentration * 100).toFixed(1)}% of funds concentrated in bank ${bankId}`,
          concentration,
          0.5
        ));
      }
    }

    return alerts;
  }

  /**
   * Configure liquidity thresholds.
   */
  setThresholds(entityId: string, thresholds: LiquidityThreshold[]): void {
    this.thresholds.set(entityId, thresholds);
  }

  /**
   * Get alert history.
   */
  getAlertHistory(entityId?: string): LiquidityAlert[] {
    if (entityId) {
      return this.alertHistory.filter(a => a.entityId === entityId);
    }
    return [...this.alertHistory];
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private calculateFreshness(
    oldestData: Date,
    newestData: Date,
    staleAccounts: string[]
  ): DataFreshness {
    const now = Date.now();
    const oldestAge = now - oldestData.getTime();
    const oneMinute = 60 * 1000;
    const fiveMinutes = 5 * 60 * 1000;
    const fifteenMinutes = 15 * 60 * 1000;

    let overallFreshness: DataFreshness['overallFreshness'];

    if (oldestAge < oneMinute && staleAccounts.length === 0) {
      overallFreshness = 'real_time';
    } else if (oldestAge < fiveMinutes && staleAccounts.length === 0) {
      overallFreshness = 'near_real_time';
    } else if (oldestAge < fifteenMinutes) {
      overallFreshness = 'delayed';
    } else {
      overallFreshness = 'stale';
    }

    return {
      overallFreshness,
      oldestData,
      newestData,
      staleAccounts,
    };
  }

  private createAlert(
    entityId: string,
    alertType: LiquidityAlertType,
    severity: 'info' | 'warning' | 'critical',
    message: string,
    currentValue: number,
    threshold: number
  ): LiquidityAlert {
    const alert: LiquidityAlert = {
      alertId: `alert-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      entityId,
      alertType,
      severity,
      message,
      currentValue,
      threshold,
      triggeredAt: new Date(),
      acknowledged: false,
    };

    this.alertHistory.push(alert);
    return alert;
  }
}
