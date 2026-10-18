/**
 * Secret Domain Model
 *
 * Manages secrets, encryption keys, and credentials.
 */

import { z } from 'zod';
import {
  SecretTypeSchema,
  KeyStatusSchema,
  EncryptionAlgorithmSchema,
} from '../../value-objects/index.js';

// =============================================================================
// Secret Schema
// =============================================================================

export const SecretSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable(),

  // Type and classification
  secretType: SecretTypeSchema,
  classification: z.enum(['public', 'internal', 'confidential', 'restricted']),

  // Value (encrypted at rest)
  encryptedValue: z.string(),
  encryptionKeyId: z.string().uuid(),
  encryptionAlgorithm: EncryptionAlgorithmSchema,

  // Versioning
  currentVersion: z.number().int().positive(),
  versions: z.array(z.object({
    version: z.number().int().positive(),
    encryptedValue: z.string(),
    createdAt: z.date(),
    createdBy: z.string().uuid(),
    expiresAt: z.date().nullable(),
  })).nullable(),

  // Rotation
  rotationEnabled: z.boolean().default(false),
  rotationIntervalDays: z.number().int().nullable(),
  lastRotatedAt: z.date().nullable(),
  nextRotationAt: z.date().nullable(),

  // Access control
  allowedIdentities: z.array(z.string().uuid()).nullable(),
  allowedRoles: z.array(z.string().uuid()).nullable(),
  allowedServices: z.array(z.string()).nullable(),

  // Usage tracking
  lastAccessedAt: z.date().nullable(),
  lastAccessedBy: z.string().uuid().nullable(),
  accessCount: z.number().int().default(0),

  // Expiration
  expiresAt: z.date().nullable(),
  expiredNotificationSent: z.boolean().default(false),

  // External reference
  externalId: z.string().nullable(), // AWS Secrets Manager ARN, etc.
  externalProvider: z.string().nullable(),

  // Audit
  metadata: z.record(z.unknown()).nullable(),
  tags: z.array(z.string()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
  version: z.number().int().positive(),
  deletedAt: z.date().nullable(),
});

export type Secret = z.infer<typeof SecretSchema>;

// =============================================================================
// Encryption Key Schema
// =============================================================================

export const EncryptionKeySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid().nullable(), // null for system keys
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable(),

  // Key details
  algorithm: EncryptionAlgorithmSchema,
  keySize: z.number().int(),
  status: KeyStatusSchema,

  // Key material (stored encrypted with master key)
  encryptedKeyMaterial: z.string().nullable(), // null if external
  keyMaterialHash: z.string(),

  // External key management
  isExternal: z.boolean().default(false),
  externalKeyId: z.string().nullable(), // AWS KMS Key ID, etc.
  externalProvider: z.string().nullable(),

  // Rotation
  rotationEnabled: z.boolean().default(false),
  rotationIntervalDays: z.number().int().nullable(),
  lastRotatedAt: z.date().nullable(),
  nextRotationAt: z.date().nullable(),

  // Lifecycle
  activatedAt: z.date().nullable(),
  deactivatedAt: z.date().nullable(),
  expiresAt: z.date().nullable(),
  destroyedAt: z.date().nullable(),

  // Usage
  purpose: z.enum(['encryption', 'signing', 'key_wrapping', 'authentication']),
  usageCount: z.number().int().default(0),
  lastUsedAt: z.date().nullable(),

  // Audit
  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
  version: z.number().int().positive(),
});

export type EncryptionKey = z.infer<typeof EncryptionKeySchema>;

// =============================================================================
// API Key Schema
// =============================================================================

export const APIKeySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  identityId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable(),

  // Key value (only shown once at creation)
  keyPrefix: z.string(), // First 8 chars for identification
  keyHash: z.string(), // Full key hash for validation

  // Permissions
  scopes: z.array(z.string()), // e.g., ['read:entities', 'write:contracts']
  roleId: z.string().uuid().nullable(),

  // Restrictions
  ipWhitelist: z.array(z.string()).nullable(),
  rateLimit: z.number().int().nullable(), // requests per minute
  allowedOrigins: z.array(z.string()).nullable(),

  // Status
  status: z.enum(['active', 'inactive', 'revoked']),
  revokedAt: z.date().nullable(),
  revokedBy: z.string().uuid().nullable(),
  revokeReason: z.string().nullable(),

  // Expiration
  expiresAt: z.date().nullable(),

  // Usage
  lastUsedAt: z.date().nullable(),
  lastUsedIp: z.string().nullable(),
  usageCount: z.number().int().default(0),

  // Audit
  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid(),
});

