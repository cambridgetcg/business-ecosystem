/**
 * @ecosystem/events-legal
 * Legal and contract domain events
 */

import { z } from 'zod';

// Base schemas
const eventMetadataSchema = z.object({
  correlationId: z.string().uuid(),
  causationId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  tenantId: z.string().uuid().optional(),
  source: z.string(),
  timestamp: z.coerce.date(),
});

const baseDomainEventSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  aggregateId: z.string().uuid(),
  aggregateType: z.string(),
  version: z.number().int().positive(),
  occurredAt: z.coerce.date(),
  metadata: eventMetadataSchema,
});

// ============================================================================
// Contract Events
// ============================================================================

export const contractCreatedEventSchema = baseDomainEventSchema.extend({
  type: z.literal('contract.created'),
  aggregateType: z.literal('Contract'),
  payload: z.object({
    entityId: z.string().uuid(),
    contractType: z.string(),
    counterpartyName: z.string(),
    effectiveDate: z.coerce.date().optional(),
  }),
});

export type ContractCreatedEvent = z.infer<typeof contractCreatedEventSchema>;

export const contractSignedEventSchema = baseDomainEventSchema.extend({
  type: z.literal('contract.signed'),
  aggregateType: z.literal('Contract'),
  payload: z.object({
    signedBy: z.string().uuid(),
    signedAt: z.coerce.date(),
    allPartiesSigned: z.boolean(),
  }),
});

export type ContractSignedEvent = z.infer<typeof contractSignedEventSchema>;

export const contractExecutedEventSchema = baseDomainEventSchema.extend({
  type: z.literal('contract.executed'),
  aggregateType: z.literal('Contract'),
  payload: z.object({
    executedAt: z.coerce.date(),
    effectiveDate: z.coerce.date(),
    expirationDate: z.coerce.date().optional(),
  }),
});

export type ContractExecutedEvent = z.infer<typeof contractExecutedEventSchema>;

export const contractExpiredEventSchema = baseDomainEventSchema.extend({
  type: z.literal('contract.expired'),
  aggregateType: z.literal('Contract'),
  payload: z.object({
    expiredAt: z.coerce.date(),
    autoRenewed: z.boolean(),
  }),
});

export type ContractExpiredEvent = z.infer<typeof contractExpiredEventSchema>;

export const contractTerminatedEventSchema = baseDomainEventSchema.extend({
  type: z.literal('contract.terminated'),
  aggregateType: z.literal('Contract'),
  payload: z.object({
    terminatedAt: z.coerce.date(),
    terminatedBy: z.string().uuid(),
    reason: z.string(),
  }),
});

export type ContractTerminatedEvent = z.infer<typeof contractTerminatedEventSchema>;

// ============================================================================
// Document Events
// ============================================================================

export const documentUploadedEventSchema = baseDomainEventSchema.extend({
  type: z.literal('document.uploaded'),
  aggregateType: z.literal('Document'),
  payload: z.object({
    fileName: z.string(),
    category: z.string(),
    entityId: z.string().uuid(),
    uploadedBy: z.string().uuid(),
  }),
});

export type DocumentUploadedEvent = z.infer<typeof documentUploadedEventSchema>;

export const documentSignatureRequestedEventSchema = baseDomainEventSchema.extend({
  type: z.literal('document.signature_requested'),
  aggregateType: z.literal('Document'),
  payload: z.object({
    signerIds: z.array(z.string().uuid()),
    dueDate: z.coerce.date().optional(),
  }),
});

export type DocumentSignatureRequestedEvent = z.infer<typeof documentSignatureRequestedEventSchema>;

// ============================================================================
// IP Events
// ============================================================================

export const trademarkFiledEventSchema = baseDomainEventSchema.extend({
  type: z.literal('ip.trademark_filed'),
  aggregateType: z.literal('Trademark'),
  payload: z.object({
    markName: z.string(),
    classes: z.array(z.number()),
    jurisdiction: z.string(),
    filingDate: z.coerce.date(),
  }),
});

export type TrademarkFiledEvent = z.infer<typeof trademarkFiledEventSchema>;

export const patentGrantedEventSchema = baseDomainEventSchema.extend({
  type: z.literal('ip.patent_granted'),
  aggregateType: z.literal('Patent'),
  payload: z.object({
    patentNumber: z.string(),
    title: z.string(),
    grantDate: z.coerce.date(),
    expirationDate: z.coerce.date(),
  }),
});

export type PatentGrantedEvent = z.infer<typeof patentGrantedEventSchema>;

// ============================================================================
// Event Union
// ============================================================================

export const legalEventSchema = z.discriminatedUnion('type', [
  contractCreatedEventSchema,
  contractSignedEventSchema,
  contractExecutedEventSchema,
  contractExpiredEventSchema,
  contractTerminatedEventSchema,
  documentUploadedEventSchema,
  documentSignatureRequestedEventSchema,
  trademarkFiledEventSchema,
  patentGrantedEventSchema,
]);

export type LegalEvent = z.infer<typeof legalEventSchema>;

export const LEGAL_EVENT_TYPES = [
  'contract.created',
  'contract.signed',
  'contract.executed',
  'contract.expired',
  'contract.terminated',
  'document.uploaded',
  'document.signature_requested',
  'ip.trademark_filed',
  'ip.patent_granted',
] as const;
