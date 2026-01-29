import { z } from 'zod';

/**
 * Accounting Period Entity - Fiscal period management
 */

export const PeriodStatusSchema = z.enum([
  'open',
  'closed',
  'locked',
]);
export type PeriodStatus = z.infer<typeof PeriodStatusSchema>;

export const AccountingPeriodSchema = z.object({
  id: z.string().uuid(),
  entityId: z.string().uuid(),
  periodName: z.string().min(1).max(100),
  startDate: z.date(),
  endDate: z.date(),
  fiscalYear: z.number().int().min(1900).max(2100),
  fiscalQuarter: z.number().int().min(1).max(4),
  fiscalMonth: z.number().int().min(1).max(12).optional(),
  status: PeriodStatusSchema,
  closedAt: z.date().optional(),
  closedBy: z.string().uuid().optional(),
  lockedAt: z.date().optional(),
  lockedBy: z.string().uuid().optional(),
  trialBalanceSnapshot: z.record(z.string()).optional(), // AccountId -> Balance
  createdAt: z.date(),
  updatedAt: z.date(),
  version: z.number().int().positive(),
});

export type AccountingPeriod = z.infer<typeof AccountingPeriodSchema>;

export const CreatePeriodInputSchema = z.object({
  entityId: z.string().uuid(),
  periodName: z.string().min(1).max(100),
  startDate: z.date(),
  endDate: z.date(),
  fiscalYear: z.number().int(),
  fiscalQuarter: z.number().int().min(1).max(4),
  fiscalMonth: z.number().int().min(1).max(12).optional(),
});

export type CreatePeriodInput = z.infer<typeof CreatePeriodInputSchema>;

/**
 * Check if a date falls within a period
 */
export function isDateInPeriod(date: Date, period: AccountingPeriod): boolean {
  return date >= period.startDate && date <= period.endDate;
}

/**
 * Check if period can accept new entries
 */
export function canPostToPerod(period: AccountingPeriod): boolean {
  return period.status === 'open';
}

/**
 * Check if period can be closed
 */
export function canClosePeriod(period: AccountingPeriod): boolean {
  return period.status === 'open';
}

/**
 * Check if period can be reopened
 */
export function canReopenPeriod(period: AccountingPeriod): boolean {
  return period.status === 'closed';
}
