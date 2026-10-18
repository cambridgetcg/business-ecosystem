/**
 * Corporate Security Value Objects
 *
 * Enums and value types for security domain.
 */

import { z } from 'zod';

// =============================================================================
// Authentication & Identity
// =============================================================================

export const AuthenticationMethodSchema = z.enum([
  'password',
  'mfa_totp',
  'mfa_sms',
  'sso_saml',
  'sso_oidc',
  'api_key',
  'certificate',
]);
export type AuthenticationMethod = z.infer<typeof AuthenticationMethodSchema>;

export const IdentityStatusSchema = z.enum([
  'active',
  'inactive',
  'suspended',
  'locked',
  'pending_verification',
]);
export type IdentityStatus = z.infer<typeof IdentityStatusSchema>;

export const MFAStatusSchema = z.enum([
  'not_configured',
  'configured',
  'enforced',
  'bypassed',
]);
export type MFAStatus = z.infer<typeof MFAStatusSchema>;

// =============================================================================
// Authorization & Access Control
// =============================================================================

export const PolicyTypeSchema = z.enum([
  'rbac',       // Role-based access control
  'abac',       // Attribute-based access control
  'pbac',       // Policy-based access control
]);
export type PolicyType = z.infer<typeof PolicyTypeSchema>;

export const PolicyEffectSchema = z.enum([
  'allow',
  'deny',
]);
export type PolicyEffect = z.infer<typeof PolicyEffectSchema>;

export const PermissionActionSchema = z.enum([
  'create',
  'read',
  'update',
  'delete',
  'execute',
  'approve',
  'reject',
  'export',
  'import',
  'admin',
  '*',
]);
export type PermissionAction = z.infer<typeof PermissionActionSchema>;

export const ResourceTypeSchema = z.enum([
  // Foundational
  'entity',
  'account',
  'journal_entry',
  'bank_account',
  'transaction',
  'tax_return',
  'compliance_obligation',
  // Operational
  'contract',
  'insurance_policy',
  'ip_asset',
  'privacy_record',
  // Security
  'user',
  'role',
  'policy',
  'audit_log',
  'secret',
  '*',
]);
export type ResourceType = z.infer<typeof ResourceTypeSchema>;

// =============================================================================
// Security Events & Incidents
// =============================================================================

export const SecurityEventTypeSchema = z.enum([
  // Authentication events
  'login_success',
  'login_failure',
  'logout',
  'mfa_challenge',
  'mfa_success',
  'mfa_failure',
  'password_change',
  'password_reset',
  // Authorization events
  'access_granted',
  'access_denied',
  'privilege_escalation',
  // Security incidents
  'brute_force_detected',
  'anomaly_detected',
  'suspicious_activity',
  'data_breach',
  'unauthorized_access',
  'security_incident_created',
  'security_incident_escalated',
  'security_incident_resolved',
  'critical_action',
  // Administrative events
  'role_assigned',
  'role_revoked',
  'policy_created',
  'policy_modified',
  'user_created',
  'user_suspended',
  'user_deleted',
  // System events
  'api_key_created',
  'api_key_revoked',
  'certificate_issued',
  'certificate_revoked',
  'secret_accessed',
  'secret_rotated',
]);
export type SecurityEventType = z.infer<typeof SecurityEventTypeSchema>;

export const IncidentSeveritySchema = z.enum([
  'critical',
  'high',
  'medium',
  'low',
  'info',
]);
export type IncidentSeverity = z.infer<typeof IncidentSeveritySchema>;

export const IncidentStatusSchema = z.enum([
  'open',
  'investigating',
  'contained',
  'resolved',
  'closed',
  'false_positive',
]);
export type IncidentStatus = z.infer<typeof IncidentStatusSchema>;

// =============================================================================
// Encryption & Secrets
// =============================================================================

export const EncryptionAlgorithmSchema = z.enum([
  'aes_256_gcm',
  'aes_256_cbc',
  'rsa_4096',
  'ecdsa_p384',
]);
export type EncryptionAlgorithm = z.infer<typeof EncryptionAlgorithmSchema>;

export const KeyStatusSchema = z.enum([
  'active',
  'rotating',
  'deprecated',
  'revoked',
  'destroyed',
]);
export type KeyStatus = z.infer<typeof KeyStatusSchema>;

export const SecretTypeSchema = z.enum([
  'api_key',
  'password',
  'certificate',
  'encryption_key',
  'oauth_token',
  'database_credential',
  'service_account',
]);
export type SecretType = z.infer<typeof SecretTypeSchema>;

// =============================================================================
// Session Management
// =============================================================================

export const SessionStatusSchema = z.enum([
  'active',
  'expired',
  'revoked',
  'idle',
]);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

// =============================================================================
// Common Value Objects
// =============================================================================

export const IPAddressSchema = z.string().ip();
export type IPAddress = z.infer<typeof IPAddressSchema>;

export const UserAgentSchema = z.string().max(500);
export type UserAgent = z.infer<typeof UserAgentSchema>;

export const DeviceFingerprintSchema = z.object({
  id: z.string(),
  type: z.enum(['desktop', 'mobile', 'tablet', 'unknown']),
  os: z.string().optional(),
  browser: z.string().optional(),
  trusted: z.boolean().default(false),
});
export type DeviceFingerprint = z.infer<typeof DeviceFingerprintSchema>;

export const GeoLocationSchema = z.object({
  country: z.string().length(2),
  region: z.string().optional(),
  city: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});
export type GeoLocation = z.infer<typeof GeoLocationSchema>;

// =============================================================================
// Condition Operators for ABAC
// =============================================================================

export const ConditionOperatorSchema = z.enum([
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'starts_with',
  'ends_with',
  'greater_than',
  'less_than',
  'in',
  'not_in',
  'exists',
  'not_exists',
  'matches_regex',
]);
export type ConditionOperator = z.infer<typeof ConditionOperatorSchema>;

export const PolicyConditionSchema = z.object({
  attribute: z.string(),
  operator: ConditionOperatorSchema,
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
});
export type PolicyCondition = z.infer<typeof PolicyConditionSchema>;
