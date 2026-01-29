/**
 * FX Exposure Service Types
 *
 * Types for FX exposure tracking, hedging strategies, and rate management.
 *
 * @see docs/research/nuances/18_FX_EXPOSURE_MANAGEMENT.md
 * @module services/fx
 */

import type { Money } from '../../types/financial.js';

/**
 * Currency pair representation.
 */
export interface CurrencyPair {
  readonly baseCurrency: string;
  readonly quoteCurrency: string;
}

/**
 * FX rate with metadata.
 */
export interface FXRate {
  readonly pair: CurrencyPair;
  readonly bid: number;
  readonly ask: number;
  readonly mid: number;
  readonly source: FXRateSource;
  readonly timestamp: Date;
  readonly validUntil: Date;
}

/**
 * FX rate source.
 */
export type FXRateSource =
  | 'reuters'
  | 'bloomberg'
  | 'ecb'
  | 'fed'
  | 'internal'
  | 'bank_indicative'
  | 'bank_firm';

/**
 * FX exposure position.
 */
export interface FXExposure {
  readonly exposureId: string;
  readonly entityId: string;
  readonly currency: string;
  readonly baseCurrency: string;
  readonly exposureType: ExposureType;
  readonly grossExposure: Money;
  readonly hedgedAmount: Money;
  readonly netExposure: Money;
  readonly hedgeRatio: number;
  readonly maturityDate?: Date | undefined;
  readonly positions: ExposurePosition[];
  readonly lastUpdated: Date;
}

/**
 * Exposure type classification.
 */
export type ExposureType =
  | 'transaction'      // Actual committed transactions
  | 'translation'      // Balance sheet translation
  | 'economic'         // Forecasted/operational
  | 'contingent';      // Potential/uncommitted

/**
 * Individual exposure position.
 */
export interface ExposurePosition {
  readonly positionId: string;
  readonly source: ExposureSource;
  readonly amount: Money;
  readonly maturityDate?: Date | undefined;
  readonly certainty: ExposureCertainty;
  readonly reference?: string | undefined;
}

/**
 * Source of exposure.
 */
export type ExposureSource =
  | 'accounts_receivable'
  | 'accounts_payable'
  | 'intercompany'
  | 'cash_balance'
  | 'forecast'
  | 'committed_order'
  | 'pending_settlement'
  | 'dividend'
  | 'capex';

/**
 * Certainty level of exposure.
 */
export type ExposureCertainty =
  | 'committed'     // 100% certain
  | 'high'          // >90% certain
  | 'medium'        // 50-90% certain
  | 'low';          // <50% certain

/**
 * Hedge instrument.
 */
export interface HedgeInstrument {
  readonly hedgeId: string;
  readonly entityId: string;
  readonly instrumentType: HedgeInstrumentType;
  readonly currencyPair: CurrencyPair;
  readonly notionalAmount: Money;
  readonly direction: 'buy' | 'sell';
  readonly rate: number;
  readonly tradeDate: Date;
  readonly settlementDate: Date;
  readonly maturityDate: Date;
  readonly status: HedgeStatus;
  readonly counterpartyId: string;
  readonly linkedExposures: string[];
  readonly marketValue?: Money | undefined;
  readonly unrealizedPnL?: Money | undefined;
}

/**
 * Hedge instrument types.
 */
export type HedgeInstrumentType =
  | 'spot'
  | 'forward'
  | 'ndf'          // Non-deliverable forward
  | 'option'
  | 'swap'
  | 'natural';     // Natural hedge (matching positions)

/**
 * Hedge status.
 */
export type HedgeStatus =
  | 'pending'
  | 'active'
  | 'partially_settled'
  | 'settled'
  | 'cancelled'
  | 'expired';

/**
 * Hedging policy configuration.
 */
export interface HedgingPolicy {
  readonly policyId: string;
  readonly entityId: string;
  readonly currency: string;
  readonly exposureType: ExposureType;
  readonly targetHedgeRatio: number;
  readonly minHedgeRatio: number;
  readonly maxHedgeRatio: number;
  readonly allowedInstruments: HedgeInstrumentType[];
  readonly maxTenorDays: number;
  readonly maxSingleTradeSize: Money;
  readonly approvalThreshold: Money;
  readonly effectiveDate: Date;
  readonly expiryDate?: Date | undefined;
}

