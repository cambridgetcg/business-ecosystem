/**
 * Employee Tax Record Domain Model
 *
 * Tracks employee tax data for PAYE/NI calculations:
 * - Tax codes and NI categories
 * - Year-to-date figures
 * - Student loan status
 * - Starter/leaver information
 */

import { z } from 'zod';
import {
  NICategorySchema,
  TaxCodeSchema,
  StudentLoanPlanSchema,
  PaymentFrequencySchema,
  StarterDeclarationSchema,
  UKTaxYearSchema,
  NINOSchema,
} from '../../value-objects/index.js';

// =============================================================================
// Employment Status
// =============================================================================

export const EmploymentStatusSchema = z.enum([
  'active',      // Currently employed
  'on_leave',    // On leave (maternity, sickness, etc.)
  'terminated',  // Left employment
  'suspended',   // Temporarily suspended
]);
export type EmploymentStatus = z.infer<typeof EmploymentStatusSchema>;

// =============================================================================
// Director NI Method
// =============================================================================

export const DirectorNIMethodSchema = z.enum([
  'annual',      // Annual earnings method (default for directors)
  'alternative', // Alternative method (cumulative monthly/weekly)
]);
export type DirectorNIMethod = z.infer<typeof DirectorNIMethodSchema>;

// =============================================================================
// Employee Tax Record
// =============================================================================

export const EmployeeTaxRecordSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  entityId: z.string().uuid(),
  employeeId: z.string().uuid(), // Reference to HR/People service

  // Tax identifiers
  nationalInsuranceNumber: NINOSchema.nullable(),
  taxCode: TaxCodeSchema,
  niCategory: NICategorySchema,
  isDirector: z.boolean(),
  directorNIMethod: DirectorNIMethodSchema.nullable(),
  directorAppointmentDate: z.date().nullable(),

  // Student loans
  studentLoanPlan: StudentLoanPlanSchema.nullable(),
  hasPostgraduateLoan: z.boolean(),

  // Employment details
  employmentStatus: EmploymentStatusSchema,
  payFrequency: PaymentFrequencySchema,
  payrollId: z.string().max(35).nullable(), // Employer's payroll ID

  // Current tax year
  taxYear: UKTaxYearSchema,

  // Year-to-Date figures (cumulative for tax year)
  grossPayYTD: z.string(),
  taxablePayYTD: z.string(),
  taxPaidYTD: z.string(),
  niablePayYTD: z.string(), // Pay subject to NI
  employeeNIYTD: z.string(),
  employerNIYTD: z.string(),
  studentLoanYTD: z.string(),
  postgraduateLoanYTD: z.string(),

  // Benefits in kind
  benefitsInKindYTD: z.string(),
  benefitsTaxYTD: z.string(),

  // Statutory payments YTD
  smpYTD: z.string(),
  sppYTD: z.string(),
  sapYTD: z.string(),
  shppYTD: z.string(),
  sspYTD: z.string(),

  // Period tracking
  currentPeriodNumber: z.number().int().min(1),
  periodsWorkedThisYear: z.number().int().min(0),

  // Starter/Leaver information
  startDate: z.date(),
  leaveDate: z.date().nullable(),
  starterDeclaration: StarterDeclarationSchema.nullable(),
  p45Details: z.object({
    previousEmployer: z.string().nullable(),
    taxCodeAtLeaving: z.string().nullable(),
    lastPayDate: z.date().nullable(),
    totalPayToDate: z.string().nullable(),
    totalTaxToDate: z.string().nullable(),
  }).nullable(),

  // P60/P45 generated
  p60Issued: z.boolean(),
  p60IssuedAt: z.date().nullable(),
  p45Issued: z.boolean(),
  p45IssuedAt: z.date().nullable(),

  // Week 1/Month 1 basis
  week1Month1Basis: z.boolean(), // Non-cumulative tax calculation

  // Irregular employment
  irregularPaymentPattern: z.boolean(),
  offPayrollWorker: z.boolean(), // IR35

  // Audit
  notes: z.string().max(2000).nullable(),
  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional(),
  version: z.number().int().positive(),
  deletedAt: z.date().nullable(),
});

export type EmployeeTaxRecord = z.infer<typeof EmployeeTaxRecordSchema>;

// =============================================================================
// Create Input
// =============================================================================

