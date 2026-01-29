/**
 * KYC Commands
 */

import { z } from 'zod';
import {
  identityTypeSchema,
  personNameSchema,
  addressSchema,
  dateOfBirthSchema,
  corporateDetailsSchema,
  documentTypeSchema,
  verificationTypeSchema,
} from '../../domain/value-objects/index.js';

// Create Identity Command
export const createIdentityCommandSchema = z.object({
  tenantId: z.string().uuid(),
  externalId: z.string().max(255).optional(),
  type: identityTypeSchema,
  
  // Individual
  name: personNameSchema.optional(),
  dateOfBirth: dateOfBirthSchema.optional(),
  nationality: z.string().length(2).optional(),
  taxId: z.string().max(50).optional(),
  
  // Corporate
  corporateDetails: corporateDetailsSchema.optional(),
  
  // Contact
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  address: addressSchema.optional(),
  
  // Metadata
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

export type CreateIdentityCommand = z.infer<typeof createIdentityCommandSchema>;

// Update Identity Command
export const updateIdentityCommandSchema = z.object({
  identityId: z.string().uuid(),
  tenantId: z.string().uuid(),
  
  name: personNameSchema.optional(),
  dateOfBirth: dateOfBirthSchema.optional(),
  nationality: z.string().length(2).optional(),
  taxId: z.string().max(50).optional(),
  corporateDetails: corporateDetailsSchema.optional(),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  address: addressSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

export type UpdateIdentityCommand = z.infer<typeof updateIdentityCommandSchema>;

// Verify Identity Command
export const verifyIdentityCommandSchema = z.object({
  identityId: z.string().uuid(),
  tenantId: z.string().uuid(),
  verifiedBy: z.string(),
  expiresAt: z.date().optional(),
});

export type VerifyIdentityCommand = z.infer<typeof verifyIdentityCommandSchema>;

// Reject Identity Command
export const rejectIdentityCommandSchema = z.object({
  identityId: z.string().uuid(),
  tenantId: z.string().uuid(),
  reason: z.string().min(1),
  rejectedBy: z.string(),
});

export type RejectIdentityCommand = z.infer<typeof rejectIdentityCommandSchema>;

// Upload Document Command
export const uploadDocumentCommandSchema = z.object({
  identityId: z.string().uuid(),
  tenantId: z.string().uuid(),
  type: documentTypeSchema,
  documentNumber: z.string().max(100).optional(),
  issuingCountry: z.string().length(2).optional(),
  issueDate: z.date().optional(),
  expiryDate: z.date().optional(),
  fileName: z.string().max(500),
  fileType: z.string().max(100),
  fileSize: z.number(),
  storageKey: z.string().max(1000),
  checksum: z.string().max(128).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type UploadDocumentCommand = z.infer<typeof uploadDocumentCommandSchema>;

// Verify Document Command
export const verifyDocumentCommandSchema = z.object({
  documentId: z.string().uuid(),
  tenantId: z.string().uuid(),
  verifiedBy: z.string(),
  checks: z.array(z.object({
    checkType: z.string(),
    status: z.enum(['PASSED', 'FAILED', 'PENDING']),
    score: z.number().optional(),
    details: z.record(z.unknown()).optional(),
  })),
});

export type VerifyDocumentCommand = z.infer<typeof verifyDocumentCommandSchema>;

// Reject Document Command
export const rejectDocumentCommandSchema = z.object({
  documentId: z.string().uuid(),
  tenantId: z.string().uuid(),
  reason: z.string().min(1),
  rejectedBy: z.string(),
});

export type RejectDocumentCommand = z.infer<typeof rejectDocumentCommandSchema>;

// Create Verification Request Command
export const createVerificationRequestCommandSchema = z.object({
  identityId: z.string().uuid(),
  tenantId: z.string().uuid(),
  type: verificationTypeSchema,
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  requiredDocuments: z.array(z.object({
    documentType: z.string(),
    required: z.boolean(),
  })).optional(),
  requestedBy: z.string(),
  requestSource: z.enum(['MANUAL', 'AUTOMATED', 'API', 'SCHEDULED']),
  expiresAt: z.date().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateVerificationRequestCommand = z.infer<typeof createVerificationRequestCommandSchema>;

// Start Verification Review Command
export const startVerificationReviewCommandSchema = z.object({
  requestId: z.string().uuid(),
  tenantId: z.string().uuid(),
  assignedTo: z.string(),
});

export type StartVerificationReviewCommand = z.infer<typeof startVerificationReviewCommandSchema>;

// Complete Verification Request Command
export const completeVerificationRequestCommandSchema = z.object({
  requestId: z.string().uuid(),
  tenantId: z.string().uuid(),
  decision: z.enum(['APPROVED', 'REJECTED']),
  reason: z.string().optional(),
  decisionBy: z.string(),
});

export type CompleteVerificationRequestCommand = z.infer<typeof completeVerificationRequestCommandSchema>;

// Assess Risk Command
export const assessRiskCommandSchema = z.object({
  identityId: z.string().uuid(),
  tenantId: z.string().uuid(),
  assessedBy: z.string().optional(),
});

export type AssessRiskCommand = z.infer<typeof assessRiskCommandSchema>;

// Run AML Screening Command
export const runAmlScreeningCommandSchema = z.object({
  identityId: z.string().uuid(),
  tenantId: z.string().uuid(),
  screeningTypes: z.array(z.enum(['PEP', 'SANCTIONS', 'ADVERSE_MEDIA'])),
  verificationRequestId: z.string().uuid().optional(),
});

export type RunAmlScreeningCommand = z.infer<typeof runAmlScreeningCommandSchema>;
