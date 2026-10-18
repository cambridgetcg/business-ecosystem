/**
 * CT600 Corporation Tax Return Model
 *
 * Represents the HMRC CT600 form structure for Corporation Tax returns.
 * Reference: https://www.gov.uk/government/publications/corporation-tax-return-ct600-2023-version-3
 */

import { z } from 'zod';
import type { CorporationTaxPeriod } from './period.js';

// =============================================================================
// CT600 Box Definitions
// =============================================================================

/**
 * CT600 Core Return - Main Boxes
 * Box numbers follow HMRC CT600 form
 */
export const CT600CoreSchema = z.object({
  // Company Information (Boxes 1-9)
  box1_companyName: z.string().max(160),
  box2_companyUTR: z.string().length(10),
  box3_taxReference: z.string().max(20).optional(),
  box4_companyRegistrationNumber: z.string().max(10).optional(),
  box5_registeredOffice: z.string().max(500),
  box6_tradingName: z.string().max(160).optional(),

  // Accounting Period (Boxes 30-35)
  box30_periodStart: z.date(),
  box31_periodEnd: z.date(),

  // Basic Trading Profits (Boxes 145-190)
  box145_tradingProfits: z.string(), // Trading profits
  box155_tradingLosses: z.string(), // Trading losses brought forward
  box160_netTradingProfits: z.string(), // Net trading profits after losses

  // Non-Trading Income (Boxes 190-215)
  box190_loanRelationshipsNonTrading: z.string(), // Interest/non-trading credits
  box195_intangibleAssetsIncome: z.string(), // Intangible assets credits
  box200_propertyIncome: z.string(), // Property business income
  box205_otherIncome: z.string(), // Other income

  // Chargeable Gains (Boxes 220-245)
  box220_chargeableGains: z.string(), // Chargeable gains
  box225_capitalLossesBroughtForward: z.string(), // Capital losses b/f used
  box235_netChargeableGains: z.string(), // Net chargeable gains

  // Total Profits (Boxes 275-290)
  box275_grossProfits: z.string(), // Gross profits before deductions

  // Deductions (Boxes 305-355)
  box305_tradingLossesRelief: z.string(), // Losses against profits
  box310_nontradingDeficits: z.string(), // Non-trading loan deficits
  box315_groupRelief: z.string(), // Group relief claimed
  box320_managementExpenses: z.string(), // Management expenses
  box325_qualifyingDonations: z.string(), // Qualifying charitable donations

  // Profits Chargeable to CT (Boxes 360-375)
  box360_profitsChargeableToCT: z.string(), // Profits chargeable to CT
  box365_financialYear1: z.string(), // FY apportioned profits (if straddles FYs)
  box370_financialYear2: z.string().optional(), // Second FY profits

  // Tax Calculation (Boxes 380-440)
  box380_ctAtMainRate: z.string(), // CT at main rate
  box385_ctAtSmallProfitsRate: z.string(), // CT at small profits rate
  box390_marginalRelief: z.string(), // Marginal relief
  box400_grossCT: z.string(), // Gross CT before reliefs
  box405_doubleTaxRelief: z.string(), // Double tax relief
  box410_underlyingTaxOnDividends: z.string(), // Underlying tax on dividends
  box415_foreignTaxCredit: z.string(), // Foreign tax credit
  box430_netCT: z.string(), // Net CT after reliefs

  // Additional Claims (Boxes 440-490)
  box440_rdTaxCredit: z.string(), // R&D tax credit
  box445_creativeTaxCredit: z.string(), // Creative industries credit
  box470_communityInvestmentRelief: z.string(), // Community investment relief
  box475_investmentZoneRelief: z.string(), // Investment zone relief

  // Final Tax Due (Boxes 505-530)
  box505_ctOutstanding: z.string(), // CT payable
  box510_ctRepayable: z.string(), // CT repayable
  box515_instalmentPayments: z.string(), // Instalment payments already made
  box520_taxPayable: z.string(), // Final tax payable
  box525_bankAccountForRepayment: z.string().optional(),

  // Declarations (Boxes 600+)
  box600_declaration: z.boolean(),
  box605_declarantName: z.string().max(100),
  box610_declarantStatus: z.enum(['director', 'company_secretary', 'agent', 'liquidator', 'administrator']),
  box615_declarationDate: z.date(),
});

export type CT600Core = z.infer<typeof CT600CoreSchema>;

// =============================================================================
// CT600 Supplementary Pages
// =============================================================================

/**
 * CT600A - Loans to participators (Close companies)
 */
export const CT600ASchema = z.object({
  included: z.boolean(),
  totalLoansOutstanding: z.string().optional(),
  s455TaxDue: z.string().optional(),
  loansRepaid: z.array(z.object({
    participatorName: z.string(),
    loanAmount: z.string(),
    dateAdvanced: z.date(),
    dateRepaid: z.date().optional(),
    taxDue: z.string(),
  })).optional(),
});

