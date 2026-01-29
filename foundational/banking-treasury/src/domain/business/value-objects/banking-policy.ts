/**
 * Banking Policy Value Object
 *
 * Business-unit-specific rules for banking operations.
 * Defines approval thresholds, dual controls, permitted rails,
 * and compliance requirements.
 *
 * @module business/value-objects
 */

import type { Money, PaymentMethod } from '../../../types/financial.js';

/**
 * Approval threshold configuration.
 * Different amounts require different approval levels.
 */
export interface ApprovalThreshold {
  readonly currency: string;
  readonly amountThreshold: number;
  readonly requiredApprovers: number;
  readonly escalationPath?: string;
}

/**
 * Operations that may require dual control.
 */
export type DualControlOperation =
  | 'payment_create'
  | 'payment_approve'
  | 'account_modify'
  | 'beneficiary_add'
  | 'user_permission_change'
  | 'facility_draw';

/**
 * Dual control rule for sensitive operations.
 */
export interface DualControlRule {
  readonly operation: DualControlOperation;
  readonly threshold?: Money;
  readonly alwaysRequired: boolean;
}

/**
 * Compliance check types required before payment.
 */
export type ComplianceCheckType =
  | 'sanctions_screening'
  | 'pep_check'
  | 'adverse_media'
  | 'beneficial_ownership'
  | 'transaction_monitoring'
  | 'velocity_check'
  | 'country_risk';

/**
 * Counterparty restriction rules.
 */
export interface CounterpartyRule {
  readonly type: 'whitelist' | 'blacklist' | 'requires_approval';
  readonly countries?: string[];
  readonly entityTypes?: string[];
  readonly industryCategories?: string[];
}

/**
 * FX policy for a business unit.
 */
export interface FXPolicy {
  /** Natural currency for this business unit */
  readonly functionalCurrency: string;

  /** Auto-convert incoming foreign currency */
  readonly autoConvertInbound: boolean;

  /** Threshold above which hedging is required */
  readonly hedgeThreshold?: Money;

  /** Preferred FX provider (bank relationship ID) */
  readonly preferredFXProvider?: string;

  /** Maximum allowable spread from mid-market (basis points) */
  readonly maxSpreadBps?: number;

  /** Permitted hedging instruments */
  readonly permittedHedgingInstruments?: ('spot' | 'forward' | 'option' | 'ndf')[];
}

/**
 * Banking Policy value object.
 *
 * Encapsulates all rules governing banking operations for a business unit.
 */
export interface BankingPolicy {
  readonly businessUnitId: string;

  /** Approval thresholds by amount */
  readonly approvalThresholds: ApprovalThreshold[];

  /** Required dual control for certain operations */
  readonly dualControlRules: DualControlRule[];

  /** Permitted payment rails for this business unit */
  readonly permittedRails: PaymentMethod[];

  /** Required compliance checks before payment */
  readonly prePaymentChecks: ComplianceCheckType[];

  /** Counterparty restrictions */
  readonly counterpartyRules: CounterpartyRule[];

  /** FX policy for this unit */
  readonly fxPolicy: FXPolicy;

  /** Maximum single payment amount (requires exception for larger) */
  readonly maxSinglePayment?: Money;

  /** Daily aggregate payment limit */
  readonly dailyPaymentLimit?: Money;

  /** Cut-off time for same-day processing (HH:MM in local time) */
  readonly sameDayCutoff?: string;

  /** Whether international payments require additional approval */
  readonly internationalRequiresApproval: boolean;

  /** Effective date of this policy version */
  readonly effectiveFrom: Date;

  /** Optional expiration (for temporary policy changes) */
  readonly effectiveUntil?: Date;
}

/**
 * Create a default banking policy for a business unit.
 */
export function createDefaultBankingPolicy(
  businessUnitId: string,
  functionalCurrency: string
): BankingPolicy {
  return {
    businessUnitId,
    approvalThresholds: [
      { currency: functionalCurrency, amountThreshold: 10000, requiredApprovers: 1 },
      { currency: functionalCurrency, amountThreshold: 50000, requiredApprovers: 2 },
      { currency: functionalCurrency, amountThreshold: 250000, requiredApprovers: 3 },
    ],
    dualControlRules: [
      { operation: 'beneficiary_add', alwaysRequired: true },
      { operation: 'payment_approve', threshold: { amount: 100000, currency: functionalCurrency }, alwaysRequired: false },
    ],
    permittedRails: ['ach', 'same_day_ach', 'wire', 'rtp'],
    prePaymentChecks: ['sanctions_screening', 'velocity_check'],
    counterpartyRules: [],
    fxPolicy: {
      functionalCurrency,
      autoConvertInbound: false,
    },
    internationalRequiresApproval: true,
    effectiveFrom: new Date(),
  };
}

/**
 * Create a SaaS-optimized banking policy.
 */
export function createSaaSBankingPolicy(
  businessUnitId: string,
  functionalCurrency: string
): BankingPolicy {
  return {
    businessUnitId,
    approvalThresholds: [
      // Higher thresholds for predictable SaaS flows
      { currency: functionalCurrency, amountThreshold: 25000, requiredApprovers: 1 },
      { currency: functionalCurrency, amountThreshold: 100000, requiredApprovers: 2 },
    ],
    dualControlRules: [
      { operation: 'beneficiary_add', alwaysRequired: true },
      { operation: 'user_permission_change', alwaysRequired: true },
    ],
    permittedRails: ['ach', 'same_day_ach', 'wire', 'rtp', 'sepa', 'sepa_instant'],
    prePaymentChecks: ['sanctions_screening'],
    counterpartyRules: [],
    fxPolicy: {
      functionalCurrency,
      autoConvertInbound: true, // Convert customer payments to functional currency
      maxSpreadBps: 50,
    },
    internationalRequiresApproval: false, // Global SaaS typically has many international customers
    effectiveFrom: new Date(),
  };
}

/**
 * Create a Trading-optimized banking policy.
 */
export function createTradingBankingPolicy(
  businessUnitId: string,
  functionalCurrency: string
): BankingPolicy {
  return {
    businessUnitId,
    approvalThresholds: [
      // Lower thresholds for trade payments (higher individual value)
      { currency: functionalCurrency, amountThreshold: 5000, requiredApprovers: 1 },
      { currency: functionalCurrency, amountThreshold: 50000, requiredApprovers: 2 },
      { currency: functionalCurrency, amountThreshold: 200000, requiredApprovers: 3 },
    ],
    dualControlRules: [
      { operation: 'beneficiary_add', alwaysRequired: true },
      { operation: 'payment_approve', alwaysRequired: true }, // Always dual control for trading
      { operation: 'facility_draw', alwaysRequired: true },
    ],
    permittedRails: ['wire', 'swift', 'swift_gpi', 'sepa'],
    prePaymentChecks: [
      'sanctions_screening',
      'pep_check',
      'country_risk',
      'beneficial_ownership',
    ],
    counterpartyRules: [
      { type: 'requires_approval', countries: ['IR', 'KP', 'SY', 'CU', 'VE'] }, // High-risk countries
    ],
    fxPolicy: {
      functionalCurrency,
      autoConvertInbound: false, // Manual FX decisions for trading
      hedgeThreshold: { amount: 100000, currency: functionalCurrency },
      permittedHedgingInstruments: ['spot', 'forward'],
      maxSpreadBps: 30,
    },
    maxSinglePayment: { amount: 1000000, currency: functionalCurrency },
    internationalRequiresApproval: true,
    effectiveFrom: new Date(),
  };
}
