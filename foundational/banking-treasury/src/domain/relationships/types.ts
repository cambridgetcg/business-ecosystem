/**
 * Bank Relationship Types
 *
 * Types for managing bank relationships, negotiated terms,
 * and relationship value calculation.
 *
 * @module relationships/types
 */

import type { Money } from '../../types/financial.js';

/**
 * Bank relationship tier classification.
 */
export type RelationshipTier = 'primary' | 'secondary' | 'specialist';

/**
 * Relationship status.
 */
export type RelationshipStatus = 'active' | 'dormant' | 'terminated';

/**
 * Bank product categories.
 */
export type BankProductType =
  | 'cash_management'
  | 'payments'
  | 'fx'
  | 'trade_finance'
  | 'credit'
  | 'investments'
  | 'custody';

/**
 * Bank product configuration.
 */
export interface BankProduct {
  readonly productType: BankProductType;
  readonly productName: string;
  readonly status: 'active' | 'pending' | 'cancelled';
  readonly activatedAt: Date;
}

/**
 * Relationship event types.
 */
export type RelationshipEventType =
  | 'pricing_review'
  | 'product_added'
  | 'issue_raised'
  | 'issue_resolved'
  | 'meeting'
  | 'contract_renewal';

/**
 * Relationship event record.
 */
export interface RelationshipEvent {
  readonly eventType: RelationshipEventType;
  readonly occurredAt: Date;
  readonly description: string;
  readonly participants?: string[] | undefined;
  readonly outcome?: string | undefined;
}

/**
 * Volume discount tier.
 */
export interface VolumeDiscount {
  readonly feeType: string;
  readonly thresholdVolume: number;
  readonly discountPercentage: number;
}

/**
 * Negotiated fee schedule with a bank.
 */
export interface FeeSchedule {
  readonly bankRelationshipId: string;
  readonly effectiveDate: Date;
  readonly expirationDate?: Date | undefined;

  // Transaction fees
  readonly domesticWireFee: Money;
  readonly internationalWireFee: Money;
  readonly achFee: Money;
  readonly rtpFee?: Money | undefined;
  readonly checkFee?: Money | undefined;

  // Service fees
  readonly monthlyMaintenanceFee: Money;
  readonly cashManagementFee?: Money | undefined;
  readonly positivePayFee?: Money | undefined;
  readonly statementFee?: Money | undefined;

  // FX spread (basis points from mid-market)
  readonly fxSpreadBps: number;

  // Volume discounts
  readonly volumeDiscounts?: VolumeDiscount[] | undefined;

  // Earnings credit rate (offset fees with balances)
  readonly earningsCreditRate?: number | undefined;

  // Contract reference
  readonly contractReference?: string | undefined;
  readonly nextReviewDate?: Date | undefined;
}

/**
 * Calculated relationship value for negotiation leverage.
 */
export interface RelationshipValue {
  readonly bankRelationshipId: string;
  readonly calculatedAt: Date;
  readonly period: {
    readonly start: Date;
    readonly end: Date;
  };

  // Deposit value
  readonly averageDailyBalance: Money;
  readonly compensatingBalances: Money;

  // Fee revenue to bank
  readonly transactionFees: Money;
  readonly serviceFees: Money;
  readonly fxRevenue: Money;

  // Credit utilization
  readonly avgCreditUtilization: number;
  readonly peakCreditUtilization: number;

  // Volume metrics
  readonly paymentVolume: number;
  readonly paymentValue: Money;
  readonly fxVolume: Money;

  // Calculated metrics
  readonly estimatedBankRevenue: Money;
  readonly relationshipScore: number;

  // Trend
  readonly trend: 'growing' | 'stable' | 'declining';
}

/**
 * Create a default fee schedule for negotiation baseline.
 */
export function createDefaultFeeSchedule(
  bankRelationshipId: string,
  currency: string
): FeeSchedule {
  return {
    bankRelationshipId,
    effectiveDate: new Date(),
    domesticWireFee: { amount: 25, currency },
    internationalWireFee: { amount: 45, currency },
    achFee: { amount: 0.50, currency },
    rtpFee: { amount: 1.00, currency },
    monthlyMaintenanceFee: { amount: 50, currency },
    fxSpreadBps: 100, // 1% spread
  };
}
