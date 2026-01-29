/**
 * Legal Operations - Zod Validators
 */

import { z } from 'zod';

export const NotificationTypeEnum = z.enum([
  'EXPIRY_WARNING', 'RENEWAL_REMINDER', 'OBLIGATION_DUE',
  'SIGNATURE_REQUIRED', 'APPROVAL_REQUIRED', 'STATUS_CHANGE',
  'MATTER_UPDATE', 'CUSTOM'
]);

export const CreateNotificationSchema = z.object({
  type: NotificationTypeEnum,
  entityType: z.string().min(1).max(100),
  entityId: z.string().cuid(),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  recipients: z.array(z.string()).min(1),
  scheduledFor: z.coerce.date().optional(),
});

export const NotificationQuerySchema = z.object({
  type: NotificationTypeEnum.optional(),
  entityType: z.string().optional(),
  entityId: z.string().cuid().optional(),
  pending: z.coerce.boolean().default(false),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const AuditLogQuerySchema = z.object({
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  userId: z.string().optional(),
  action: z.string().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const DashboardQuerySchema = z.object({
  period: z.enum(['7d', '30d', '90d', '1y']).default('30d'),
});

// Contract Modifications (Amendment/Addendum)
export const ModificationTypeEnum = z.enum([
  'AMENDMENT', 'ADDENDUM', 'SUPPLEMENT', 'SIDE_LETTER',
  'WAIVER', 'CONSENT', 'NOVATION'
]);

export const ModificationStatusEnum = z.enum([
  'DRAFT', 'PENDING_REVIEW', 'PENDING_SIGNATURE',
  'EXECUTED', 'REJECTED', 'SUPERSEDED'
]);

export const CreateModificationSchema = z.object({
  contractId: z.string().cuid(),
  type: ModificationTypeEnum,
  title: z.string().min(1).max(200),
  effectiveDate: z.coerce.date(),
  sectionsAffected: z.array(z.string()).default([]),
  summary: z.string().min(1).max(10000),
  documentId: z.string().cuid().optional(),
  supersedesId: z.string().cuid().optional(),
});

export const UpdateModificationSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  effectiveDate: z.coerce.date().optional(),
  sectionsAffected: z.array(z.string()).optional(),
  summary: z.string().min(1).max(10000).optional(),
  status: ModificationStatusEnum.optional(),
  documentId: z.string().cuid().optional(),
});

export const ExecuteModificationSchema = z.object({
  executedAt: z.coerce.date().optional(),
});

export const ModificationQuerySchema = z.object({
  contractId: z.string().cuid().optional(),
  type: ModificationTypeEnum.optional(),
  status: ModificationStatusEnum.optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateNotificationInput = z.infer<typeof CreateNotificationSchema>;
export type NotificationQuery = z.infer<typeof NotificationQuerySchema>;
export type AuditLogQuery = z.infer<typeof AuditLogQuerySchema>;
export type DashboardQuery = z.infer<typeof DashboardQuerySchema>;
export type CreateModificationInput = z.infer<typeof CreateModificationSchema>;
export type UpdateModificationInput = z.infer<typeof UpdateModificationSchema>;
export type ExecuteModificationInput = z.infer<typeof ExecuteModificationSchema>;
export type ModificationQuery = z.infer<typeof ModificationQuerySchema>;
