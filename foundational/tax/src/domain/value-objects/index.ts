/**
 * UK Tax Domain Value Objects and Enums
 *
 * Defines UK-specific tax constants, enums, and value objects for:
 * - Corporation Tax
 * - VAT (MTD compliant)
 * - PAYE / National Insurance
 */

import { z } from 'zod';

// =============================================================================
// UK Tax Year
// =============================================================================

/**
 * UK tax year format: "2024-25" (April 6, 2024 to April 5, 2025)
 */
export const UKTaxYearSchema = z.string().regex(/^\d{4}-\d{2}$/, 'Invalid UK tax year format (e.g., 2024-25)');
export type UKTaxYear = z.infer<typeof UKTaxYearSchema>;

/**
 * Calculate UK tax year from a date
 */
export function getTaxYear(date: Date): UKTaxYear {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed
  const day = date.getDate();

  // Tax year starts 6 April
  if (month < 3 || (month === 3 && day < 6)) {
    // Before 6 April - previous tax year
    return `${year - 1}-${String(year).slice(2)}`;
  }
  return `${year}-${String(year + 1).slice(2)}`;
}

/**
 * Get tax year start date
 */
export function getTaxYearStart(taxYear: UKTaxYear): Date {
  const startYear = parseInt(taxYear.split('-')[0], 10);
  return new Date(startYear, 3, 6); // April 6
}

/**
 * Get tax year end date
 */
export function getTaxYearEnd(taxYear: UKTaxYear): Date {
  const startYear = parseInt(taxYear.split('-')[0], 10);
  return new Date(startYear + 1, 3, 5); // April 5 next year
}

// =============================================================================
// VAT Schemes
// =============================================================================

export const VATSchemeSchema = z.enum([
  'standard',           // Standard VAT accounting
  'flat_rate',          // Flat Rate Scheme
  'cash_accounting',    // Cash Accounting Scheme
  'annual_accounting',  // Annual Accounting Scheme
]);
export type VATScheme = z.infer<typeof VATSchemeSchema>;

/**
 * Flat Rate Scheme percentages by business type (2024/25)
 * Key categories - full list has 54 trade sectors
 */
export const FlatRatePercentages: Record<string, number> = {
  'accountancy_bookkeeping': 14.5,
  'advertising': 11.0,
  'agricultural_services': 11.0,
  'architect_surveyor': 14.5,
  'boarding_kennels': 12.0,
  'business_services': 12.0,
  'catering_takeaway': 12.5,
  'computer_it_consultancy': 14.5,
  'computer_repair': 10.5,
  'entertainment_journalism': 12.5,
  'estate_agency': 12.0,
  'farming': 6.5,
  'film_radio_tv': 13.0,
  'financial_services': 13.5,
  'general_building': 9.5,
  'hairdressing_beauty': 13.0,
  'hiring_renting': 9.5,
  'hotel_accommodation': 10.5,
  'investigation_security': 12.0,
  'labour_only_construction': 14.5,
  'laundry_dry_cleaning': 12.0,
  'lawyer_legal_services': 14.5,
  'library_archive': 12.0,
  'management_consultancy': 14.0,
  'manufacturing_food': 9.0,
  'manufacturing_other': 9.5,
  'membership_organisation': 8.0,
  'mining_quarrying': 10.0,
  'packaging': 9.0,
  'photography': 11.0,
  'post_office': 5.0,
  'printing': 8.5,
  'publishing': 11.0,
  'pubs': 6.5,
  'real_estate_property': 14.0,
  'repairing_personal_goods': 10.0,
  'repairing_vehicles': 8.5,
  'restaurant_cafe': 12.5,
  'retailing_food': 4.0,
  'retailing_vehicles': 6.5,
  'retailing_other': 7.5,
  'secretarial': 13.0,
  'social_work': 11.0,
  'sport_recreation': 8.5,
  'transport_freight': 10.0,
  'travel_agency': 10.5,
  'veterinary_medicine': 11.0,
  'waste_scrap': 10.5,
  'wholesale_agricultural': 8.0,
  'wholesale_food': 7.5,
  'wholesale_other': 8.5,
  'other': 12.0, // Default if no category matches
};

/**
 * VAT quarter ending months (stagger groups)
 */
export const VATQuarterEndSchema = z.enum([
  'march',  // Stagger 1: Mar, Jun, Sep, Dec
  'april',  // Stagger 2: Apr, Jul, Oct, Jan
  'may',    // Stagger 3: May, Aug, Nov, Feb
]);
export type VATQuarterEnd = z.infer<typeof VATQuarterEndSchema>;

/**
 * UK VAT rates
 */
