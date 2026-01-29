/**
 * KYC Queries
 */

import { z } from 'zod';
import { identityTypeSchema, verificationStatusSchema, riskLevelSchema } from '../../domain/value-objects/index.js';

// Get Identity Query
export const getIdentityQuerySchema = z.object({
  identityId: z.string().uuid(),
  tenantId: z.string().uuid(),
});

export type GetIdentityQuery = z.infer<typeof getIdentityQuerySchema>;

// Get Identity by External ID Query
export const getIdentityByExternalIdQuerySchema = z.object({
  externalId: z.string(),
  tenantId: z.string().uuid(),
});

export type GetIdentityByExternalIdQuery = z.infer<typeof getIdentityByExternalIdQuerySchema>;

// List Identities Query
export const listIdentitiesQuerySchema = z.object({
  tenantId: z.string().uuid(),
  type: identityTypeSchema.optional(),
  verificationStatus: verificationStatusSchema.optional(),
  riskLevel: riskLevelSchema.optional(),
  isPep: z.boolean().optional(),
  isSanctioned: z.boolean().optional(),
  search: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  orderBy: z.enum(['createdAt', 'updatedAt', 'verifiedAt']).default('createdAt'),
  orderDirection: z.enum(['asc', 'desc']).default('desc'),
});

export type ListIdentitiesQuery = z.infer<typeof listIdentitiesQuerySchema>;

// Get Document Query
export const getDocumentQuerySchema = z.object({
  documentId: z.string().uuid(),
  tenantId: z.string().uuid(),
});

export type GetDocumentQuery = z.infer<typeof getDocumentQuerySchema>;

// List Documents Query
export const listDocumentsQuerySchema = z.object({
  identityId: z.string().uuid(),
  tenantId: z.string().uuid(),
  type: z.string().optional(),
  status: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

export type ListDocumentsQuery = z.infer<typeof listDocumentsQuerySchema>;

// Get Verification Request Query
export const getVerificationRequestQuerySchema = z.object({
  requestId: z.string().uuid(),
  tenantId: z.string().uuid(),
});

export type GetVerificationRequestQuery = z.infer<typeof getVerificationRequestQuerySchema>;

// List Verification Requests Query
export const listVerificationRequestsQuerySchema = z.object({
  tenantId: z.string().uuid(),
  identityId: z.string().uuid().optional(),
  status: verificationStatusSchema.optional(),
  type: z.string().optional(),
  assignedTo: z.string().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  orderBy: z.enum(['createdAt', 'requestedAt', 'priority']).default('requestedAt'),
  orderDirection: z.enum(['asc', 'desc']).default('desc'),
});

export type ListVerificationRequestsQuery = z.infer<typeof listVerificationRequestsQuerySchema>;

// Get Pending Reviews Query
export const getPendingReviewsQuerySchema = z.object({
  tenantId: z.string().uuid(),
  assignedTo: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
});

export type GetPendingReviewsQuery = z.infer<typeof getPendingReviewsQuerySchema>;

// Get AML Screening Results Query
export const getAmlScreeningResultsQuerySchema = z.object({
  identityId: z.string().uuid(),
  tenantId: z.string().uuid(),
  screeningType: z.enum(['PEP', 'SANCTIONS', 'ADVERSE_MEDIA']).optional(),
});

export type GetAmlScreeningResultsQuery = z.infer<typeof getAmlScreeningResultsQuerySchema>;

// Get Identity Audit Log Query
export const getIdentityAuditLogQuerySchema = z.object({
  identityId: z.string().uuid(),
  tenantId: z.string().uuid(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

export type GetIdentityAuditLogQuery = z.infer<typeof getIdentityAuditLogQuerySchema>;

// Get Expiring Documents Query
export const getExpiringDocumentsQuerySchema = z.object({
  tenantId: z.string().uuid(),
  daysUntilExpiry: z.number().min(1).max(365).default(30),
  limit: z.number().min(1).max(100).default(50),
});

export type GetExpiringDocumentsQuery = z.infer<typeof getExpiringDocumentsQuerySchema>;

// Get Verification Statistics Query
export const getVerificationStatisticsQuerySchema = z.object({
  tenantId: z.string().uuid(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
});

export type GetVerificationStatisticsQuery = z.infer<typeof getVerificationStatisticsQuerySchema>;
