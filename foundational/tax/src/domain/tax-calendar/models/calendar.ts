/**
 * Tax Calendar Model
 *
 * Manages tax deadlines, filing dates, and payment schedules.
 */

import { z } from 'zod';

// =============================================================================
// Tax Deadline Types
// =============================================================================

export const TaxDeadlineTypeSchema = z.enum([
  // Corporation Tax
  'ct_return_filing',
  'ct_payment',
  'ct_instalment',
  'ct_quarterly_payment',

  // VAT
  'vat_return_filing',
  'vat_payment',
  'vat_ec_sales_list',

  // PAYE
  'paye_fps_submission',
  'paye_eps_submission',
  'paye_payment',
  'paye_p11d_filing',
  'paye_p11d_class1a_payment',
  'paye_p60_issue',
  'paye_p45_issue',
  'paye_year_end',

  // Annual filings
  'annual_accounts_filing',
  'confirmation_statement',

  // Other
  'cis_return',
  'stamp_duty_return',
  'capital_gains_tax',
  'tax_investigation',
  'custom',
]);

export type TaxDeadlineType = z.infer<typeof TaxDeadlineTypeSchema>;

export const DeadlinePrioritySchema = z.enum([
  'low',      // Informational
  'medium',   // Standard deadline
  'high',     // Approaching deadline
  'critical', // Imminent deadline
]);

export type DeadlinePriority = z.infer<typeof DeadlinePrioritySchema>;

export const DeadlineStatusSchema = z.enum([
  'upcoming',    // Not yet due
  'due_soon',    // Within warning period
  'overdue',     // Past deadline
  'completed',   // Filed/paid
  'extended',    // Extension granted
  'not_required', // Not applicable
]);

export type DeadlineStatus = z.infer<typeof DeadlineStatusSchema>;

// =============================================================================
// Tax Deadline
// =============================================================================

export const TaxDeadlineSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  entityId: z.string().uuid(),

  // Deadline details
  type: TaxDeadlineTypeSchema,
  title: z.string().max(200),
  description: z.string().max(1000).optional(),

  // Reference
  taxType: z.enum(['corporation_tax', 'vat', 'paye', 'accounts', 'other']),
  taxPeriod: z.string().max(20).optional(), // e.g., "2024-25" or "Q1 2024"
  referenceId: z.string().uuid().optional(), // Link to CT period, VAT return, etc.
  referenceNumber: z.string().max(50).optional(), // HMRC reference

  // Dates
  dueDate: z.date(),
  originalDueDate: z.date(),
  warningDate: z.date(), // When to start warning
  extensionDate: z.date().optional(),
  completedDate: z.date().optional(),

  // Amounts (if applicable)
  estimatedAmount: z.string().optional(),
  actualAmount: z.string().optional(),
  penaltyAmount: z.string().default('0'),

  // Status
  status: DeadlineStatusSchema,
  priority: DeadlinePrioritySchema,

  // Assignment
  assignedTo: z.string().uuid().optional(),
  assignedTeam: z.string().max(100).optional(),

  // Completion
  completedBy: z.string().uuid().optional(),
  completionNotes: z.string().max(1000).optional(),
  hmrcReceiptNumber: z.string().max(100).optional(),

  // Reminders
  remindersSent: z.array(z.object({
    sentAt: z.date(),
    type: z.enum(['email', 'notification', 'sms']),
    recipient: z.string(),
  })).default([]),
  nextReminderDate: z.date().optional(),

  // Recurrence
  isRecurring: z.boolean().default(false),
  recurrencePattern: z.enum([
    'monthly',
    'quarterly',
    'annually',
    'custom',
  ]).optional(),
  recurrenceEndDate: z.date().optional(),

  // Audit
  notes: z.string().max(2000).optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid().optional(),
});

export type TaxDeadline = z.infer<typeof TaxDeadlineSchema>;

// =============================================================================
// Tax Calendar Period
// =============================================================================

export const TaxCalendarPeriodSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  entityId: z.string().uuid(),

  // Period
  taxYear: z.string(), // e.g., "2024-25"
  periodStart: z.date(),
  periodEnd: z.date(),

  // Configuration
  accountingPeriodEnd: z.date(), // Company year end
  vatQuarterEndMonth: z.number().int().min(1).max(12).optional(),

  // Key dates (auto-calculated)
  corporationTaxFilingDeadline: z.date(),
  corporationTaxPaymentDeadline: z.date(),
  vatReturnDates: z.array(z.date()),
  payeMonthlyDates: z.array(z.date()),
  p11dFilingDeadline: z.date(),
  annualAccountsDeadline: z.date(),

  // Status
  deadlinesGenerated: z.boolean().default(false),
  generatedAt: z.date().optional(),

  // Audit
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type TaxCalendarPeriod = z.infer<typeof TaxCalendarPeriodSchema>;

// =============================================================================
// Calendar View Types
// =============================================================================

export interface CalendarMonth {
  year: number;
  month: number;
  deadlines: TaxDeadline[];
}

export interface CalendarWeek {
  weekStart: Date;
  weekEnd: Date;
  deadlines: TaxDeadline[];
}

export interface DeadlineSummary {
  upcoming: number;
  dueSoon: number;
  overdue: number;
  completed: number;
  totalEstimatedAmount: string;
}

// =============================================================================
// Reminder Configuration
// =============================================================================

export const ReminderConfigSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),

  // What to remind about
  deadlineTypes: z.array(TaxDeadlineTypeSchema),

  // When to remind (days before due date)
  reminderDays: z.array(z.number().int().positive()), // e.g., [30, 14, 7, 1]

  // How to remind
  channels: z.array(z.enum(['email', 'notification', 'sms', 'webhook'])),

  // Recipients
  recipients: z.array(z.object({
    type: z.enum(['user', 'email', 'webhook']),
    value: z.string(),
  })),

  // Escalation
  escalationDays: z.number().int().optional(), // Days overdue before escalation
  escalationRecipients: z.array(z.string()).optional(),

  // Status
  enabled: z.boolean().default(true),

  // Audit
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ReminderConfig = z.infer<typeof ReminderConfigSchema>;
