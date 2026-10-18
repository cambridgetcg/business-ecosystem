/**
 * P11D Benefits Model
 *
 * HMRC P11D form for reporting employee benefits in kind and expenses.
 * Reference: https://www.gov.uk/government/publications/paye-end-of-year-expenses-and-benefits-p11d
 */

import { z } from 'zod';

// =============================================================================
// Benefit Categories (P11D Sections)
// =============================================================================

/**
 * Section A - Assets transferred (cars, property, goods, other assets)
 */
export const SectionASchema = z.object({
  description: z.string().max(500),
  marketValue: z.string(),
  amountPaidByEmployee: z.string().default('0'),
  cashEquivalent: z.string(),
});

/**
 * Section B - Payments made on behalf of employee
 */
export const SectionBSchema = z.object({
  description: z.string().max(500),
  amount: z.string(),
});

/**
 * Section C - Vouchers and credit cards
 */
export const SectionCSchema = z.object({
  totalVouchersCreditCards: z.string(),
  nonCashVouchers: z.string().optional(),
  creditTokens: z.string().optional(),
});

/**
 * Section D - Living accommodation
 */
export const SectionDSchema = z.object({
  addressOfProperty: z.string().max(500),
  grossValue: z.string(),
  rentPaidByEmployer: z.string(),
  rentPaidByEmployee: z.string().default('0'),
  cashEquivalent: z.string(),
  jobRelatedAccommodation: z.boolean(),
});

/**
 * Section E - Mileage allowance payments
 */
export const SectionESchema = z.object({
  businessMiles: z.number().int(),
  approvedAmount: z.string(), // AMAP rate × miles
  amountPaidByEmployer: z.string(),
  excessOverApprovedAmount: z.string(), // Taxable if > approved
});

/**
 * Section F - Company cars and fuel
 */
export const CarBenefitSchema = z.object({
  makeAndModel: z.string().max(100),
  registrationNumber: z.string().max(15),
  dateFirstRegistered: z.date(),
  fuelType: z.enum(['petrol', 'diesel', 'electric', 'hybrid_petrol', 'hybrid_diesel']),
  co2Emissions: z.number().int(), // g/km
  listPrice: z.string(),
  accessoriesValue: z.string().default('0'),
  capitalContribution: z.string().default('0'),
  paymentForPrivateUse: z.string().default('0'),
  dateAvailableFrom: z.date(),
  dateAvailableTo: z.date().optional(),
  daysUnavailable: z.number().int().default(0),
  electricRangeKm: z.number().int().optional(), // For hybrids
  cashEquivalent: z.string(),
});

export const FuelBenefitSchema = z.object({
  fuelType: z.enum(['petrol', 'diesel', 'hybrid_petrol', 'hybrid_diesel']),
  co2Emissions: z.number().int(),
  dateAvailableFrom: z.date(),
  dateAvailableTo: z.date().optional(),
  fuelWithdrawnDate: z.date().optional(),
  cashEquivalent: z.string(),
});

export const SectionFSchema = z.object({
  cars: z.array(CarBenefitSchema).default([]),
  fuel: z.array(FuelBenefitSchema).default([]),
  totalCarBenefit: z.string(),
  totalFuelBenefit: z.string(),
});

/**
 * Section G - Vans and van fuel
 */
export const VanBenefitSchema = z.object({
  registrationNumber: z.string().max(15),
  dateAvailableFrom: z.date(),
  dateAvailableTo: z.date().optional(),
  isZeroEmission: z.boolean(),
  cashEquivalent: z.string(),
});

export const SectionGSchema = z.object({
  vans: z.array(VanBenefitSchema).default([]),
  fuelForPrivateUse: z.boolean(),
  totalVanBenefit: z.string(),
  totalVanFuelBenefit: z.string(),
});

/**
 * Section H - Interest-free and low interest loans
 */
export const LoanBenefitSchema = z.object({
  loanDescription: z.string().max(200),
  loanAmount: z.string(),
  maximumBalanceInYear: z.string(),
  balanceAtYearEnd: z.string(),
  interestRate: z.string(), // As decimal, e.g., "0.02" for 2%
  officialRate: z.string(), // HMRC official rate
  cashEquivalent: z.string(),
  qualifyingLoan: z.boolean(), // Some loans exempt
});

export const SectionHSchema = z.object({
  loans: z.array(LoanBenefitSchema).default([]),
  totalCashEquivalent: z.string(),
});

/**
 * Section I - Private medical treatment or insurance
 */
export const SectionISchema = z.object({
  premiumPaidByEmployer: z.string(),
  amountContributedByEmployee: z.string().default('0'),
  cashEquivalent: z.string(),
  insurerName: z.string().max(100).optional(),
  policyNumber: z.string().max(50).optional(),
});

/**
 * Section J - Qualifying relocation expenses over £8,000
 */
export const SectionJSchema = z.object({
  totalRelocationExpenses: z.string(),
  exemptAmount: z.string().default('8000'), // £8,000 exemption
  taxableExcess: z.string(),
});

/**
 * Section K - Services supplied
 */
export const SectionKSchema = z.object({
  description: z.string().max(500),
  costToEmployer: z.string(),
  amountPaidByEmployee: z.string().default('0'),
  cashEquivalent: z.string(),
});

/**
 * Section L - Assets placed at employee's disposal
 */
