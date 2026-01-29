/**
 * Verification Request Entity
 * Represents a KYC verification workflow
 */

import { z } from 'zod';
import {
  VerificationStatus,
  verificationStatusSchema,
  RiskLevel,
  riskLevelSchema,
  verificationCheckSchema,
  type VerificationCheck,
} from '../value-objects/index.js';

export const VerificationType = {
  IDENTITY: 'IDENTITY',
  DOCUMENT: 'DOCUMENT',
  ADDRESS: 'ADDRESS',
  AML_SCREENING: 'AML_SCREENING',
  FULL_KYC: 'FULL_KYC',
  ENHANCED_DUE_DILIGENCE: 'ENHANCED_DUE_DILIGENCE',
  PERIODIC_REVIEW: 'PERIODIC_REVIEW',
} as const;

export type VerificationType = (typeof VerificationType)[keyof typeof VerificationType];

export const verificationTypeSchema = z.enum([
  'IDENTITY',
  'DOCUMENT',
  'ADDRESS',
  'AML_SCREENING',
  'FULL_KYC',
  'ENHANCED_DUE_DILIGENCE',
  'PERIODIC_REVIEW',
]);

export const verificationRequestSchema = z.object({
  id: z.string().uuid(),
  identityId: z.string().uuid(),
  tenantId: z.string().uuid(),
  
  // Request info
  type: verificationTypeSchema,
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  
  // Status
  status: verificationStatusSchema,
  
  // Required documents
  requiredDocuments: z.array(z.object({
    documentType: z.string(),
    required: z.boolean(),
    uploadedDocumentId: z.string().uuid().optional(),
    status: z.enum(['PENDING', 'UPLOADED', 'VERIFIED', 'REJECTED']),
  })),
  
  // Checks
  checks: z.array(verificationCheckSchema).optional(),
  checksCompleted: z.number().default(0),
  checksTotal: z.number().default(0),
  
  // Risk
  riskLevel: riskLevelSchema.optional(),
  riskScore: z.number().min(0).max(100).optional(),
  riskFactors: z.array(z.string()).optional(),
  
  // Assignment
  assignedTo: z.string().optional(),
  assignedAt: z.date().optional(),
  
  // Review
  reviewNotes: z.string().optional(),
  internalNotes: z.string().optional(),
  
  // Timestamps
  requestedAt: z.date(),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  expiresAt: z.date().optional(),
  
  // Requester
  requestedBy: z.string(),
  requestSource: z.enum(['MANUAL', 'AUTOMATED', 'API', 'SCHEDULED']),
  
  // Result
  decision: z.enum(['APPROVED', 'REJECTED', 'REFERRED']).optional(),
  decisionReason: z.string().optional(),
  decisionBy: z.string().optional(),
  decisionAt: z.date().optional(),
  
  // Metadata
  metadata: z.record(z.unknown()).optional(),
  
  // Timestamps
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type VerificationRequest = z.infer<typeof verificationRequestSchema>;

export const createVerificationRequestSchema = z.object({
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

export type CreateVerificationRequestInput = z.infer<typeof createVerificationRequestSchema>;

// Domain logic
export class VerificationRequestEntity {
  constructor(private readonly data: VerificationRequest) {}

  get id(): string {
    return this.data.id;
  }

  get identityId(): string {
    return this.data.identityId;
  }

  get type(): VerificationType {
    return this.data.type;
  }

  get status(): VerificationStatus {
    return this.data.status;
  }

  get isComplete(): boolean {
    return (
      this.data.status === VerificationStatus.APPROVED ||
      this.data.status === VerificationStatus.REJECTED
    );
  }

  get isExpired(): boolean {
    if (!this.data.expiresAt) return false;
    return new Date() > this.data.expiresAt;
  }

  get progress(): number {
    if (this.data.checksTotal === 0) return 0;
    return Math.round((this.data.checksCompleted / this.data.checksTotal) * 100);
  }

  get pendingDocuments(): typeof this.data.requiredDocuments {
    return this.data.requiredDocuments.filter(
      d => d.required && d.status !== 'VERIFIED'
    );
  }

  get hasAllDocuments(): boolean {
    return this.pendingDocuments.length === 0;
  }

  startReview(assignedTo: string): VerificationRequest {
    if (this.data.status !== VerificationStatus.PENDING) {
      throw new Error('Request must be in PENDING status to start review');
    }
    return {
      ...this.data,
      status: VerificationStatus.IN_REVIEW,
      assignedTo,
      assignedAt: new Date(),
      startedAt: new Date(),
      updatedAt: new Date(),
    };
  }

  addCheck(check: VerificationCheck): VerificationRequest {
    const checks = [...(this.data.checks || []), check];
    return {
      ...this.data,
      checks,
      checksCompleted: checks.filter(c => c.status !== 'PENDING').length,
      updatedAt: new Date(),
    };
  }

  linkDocument(documentType: string, documentId: string): VerificationRequest {
    const requiredDocuments = this.data.requiredDocuments.map(doc => {
      if (doc.documentType === documentType) {
        return {
          ...doc,
          uploadedDocumentId: documentId,
          status: 'UPLOADED' as const,
        };
      }
      return doc;
    });
    return {
      ...this.data,
      requiredDocuments,
      updatedAt: new Date(),
    };
  }

  markDocumentVerified(documentId: string): VerificationRequest {
    const requiredDocuments = this.data.requiredDocuments.map(doc => {
      if (doc.uploadedDocumentId === documentId) {
        return { ...doc, status: 'VERIFIED' as const };
      }
      return doc;
    });
    return {
      ...this.data,
      requiredDocuments,
      updatedAt: new Date(),
    };
  }

  approve(decisionBy: string, reason?: string): VerificationRequest {
    if (this.isComplete) {
      throw new Error('Request is already complete');
    }
    return {
      ...this.data,
      status: VerificationStatus.APPROVED,
      decision: 'APPROVED',
      decisionBy,
      decisionReason: reason,
      decisionAt: new Date(),
      completedAt: new Date(),
      updatedAt: new Date(),
    };
  }

  reject(decisionBy: string, reason: string): VerificationRequest {
    if (this.isComplete) {
      throw new Error('Request is already complete');
    }
    return {
      ...this.data,
      status: VerificationStatus.REJECTED,
      decision: 'REJECTED',
      decisionBy,
      decisionReason: reason,
      decisionAt: new Date(),
      completedAt: new Date(),
      updatedAt: new Date(),
    };
  }

  refer(decisionBy: string, reason: string): VerificationRequest {
    return {
      ...this.data,
      decision: 'REFERRED',
      decisionBy,
      decisionReason: reason,
      decisionAt: new Date(),
      updatedAt: new Date(),
    };
  }

  setRiskAssessment(riskLevel: RiskLevel, score: number, factors: string[]): VerificationRequest {
    return {
      ...this.data,
      riskLevel,
      riskScore: score,
      riskFactors: factors,
      updatedAt: new Date(),
    };
  }

  toJSON(): VerificationRequest {
    return { ...this.data };
  }
}
