/**
 * @ecosystem/contracts-document
 * Document management DTOs for cross-service communication
 */

import { z } from 'zod';

// ============================================================================
// Document Types
// ============================================================================

export const documentCategorySchema = z.enum([
  'contract',
  'agreement',
  'policy',
  'certificate',
  'license',
  'permit',
  'report',
  'filing',
  'correspondence',
  'invoice',
  'receipt',
  'tax_document',
  'identity_document',
  'legal_document',
  'other',
]);

export type DocumentCategory = z.infer<typeof documentCategorySchema>;

export const documentStatusSchema = z.enum([
  'draft',
  'pending_review',
  'pending_signature',
  'partially_signed',
  'signed',
  'executed',
  'expired',
  'cancelled',
  'archived',
]);

export type DocumentStatus = z.infer<typeof documentStatusSchema>;

// ============================================================================
// Document Contracts
// ============================================================================

export const documentSchema = z.object({
  id: z.string().uuid(),
  entityId: z.string().uuid(),
  category: documentCategorySchema,
  status: documentStatusSchema,
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  fileName: z.string(),
  mimeType: z.string(),
  fileSize: z.number().int().positive(),
  storageKey: z.string(), // S3 key or storage path
  version: z.number().int().positive(),
  parentDocumentId: z.string().uuid().optional(),
  effectiveDate: z.coerce.date().optional(),
  expirationDate: z.coerce.date().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
  createdBy: z.string().uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Document = z.infer<typeof documentSchema>;

// ============================================================================
// Signature Contracts
// ============================================================================

export const signatureStatusSchema = z.enum([
  'pending',
  'signed',
  'declined',
  'expired',
]);

export const signatureSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  signerId: z.string().uuid(),
  signerEmail: z.string().email(),
  signerName: z.string(),
  status: signatureStatusSchema,
  signedAt: z.coerce.date().optional(),
  ipAddress: z.string().optional(),
  signatureData: z.string().optional(), // Base64 encoded signature image or certificate
  order: z.number().int().positive(), // Signing order
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Signature = z.infer<typeof signatureSchema>;

// ============================================================================
// Document Template Contracts
// ============================================================================

export const documentTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  category: documentCategorySchema,
  description: z.string().max(2000).optional(),
  content: z.string(), // Template content with placeholders
  variables: z.array(z.object({
    name: z.string(),
    type: z.enum(['text', 'number', 'date', 'boolean', 'select']),
    required: z.boolean(),
    defaultValue: z.unknown().optional(),
    options: z.array(z.string()).optional(), // For select type
  })),
  isActive: z.boolean(),
  version: z.number().int().positive(),
  createdBy: z.string().uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type DocumentTemplate = z.infer<typeof documentTemplateSchema>;

// ============================================================================
// Document Access Contracts
// ============================================================================

export const documentAccessSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  userId: z.string().uuid(),
  permission: z.enum(['view', 'edit', 'sign', 'manage']),
  grantedBy: z.string().uuid(),
  expiresAt: z.coerce.date().optional(),
  createdAt: z.coerce.date(),
});

export type DocumentAccess = z.infer<typeof documentAccessSchema>;
