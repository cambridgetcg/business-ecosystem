/**
 * Document Entity
 * Represents an identity document (passport, ID, etc.)
 */

import { z } from 'zod';
import {
  DocumentType,
  documentTypeSchema,
  VerificationStatus,
  verificationStatusSchema,
} from '../value-objects/index.js';

export const DocumentStatus = {
  UPLOADED: 'UPLOADED',
  PROCESSING: 'PROCESSING',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
} as const;

export type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus];

export const documentStatusSchema = z.enum([
  'UPLOADED',
  'PROCESSING',
  'VERIFIED',
  'REJECTED',
  'EXPIRED',
]);

export const documentSchema = z.object({
  id: z.string().uuid(),
  identityId: z.string().uuid(),
  tenantId: z.string().uuid(),
  
  // Document info
  type: documentTypeSchema,
  documentNumber: z.string().max(100).optional(),
  issuingCountry: z.string().length(2).optional(),
  issuingAuthority: z.string().max(200).optional(),
  issueDate: z.date().optional(),
  expiryDate: z.date().optional(),
  
  // File info
  fileName: z.string().max(500),
  fileType: z.string().max(100),
  fileSize: z.number(),
  storageKey: z.string().max(1000),
  checksum: z.string().max(128).optional(),
  
  // Processing
  status: documentStatusSchema,
  ocrData: z.record(z.unknown()).optional(),
  extractedData: z.record(z.unknown()).optional(),
  
  // Verification
  verificationStatus: verificationStatusSchema,
  verificationChecks: z.array(z.object({
    checkType: z.string(),
    status: z.enum(['PASSED', 'FAILED', 'PENDING']),
    score: z.number().optional(),
    details: z.record(z.unknown()).optional(),
    performedAt: z.date(),
  })).optional(),
  verifiedAt: z.date().optional(),
  verifiedBy: z.string().optional(),
  rejectionReason: z.string().optional(),
  
  // Metadata
  metadata: z.record(z.unknown()).optional(),
  
  // Timestamps
  uploadedAt: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Document = z.infer<typeof documentSchema>;

export const uploadDocumentSchema = z.object({
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

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;

// Domain logic
export class DocumentEntity {
  constructor(private readonly data: Document) {}

  get id(): string {
    return this.data.id;
  }

  get identityId(): string {
    return this.data.identityId;
  }

  get type(): DocumentType {
    return this.data.type;
  }

  get status(): DocumentStatus {
    return this.data.status;
  }

  get verificationStatus(): VerificationStatus {
    return this.data.verificationStatus;
  }

  get isExpired(): boolean {
    if (!this.data.expiryDate) return false;
    return new Date() > this.data.expiryDate;
  }

  get isVerified(): boolean {
    return this.data.verificationStatus === VerificationStatus.APPROVED;
  }

  get isIdentityDocument(): boolean {
    const identityTypes: readonly DocumentType[] = [
      DocumentType.PASSPORT,
      DocumentType.NATIONAL_ID,
      DocumentType.DRIVERS_LICENSE,
      DocumentType.RESIDENCE_PERMIT,
    ];
    return identityTypes.includes(this.data.type);
  }

  get isProofOfAddress(): boolean {
    const addressTypes: readonly DocumentType[] = [
      DocumentType.UTILITY_BILL,
      DocumentType.BANK_STATEMENT,
    ];
    return addressTypes.includes(this.data.type);
  }

  startProcessing(): Document {
    if (this.data.status !== DocumentStatus.UPLOADED) {
      throw new Error('Document must be in UPLOADED status to start processing');
    }
    return {
      ...this.data,
      status: DocumentStatus.PROCESSING,
      verificationStatus: VerificationStatus.IN_REVIEW,
      updatedAt: new Date(),
    };
  }

  setOcrData(ocrData: Record<string, unknown>, extractedData: Record<string, unknown>): Document {
    return {
      ...this.data,
      ocrData,
      extractedData,
      updatedAt: new Date(),
    };
  }

  verify(verifiedBy: string, checks: Document['verificationChecks']): Document {
    const allPassed = checks?.every(c => c.status === 'PASSED') ?? false;
    
    return {
      ...this.data,
      status: allPassed ? DocumentStatus.VERIFIED : DocumentStatus.REJECTED,
      verificationStatus: allPassed ? VerificationStatus.APPROVED : VerificationStatus.REJECTED,
      verificationChecks: checks,
      verifiedAt: new Date(),
      verifiedBy,
      updatedAt: new Date(),
    };
  }

  reject(reason: string, verifiedBy: string): Document {
    return {
      ...this.data,
      status: DocumentStatus.REJECTED,
      verificationStatus: VerificationStatus.REJECTED,
      rejectionReason: reason,
      verifiedAt: new Date(),
      verifiedBy,
      updatedAt: new Date(),
    };
  }

  markExpired(): Document {
    return {
      ...this.data,
      status: DocumentStatus.EXPIRED,
      verificationStatus: VerificationStatus.EXPIRED,
      updatedAt: new Date(),
    };
  }

  toJSON(): Document {
    return { ...this.data };
  }
}