export const VATRates = {
  STANDARD: 0.20,       // 20%
  REDUCED: 0.05,        // 5%
  ZERO: 0.00,           // 0%
} as const;

// =============================================================================
// National Insurance Categories
// =============================================================================

export const NICategorySchema = z.enum([
  'A',  // Standard rate - most employees
  'B',  // Married women's reduced rate
  'C',  // Employees over State Pension age
  'F',  // Freeport employees
  'H',  // Apprentice under 25
  'I',  // Married women's reduced rate (contracted out)
  'J',  // Deferment (employee has other job)
  'L',  // Freeport, deferment
  'M',  // Under 21
  'S',  // State Pension age employees
  'V',  // Veterans first year civilian employment
  'Z',  // Under 21, deferment
]);
export type NICategory = z.infer<typeof NICategorySchema>;

/**
 * NI Thresholds (2024/25) - Weekly values
 */
export const NIThresholds2024 = {
  LEL: 123,     // Lower Earnings Limit
  PT: 242,      // Primary Threshold (employee starts paying)
  ST: 175,      // Secondary Threshold (employer starts paying)
  FUST: 481,    // Freeport Upper Secondary Threshold
  UST: 967,     // Upper Secondary Threshold (under 21s)
  AUST: 967,    // Apprentice Upper Secondary Threshold
  VUST: 967,    // Veterans Upper Secondary Threshold
  UEL: 967,     // Upper Earnings Limit
} as const;

/**
 * NI Rates (2024/25) - after April 2024 reduction
 */
export const NIRates2024 = {
  employee: {
    main: 0.08,        // 8% between PT and UEL (reduced from 10%)
    additional: 0.02,  // 2% above UEL
  },
  employer: {
    standard: 0.138,   // 13.8% above ST
    under21: 0.00,     // 0% up to UST, then 13.8%
    apprentice: 0.00,  // 0% up to AUST, then 13.8%
    veteran: 0.00,     // 0% up to VUST, then 13.8%
    freeport: 0.00,    // 0% up to FUST, then 13.8%
  },
} as const;

// =============================================================================
// Tax Codes
// =============================================================================

/**
 * PAYE Tax Code format validation
 * Examples: 1257L, BR, D0, D1, NT, 0T, K500, S1257L, C1257L
 */
export const TaxCodeSchema = z.string().regex(
  /^([SC]?)(\d{1,4}[LMNPTWY]|BR|D[01]|NT|0T|K\d{1,4})$/i,
  'Invalid UK tax code format'
);
export type TaxCode = z.infer<typeof TaxCodeSchema>;

/**
 * Personal Allowance (2024/25)
 */
export const PersonalAllowance2024 = 12570;

/**
 * Income Tax bands (2024/25) - Rest of UK
 */
export const IncomeTaxBands2024 = {
  basic: { rate: 0.20, threshold: 37700 },      // 20% up to £37,700
  higher: { rate: 0.40, threshold: 125140 },    // 40% £37,701 to £125,140
  additional: { rate: 0.45 },                    // 45% above £125,140
} as const;

/**
 * Scottish Income Tax bands (2024/25)
 */
export const ScottishIncomeTaxBands2024 = {
  starter: { rate: 0.19, threshold: 2306 },     // 19% up to £2,306
  basic: { rate: 0.20, threshold: 13991 },      // 20% £2,307 to £13,991
  intermediate: { rate: 0.21, threshold: 31092 }, // 21% £13,992 to £31,092
  higher: { rate: 0.42, threshold: 125140 },    // 42% £31,093 to £125,140
  top: { rate: 0.47 },                          // 47% above £125,140
} as const;

/**
 * Welsh Income Tax bands (2024/25)
 *
 * Wales has had power to set its own income tax rates since April 2019.
 * Welsh residents have tax codes prefixed with 'C'.
 * Currently, Welsh rates match the rest of UK (England/NI) rates,
 * but this may change in future. Defined separately for future-proofing.
 */
export const WelshIncomeTaxBands2024 = {
  basic: { rate: 0.20, threshold: 37700 },      // 20% up to £37,700
  higher: { rate: 0.40, threshold: 125140 },    // 40% £37,701 to £125,140
  additional: { rate: 0.45 },                    // 45% above £125,140
} as const;

/**
 * Tax region enum for clarity
 */
export const TaxRegion = {
  REST_OF_UK: 'rest_of_uk',  // England and Northern Ireland
  SCOTLAND: 'scotland',
  WALES: 'wales',
} as const;
export type TaxRegion = (typeof TaxRegion)[keyof typeof TaxRegion];

// =============================================================================
// Corporation Tax
// =============================================================================

/**
 * Corporation Tax rates (FY 2023/24 onwards)
 */
