/**
 * Signature Domain Model
 *
 * Tracks e-signatures and signature requests for contracts.
 */

import { z } from 'zod';
import { SignatureStatusSchema, type SignatureStatus } from '../../value-objects/index.js';

// =============================================================================
// Signature Request Schema
// =============================================================================

export const SignatureRequestSchema = z.object({
  id: z.string().uuid(),
  contractId: z.string().uuid(),
  contractPartyId: z.string().uuid(),
  tenantId: z.string().uuid(),

  // Signer info
  signerName: z.string().max(255),
  signerEmail: z.string().email(),

  // Status
  status: SignatureStatusSchema,

  // External e-signature provider
  externalProvider: z.enum(['docusign', 'hellosign', 'adobe_sign', 'internal']).nullable(),
  externalRequestId: z.string().max(255).nullable(), // Provider's envelope/request ID

  // Request details
  requestedAt: z.date(),
  requestedBy: z.string().uuid(),
  expiresAt: z.date().nullable(),

  // Completion details
  signedAt: z.date().nullable(),
  signatureData: z.string().nullable(), // Base64 signature image or signature hash
  signedIpAddress: z.string().max(45).nullable(),
  signedUserAgent: z.string().max(500).nullable(),

  // Decline/void details
  declinedAt: z.date().nullable(),
  declineReason: z.string().max(500).nullable(),
  voidedAt: z.date().nullable(),
  voidReason: z.string().max(500).nullable(),

  // Reminders
  reminderCount: z.number().int().default(0),
  lastReminderAt: z.date().nullable(),

  // Audit
  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type SignatureRequest = z.infer<typeof SignatureRequestSchema>;

// =============================================================================
// Create Signature Request Input
// =============================================================================

export const CreateSignatureRequestInputSchema = z.object({
  contractId: z.string().uuid(),
  contractPartyId: z.string().uuid(),
  tenantId: z.string().uuid(),
  signerName: z.string().min(1).max(255),
  signerEmail: z.string().email(),
  requestedBy: z.string().uuid(),
  expiresAt: z.date().optional(),
  externalProvider: z.enum(['docusign', 'hellosign', 'adobe_sign', 'internal']).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateSignatureRequestInput = z.infer<typeof CreateSignatureRequestInputSchema>;

// =============================================================================
// Signature Audit Log Schema
// =============================================================================

export const SignatureAuditLogSchema = z.object({
  id: z.string().uuid(),
  signatureRequestId: z.string().uuid(),
  action: z.enum([
    'created',
    'sent',
    'viewed',
    'signed',
    'declined',
    'voided',
    'expired',
    'reminder_sent',
  ]),
  actorId: z.string().uuid().nullable(),
  actorEmail: z.string().email().nullable(),
  ipAddress: z.string().max(45).nullable(),
  userAgent: z.string().max(500).nullable(),
  details: z.record(z.unknown()).nullable(),
  occurredAt: z.date(),
});

export type SignatureAuditLog = z.infer<typeof SignatureAuditLogSchema>;

// =============================================================================
// Domain Logic
// =============================================================================

/**
 * Check if signature request can be signed
 */
export function canSign(request: SignatureRequest): boolean {
  if (request.status !== 'pending') {
    return false;
  }

  if (request.expiresAt && new Date(request.expiresAt) < new Date()) {
    return false;
  }

  return true;
}

/**
 * Check if signature request can be declined
 */
export function canDecline(request: SignatureRequest): boolean {
  return request.status === 'pending';
}

/**
 * Check if signature request can be voided
 */
export function canVoid(request: SignatureRequest): boolean {
  return request.status === 'pending';
}

/**
 * Check if signature request can receive reminders
 */
export function canSendReminder(request: SignatureRequest, maxReminders: number = 5): boolean {
  if (request.status !== 'pending') {
    return false;
  }

  if (request.reminderCount >= maxReminders) {
    return false;
  }

  return true;
}

/**
 * Check if signature request is expired
 */
export function isExpired(request: SignatureRequest): boolean {
  if (!request.expiresAt) {
    return false;
  }

  return new Date(request.expiresAt) < new Date();
}

/**
 * Get signature status label
 */
export function getSignatureStatusLabel(status: SignatureStatus): string {
  const labels: Record<SignatureStatus, string> = {
    pending: 'Pending',
    signed: 'Signed',
    declined: 'Declined',
    expired: 'Expired',
    voided: 'Voided',
  };
  return labels[status];
}

/**
 * Get signature request progress as percentage
 */
export function getSignatureProgress(requests: SignatureRequest[]): number {
  if (requests.length === 0) {
    return 0;
  }

  const signedCount = requests.filter(r => r.status === 'signed').length;
  return Math.round((signedCount / requests.length) * 100);
}

/**
 * Check if all signatures are complete
 */
export function allSignaturesComplete(requests: SignatureRequest[]): boolean {
  return requests.length > 0 && requests.every(r => r.status === 'signed');
}

/**
 * Check if any signatures were declined
 */
export function hasDeclinedSignatures(requests: SignatureRequest[]): boolean {
  return requests.some(r => r.status === 'declined');
}
