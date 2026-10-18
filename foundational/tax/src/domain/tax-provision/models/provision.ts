/**
 * Tax Provision Model
 *
 * Represents tax provisions for financial reporting under IFRS/UK GAAP.
 * Includes current tax, deferred tax, and uncertain tax positions.
 */

import { z } from 'zod';

// =============================================================================
// Tax Provision Status
// =============================================================================

export const TaxProvisionStatusSchema = z.enum([
  'draft',        // Initial calculation
  'reviewed',     // Reviewed by tax team
  'approved',     // Approved for reporting
  'final',        // Final for period
  'restated',     // Restated in subsequent period
]);

export type TaxProvisionStatus = z.infer<typeof TaxProvisionStatusSchema>;

// =============================================================================
// Current Tax Provision
// =============================================================================

export const CurrentTaxProvisionSchema = z.object({
  // Corporation Tax
  ukCorporationTax: z.string(),
  ukCorporationTaxRate: z.string(),

  // Overseas tax
  overseasTax: z.string(),
  overseasTaxByJurisdiction: z.array(z.object({
    jurisdiction: z.string(),
    taxableProfit: z.string(),
    taxRate: z.string(),
    taxCharge: z.string(),
    withholdingTax: z.string().default('0'),
  })).default([]),

  // Adjustments
  adjustmentsPriorPeriods: z.string().default('0'),
  adjustmentsCurrentPeriod: z.string().default('0'),

  // R&D and other credits
  rdTaxCredits: z.string().default('0'),
  otherTaxCredits: z.string().default('0'),

  // Group relief
  groupReliefReceived: z.string().default('0'),
  groupReliefSurrendered: z.string().default('0'),

  // Total current tax
  totalCurrentTaxCharge: z.string(),
});

export type CurrentTaxProvision = z.infer<typeof CurrentTaxProvisionSchema>;

// =============================================================================
// Deferred Tax Components
// =============================================================================

export const DeferredTaxItemSchema = z.object({
  category: z.enum([
    'accelerated_capital_allowances',
    'revaluation_gains',
    'intangible_assets',
    'share_based_payments',
    'pension_obligations',
    'provisions',
    'trading_losses',
    'capital_losses',
    'other_timing_differences',
  ]),
  description: z.string().max(500),
  temporaryDifference: z.string(),
  taxRate: z.string(),
  deferredTaxAsset: z.string().default('0'),
  deferredTaxLiability: z.string().default('0'),
  movementInYear: z.string(),
  recognitionBasis: z.enum(['probable', 'virtually_certain', 'not_recognised']),
});

export type DeferredTaxItem = z.infer<typeof DeferredTaxItemSchema>;

export const DeferredTaxProvisionSchema = z.object({
  // Opening balances
  openingDeferredTaxAsset: z.string(),
  openingDeferredTaxLiability: z.string(),

  // Individual components
  items: z.array(DeferredTaxItemSchema),

  // Movements
  chargeToIncomeStatement: z.string(),
  chargeToOCI: z.string().default('0'), // Other comprehensive income
  chargeToEquity: z.string().default('0'),
  acquisitionsDisposals: z.string().default('0'),
  exchangeDifferences: z.string().default('0'),
  rateChange: z.string().default('0'),
  otherMovements: z.string().default('0'),

  // Closing balances
  closingDeferredTaxAsset: z.string(),
  closingDeferredTaxLiability: z.string(),
  netDeferredTaxPosition: z.string(), // Asset positive, Liability negative

  // Unrecognised items
  unrecognisedDeferredTaxAssets: z.string().default('0'),
  unrecognisedLossesCarriedForward: z.string().default('0'),
});

export type DeferredTaxProvision = z.infer<typeof DeferredTaxProvisionSchema>;

// =============================================================================
// Uncertain Tax Positions (UTP)
// =============================================================================

export const UncertainTaxPositionSchema = z.object({
  id: z.string().uuid(),
  description: z.string().max(1000),
  jurisdiction: z.string(),
  taxType: z.enum(['corporation_tax', 'vat', 'transfer_pricing', 'withholding_tax', 'other']),

  // Risk assessment
  potentialExposure: z.string(),
  probabilityOfPayment: z.string(), // 0-1
  expectedPayment: z.string(), // Exposure × Probability
  bestEstimate: z.string(),
  worstCase: z.string(),

  // Timing
  expectedResolutionDate: z.date().optional(),
  statuteOfLimitationsDate: z.date().optional(),

  // Status
  status: z.enum(['open', 'under_review', 'disputed', 'resolved', 'expired']),
  interestAccrued: z.string().default('0'),
  penaltiesAccrued: z.string().default('0'),

  // Documentation
  notes: z.string().max(2000).optional(),
  supportingDocuments: z.array(z.string()).default([]),
});

