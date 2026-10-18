/**
 * PAYE Submission Domain Model (RTI - Real Time Information)
 *
 * Represents PAYE submissions to HMRC:
 * - FPS (Full Payment Submission) - submitted every payday
 * - EPS (Employer Payment Summary) - monthly adjustments
 * - NVR (NINO Verification Request) - verify employee NINOs
 * - EAR (Earlier Year Update) - corrections to previous years
 */

import { z } from 'zod';
import {
  RTISubmissionTypeSchema,
  UKTaxYearSchema,
} from '../../value-objects/index.js';

// =============================================================================
// Submission Status
// =============================================================================

export const PAYESubmissionStatusSchema = z.enum([
  'draft',        // Being prepared
  'validated',    // Passed validation
  'submitted',    // Sent to HMRC
  'acknowledged', // HMRC acknowledged
  'error',        // Submission error
  'superseded',   // Replaced by later submission
]);
export type PAYESubmissionStatus = z.infer<typeof PAYESubmissionStatusSchema>;

// =============================================================================
// FPS (Full Payment Submission)
// =============================================================================

export const FPSSubmissionSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  entityId: z.string().uuid(),
  registrationId: z.string().uuid(),

  submissionType: z.literal('fps'),

  // Period
  taxYear: UKTaxYearSchema, // e.g., "2024-25"
  taxMonth: z.number().int().min(1).max(12), // 1-12 (April = Month 1)
  paymentDate: z.date(),
  payFrequency: z.enum(['weekly', 'fortnightly', 'four_weekly', 'monthly']),

  // Employee count
  employeeCount: z.number().int().min(1),

  // Totals for all employees in this submission
  totalPayInPeriod: z.string(),      // Total gross pay
  totalTaxDeducted: z.string(),       // Total PAYE tax
  totalStudentLoan: z.string(),       // Total student loan deductions
  totalPostgraduateLoan: z.string(),  // Total postgraduate loan deductions

  // National Insurance totals
  totalEmployeeNI: z.string(),        // Employee NI contributions
  totalEmployerNI: z.string(),        // Employer NI contributions

  // Other statutory payments included
  totalSMP: z.string().nullable(),    // Statutory Maternity Pay
  totalSPP: z.string().nullable(),    // Statutory Paternity Pay
  totalSAP: z.string().nullable(),    // Statutory Adoption Pay
  totalShPP: z.string().nullable(),   // Shared Parental Pay
  totalSSP: z.string().nullable(),    // Statutory Sick Pay

  // Status
  status: PAYESubmissionStatusSchema,
  submittedAt: z.date().nullable(),

  // HMRC Response
  hmrcCorrelationId: z.string().nullable(),
  hmrcReceiptTimestamp: z.date().nullable(),
  hmrcErrors: z.array(z.object({
    code: z.string(),
    message: z.string(),
    path: z.string().optional(),
  })).nullable(),

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

export type FPSSubmission = z.infer<typeof FPSSubmissionSchema>;

// =============================================================================
// EPS (Employer Payment Summary)
// =============================================================================

export const EPSSubmissionSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  entityId: z.string().uuid(),
  registrationId: z.string().uuid(),

  submissionType: z.literal('eps'),

  // Period
  taxYear: UKTaxYearSchema,
  taxMonth: z.number().int().min(1).max(12),

  // Recovery amounts (statutory payments the employer can reclaim)
  smpRecovered: z.string().nullable(),   // SMP recovered
  sppRecovered: z.string().nullable(),   // SPP recovered
  sapRecovered: z.string().nullable(),   // SAP recovered
  shppRecovered: z.string().nullable(),  // ShPP recovered
  nicCompensation: z.string().nullable(), // NIC compensation on statutory payments

  // CIS deductions suffered
  cisDeductionsSuffered: z.string().nullable(),

  // Flags
  noPaymentForPeriod: z.boolean(), // No employees paid in period
  periodOfInactivity: z.object({
    from: z.date(),
    to: z.date(),
  }).nullable(),
  employmentAllowanceClaim: z.boolean(), // Claiming Employment Allowance
  apprenticeshipLevyClaim: z.string().nullable(), // Annual levy allowance

  // Final submission flags
  finalSubmissionForYear: z.boolean(),
  dateSchemesClosed: z.date().nullable(),
  schemeCeasedDate: z.date().nullable(),

  // Status
  status: PAYESubmissionStatusSchema,
  submittedAt: z.date().nullable(),

  // HMRC Response
  hmrcCorrelationId: z.string().nullable(),
  hmrcReceiptTimestamp: z.date().nullable(),
  hmrcErrors: z.array(z.object({
    code: z.string(),
    message: z.string(),
  })).nullable(),

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