export const CorporationTaxRates = {
  SMALL_PROFITS_RATE: 0.19,        // 19% for profits <= £50,000
  MAIN_RATE: 0.25,                  // 25% for profits > £250,000
  MARGINAL_RELIEF_FRACTION: 3 / 200, // 3/200 for profits between thresholds
  LOWER_LIMIT: 50000,               // £50,000
  UPPER_LIMIT: 250000,              // £250,000
} as const;

/**
 * Corporation Tax Financial Year format: "FY2024" (April 1, 2024 to March 31, 2025)
 */
export const FinancialYearSchema = z.string().regex(/^FY\d{4}$/, 'Invalid financial year format (e.g., FY2024)');
export type FinancialYear = z.infer<typeof FinancialYearSchema>;

// =============================================================================
// HMRC Reference Numbers
// =============================================================================

/**
 * Company UTR (Unique Taxpayer Reference) - 10 digits
 */
export const UTRSchema = z.string().regex(/^\d{10}$/, 'UTR must be exactly 10 digits');
export type UTR = z.infer<typeof UTRSchema>;

/**
 * VAT Registration Number - GB + 9 or 12 digits
 */
export const VATNumberSchema = z.string().regex(
  /^GB(\d{9}|\d{12})$/,
  'VAT number must be GB followed by 9 or 12 digits'
);
export type VATNumber = z.infer<typeof VATNumberSchema>;

/**
 * PAYE Reference - Office number (3 digits) + Employer Reference (alphanumeric)
 */
export const PAYEReferenceSchema = z.string().regex(
  /^\d{3}\/[A-Z0-9]+$/,
  'PAYE reference must be in format 123/ABC123'
);
export type PAYEReference = z.infer<typeof PAYEReferenceSchema>;

/**
 * Accounts Office Reference - 13 characters
 */
export const AccountsOfficeReferenceSchema = z.string().regex(
  /^\d{3}P[A-Z]\d{8}$/,
  'Invalid Accounts Office Reference format'
);
export type AccountsOfficeReference = z.infer<typeof AccountsOfficeReferenceSchema>;

/**
 * National Insurance Number
 */
export const NINOSchema = z.string().regex(
  /^[A-CEGHJ-PR-TW-Z]{2}\d{6}[A-D]$/,
  'Invalid National Insurance Number format'
);
export type NINO = z.infer<typeof NINOSchema>;

// =============================================================================
// Student Loan Plans
// =============================================================================

export const StudentLoanPlanSchema = z.enum([
  'plan1',     // Pre-2012 England/Wales, all Scotland/NI
  'plan2',     // Post-2012 England/Wales
  'plan4',     // Scotland post-2017
  'plan5',     // Post-2023 England/Wales
  'postgrad',  // Postgraduate Loan
]);
export type StudentLoanPlan = z.infer<typeof StudentLoanPlanSchema>;

/**
 * Student Loan thresholds and rates (2024/25) - Annual
 */
export const StudentLoanThresholds2024 = {
  plan1: { threshold: 24990, rate: 0.09 },
  plan2: { threshold: 27295, rate: 0.09 },
  plan4: { threshold: 31395, rate: 0.09 },
  plan5: { threshold: 25000, rate: 0.09 },
  postgrad: { threshold: 21000, rate: 0.06 },
} as const;

// =============================================================================
// RTI Submission Types
// =============================================================================

export const RTISubmissionTypeSchema = z.enum([
  'fps',  // Full Payment Submission
  'eps',  // Employer Payment Summary
  'nvr',  // NINO Verification Request
  'ear',  // Earlier Year Update
]);
export type RTISubmissionType = z.infer<typeof RTISubmissionTypeSchema>;

// =============================================================================
// Starter Declarations (P46)
// =============================================================================

export const StarterDeclarationSchema = z.enum([
  'A',  // First job since 6 April, no benefits
  'B',  // Only job, receiving benefits
  'C',  // Another job or pension
]);
export type StarterDeclaration = z.infer<typeof StarterDeclarationSchema>;

// =============================================================================
// Payment Frequencies
// =============================================================================

export const PaymentFrequencySchema = z.enum([
  'weekly',       // 52 periods
  'fortnightly',  // 26 periods
  'four_weekly',  // 13 periods
  'monthly',      // 12 periods
  'quarterly',    // 4 periods
  'annually',     // 1 period
]);
export type PaymentFrequency = z.infer<typeof PaymentFrequencySchema>;

/**
 * Periods per year for each frequency
 */
export const PeriodsPerYear: Record<PaymentFrequency, number> = {
  weekly: 52,
  fortnightly: 26,
  four_weekly: 13,
  monthly: 12,
  quarterly: 4,
  annually: 1,
};