export const CreateEmployeeTaxRecordInputSchema = z.object({
  tenantId: z.string().uuid(),
  entityId: z.string().uuid(),
  employeeId: z.string().uuid(),
  nationalInsuranceNumber: NINOSchema.optional(),
  taxCode: TaxCodeSchema.default('1257L'),
  niCategory: NICategorySchema.default('A'),
  isDirector: z.boolean().default(false),
  directorNIMethod: DirectorNIMethodSchema.optional(),
  studentLoanPlan: StudentLoanPlanSchema.optional(),
  hasPostgraduateLoan: z.boolean().default(false),
  payFrequency: PaymentFrequencySchema.default('monthly'),
  payrollId: z.string().max(35).optional(),
  startDate: z.date(),
  starterDeclaration: StarterDeclarationSchema.optional(),
  p45Details: z.object({
    previousEmployer: z.string().optional(),
    taxCodeAtLeaving: z.string().optional(),
    lastPayDate: z.date().optional(),
    totalPayToDate: z.string().optional(),
    totalTaxToDate: z.string().optional(),
  }).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateEmployeeTaxRecordInput = z.infer<typeof CreateEmployeeTaxRecordInputSchema>;

// =============================================================================
// Update Input
// =============================================================================

export const UpdateEmployeeTaxRecordInputSchema = z.object({
  taxCode: TaxCodeSchema.optional(),
  niCategory: NICategorySchema.optional(),
  studentLoanPlan: StudentLoanPlanSchema.nullable().optional(),
  hasPostgraduateLoan: z.boolean().optional(),
  payFrequency: PaymentFrequencySchema.optional(),
  week1Month1Basis: z.boolean().optional(),
  irregularPaymentPattern: z.boolean().optional(),
  offPayrollWorker: z.boolean().optional(),
  leaveDate: z.date().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type UpdateEmployeeTaxRecordInput = z.infer<typeof UpdateEmployeeTaxRecordInputSchema>;

// =============================================================================
// Pay Period Input (for calculations)
// =============================================================================

export const PayPeriodInputSchema = z.object({
  employeeId: z.string().uuid(),
  periodNumber: z.number().int().min(1),
  payDate: z.date(),
  grossPay: z.string(),
  preTaxDeductions: z.string().default('0'), // Pension, salary sacrifice, etc.
  benefitsInKind: z.string().default('0'),
  studentLoanDeduction: z.string().optional(), // Override calculated amount
  pensionContribution: z.string().default('0'),
  pensionMethod: z.enum(['net_pay', 'relief_at_source']).default('net_pay'),
});

export type PayPeriodInput = z.infer<typeof PayPeriodInputSchema>;

// =============================================================================
// Domain Logic
// =============================================================================

/**
 * Parse tax code to extract allowance
 * Examples: 1257L = £12,570, K500 = negative £5,000, BR = basic rate only
 */
export function parseTaxCode(taxCode: string): {
  allowance: number;
  isScottish: boolean;
  isWelsh: boolean;
  isKCode: boolean;
  suffix: string | null;
} {
  const upperCode = taxCode.toUpperCase();
  const isScottish = upperCode.startsWith('S');
  const isWelsh = upperCode.startsWith('C');

  // Remove S or C prefix if present
  let code = upperCode;
  if (isScottish || isWelsh) {
    code = code.substring(1);
  }

  // Handle special codes
  if (code === 'BR') {
    return { allowance: 0, isScottish, isWelsh, isKCode: false, suffix: 'BR' };
  }
  if (code === 'D0') {
    return { allowance: 0, isScottish, isWelsh, isKCode: false, suffix: 'D0' };
  }
  if (code === 'D1') {
    return { allowance: 0, isScottish, isWelsh, isKCode: false, suffix: 'D1' };
  }
  if (code === 'NT') {
    return { allowance: Infinity, isScottish, isWelsh, isKCode: false, suffix: 'NT' };
  }
  if (code === '0T') {
    return { allowance: 0, isScottish, isWelsh, isKCode: false, suffix: '0T' };
  }

  // Handle K codes (negative allowance - underpaid tax from previous years)
  const isKCode = code.startsWith('K');
  if (isKCode) {
    const numericPart = parseInt(code.substring(1), 10);
    return {
      allowance: -(numericPart * 10),
      isScottish,
      isWelsh,
      isKCode: true,
      suffix: 'K',
    };
  }

  // Standard codes: number + suffix letter
  const match = code.match(/^(\d+)([LMNPTWY])$/);
  if (match) {
    const numericPart = parseInt(match[1], 10);
    return {
      allowance: numericPart * 10,
      isScottish,
      isWelsh,
      isKCode: false,
      suffix: match[2],
    };
  }

  // Unknown format - return 0 allowance
  return { allowance: 0, isScottish, isWelsh, isKCode: false, suffix: null };
}

/**
 * Get default tax code for starter declarations
 */
export function getStarterTaxCode(declaration: 'A' | 'B' | 'C'): string {
  switch (declaration) {
    case 'A':
      return '1257L'; // Standard personal allowance on cumulative basis
    case 'B':
      return '1257L'; // Standard personal allowance on cumulative basis
    case 'C':
      return 'BR';    // Basic rate - no personal allowance
  }
}

/**
 * Check if employee is approaching state pension age
 * (affects NI category)
 */
export function isNearStatePensionAge(dateOfBirth: Date, payDate: Date): boolean {
  const age = Math.floor(
    (payDate.getTime() - dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  );
  // State pension age varies but broadly 66-68
  return age >= 65;
}