export type UncertainTaxPosition = z.infer<typeof UncertainTaxPositionSchema>;

// =============================================================================
// Tax Rate Reconciliation
// =============================================================================

export const TaxRateReconciliationItemSchema = z.object({
  description: z.string().max(200),
  amount: z.string(),
  effectiveRateImpact: z.string(), // Percentage points
});

export const TaxRateReconciliationSchema = z.object({
  profitBeforeTax: z.string(),
  standardTaxRate: z.string(),
  expectedTaxCharge: z.string(), // Profit × Standard rate

  // Reconciling items
  items: z.array(TaxRateReconciliationItemSchema),

  // Common reconciling items
  permanentDifferences: z.string().default('0'),
  disallowableExpenses: z.string().default('0'),
  nonTaxableIncome: z.string().default('0'),
  taxRateChanges: z.string().default('0'),
  overseasTaxRateDifferential: z.string().default('0'),
  priorPeriodAdjustments: z.string().default('0'),
  otherAdjustments: z.string().default('0'),

  // Final
  actualTaxCharge: z.string(),
  effectiveTaxRate: z.string(),
});

export type TaxRateReconciliation = z.infer<typeof TaxRateReconciliationSchema>;

// =============================================================================
// Complete Tax Provision
// =============================================================================

export const TaxProvisionSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  entityId: z.string().uuid(),

  // Period
  periodStart: z.date(),
  periodEnd: z.date(),
  reportingFramework: z.enum(['IFRS', 'UK_GAAP', 'FRS_102', 'FRS_105']),

  // Financial data
  profitBeforeTax: z.string(),
  profitLossForTax: z.string(), // After tax adjustments

  // Current tax
  currentTax: CurrentTaxProvisionSchema,

  // Deferred tax
  deferredTax: DeferredTaxProvisionSchema,

  // Uncertain tax positions
  uncertainTaxPositions: z.array(UncertainTaxPositionSchema).default([]),
  totalUTPProvision: z.string().default('0'),

  // Tax rate reconciliation
  rateReconciliation: TaxRateReconciliationSchema,

  // Summary
  totalTaxCharge: z.string(), // Current + Deferred
  effectiveTaxRate: z.string(),

  // Balance sheet
  currentTaxAsset: z.string().default('0'),
  currentTaxLiability: z.string().default('0'),
  netCurrentTaxPosition: z.string(),

  // Status and audit
  status: TaxProvisionStatusSchema,
  calculatedAt: z.date(),
  reviewedAt: z.date().optional(),
  reviewedBy: z.string().uuid().optional(),
  approvedAt: z.date().optional(),
  approvedBy: z.string().uuid().optional(),

  // Notes
  notes: z.string().max(5000).optional(),
  metadata: z.record(z.unknown()).optional(),

  // Audit
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid().optional(),
  version: z.number().int().positive().default(1),
});

export type TaxProvision = z.infer<typeof TaxProvisionSchema>;

// =============================================================================
// Input Types
// =============================================================================

export interface TaxProvisionInput {
  tenantId: string;
  entityId: string;
  periodStart: Date;
  periodEnd: Date;
  reportingFramework: 'IFRS' | 'UK_GAAP' | 'FRS_102' | 'FRS_105';
  profitBeforeTax: string;

  // Tax computation inputs
  taxableProfit: string;
  taxRate: string;
  overseasProfits?: Array<{
    jurisdiction: string;
    profit: string;
    rate: string;
  }>;

  // Adjustments
  priorPeriodAdjustments?: string;
  rdTaxCredits?: string;
  groupRelief?: string;

  // Deferred tax items
  deferredTaxItems?: Array<{
    category: DeferredTaxItem['category'];
    description: string;
    temporaryDifference: string;
    recognitionBasis: DeferredTaxItem['recognitionBasis'];
  }>;

  // Opening balances
  openingDeferredTaxAsset?: string;
  openingDeferredTaxLiability?: string;
  openingCurrentTaxAsset?: string;
  openingCurrentTaxLiability?: string;

  // Payments
  taxPaymentsInYear?: string;
}
