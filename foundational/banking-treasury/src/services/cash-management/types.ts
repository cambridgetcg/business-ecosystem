/**
 * Cash Management Types
 *
 * Types for cash position tracking, projections, and liquidity management.
 *
 * @module services/cash-management
 */

import type { Money } from '../../types/financial.js';

/**
 * Cash position for an entity.
 */
export interface CashPosition {
  readonly entityId: string;
  readonly timestamp: Date;
  readonly balancesByCurrency: Map<string, Money>;
  readonly balancesByBank: Map<string, Money>;
  readonly balancesByAccount: Map<string, AccountBalance>;
  readonly totalInBaseCurrency: Money;
  readonly baseCurrency: string;
  readonly fxRatesUsed: FXRateSnapshot[];
  readonly dataFreshness: DataFreshness;
}

/**
 * Account balance detail.
 */
export interface AccountBalance {
  readonly accountId: string;
  readonly accountName: string;
  readonly bankId: string;
  readonly bankName: string;
  readonly ledgerBalance: Money;
  readonly availableBalance: Money;
  readonly pendingCredits: Money;
  readonly pendingDebits: Money;
  readonly lastUpdated: Date;
}

/**
 * FX rate snapshot.
 */
export interface FXRateSnapshot {
  readonly currencyPair: string;
  readonly rate: number;
  readonly source: string;
  readonly timestamp: Date;
}

/**
 * Data freshness indicator.
 */
export interface DataFreshness {
  readonly overallFreshness: 'real_time' | 'near_real_time' | 'delayed' | 'stale';
  readonly oldestData: Date;
  readonly newestData: Date;
  readonly staleAccounts: string[];
}

/**
 * Consolidated position across entities.
 */
export interface ConsolidatedPosition {
  readonly timestamp: Date;
  readonly entityPositions: Map<string, CashPosition>;
  readonly consolidatedByCurrency: Map<string, Money>;
  readonly consolidatedByBank: Map<string, Money>;
  readonly totalInBaseCurrency: Money;
  readonly baseCurrency: string;
  readonly intercompanyEliminations: Money;
}

/**
 * Projected position.
 */
export interface ProjectedPosition {
  readonly entityId: string;
  readonly projectionDate: Date;
  readonly horizon: ProjectionHorizon;
  readonly projectedBalance: Money;
  readonly expectedInflows: ScheduledCashFlow[];
  readonly expectedOutflows: ScheduledCashFlow[];
  readonly confidenceLevel: number;
  readonly assumptions: ProjectionAssumption[];
}

/**
 * Projection horizon.
 */
export interface ProjectionHorizon {
  readonly days: number;
  readonly granularity: 'daily' | 'weekly' | 'monthly';
}

/**
 * Scheduled cash flow.
 */
export interface ScheduledCashFlow {
  readonly id: string;
  readonly type: 'inflow' | 'outflow';
  readonly category: CashFlowCategory;
  readonly amount: Money;
  readonly expectedDate: Date;
  readonly certainty: 'committed' | 'expected' | 'forecast';
  readonly sourceSystem?: string | undefined;
  readonly reference?: string | undefined;
}

/**
 * Cash flow category.
 */
export type CashFlowCategory =
  | 'customer_receipts'
  | 'vendor_payments'
  | 'payroll'
  | 'taxes'
  | 'loan_repayment'
  | 'loan_drawdown'
  | 'intercompany'
  | 'fx_settlement'
  | 'dividend'
  | 'capex'
  | 'other';

/**
 * Projection assumption.
 */
export interface ProjectionAssumption {
  readonly category: string;
  readonly description: string;
  readonly impact: 'low' | 'medium' | 'high';
}

/**
 * Liquidity alert.
 */
export interface LiquidityAlert {
  readonly alertId: string;
  readonly entityId: string;
  readonly alertType: LiquidityAlertType;
  readonly severity: 'info' | 'warning' | 'critical';
  readonly message: string;
  readonly currentValue: number;
  readonly threshold: number;
  readonly triggeredAt: Date;
  readonly acknowledged: boolean;
}

/**
 * Liquidity alert type.
 */
export type LiquidityAlertType =
  | 'low_balance'
  | 'high_balance'
  | 'negative_projection'
  | 'covenant_breach_risk'
  | 'concentration_risk'
  | 'stale_data';

/**
 * Liquidity threshold configuration.
 */
export interface LiquidityThreshold {
  readonly entityId: string;
  readonly currency: string;
  readonly minimumBalance: Money;
  readonly targetBalance: Money;
  readonly maximumBalance?: Money | undefined;
  readonly alertLeadDays: number;
}
