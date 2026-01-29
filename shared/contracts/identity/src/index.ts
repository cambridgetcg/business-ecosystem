/**
 * @ecosystem/contracts-identity
 * Identity and user-related DTOs for cross-service communication
 */

import { z } from 'zod';

// ============================================================================
// User Contracts
// ============================================================================

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  roles: z.array(z.string()),
  tenantId: z.string().uuid().optional(),
  status: z.enum(['active', 'inactive', 'pending', 'suspended']),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type User = z.infer<typeof userSchema>;

export const createUserSchema = userSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateUser = z.infer<typeof createUserSchema>;

// ============================================================================
// KYC Verification Contracts
// ============================================================================

export const kycStatusSchema = z.enum([
  'not_started',
  'pending',
  'in_review',
  'approved',
  'rejected',
  'expired',
]);

export type KycStatus = z.infer<typeof kycStatusSchema>;

export const kycVerificationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  status: kycStatusSchema,
  level: z.enum(['basic', 'enhanced', 'full']),
  verifiedAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional(),
  documents: z.array(z.object({
    type: z.string(),
    status: z.enum(['pending', 'verified', 'rejected']),
    uploadedAt: z.coerce.date(),
  })),
  riskScore: z.number().min(0).max(100).optional(),
});

export type KycVerification = z.infer<typeof kycVerificationSchema>;

// ============================================================================
// Tenant Contracts
// ============================================================================

export const tenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  status: z.enum(['active', 'inactive', 'suspended']),
  settings: z.record(z.unknown()).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Tenant = z.infer<typeof tenantSchema>;

// ============================================================================
// Authentication Contracts
// ============================================================================

export const authTokenSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
  tokenType: z.literal('Bearer'),
});

export type AuthToken = z.infer<typeof authTokenSchema>;

export const sessionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  tenantId: z.string().uuid().optional(),
  ipAddress: z.string(),
  userAgent: z.string(),
  createdAt: z.coerce.date(),
  expiresAt: z.coerce.date(),
  lastActivityAt: z.coerce.date(),
});

export type Session = z.infer<typeof sessionSchema>;
