/**
 * Contract Lifecycle - Zod Validators
 *
 * Handles contract state transitions, renewal workflows, and lifecycle events
 */

import { z } from 'zod';

// Contract statuses that represent lifecycle stages
export const LifecycleStatusEnum = z.enum([
  'DRAFT',
  'PENDING_REVIEW',
  'IN_NEGOTIATION',
  'PENDING_APPROVAL',
  'PENDING_SIGNATURE',
  'ACTIVE',
  'SUSPENDED',
  'EXPIRED',
  'TERMINATED',
  'RENEWED',
  'ARCHIVED',
]);

export type LifecycleStatus = z.infer<typeof LifecycleStatusEnum>;

// Valid state transitions map
export const VALID_TRANSITIONS: Record<LifecycleStatus, LifecycleStatus[]> = {
  DRAFT: ['PENDING_REVIEW', 'ARCHIVED'],
  PENDING_REVIEW: ['IN_NEGOTIATION', 'PENDING_APPROVAL', 'DRAFT', 'ARCHIVED'],
  IN_NEGOTIATION: ['PENDING_APPROVAL', 'DRAFT', 'ARCHIVED'],
  PENDING_APPROVAL: ['PENDING_SIGNATURE', 'IN_NEGOTIATION', 'DRAFT', 'ARCHIVED'],
  PENDING_SIGNATURE: ['ACTIVE', 'PENDING_APPROVAL', 'ARCHIVED'],
  ACTIVE: ['SUSPENDED', 'TERMINATED', 'EXPIRED', 'RENEWED'],
  SUSPENDED: ['ACTIVE', 'TERMINATED'],
  EXPIRED: ['RENEWED', 'ARCHIVED'],
  TERMINATED: ['ARCHIVED'],
  RENEWED: ['ACTIVE'],
  ARCHIVED: [],
};

// Transition action definitions
export const TransitionActionEnum = z.enum([
  'SUBMIT_FOR_REVIEW',
  'START_NEGOTIATION',
  'COMPLETE_NEGOTIATION',
  'APPROVE',
  'REJECT',
  'SIGN',
  'COUNTERSIGN',
  'ACTIVATE',
  'SUSPEND',
  'RESUME',
  'TERMINATE',
  'EXPIRE',
  'RENEW',
  'ARCHIVE',
]);

export type TransitionAction = z.infer<typeof TransitionActionEnum>;

// Action to target status mapping
export const ACTION_TARGET_STATUS: Record<TransitionAction, LifecycleStatus> = {
  SUBMIT_FOR_REVIEW: 'PENDING_REVIEW',
  START_NEGOTIATION: 'IN_NEGOTIATION',
  COMPLETE_NEGOTIATION: 'PENDING_APPROVAL',
  APPROVE: 'PENDING_SIGNATURE',
  REJECT: 'DRAFT',
  SIGN: 'PENDING_SIGNATURE', // Stays until all parties sign, then becomes ACTIVE
  COUNTERSIGN: 'ACTIVE',
  ACTIVATE: 'ACTIVE',
  SUSPEND: 'SUSPENDED',
  RESUME: 'ACTIVE',
  TERMINATE: 'TERMINATED',
  EXPIRE: 'EXPIRED',
  RENEW: 'RENEWED',
  ARCHIVE: 'ARCHIVED',
};

// Transition request schema
export const TransitionRequestSchema = z.object({
  contractId: z.string().cuid(),
  action: TransitionActionEnum,
  reason: z.string().max(1000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type TransitionRequest = z.infer<typeof TransitionRequestSchema>;

// Renewal request schema
export const RenewalRequestSchema = z.object({
  contractId: z.string().cuid(),
  newExpiryDate: z.coerce.date().optional(),
  renewalTermDays: z.number().int().positive().optional(),
  updateValue: z.number().positive().optional(),
  updateCurrency: z.string().length(3).optional(),
  notes: z.string().max(2000).optional(),
});

export type RenewalRequest = z.infer<typeof RenewalRequestSchema>;

// Expiration check query
export const ExpirationQuerySchema = z.object({
  daysAhead: z.coerce.number().int().positive().max(365).default(30),
  includeAutoRenewal: z.coerce.boolean().default(true),
  status: LifecycleStatusEnum.optional(),
});

export type ExpirationQuery = z.infer<typeof ExpirationQuerySchema>;

// Lifecycle event for audit trail
export const LifecycleEventSchema = z.object({
  contractId: z.string().cuid(),
  previousStatus: LifecycleStatusEnum,
  newStatus: LifecycleStatusEnum,
  action: TransitionActionEnum,
  performedBy: z.string(),
  performedAt: z.date(),
  reason: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type LifecycleEvent = z.infer<typeof LifecycleEventSchema>;

// Bulk renewal request
export const BulkRenewalRequestSchema = z.object({
  contractIds: z.array(z.string().cuid()).min(1).max(100),
  renewalTermDays: z.number().int().positive().optional(),
  skipInvalid: z.boolean().default(false),
});

export type BulkRenewalRequest = z.infer<typeof BulkRenewalRequestSchema>;

// Contract health check result
export const ContractHealthSchema = z.object({
  contractId: z.string().cuid(),
  status: LifecycleStatusEnum,
  daysUntilExpiry: z.number().nullable(),
  hasOverdueObligations: z.boolean(),
  overdueObligationCount: z.number(),
  renewalEligible: z.boolean(),
  autoRenewalEnabled: z.boolean(),
  renewalNoticeDays: z.number().nullable(),
  renewalWindowOpen: z.boolean(),
  healthScore: z.enum(['HEALTHY', 'ATTENTION', 'CRITICAL']),
});

export type ContractHealth = z.infer<typeof ContractHealthSchema>;

// Helper function to check if transition is valid
export function isValidTransition(from: LifecycleStatus, to: LifecycleStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// Helper function to get allowed transitions from a status
export function getAllowedTransitions(from: LifecycleStatus): LifecycleStatus[] {
  return VALID_TRANSITIONS[from] ?? [];
}

// Helper function to get action for transition
export function getActionForTransition(from: LifecycleStatus, to: LifecycleStatus): TransitionAction | null {
  const actionEntry = Object.entries(ACTION_TARGET_STATUS).find(
    ([, targetStatus]) => targetStatus === to
  );
  if (!actionEntry) return null;

  const action = actionEntry[0] as TransitionAction;
  // Verify the transition is valid from current status
  if (isValidTransition(from, to)) {
    return action;
  }
  return null;
}
