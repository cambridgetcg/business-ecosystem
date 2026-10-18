import { z } from 'zod';
import { RegulatorTypeSchema, RequirementCategorySchema } from './regulatory-requirement.js';

/**
 * Compliance Calendar Entity
 * Manages compliance calendar and deadline tracking
 */

export const CalendarEventTypeSchema = z.enum([
  'deadline',
  'reminder',
  'review',
  'submission_window_open',
  'submission_window_close',
  'payment_due',
  'meeting',
  'audit',
  'other',
]);
export type CalendarEventType = z.infer<typeof CalendarEventTypeSchema>;

export const CalendarEventStatusSchema = z.enum([
  'scheduled',
  'completed',
  'missed',
  'cancelled',
  'rescheduled',
]);
export type CalendarEventStatus = z.infer<typeof CalendarEventStatusSchema>;

export const ComplianceCalendarEventSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  entityId: z.string().uuid().nullable(),

  // Event details
  title: z.string().min(1).max(255),
  description: z.string().max(2000).nullable(),
  eventType: CalendarEventTypeSchema,
  status: CalendarEventStatusSchema,

  // Regulatory context
  regulator: RegulatorTypeSchema.nullable(),
  category: RequirementCategorySchema.nullable(),
  obligationId: z.string().uuid().nullable(),
  requirementId: z.string().uuid().nullable(),

  // Timing
  eventDate: z.date(),
  eventEndDate: z.date().nullable(),
  allDay: z.boolean().default(true),
  timeZone: z.string().default('Europe/London'),

  // Recurrence
  isRecurring: z.boolean().default(false),
  recurrenceRule: z.string().nullable(), // RRULE format
  parentEventId: z.string().uuid().nullable(),

  // Reminders
  reminderDays: z.array(z.number().int()).nullable(), // e.g., [30, 14, 7, 1]
  remindersSent: z.array(z.date()).nullable(),

  // Assignment
  assignedTo: z.array(z.string().uuid()).nullable(),

  // Completion
  completedAt: z.date().nullable(),
  completedBy: z.string().uuid().nullable(),
  completionNotes: z.string().max(1000).nullable(),

  // Audit
  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
});

export type ComplianceCalendarEvent = z.infer<typeof ComplianceCalendarEventSchema>;

// =============================================================================
// Create Input
// =============================================================================

