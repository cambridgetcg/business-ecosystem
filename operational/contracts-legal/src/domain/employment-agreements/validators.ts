/**
 * Employment Agreements - Zod Validators
 */

import { z } from 'zod';

export const EmploymentTypeEnum = z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'TEMPORARY', 'INTERN']);
export const PayFrequencyEnum = z.enum(['WEEKLY', 'BI_WEEKLY', 'SEMI_MONTHLY', 'MONTHLY', 'ANNUALLY']);

export const BonusStructureSchema = z.object({
  type: z.enum(['SIGNING', 'PERFORMANCE', 'ANNUAL', 'QUARTERLY', 'PROJECT']),
  amount: z.number().positive().optional(),
  percentage: z.number().min(0).max(100).optional(),
  conditions: z.string().optional(),
});

export const EquitySchema = z.object({
  type: z.enum(['STOCK_OPTIONS', 'RSU', 'ESPP', 'PHANTOM_STOCK']),
  shares: z.number().int().positive().optional(),
  vestingSchedule: z.string().optional(),
  cliffMonths: z.number().int().positive().optional(),
  vestingMonths: z.number().int().positive().optional(),
});

export const CreateEmploymentAgreementSchema = z.object({
  // Employee info
  employeeId: z.string().min(1),
  employeeName: z.string().min(1).max(200),
  
  // Position
  jobTitle: z.string().min(1).max(200),
  department: z.string().max(100).optional(),
  location: z.string().max(200).optional(),
  reportsTo: z.string().max(200).optional(),
  
  // Employment type
  employmentType: EmploymentTypeEnum,
  
  // Dates
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  probationEndDate: z.coerce.date().optional(),
  
  // Compensation
  baseSalary: z.number().positive(),
  currency: z.string().length(3).default('USD'),
  payFrequency: PayFrequencyEnum,
  bonus: z.array(BonusStructureSchema).optional(),
  equity: z.array(EquitySchema).optional(),
  
  // Benefits
  benefits: z.array(z.string()).optional(),
  ptoAllowance: z.number().int().min(0).optional(),
  
  // Restrictive covenants
  nonCompeteDays: z.number().int().positive().optional(),
  nonSolicitDays: z.number().int().positive().optional(),
  confidentialityRequired: z.boolean().default(true),
  
  // Template
  templateId: z.string().cuid().optional(),
}).refine(
  (data) => !data.endDate || data.endDate > data.startDate,
  { message: 'End date must be after start date', path: ['endDate'] }
);

export const UpdateEmploymentAgreementSchema = z.object({
  jobTitle: z.string().min(1).max(200).optional(),
  department: z.string().max(100).optional(),
  location: z.string().max(200).optional(),
  reportsTo: z.string().max(200).optional(),
  endDate: z.coerce.date().optional(),
  baseSalary: z.number().positive().optional(),
  payFrequency: PayFrequencyEnum.optional(),
  bonus: z.array(BonusStructureSchema).optional(),
  equity: z.array(EquitySchema).optional(),
  benefits: z.array(z.string()).optional(),
  ptoAllowance: z.number().int().min(0).optional(),
});

export const EmploymentQuerySchema = z.object({
  employmentType: EmploymentTypeEnum.optional(),
  department: z.string().optional(),
  location: z.string().optional(),
  search: z.string().optional(),
  activeOnly: z.coerce.boolean().default(true),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['createdAt', 'startDate', 'employeeName', 'baseSalary']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const TerminateEmploymentSchema = z.object({
  terminationDate: z.coerce.date(),
  reason: z.enum(['RESIGNATION', 'TERMINATION', 'LAYOFF', 'RETIREMENT', 'CONTRACT_END', 'MUTUAL_AGREEMENT', 'OTHER']),
  notes: z.string().max(2000).optional(),
  severanceWeeks: z.number().int().min(0).optional(),
});

export type CreateEmploymentAgreementInput = z.infer<typeof CreateEmploymentAgreementSchema>;
export type UpdateEmploymentAgreementInput = z.infer<typeof UpdateEmploymentAgreementSchema>;
export type EmploymentQuery = z.infer<typeof EmploymentQuerySchema>;
export type TerminateEmploymentInput = z.infer<typeof TerminateEmploymentSchema>;
