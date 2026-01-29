/**
 * KYC Value Objects
 */

import { z } from 'zod';

// Document Types
export const DocumentType = {
  PASSPORT: 'PASSPORT',
  NATIONAL_ID: 'NATIONAL_ID',
  DRIVERS_LICENSE: 'DRIVERS_LICENSE',
  RESIDENCE_PERMIT: 'RESIDENCE_PERMIT',
  UTILITY_BILL: 'UTILITY_BILL',
  BANK_STATEMENT: 'BANK_STATEMENT',
  TAX_RETURN: 'TAX_RETURN',
  CORPORATE_REGISTRATION: 'CORPORATE_REGISTRATION',
  ARTICLES_OF_INCORPORATION: 'ARTICLES_OF_INCORPORATION',
  BENEFICIAL_OWNERSHIP: 'BENEFICIAL_OWNERSHIP',
} as const;

export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

export const documentTypeSchema = z.enum([
  'PASSPORT',
  'NATIONAL_ID',
  'DRIVERS_LICENSE',
  'RESIDENCE_PERMIT',
  'UTILITY_BILL',
  'BANK_STATEMENT',
  'TAX_RETURN',
  'CORPORATE_REGISTRATION',
  'ARTICLES_OF_INCORPORATION',
  'BENEFICIAL_OWNERSHIP',
]);

// Identity Types
export const IdentityType = {
  INDIVIDUAL: 'INDIVIDUAL',
  CORPORATE: 'CORPORATE',
  TRUST: 'TRUST',
  PARTNERSHIP: 'PARTNERSHIP',
} as const;

export type IdentityType = (typeof IdentityType)[keyof typeof IdentityType];

export const identityTypeSchema = z.enum(['INDIVIDUAL', 'CORPORATE', 'TRUST', 'PARTNERSHIP']);

// Verification Status
export const VerificationStatus = {
  PENDING: 'PENDING',
  IN_REVIEW: 'IN_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
  REQUIRES_UPDATE: 'REQUIRES_UPDATE',
} as const;

export type VerificationStatus = (typeof VerificationStatus)[keyof typeof VerificationStatus];

export const verificationStatusSchema = z.enum([
  'PENDING',
  'IN_REVIEW',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
  'REQUIRES_UPDATE',
]);

// Risk Level
export const RiskLevel = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  VERY_HIGH: 'VERY_HIGH',
  PROHIBITED: 'PROHIBITED',
} as const;

export type RiskLevel = (typeof RiskLevel)[keyof typeof RiskLevel];

export const riskLevelSchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH', 'PROHIBITED']);

// Verification Types
export const VerificationType = {
  KYC: 'KYC',
  KYB: 'KYB',
  EDD: 'EDD',
  PERIODIC_REVIEW: 'PERIODIC_REVIEW',
  DOCUMENT_REFRESH: 'DOCUMENT_REFRESH',
  AML_SCREENING: 'AML_SCREENING',
} as const;

export type VerificationType = (typeof VerificationType)[keyof typeof VerificationType];

export const verificationTypeSchema = z.enum([
  'KYC',
  'KYB',
  'EDD',
  'PERIODIC_REVIEW',
  'DOCUMENT_REFRESH',
  'AML_SCREENING',
]);

// Person Name
export const personNameSchema = z.object({
  firstName: z.string().min(1).max(100),
  middleName: z.string().max(100).optional(),
  lastName: z.string().min(1).max(100),
  suffix: z.string().max(20).optional(),
});

export type PersonName = z.infer<typeof personNameSchema>;

// Address
export const addressSchema = z.object({
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1).max(100),
  state: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().length(2), // ISO 3166-1 alpha-2
});

export type Address = z.infer<typeof addressSchema>;

// Date of Birth
export const dateOfBirthSchema = z.object({
  year: z.number().min(1900).max(new Date().getFullYear()),
  month: z.number().min(1).max(12),
  day: z.number().min(1).max(31),
});

export type DateOfBirth = z.infer<typeof dateOfBirthSchema>;

// Document Reference
export const documentReferenceSchema = z.object({
  documentId: z.string().uuid(),
  documentType: documentTypeSchema,
  documentNumber: z.string().max(100).optional(),
  issuingCountry: z.string().length(2).optional(),
  issueDate: z.date().optional(),
  expiryDate: z.date().optional(),
});

export type DocumentReference = z.infer<typeof documentReferenceSchema>;

// Verification Check
export const verificationCheckSchema = z.object({
  checkType: z.enum([
    'IDENTITY_MATCH',
    'DOCUMENT_AUTHENTICITY',
    'LIVENESS',
    'AML_SCREENING',
    'PEP_SCREENING',
    'SANCTIONS_SCREENING',
    'ADVERSE_MEDIA',
    'ADDRESS_VERIFICATION',
  ]),
  status: z.enum(['PASSED', 'FAILED', 'PENDING', 'NOT_APPLICABLE']),
  score: z.number().min(0).max(100).optional(),
  details: z.record(z.unknown()).optional(),
  performedAt: z.date(),
  provider: z.string().optional(),
});

export type VerificationCheck = z.infer<typeof verificationCheckSchema>;

// Risk Assessment
export const riskAssessmentSchema = z.object({
  overallRisk: riskLevelSchema,
  factors: z.array(z.object({
    factor: z.string(),
    risk: riskLevelSchema,
    weight: z.number().min(0).max(1),
    details: z.string().optional(),
  })),
  assessedAt: z.date(),
  assessedBy: z.string().optional(),
  nextReviewDate: z.date().optional(),
});

export type RiskAssessment = z.infer<typeof riskAssessmentSchema>;

// Corporate Details
export const corporateDetailsSchema = z.object({
  legalName: z.string().min(1).max(500),
  tradingName: z.string().max(500).optional(),
  registrationNumber: z.string().max(100),
  registrationCountry: z.string().length(2),
  incorporationDate: z.date().optional(),
  entityType: z.string().max(100).optional(),
  industry: z.string().max(200).optional(),
  website: z.string().url().optional(),
});

export type CorporateDetails = z.infer<typeof corporateDetailsSchema>;

// Beneficial Owner
export const beneficialOwnerSchema = z.object({
  identityId: z.string().uuid().optional(),
  name: personNameSchema,
  dateOfBirth: dateOfBirthSchema.optional(),
  nationality: z.string().length(2).optional(),
  ownershipPercentage: z.number().min(0).max(100),
  controlType: z.enum(['DIRECT', 'INDIRECT', 'VOTING_RIGHTS', 'BOARD_CONTROL']).optional(),
  verificationStatus: verificationStatusSchema,
});

export type BeneficialOwner = z.infer<typeof beneficialOwnerSchema>;