export const CreateCalendarEventInputSchema = z.object({
  tenantId: z.string().uuid(),
  entityId: z.string().uuid().optional(),
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  eventType: CalendarEventTypeSchema,
  regulator: RegulatorTypeSchema.optional(),
  category: RequirementCategorySchema.optional(),
  obligationId: z.string().uuid().optional(),
  requirementId: z.string().uuid().optional(),
  eventDate: z.date(),
  eventEndDate: z.date().optional(),
  allDay: z.boolean().optional(),
  isRecurring: z.boolean().optional(),
  recurrenceRule: z.string().optional(),
  reminderDays: z.array(z.number().int()).optional(),
  assignedTo: z.array(z.string().uuid()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateCalendarEventInput = z.infer<typeof CreateCalendarEventInputSchema>;

// =============================================================================
// Compliance Report
// =============================================================================

export const ComplianceReportSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  entityId: z.string().uuid().nullable(),

  // Report details
  reportType: z.enum([
    'monthly_summary',
    'quarterly_summary',
    'annual_review',
    'board_report',
    'regulator_submission',
    'audit_response',
    'custom',
  ]),
  title: z.string().min(1).max(255),
  periodStart: z.date(),
  periodEnd: z.date(),

  // Content
  summary: z.string().max(4000).nullable(),
  obligationsTotal: z.number().int(),
  obligationsCompleted: z.number().int(),
  obligationsOverdue: z.number().int(),
  obligationsPending: z.number().int(),

  // Breakdown by regulator
  breakdownByRegulator: z.record(z.object({
    total: z.number().int(),
    completed: z.number().int(),
    overdue: z.number().int(),
  })).nullable(),

  // Breakdown by category
  breakdownByCategory: z.record(z.object({
    total: z.number().int(),
    completed: z.number().int(),
    overdue: z.number().int(),
  })).nullable(),

  // Risk assessment
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  riskNotes: z.string().max(2000).nullable(),

  // Key metrics
  complianceRate: z.number(), // Percentage
  averageCompletionDays: z.number().nullable(),
  totalPenalties: z.number().nullable(),

  // Actions
  recommendedActions: z.array(z.string()).nullable(),
  escalationItems: z.array(z.string().uuid()).nullable(),

  // Status
  status: z.enum(['draft', 'final', 'approved', 'distributed']),
  approvedBy: z.string().uuid().nullable(),
  approvedAt: z.date().nullable(),
  distributedTo: z.array(z.string()).nullable(),
  distributedAt: z.date().nullable(),

  // Storage
  documentStorageKey: z.string().nullable(),

  // Audit
  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
});

export type ComplianceReport = z.infer<typeof ComplianceReportSchema>;

// =============================================================================
// Domain Logic
// =============================================================================

/**
 * Generate upcoming events from obligations
 */
export function generateCalendarEvents(
  obligation: {
    id: string;
    tenantId: string;
    entityId: string;
    title: string;
    regulator: string;
    category: string;
    dueDate: Date;
  },
  reminderDays: number[] = [30, 14, 7, 1]
): Partial<ComplianceCalendarEvent>[] {
  const events: Partial<ComplianceCalendarEvent>[] = [];

  // Main deadline event
  events.push({
    tenantId: obligation.tenantId,
    entityId: obligation.entityId,
    title: `DEADLINE: ${obligation.title}`,
    eventType: 'deadline',
    status: 'scheduled',
    regulator: obligation.regulator as any,
    category: obligation.category as any,
    obligationId: obligation.id,
    eventDate: obligation.dueDate,
    allDay: true,
    reminderDays,
  });

  // Reminder events
  for (const days of reminderDays) {
    const reminderDate = new Date(obligation.dueDate);
    reminderDate.setDate(reminderDate.getDate() - days);

    if (reminderDate > new Date()) {
      events.push({
        tenantId: obligation.tenantId,
        entityId: obligation.entityId,
        title: `REMINDER: ${obligation.title} (${days} days)`,
        eventType: 'reminder',
        status: 'scheduled',
        regulator: obligation.regulator as any,
        category: obligation.category as any,
        obligationId: obligation.id,
        eventDate: reminderDate,
        allDay: true,
      });
    }
  }

  return events;
}

/**
 * Calculate compliance rate
 */
export function calculateComplianceRate(completed: number, total: number): number {
  if (total === 0) return 100;
  return Math.round((completed / total) * 100 * 10) / 10;
}

/**
 * Determine risk level based on metrics
 */
export function determineRiskLevel(
  complianceRate: number,
  overdueCount: number,
  criticalOverdue: number
): 'low' | 'medium' | 'high' | 'critical' {
  if (criticalOverdue > 0) return 'critical';
  if (overdueCount > 5 || complianceRate < 70) return 'high';
  if (overdueCount > 0 || complianceRate < 90) return 'medium';
  return 'low';
}

/**
 * Parse RRULE and get next occurrence
 */
export function getNextOccurrence(rrule: string, after: Date): Date | null {
  // Simplified parsing - in production use rrule library
  if (rrule.includes('FREQ=MONTHLY')) {
    const next = new Date(after);
    next.setMonth(next.getMonth() + 1);
    return next;
  }
  if (rrule.includes('FREQ=QUARTERLY')) {
    const next = new Date(after);
    next.setMonth(next.getMonth() + 3);
    return next;
  }
  if (rrule.includes('FREQ=YEARLY')) {
    const next = new Date(after);
    next.setFullYear(next.getFullYear() + 1);
    return next;
  }
  return null;
}
