/**
 * KYC Domain Events
 */

import { z } from 'zod';

// Base event schema
const baseEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.string(),
  aggregateId: z.string().uuid(),
  aggregateType: z.enum(['Identity', 'Document', 'VerificationRequest']),
  tenantId: z.string().uuid(),
  occurredAt: z.date(),
  version: z.number().default(1),
  correlationId: z.string().uuid().optional(),
  causationId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// Identity Events
export const identityCreatedEventSchema = baseEventSchema.extend({
  eventType: z.literal('IdentityCreated'),
  payload: z.object({
    identityId: z.string().uuid(),
    type: z.string(),
    externalId: z.string().optional(),
  }),
});

export const identityVerifiedEventSchema = baseEventSchema.extend({
  eventType: z.literal('IdentityVerified'),
  payload: z.object({
    identityId: z.string().uuid(),
    verifiedBy: z.string(),
    verificationRequestId: z.string().uuid().optional(),
  }),
});

export const identityRejectedEventSchema = baseEventSchema.extend({
  eventType: z.literal('IdentityRejected'),
  payload: z.object({
    identityId: z.string().uuid(),
    reason: z.string(),
    rejectedBy: z.string().optional(),
  }),
});

export const identityRiskAssessedEventSchema = baseEventSchema.extend({
  eventType: z.literal('IdentityRiskAssessed'),
  payload: z.object({
    identityId: z.string().uuid(),
    previousRiskLevel: z.string().optional(),
    newRiskLevel: z.string(),
    riskScore: z.number().optional(),
    factors: z.array(z.string()).optional(),
  }),
});

export const identityUpdatedEventSchema = baseEventSchema.extend({
  eventType: z.literal('IdentityUpdated'),
  payload: z.object({
    identityId: z.string().uuid(),
    changedFields: z.array(z.string()),
  }),
});

export const identityPepFlaggedEventSchema = baseEventSchema.extend({
  eventType: z.literal('IdentityPepFlagged'),
  payload: z.object({
    identityId: z.string().uuid(),
    pepDetails: z.record(z.unknown()).optional(),
  }),
});

export const identitySanctionedEventSchema = baseEventSchema.extend({
  eventType: z.literal('IdentitySanctioned'),
  payload: z.object({
    identityId: z.string().uuid(),
    sanctionList: z.string(),
    matchScore: z.number().optional(),
  }),
});

// Document Events
export const documentUploadedEventSchema = baseEventSchema.extend({
  eventType: z.literal('DocumentUploaded'),
  payload: z.object({
    documentId: z.string().uuid(),
    identityId: z.string().uuid(),
    documentType: z.string(),
    fileName: z.string(),
  }),
});

export const documentProcessingStartedEventSchema = baseEventSchema.extend({
  eventType: z.literal('DocumentProcessingStarted'),
  payload: z.object({
    documentId: z.string().uuid(),
    identityId: z.string().uuid(),
  }),
});

export const documentVerifiedEventSchema = baseEventSchema.extend({
  eventType: z.literal('DocumentVerified'),
  payload: z.object({
    documentId: z.string().uuid(),
    identityId: z.string().uuid(),
    verifiedBy: z.string(),
    checks: z.array(z.object({
      checkType: z.string(),
      status: z.string(),
      score: z.number().optional(),
    })).optional(),
  }),
});

export const documentRejectedEventSchema = baseEventSchema.extend({
  eventType: z.literal('DocumentRejected'),
  payload: z.object({
    documentId: z.string().uuid(),
    identityId: z.string().uuid(),
    reason: z.string(),
    rejectedBy: z.string().optional(),
  }),
});

export const documentExpiredEventSchema = baseEventSchema.extend({
  eventType: z.literal('DocumentExpired'),
  payload: z.object({
    documentId: z.string().uuid(),
    identityId: z.string().uuid(),
    expiryDate: z.date(),
  }),
});

// Verification Request Events
export const verificationRequestCreatedEventSchema = baseEventSchema.extend({
  eventType: z.literal('VerificationRequestCreated'),
  payload: z.object({
    requestId: z.string().uuid(),
    identityId: z.string().uuid(),
    type: z.string(),
    requestedBy: z.string(),
    requestSource: z.string(),
  }),
});

