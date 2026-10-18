/**
 * Identity Domain Model
 *
 * Represents a user identity in the security system.
 * Manages authentication credentials, MFA, and identity state.
 */

import { z } from 'zod';
import {
  IdentityStatusSchema,
  MFAStatusSchema,
  AuthenticationMethodSchema,
  DeviceFingerprintSchema,
  type IdentityStatus,
} from '../../value-objects/index.js';

// =============================================================================
// MFA Configuration
// =============================================================================

export const MFAConfigSchema = z.object({
  totpEnabled: z.boolean().default(false),
  totpSecret: z.string().nullable(),
  smsEnabled: z.boolean().default(false),
  phoneNumber: z.string().nullable(),
  backupCodes: z.array(z.string()).nullable(),
  backupCodesUsed: z.number().int().default(0),
  lastMFAVerification: z.date().nullable(),
});
export type MFAConfig = z.infer<typeof MFAConfigSchema>;

// =============================================================================
// Password Policy
// =============================================================================

export const PasswordHistorySchema = z.object({
  hash: z.string(),
  createdAt: z.date(),
});
export type PasswordHistory = z.infer<typeof PasswordHistorySchema>;

// =============================================================================
// Identity Schema
// =============================================================================

export const IdentitySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),

  // User reference
  userId: z.string().uuid(),
  email: z.string().email(),
  username: z.string().min(3).max(50).nullable(),

  // Status
  status: IdentityStatusSchema,
  mfaStatus: MFAStatusSchema,
  mfaConfig: MFAConfigSchema.nullable(),

  // Authentication
  passwordHash: z.string().nullable(),
  passwordSalt: z.string().nullable(),
  passwordHistory: z.array(PasswordHistorySchema).nullable(),
  passwordExpiresAt: z.date().nullable(),
  lastPasswordChange: z.date().nullable(),

  // Login tracking
  lastLoginAt: z.date().nullable(),
  lastLoginIp: z.string().nullable(),
  lastLoginUserAgent: z.string().nullable(),
  failedLoginAttempts: z.number().int().default(0),
  lockedUntil: z.date().nullable(),

  // Trusted devices
  trustedDevices: z.array(DeviceFingerprintSchema).nullable(),

  // SSO
  ssoProvider: z.string().nullable(),
  ssoExternalId: z.string().nullable(),
  ssoAttributes: z.record(z.unknown()).nullable(),

  // API access
  apiKeyEnabled: z.boolean().default(false),

  // Verification
  emailVerified: z.boolean().default(false),
  emailVerifiedAt: z.date().nullable(),
  verificationToken: z.string().nullable(),
  verificationExpires: z.date().nullable(),

  // Audit
  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
  version: z.number().int().positive(),
  deletedAt: z.date().nullable(),
});

export type Identity = z.infer<typeof IdentitySchema>;

// =============================================================================
// Create Input
// =============================================================================

export const CreateIdentityInputSchema = z.object({
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  email: z.string().email(),
  username: z.string().min(3).max(50).optional(),
  password: z.string().min(12).optional(),
  ssoProvider: z.string().optional(),
  ssoExternalId: z.string().optional(),
  requireMFA: z.boolean().default(false),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateIdentityInput = z.infer<typeof CreateIdentityInputSchema>;

// =============================================================================
// Domain Logic
// =============================================================================

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const PASSWORD_HISTORY_COUNT = 12;

/**
 * Check if identity is locked
 */
export function isLocked(identity: Identity): boolean {
  if (identity.status === 'locked') return true;
  if (identity.lockedUntil && new Date() < identity.lockedUntil) return true;
  return false;
}

/**
 * Check if identity can authenticate
 */
export function canAuthenticate(identity: Identity): boolean {
  if (identity.status !== 'active') return false;
  if (isLocked(identity)) return false;
  if (identity.deletedAt) return false;
  return true;
}

/**
 * Record failed login attempt
 */
export function recordFailedLogin(identity: Identity): Partial<Identity> {
  const failedAttempts = identity.failedLoginAttempts + 1;
  const shouldLock = failedAttempts >= MAX_FAILED_ATTEMPTS;

  return {
    failedLoginAttempts: failedAttempts,
    lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_DURATION_MS) : identity.lockedUntil,
    status: shouldLock ? 'locked' : identity.status,
  };
}

/**
 * Record successful login
 */
export function recordSuccessfulLogin(
  identity: Identity,
  ip: string,
  userAgent: string
): Partial<Identity> {
  return {
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: new Date(),
    lastLoginIp: ip,
    lastLoginUserAgent: userAgent,
  };
}

/**
 * Check if MFA is required
 */
export function requiresMFA(identity: Identity): boolean {
  return identity.mfaStatus === 'enforced' || identity.mfaStatus === 'configured';
}

/**
 * Check if password is expired
 */
export function isPasswordExpired(identity: Identity): boolean {
  if (!identity.passwordExpiresAt) return false;
  return new Date() > identity.passwordExpiresAt;
}

/**
 * Check if password was recently used (in history)
 */
export function isPasswordInHistory(passwordHash: string, history: PasswordHistory[]): boolean {
  return history.some(h => h.hash === passwordHash);
}

/**
 * Get password history entries to keep
 */
export function getUpdatedPasswordHistory(
  currentHash: string,
  history: PasswordHistory[] | null
): PasswordHistory[] {
  const now = new Date();
  const newEntry: PasswordHistory = { hash: currentHash, createdAt: now };
  const existingHistory = history || [];

  return [newEntry, ...existingHistory].slice(0, PASSWORD_HISTORY_COUNT);
}

/**
 * Calculate lockout remaining time in seconds
 */
export function getLockoutRemainingSeconds(identity: Identity): number {
  if (!identity.lockedUntil) return 0;
  const remaining = identity.lockedUntil.getTime() - Date.now();
  return Math.max(0, Math.ceil(remaining / 1000));
}

/**
 * Generate verification token expiry (24 hours)
 */
export function getVerificationExpiry(): Date {
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
}

/**
 * Get identity status label
 */
export function getIdentityStatusLabel(status: IdentityStatus): string {
  const labels: Record<IdentityStatus, string> = {
    active: 'Active',
    inactive: 'Inactive',
    suspended: 'Suspended',
    locked: 'Locked',
    pending_verification: 'Pending Verification',
  };
  return labels[status];
}