export type APIKey = z.infer<typeof APIKeySchema>;

// =============================================================================
// Create Inputs
// =============================================================================

export const CreateSecretInputSchema = z.object({
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  secretType: SecretTypeSchema,
  classification: z.enum(['public', 'internal', 'confidential', 'restricted']),
  value: z.string(), // Plain text, will be encrypted
  rotationEnabled: z.boolean().optional(),
  rotationIntervalDays: z.number().int().optional(),
  allowedIdentities: z.array(z.string().uuid()).optional(),
  allowedRoles: z.array(z.string().uuid()).optional(),
  allowedServices: z.array(z.string()).optional(),
  expiresAt: z.date().optional(),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

export type CreateSecretInput = z.infer<typeof CreateSecretInputSchema>;

export const CreateAPIKeyInputSchema = z.object({
  tenantId: z.string().uuid(),
  identityId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  scopes: z.array(z.string()),
  roleId: z.string().uuid().optional(),
  ipWhitelist: z.array(z.string()).optional(),
  rateLimit: z.number().int().optional(),
  allowedOrigins: z.array(z.string()).optional(),
  expiresAt: z.date().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateAPIKeyInput = z.infer<typeof CreateAPIKeyInputSchema>;

// =============================================================================
// Domain Logic
// =============================================================================

/**
 * Check if secret is expired
 */
export function isSecretExpired(secret: Secret): boolean {
  if (!secret.expiresAt) return false;
  return new Date() > secret.expiresAt;
}

/**
 * Check if secret needs rotation
 */
export function needsRotation(secret: Secret): boolean {
  if (!secret.rotationEnabled || !secret.nextRotationAt) return false;
  return new Date() >= secret.nextRotationAt;
}

/**
 * Calculate next rotation date
 */
export function getNextRotationDate(secret: Secret): Date | null {
  if (!secret.rotationEnabled || !secret.rotationIntervalDays) return null;
  const baseDate = secret.lastRotatedAt || secret.createdAt;
  return new Date(baseDate.getTime() + secret.rotationIntervalDays * 24 * 60 * 60 * 1000);
}

/**
 * Check if identity can access secret
 */
export function canAccessSecret(
  secret: Secret,
  identityId: string,
  roles: string[],
  service?: string
): boolean {
  // Check if deleted or expired
  if (secret.deletedAt) return false;
  if (isSecretExpired(secret)) return false;

  // Check identity allowlist
  if (secret.allowedIdentities?.length) {
    if (secret.allowedIdentities.includes(identityId)) return true;
  }

  // Check role allowlist
  if (secret.allowedRoles?.length) {
    if (roles.some(r => secret.allowedRoles!.includes(r))) return true;
  }

  // Check service allowlist
  if (service && secret.allowedServices?.length) {
    if (secret.allowedServices.includes(service)) return true;
  }

  // If no restrictions, allow (should be restricted by higher-level permissions)
  if (!secret.allowedIdentities?.length && !secret.allowedRoles?.length && !secret.allowedServices?.length) {
    return true;
  }

  return false;
}

/**
 * Check if encryption key is usable
 */
export function isKeyUsable(key: EncryptionKey): boolean {
  if (key.status !== 'active') return false;
  if (key.expiresAt && new Date() > key.expiresAt) return false;
  return true;
}

/**
 * Check if API key is valid
 */
export function isAPIKeyValid(apiKey: APIKey): boolean {
  if (apiKey.status !== 'active') return false;
  if (apiKey.expiresAt && new Date() > apiKey.expiresAt) return false;
  return true;
}

/**
 * Check if IP is in whitelist
 */
export function isIPWhitelisted(apiKey: APIKey, ip: string): boolean {
  if (!apiKey.ipWhitelist?.length) return true;
  return apiKey.ipWhitelist.some(allowed => {
    if (allowed.includes('/')) {
      // CIDR notation - simplified check
      return ip.startsWith(allowed.split('/')[0].split('.').slice(0, 3).join('.'));
    }
    return allowed === ip;
  });
}

/**
 * Generate API key prefix
 */
export function generateKeyPrefix(fullKey: string): string {
  return fullKey.substring(0, 8);
}

/**
 * Mask secret value for display
 */
export function maskSecretValue(value: string): string {
  if (value.length <= 8) return '*'.repeat(value.length);
  return value.substring(0, 4) + '*'.repeat(value.length - 8) + value.substring(value.length - 4);
}