/**
 * Hedge recommendation.
 */
export interface HedgeRecommendation {
  readonly recommendationId: string;
  readonly entityId: string;
  readonly currency: string;
  readonly action: 'increase_hedge' | 'reduce_hedge' | 'roll_forward' | 'no_action';
  readonly currentHedgeRatio: number;
  readonly targetHedgeRatio: number;
  readonly suggestedAmount: Money;
  readonly suggestedInstrument: HedgeInstrumentType;
  readonly suggestedTenorDays: number;
  readonly rationale: string;
  readonly priority: 'high' | 'medium' | 'low';
  readonly validUntil: Date;
}

/**
 * FX trade execution request.
 */
export interface FXTradeRequest {
  readonly entityId: string;
  readonly currencyPair: CurrencyPair;
  readonly direction: 'buy' | 'sell';
  readonly amount: Money;
  readonly valueDate: Date;
  readonly instrumentType: HedgeInstrumentType;
  readonly linkedExposureIds?: string[] | undefined;
  readonly rateLimit?: number | undefined;
  readonly expiresAt?: Date | undefined;
}

/**
 * FX trade execution result.
 */
export interface FXTradeResult {
  readonly tradeId: string;
  readonly request: FXTradeRequest;
  readonly status: 'executed' | 'rejected' | 'expired';
  readonly executedRate?: number | undefined;
  readonly executedAmount?: Money | undefined;
  readonly contraAmount?: Money | undefined;
  readonly settlementDate?: Date | undefined;
  readonly counterpartyId?: string | undefined;
  readonly rejectionReason?: string | undefined;
  readonly timestamp: Date;
}

/**
 * VaR (Value at Risk) calculation result.
 */
export interface VaRResult {
  readonly entityId: string;
  readonly baseCurrency: string;
  readonly calculationDate: Date;
  readonly confidenceLevel: number;
  readonly holdingPeriodDays: number;
  readonly method: VaRMethod;
  readonly totalVaR: Money;
  readonly componentVaR: Map<string, Money>;
  readonly diversificationBenefit: Money;
}

/**
 * VaR calculation method.
 */
export type VaRMethod =
  | 'historical'
  | 'parametric'
  | 'monte_carlo';

/**
 * FX exposure summary for reporting.
 */
export interface FXExposureSummary {
  readonly entityId: string;
  readonly baseCurrency: string;
  readonly asOfDate: Date;
  readonly exposuresByCurrency: Map<string, CurrencyExposureSummary>;
  readonly totalGrossExposure: Money;
  readonly totalNetExposure: Money;
  readonly totalHedgedAmount: Money;
  readonly overallHedgeRatio: number;
  readonly var95: Money;
}

/**
 * Per-currency exposure summary.
 */
export interface CurrencyExposureSummary {
  readonly currency: string;
  readonly grossLong: Money;
  readonly grossShort: Money;
  readonly netExposure: Money;
  readonly hedgedAmount: Money;
  readonly hedgeRatio: number;
  readonly maturityProfile: MaturityBucket[];
}

/**
 * Maturity bucket for exposure profiling.
 */
export interface MaturityBucket {
  readonly bucket: '0-30d' | '31-60d' | '61-90d' | '91-180d' | '181-365d' | '>365d';
  readonly exposure: Money;
  readonly hedged: Money;
}

/**
 * FX alert.
 */
export interface FXAlert {
  readonly alertId: string;
  readonly entityId: string;
  readonly alertType: FXAlertType;
  readonly severity: 'info' | 'warning' | 'critical';
  readonly message: string;
  readonly currency?: string | undefined;
  readonly currentValue: number;
  readonly threshold: number;
  readonly triggeredAt: Date;
  readonly acknowledged: boolean;
}

/**
 * FX alert types.
 */
export type FXAlertType =
  | 'hedge_ratio_breach'
  | 'exposure_limit_breach'
  | 'rate_movement'
  | 'hedge_maturity'
  | 'policy_violation'
  | 'var_breach';