export const AssetAvailableSchema = z.object({
  description: z.string().max(500),
  marketValueOrAnnualValue: z.string(),
  periodsAvailable: z.number().int(), // Days or periods
  amountPaidByEmployee: z.string().default('0'),
  cashEquivalent: z.string(),
});

export const SectionLSchema = z.object({
  assets: z.array(AssetAvailableSchema).default([]),
  totalCashEquivalent: z.string(),
});

/**
 * Section M - Other items (including subscriptions, educational assistance, etc.)
 */
export const OtherBenefitSchema = z.object({
  description: z.string().max(500),
  amount: z.string(),
  exemptAmount: z.string().default('0'),
  taxableAmount: z.string(),
});

export const SectionMSchema = z.object({
  items: z.array(OtherBenefitSchema).default([]),
  totalTaxableAmount: z.string(),
});

/**
 * Section N - Expenses payments made to, or on behalf of, employee
 */
export const ExpensePaymentSchema = z.object({
  description: z.string().max(500),
  amount: z.string(),
  taxableAmount: z.string(),
});

export const SectionNSchema = z.object({
  travelAndSubsistence: z.string().default('0'),
  entertainment: z.string().default('0'),
  homeWorking: z.string().default('0'),
  professionalFees: z.string().default('0'),
  other: z.array(ExpensePaymentSchema).default([]),
  totalExpenses: z.string(),
});

// =============================================================================
// P11D Summary
// =============================================================================

export const P11DSummarySchema = z.object({
  sectionATotalCashEquivalent: z.string(),
  sectionBTotalPayments: z.string(),
  sectionCTotalVouchers: z.string(),
  sectionDTotalAccommodation: z.string(),
  sectionEExcessMileage: z.string(),
  sectionFTotalCars: z.string(),
  sectionFTotalFuel: z.string(),
  sectionGTotalVans: z.string(),
  sectionGTotalVanFuel: z.string(),
  sectionHTotalLoans: z.string(),
  sectionITotalMedical: z.string(),
  sectionJTaxableRelocation: z.string(),
  sectionKTotalServices: z.string(),
  sectionLTotalAssets: z.string(),
  sectionMTotalOther: z.string(),
  sectionNTotalExpenses: z.string(),
  totalBenefitsAndExpenses: z.string(),
  class1ANICDue: z.string(), // 13.8% on benefits
});

// =============================================================================
// Complete P11D Record
// =============================================================================

export const P11DRecordSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  entityId: z.string().uuid(),
  employeeId: z.string().uuid(),
  taxYear: z.string().regex(/^\d{4}-\d{2}$/), // e.g., "2024-25"

  // Employee details
  employeeTitle: z.string().max(20).optional(),
  employeeFirstName: z.string().max(50),
  employeeSurname: z.string().max(50),
  nationalInsuranceNumber: z.string().max(9),
  dateOfBirth: z.date().optional(),
  gender: z.enum(['M', 'F']).optional(),
  payrollNumber: z.string().max(35).optional(),

  // Director status
  isDirector: z.boolean().default(false),
  dateAppointedDirector: z.date().optional(),
  dateCeasedDirector: z.date().optional(),

  // Benefit sections
  sectionA: z.array(SectionASchema).optional(),
  sectionB: z.array(SectionBSchema).optional(),
  sectionC: SectionCSchema.optional(),
  sectionD: SectionDSchema.optional(),
  sectionE: SectionESchema.optional(),
  sectionF: SectionFSchema.optional(),
  sectionG: SectionGSchema.optional(),
  sectionH: SectionHSchema.optional(),
  sectionI: SectionISchema.optional(),
  sectionJ: SectionJSchema.optional(),
  sectionK: z.array(SectionKSchema).optional(),
  sectionL: SectionLSchema.optional(),
  sectionM: SectionMSchema.optional(),
  sectionN: SectionNSchema.optional(),

  // Summary
  summary: P11DSummarySchema,

  // Status
  status: z.enum(['draft', 'calculated', 'submitted', 'acknowledged', 'amended']),
  calculatedAt: z.date().optional(),
  submittedAt: z.date().optional(),
  hmrcCorrelationId: z.string().optional(),

  // Audit
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type P11DRecord = z.infer<typeof P11DRecordSchema>;
export type CarBenefit = z.infer<typeof CarBenefitSchema>;
export type LoanBenefit = z.infer<typeof LoanBenefitSchema>;
export type P11DSummary = z.infer<typeof P11DSummarySchema>;

// =============================================================================
// P11D(b) Class 1A NIC Summary
// =============================================================================

export const P11DbSummarySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  entityId: z.string().uuid(),
  taxYear: z.string().regex(/^\d{4}-\d{2}$/),

  // Employer details
  employerName: z.string().max(160),
  payeReference: z.string().max(20),

  // Summary figures
  totalBenefitsAllEmployees: z.string(),
  class1ANICRate: z.string().default('0.138'), // 13.8%
  class1ANICDue: z.string(),

  // Status
  status: z.enum(['draft', 'submitted', 'paid']),
  submittedAt: z.date().optional(),
  paymentDueDate: z.date(),
  paidAt: z.date().optional(),
  amountPaid: z.string().default('0'),

  // HMRC
  hmrcReceiptNumber: z.string().optional(),

  // Audit
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type P11DbSummary = z.infer<typeof P11DbSummarySchema>;