/**
 * CT600B - Controlled foreign companies
 */
export const CT600BSchema = z.object({
  included: z.boolean(),
  hasCFCs: z.boolean(),
});

/**
 * CT600C - Group and consortium relief
 */
export const CT600CSchema = z.object({
  included: z.boolean(),
  claimingGroupRelief: z.boolean(),
  surrenderingGroupRelief: z.boolean(),
  groupReliefClaimed: z.string().optional(),
  groupReliefSurrendered: z.string().optional(),
  consortiumRelief: z.boolean(),
});

/**
 * CT600D - Insurance companies
 */
export const CT600DSchema = z.object({
  included: z.boolean(),
});

/**
 * CT600E - Charities and community amateur sports clubs
 */
export const CT600ESchema = z.object({
  included: z.boolean(),
  charityRegistrationNumber: z.string().optional(),
  exemptIncome: z.string().optional(),
});

/**
 * CT600H - Cross-border group relief
 */
export const CT600HSchema = z.object({
  included: z.boolean(),
});

/**
 * CT600I - Supplementary charge for ring fence profits (oil & gas)
 */
export const CT600ISchema = z.object({
  included: z.boolean(),
});

/**
 * CT600J - Research & Development tax credits
 */
export const CT600JSchema = z.object({
  included: z.boolean(),
  smeScheme: z.boolean(),
  rdecScheme: z.boolean(),
  qualifyingRDExpenditure: z.string().optional(),
  enhancedExpenditure: z.string().optional(),
  rdTaxCredit: z.string().optional(),
});

/**
 * CT600K - Tonnage tax
 */
export const CT600KSchema = z.object({
  included: z.boolean(),
});

/**
 * CT600L - Carried forward trade losses
 */
export const CT600LSchema = z.object({
  included: z.boolean(),
  lossesAtPeriodStart: z.string().optional(),
  lossesArisingInPeriod: z.string().optional(),
  lossesUsedAgainstProfits: z.string().optional(),
  lossesUsedAgainstGains: z.string().optional(),
  lossesCarriedForward: z.string().optional(),
});

// =============================================================================
// Full CT600 Return
// =============================================================================

export const CT600ReturnSchema = z.object({
  // Metadata
  id: z.string().uuid(),
  periodId: z.string().uuid(),
  tenantId: z.string().uuid(),
  entityId: z.string().uuid(),

  // Version and status
  version: z.number().int().positive().default(1),
  status: z.enum(['draft', 'validated', 'submitted', 'acknowledged', 'amended']),

  // Core return
  core: CT600CoreSchema,

  // Supplementary pages
  ct600a: CT600ASchema.optional(),
  ct600b: CT600BSchema.optional(),
  ct600c: CT600CSchema.optional(),
  ct600d: CT600DSchema.optional(),
  ct600e: CT600ESchema.optional(),
  ct600h: CT600HSchema.optional(),
  ct600i: CT600ISchema.optional(),
  ct600j: CT600JSchema.optional(),
  ct600k: CT600KSchema.optional(),
  ct600l: CT600LSchema.optional(),

  // Attachments
  computations: z.object({
    included: z.boolean(),
    fileRef: z.string().optional(),
  }).optional(),

  accounts: z.object({
    included: z.boolean(),
    iXBRL: z.boolean(),
    fileRef: z.string().optional(),
  }).optional(),

  // Submission details
  submittedAt: z.date().optional(),
  hmrcCorrelationId: z.string().optional(),
  hmrcReceiptNumber: z.string().optional(),

  // Audit
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CT600Return = z.infer<typeof CT600ReturnSchema>;

// =============================================================================
// Preparation Input
// =============================================================================

export interface CT600PreparationInput {
  period: CorporationTaxPeriod;
  companyInfo: {
    companyName: string;
    utr: string;
    registrationNumber?: string;
    registeredOffice: string;
    tradingName?: string;
    taxReference?: string;
  };
  declarant: {
    name: string;
    status: 'director' | 'company_secretary' | 'agent' | 'liquidator' | 'administrator';
  };
  supplementaryPages?: {
    ct600a?: boolean;
    ct600b?: boolean;
    ct600c?: Partial<z.infer<typeof CT600CSchema>>;
    ct600e?: Partial<z.infer<typeof CT600ESchema>>;
    ct600j?: Partial<z.infer<typeof CT600JSchema>>;
    ct600l?: Partial<z.infer<typeof CT600LSchema>>;
  };
  includeComputations?: boolean;
  includeAccounts?: boolean;
}

// =============================================================================
// Validation Results
// =============================================================================

export interface CT600ValidationResult {
  valid: boolean;
  errors: Array<{
    box: string;
    message: string;
    severity: 'error' | 'warning';
  }>;
  warnings: Array<{
    box: string;
    message: string;
  }>;
}