export const verificationRequestStartedEventSchema = baseEventSchema.extend({
  eventType: z.literal('VerificationRequestStarted'),
  payload: z.object({
    requestId: z.string().uuid(),
    identityId: z.string().uuid(),
    assignedTo: z.string(),
  }),
});

export const verificationCheckCompletedEventSchema = baseEventSchema.extend({
  eventType: z.literal('VerificationCheckCompleted'),
  payload: z.object({
    requestId: z.string().uuid(),
    identityId: z.string().uuid(),
    checkType: z.string(),
    status: z.string(),
    score: z.number().optional(),
  }),
});

export const verificationRequestApprovedEventSchema = baseEventSchema.extend({
  eventType: z.literal('VerificationRequestApproved'),
  payload: z.object({
    requestId: z.string().uuid(),
    identityId: z.string().uuid(),
    approvedBy: z.string(),
    reason: z.string().optional(),
  }),
});

export const verificationRequestRejectedEventSchema = baseEventSchema.extend({
  eventType: z.literal('VerificationRequestRejected'),
  payload: z.object({
    requestId: z.string().uuid(),
    identityId: z.string().uuid(),
    rejectedBy: z.string(),
    reason: z.string(),
  }),
});

// Type exports
export type IdentityCreatedEvent = z.infer<typeof identityCreatedEventSchema>;
export type IdentityVerifiedEvent = z.infer<typeof identityVerifiedEventSchema>;
export type IdentityRejectedEvent = z.infer<typeof identityRejectedEventSchema>;
export type IdentityRiskAssessedEvent = z.infer<typeof identityRiskAssessedEventSchema>;
export type IdentityUpdatedEvent = z.infer<typeof identityUpdatedEventSchema>;
export type IdentityPepFlaggedEvent = z.infer<typeof identityPepFlaggedEventSchema>;
export type IdentitySanctionedEvent = z.infer<typeof identitySanctionedEventSchema>;

export type DocumentUploadedEvent = z.infer<typeof documentUploadedEventSchema>;
export type DocumentProcessingStartedEvent = z.infer<typeof documentProcessingStartedEventSchema>;
export type DocumentVerifiedEvent = z.infer<typeof documentVerifiedEventSchema>;
export type DocumentRejectedEvent = z.infer<typeof documentRejectedEventSchema>;
export type DocumentExpiredEvent = z.infer<typeof documentExpiredEventSchema>;

export type VerificationRequestCreatedEvent = z.infer<typeof verificationRequestCreatedEventSchema>;
export type VerificationRequestStartedEvent = z.infer<typeof verificationRequestStartedEventSchema>;
export type VerificationCheckCompletedEvent = z.infer<typeof verificationCheckCompletedEventSchema>;
export type VerificationRequestApprovedEvent = z.infer<typeof verificationRequestApprovedEventSchema>;
export type VerificationRequestRejectedEvent = z.infer<typeof verificationRequestRejectedEventSchema>;

export type KycDomainEvent =
  | IdentityCreatedEvent
  | IdentityVerifiedEvent
  | IdentityRejectedEvent
  | IdentityRiskAssessedEvent
  | IdentityUpdatedEvent
  | IdentityPepFlaggedEvent
  | IdentitySanctionedEvent
  | DocumentUploadedEvent
  | DocumentProcessingStartedEvent
  | DocumentVerifiedEvent
  | DocumentRejectedEvent
  | DocumentExpiredEvent
  | VerificationRequestCreatedEvent
  | VerificationRequestStartedEvent
  | VerificationCheckCompletedEvent
  | VerificationRequestApprovedEvent
  | VerificationRequestRejectedEvent;

// Event factory
export function createKycEvent<T extends KycDomainEvent>(
  eventType: T['eventType'],
  aggregateId: string,
  aggregateType: T['aggregateType'],
  tenantId: string,
  payload: T['payload'],
  options?: {
    correlationId?: string;
    causationId?: string;
    metadata?: Record<string, unknown>;
  }
): T {
  return {
    eventId: crypto.randomUUID(),
    eventType,
    aggregateId,
    aggregateType,
    tenantId,
    payload,
    occurredAt: new Date(),
    version: 1,
    ...options,
  } as T;
}