export type EPSSubmission = z.infer<typeof EPSSubmissionSchema>;

// =============================================================================
// Unified PAYE Submission (union type)
// =============================================================================

export const PAYESubmissionSchema = z.discriminatedUnion('submissionType', [
  FPSSubmissionSchema,
  EPSSubmissionSchema,
]);

export type PAYESubmission = z.infer<typeof PAYESubmissionSchema>;

// =============================================================================
// Create Inputs
// =============================================================================

export const CreateFPSInputSchema = z.object({
  tenantId: z.string().uuid(),
  entityId: z.string().uuid(),
  registrationId: z.string().uuid(),
  taxYear: UKTaxYearSchema,
  taxMonth: z.number().int().min(1).max(12),
  paymentDate: z.date(),
  payFrequency: z.enum(['weekly', 'fortnightly', 'four_weekly', 'monthly']),
  employeePayments: z.array(z.object({
    employeeId: z.string().uuid(),
    grossPay: z.string(),
    taxDeducted: z.string(),
    employeeNI: z.string(),
    employerNI: z.string(),
    studentLoan: z.string().optional(),
    postgraduateLoan: z.string().optional(),
  })),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateFPSInput = z.infer<typeof CreateFPSInputSchema>;

export const CreateEPSInputSchema = z.object({
  tenantId: z.string().uuid(),
  entityId: z.string().uuid(),
  registrationId: z.string().uuid(),
  taxYear: UKTaxYearSchema,
  taxMonth: z.number().int().min(1).max(12),
  noPaymentForPeriod: z.boolean().default(false),
  smpRecovered: z.string().optional(),
  sppRecovered: z.string().optional(),
  sapRecovered: z.string().optional(),
  shppRecovered: z.string().optional(),
  nicCompensation: z.string().optional(),
  cisDeductionsSuffered: z.string().optional(),
  employmentAllowanceClaim: z.boolean().default(false),
  finalSubmissionForYear: z.boolean().default(false),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateEPSInput = z.infer<typeof CreateEPSInputSchema>;

// =============================================================================
// Domain Logic
// =============================================================================

/**
 * Get tax month number from a date
 * UK tax months run 6th to 5th
 * Month 1 = 6 April to 5 May
 */
export function getTaxMonth(date: Date): number {
  const month = date.getMonth(); // 0-indexed
  const day = date.getDate();

  // Tax month starts on 6th
  if (day >= 6) {
    // After 6th - same calendar month maps to tax month
    return month >= 3 ? month - 2 : month + 10;
  } else {
    // Before 6th - previous tax month
    const prevMonth = month === 0 ? 11 : month - 1;
    return prevMonth >= 3 ? prevMonth - 2 : prevMonth + 10;
  }
}

/**
 * Get FPS submission deadline
 * FPS must be submitted on or before payday
 * Late submission penalties apply
 */
export function getFPSDeadline(paymentDate: Date): Date {
  return new Date(paymentDate); // Same day as payment
}

/**
 * Get EPS submission deadline
 * EPS must be submitted by 19th of the month following the tax month
 */
export function getEPSDeadline(taxYear: string, taxMonth: number): Date {
  const startYear = parseInt(taxYear.split('-')[0], 10);

  // Tax month 1 (April) -> deadline 19 May
  // Tax month 12 (March) -> deadline 19 April (next calendar year)
  let deadlineMonth = taxMonth + 3; // Convert tax month to calendar month (0-indexed)
  let deadlineYear = startYear;

  if (deadlineMonth > 11) {
    deadlineMonth -= 12;
    deadlineYear += 1;
  }

  return new Date(deadlineYear, deadlineMonth, 19);
}

/**
 * Calculate Employment Allowance eligibility
 * £5,000 allowance for employers with NI bill under £100,000
 */
export function isEligibleForEmploymentAllowance(
  totalEmployerNI: number,
  isConnectedCompany: boolean = false,
  hasMoreThanOneEmployee: boolean = true
): boolean {
  // Not eligible if single director company
  if (!hasMoreThanOneEmployee) return false;

  // Not eligible if connected to other companies claiming
  if (isConnectedCompany) return false;

  // Must have employer NI liability
  if (totalEmployerNI <= 0) return false;

  // Previous year NI bill must be under £100,000
  return true; // Simplified - would need prior year data
}
