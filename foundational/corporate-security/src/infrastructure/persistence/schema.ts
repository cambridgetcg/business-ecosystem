/**
 * Corporate Security Database Schema
 *
 * Tables for identity, access control, audit, and secrets management.
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// =============================================================================
// Identities Table
// =============================================================================

export const identities = pgTable('identities', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  userId: uuid('user_id').notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  username: varchar('username', { length: 50 }),

  // Status
  status: varchar('status', { length: 50 }).notNull().default('pending_verification'),
  mfaStatus: varchar('mfa_status', { length: 50 }).notNull().default('not_configured'),
  mfaConfig: jsonb('mfa_config'),

  // Authentication
  passwordHash: text('password_hash'),
  passwordSalt: varchar('password_salt', { length: 64 }),
  passwordHistory: jsonb('password_history'),
  passwordExpiresAt: timestamp('password_expires_at'),
  lastPasswordChange: timestamp('last_password_change'),

  // Login tracking
  lastLoginAt: timestamp('last_login_at'),
  lastLoginIp: varchar('last_login_ip', { length: 45 }),
  lastLoginUserAgent: text('last_login_user_agent'),
  failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
  lockedUntil: timestamp('locked_until'),

  // Trusted devices
  trustedDevices: jsonb('trusted_devices'),

  // SSO
  ssoProvider: varchar('sso_provider', { length: 50 }),
  ssoExternalId: varchar('sso_external_id', { length: 255 }),
  ssoAttributes: jsonb('sso_attributes'),

  // API access
  apiKeyEnabled: boolean('api_key_enabled').notNull().default(false),

  // Verification
  emailVerified: boolean('email_verified').notNull().default(false),
  emailVerifiedAt: timestamp('email_verified_at'),
  verificationToken: varchar('verification_token', { length: 255 }),
  verificationExpires: timestamp('verification_expires'),

  // Audit
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  version: integer('version').notNull().default(1),
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
  tenantIdIdx: index('identities_tenant_id_idx').on(table.tenantId),
  emailIdx: uniqueIndex('identities_email_idx').on(table.tenantId, table.email),
  userIdIdx: index('identities_user_id_idx').on(table.userId),
  ssoIdx: index('identities_sso_idx').on(table.ssoProvider, table.ssoExternalId),
}));

// =============================================================================
// Roles Table
// =============================================================================

export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id'),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),

  // Role type
  isSystem: boolean('is_system').notNull().default(false),
  isDefault: boolean('is_default').notNull().default(false),

  // Hierarchy
  parentRoleId: uuid('parent_role_id'),
  level: integer('level').notNull().default(0),

  // Permissions
  permissions: jsonb('permissions').notNull().default([]),

  // Constraints
  maxUsers: integer('max_users'),
  requiresMFA: boolean('requires_mfa').notNull().default(false),
  sessionTimeout: integer('session_timeout'),
  ipRestrictions: jsonb('ip_restrictions'),

  // Audit
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  version: integer('version').notNull().default(1),
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
  tenantIdIdx: index('roles_tenant_id_idx').on(table.tenantId),
  nameIdx: uniqueIndex('roles_name_idx').on(table.tenantId, table.name),
  parentIdx: index('roles_parent_idx').on(table.parentRoleId),
}));

// =============================================================================
// Role Assignments Table
// =============================================================================

export const roleAssignments = pgTable('role_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  identityId: uuid('identity_id').notNull(),
  roleId: uuid('role_id').notNull(),

  // Scope
  entityId: uuid('entity_id'),
  departmentId: uuid('department_id'),

  // Validity
  validFrom: timestamp('valid_from').notNull().defaultNow(),
  validUntil: timestamp('valid_until'),

  // Delegation
  delegatedBy: uuid('delegated_by'),
  delegatable: boolean('delegatable').notNull().default(false),

  // Audit
  assignedAt: timestamp('assigned_at').notNull().defaultNow(),
  assignedBy: uuid('assigned_by').notNull(),
  revokedAt: timestamp('revoked_at'),
  revokedBy: uuid('revoked_by'),
  revokeReason: text('revoke_reason'),

  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  tenantIdIdx: index('role_assignments_tenant_id_idx').on(table.tenantId),
  identityIdx: index('role_assignments_identity_idx').on(table.identityId),
  roleIdx: index('role_assignments_role_idx').on(table.roleId),
  activeIdx: index('role_assignments_active_idx').on(table.identityId, table.revokedAt),
}));

// =============================================================================
// Access Policies Table
// =============================================================================

export const accessPolicies = pgTable('access_policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id'),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),

  // Policy type
  policyType: varchar('policy_type', { length: 20 }).notNull(),
  isSystem: boolean('is_system').notNull().default(false),
  enabled: boolean('enabled').notNull().default(true),

  // Target
  targetType: varchar('target_type', { length: 20 }).notNull(),
  targetIds: jsonb('target_ids'),

  // Rules
  rules: jsonb('rules').notNull().default([]),
  defaultEffect: varchar('default_effect', { length: 10 }).notNull().default('deny'),
  combiningAlgorithm: varchar('combining_algorithm', { length: 30 }).notNull().default('deny_overrides'),

  // Validity
  validFrom: timestamp('valid_from'),
  validUntil: timestamp('valid_until'),

  // Audit
  metadata: jsonb('metadata'),
  tags: jsonb('tags'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  version: integer('version').notNull().default(1),
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
  tenantIdIdx: index('access_policies_tenant_id_idx').on(table.tenantId),
  nameIdx: uniqueIndex('access_policies_name_idx').on(table.tenantId, table.name),
  enabledIdx: index('access_policies_enabled_idx').on(table.enabled),
}));

// =============================================================================
// Audit Logs Table
// =============================================================================

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),

  // Event details
  eventType: varchar('event_type', { length: 50 }).notNull(),
  eventCategory: varchar('event_category', { length: 30 }).notNull(),
  severity: varchar('severity', { length: 20 }).notNull(),

  // Actor
  actorId: uuid('actor_id'),
  actorType: varchar('actor_type', { length: 20 }).notNull(),
  actorEmail: varchar('actor_email', { length: 255 }),
  actorName: varchar('actor_name', { length: 255 }),
  actorRoles: jsonb('actor_roles'),

  // Target
  targetType: varchar('target_type', { length: 50 }),
  targetId: uuid('target_id'),
  targetName: varchar('target_name', { length: 255 }),

  // Action
  action: varchar('action', { length: 100 }).notNull(),
  outcome: varchar('outcome', { length: 20 }).notNull(),
  reason: text('reason'),

  // Request context
  requestId: uuid('request_id'),
  sessionId: uuid('session_id'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  geoLocation: jsonb('geo_location'),

  // Resource
  resourceType: varchar('resource_type', { length: 50 }),
  resourceId: uuid('resource_id'),
  resourcePath: text('resource_path'),

  // Change tracking
  previousValue: jsonb('previous_value'),
  newValue: jsonb('new_value'),

  // Additional context
  metadata: jsonb('metadata'),
  tags: jsonb('tags'),

  // Timestamp
  timestamp: timestamp('timestamp').notNull().defaultNow(),

  // Integrity
  checksum: varchar('checksum', { length: 64 }),
  previousLogId: uuid('previous_log_id'),
}, (table) => ({
  tenantIdIdx: index('audit_logs_tenant_id_idx').on(table.tenantId),
  timestampIdx: index('audit_logs_timestamp_idx').on(table.timestamp),
  actorIdx: index('audit_logs_actor_idx').on(table.actorId),
  eventTypeIdx: index('audit_logs_event_type_idx').on(table.eventType),
  targetIdx: index('audit_logs_target_idx').on(table.targetType, table.targetId),
  severityIdx: index('audit_logs_severity_idx').on(table.severity),
}));

// =============================================================================
// Security Incidents Table
// =============================================================================

export const securityIncidents = pgTable('security_incidents', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  incidentNumber: varchar('incident_number', { length: 50 }).notNull(),

  // Classification
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  severity: varchar('severity', { length: 20 }).notNull(),
  status: varchar('status', { length: 30 }).notNull().default('open'),
  category: varchar('category', { length: 50 }).notNull(),

  // Detection
  detectedAt: timestamp('detected_at').notNull().defaultNow(),
  detectedBy: varchar('detected_by', { length: 30 }).notNull(),
  detectionSource: text('detection_source'),
  triggeringEvents: jsonb('triggering_events'),
  relatedAuditLogIds: jsonb('related_audit_log_ids'),

  // Impact
  affectedResources: jsonb('affected_resources'),
  affectedUserCount: integer('affected_user_count'),
  dataCompromised: boolean('data_compromised').notNull().default(false),
  dataCompromisedDescription: text('data_compromised_description'),
  financialImpact: integer('financial_impact'),
  reputationalImpact: varchar('reputational_impact', { length: 20 }),

  // Response
  assignedTo: uuid('assigned_to'),
  assignedToName: varchar('assigned_to_name', { length: 255 }),
  responseTeam: jsonb('response_team'),
  containmentActions: text('containment_actions'),
  eradicationActions: text('eradication_actions'),
  recoveryActions: text('recovery_actions'),

  // Timeline
  timeline: jsonb('timeline'),
  containedAt: timestamp('contained_at'),
  resolvedAt: timestamp('resolved_at'),
  closedAt: timestamp('closed_at'),

  // Root cause
  rootCause: text('root_cause'),
  rootCauseCategory: varchar('root_cause_category', { length: 30 }),

  // Lessons learned
  lessonsLearned: text('lessons_learned'),
  preventativeMeasures: jsonb('preventative_measures'),

  // Reporting
  requiresRegulatorNotification: boolean('requires_regulator_notification').notNull().default(false),
  regulatorNotifiedAt: timestamp('regulator_notified_at'),
  regulatorReference: varchar('regulator_reference', { length: 100 }),
  requiresCustomerNotification: boolean('requires_customer_notification').notNull().default(false),
  customersNotifiedAt: timestamp('customers_notified_at'),

  // External
  externalTicketId: varchar('external_ticket_id', { length: 100 }),
  externalTicketUrl: text('external_ticket_url'),

  // Audit
  metadata: jsonb('metadata'),
  tags: jsonb('tags'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  version: integer('version').notNull().default(1),
}, (table) => ({
  tenantIdIdx: index('security_incidents_tenant_id_idx').on(table.tenantId),
  incidentNumberIdx: uniqueIndex('security_incidents_number_idx').on(table.incidentNumber),
  statusIdx: index('security_incidents_status_idx').on(table.status),
  severityIdx: index('security_incidents_severity_idx').on(table.severity),
  detectedAtIdx: index('security_incidents_detected_at_idx').on(table.detectedAt),
}));

// =============================================================================
// Secrets Table
// =============================================================================

export const secrets = pgTable('secrets', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),

  // Type
  secretType: varchar('secret_type', { length: 30 }).notNull(),
  classification: varchar('classification', { length: 20 }).notNull(),

  // Value
  encryptedValue: text('encrypted_value').notNull(),
  encryptionKeyId: uuid('encryption_key_id').notNull(),
  encryptionAlgorithm: varchar('encryption_algorithm', { length: 30 }).notNull(),

  // Versioning
  currentVersion: integer('current_version').notNull().default(1),
  versions: jsonb('versions'),

  // Rotation
  rotationEnabled: boolean('rotation_enabled').notNull().default(false),
  rotationIntervalDays: integer('rotation_interval_days'),
  lastRotatedAt: timestamp('last_rotated_at'),
  nextRotationAt: timestamp('next_rotation_at'),

  // Access control
  allowedIdentities: jsonb('allowed_identities'),
  allowedRoles: jsonb('allowed_roles'),
  allowedServices: jsonb('allowed_services'),

  // Usage
  lastAccessedAt: timestamp('last_accessed_at'),
  lastAccessedBy: uuid('last_accessed_by'),
  accessCount: integer('access_count').notNull().default(0),

  // Expiration
  expiresAt: timestamp('expires_at'),
  expiredNotificationSent: boolean('expired_notification_sent').notNull().default(false),

  // External
  externalId: varchar('external_id', { length: 255 }),
  externalProvider: varchar('external_provider', { length: 50 }),

  // Audit
  metadata: jsonb('metadata'),
  tags: jsonb('tags'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  version: integer('version').notNull().default(1),
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
  tenantIdIdx: index('secrets_tenant_id_idx').on(table.tenantId),
  nameIdx: uniqueIndex('secrets_name_idx').on(table.tenantId, table.name),
  typeIdx: index('secrets_type_idx').on(table.secretType),
}));

// =============================================================================
// Encryption Keys Table
// =============================================================================

export const encryptionKeys = pgTable('encryption_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id'),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),

  // Key details
  algorithm: varchar('algorithm', { length: 30 }).notNull(),
  keySize: integer('key_size').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('active'),

  // Key material
  encryptedKeyMaterial: text('encrypted_key_material'),
  keyMaterialHash: varchar('key_material_hash', { length: 64 }).notNull(),

  // External
  isExternal: boolean('is_external').notNull().default(false),
  externalKeyId: varchar('external_key_id', { length: 255 }),
  externalProvider: varchar('external_provider', { length: 50 }),

  // Rotation
  rotationEnabled: boolean('rotation_enabled').notNull().default(false),
  rotationIntervalDays: integer('rotation_interval_days'),
  lastRotatedAt: timestamp('last_rotated_at'),
  nextRotationAt: timestamp('next_rotation_at'),

  // Lifecycle
  activatedAt: timestamp('activated_at'),
  deactivatedAt: timestamp('deactivated_at'),
  expiresAt: timestamp('expires_at'),
  destroyedAt: timestamp('destroyed_at'),

  // Usage
  purpose: varchar('purpose', { length: 30 }).notNull(),
  usageCount: integer('usage_count').notNull().default(0),
  lastUsedAt: timestamp('last_used_at'),

  // Audit
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  version: integer('version').notNull().default(1),
}, (table) => ({
  tenantIdIdx: index('encryption_keys_tenant_id_idx').on(table.tenantId),
  nameIdx: uniqueIndex('encryption_keys_name_idx').on(table.tenantId, table.name),
  statusIdx: index('encryption_keys_status_idx').on(table.status),
}));

// =============================================================================
// API Keys Table
// =============================================================================

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  identityId: uuid('identity_id').notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),

  // Key
  keyPrefix: varchar('key_prefix', { length: 8 }).notNull(),
  keyHash: varchar('key_hash', { length: 64 }).notNull(),

  // Permissions
  scopes: jsonb('scopes').notNull().default([]),
  roleId: uuid('role_id'),

  // Restrictions
  ipWhitelist: jsonb('ip_whitelist'),
  rateLimit: integer('rate_limit'),
  allowedOrigins: jsonb('allowed_origins'),

  // Status
  status: varchar('status', { length: 20 }).notNull().default('active'),
  revokedAt: timestamp('revoked_at'),
  revokedBy: uuid('revoked_by'),
  revokeReason: text('revoke_reason'),

  // Expiration
  expiresAt: timestamp('expires_at'),

  // Usage
  lastUsedAt: timestamp('last_used_at'),
  lastUsedIp: varchar('last_used_ip', { length: 45 }),
  usageCount: integer('usage_count').notNull().default(0),

  // Audit
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: uuid('created_by').notNull(),
}, (table) => ({
  tenantIdIdx: index('api_keys_tenant_id_idx').on(table.tenantId),
  identityIdx: index('api_keys_identity_idx').on(table.identityId),
  keyPrefixIdx: index('api_keys_key_prefix_idx').on(table.keyPrefix),
  statusIdx: index('api_keys_status_idx').on(table.status),
}));

// =============================================================================
// Sessions Table
// =============================================================================

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  identityId: uuid('identity_id').notNull(),

  // Session details
  sessionToken: varchar('session_token', { length: 255 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('active'),

  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
  lastActivityAt: timestamp('last_activity_at').notNull().defaultNow(),
  revokedAt: timestamp('revoked_at'),

  // Context
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  deviceFingerprint: jsonb('device_fingerprint'),
  geoLocation: jsonb('geo_location'),

  // MFA
  mfaVerified: boolean('mfa_verified').notNull().default(false),
  mfaVerifiedAt: timestamp('mfa_verified_at'),

  // Metadata
  metadata: jsonb('metadata'),
}, (table) => ({
  tenantIdIdx: index('sessions_tenant_id_idx').on(table.tenantId),
  identityIdx: index('sessions_identity_idx').on(table.identityId),
  tokenIdx: uniqueIndex('sessions_token_idx').on(table.sessionToken),
  expiresIdx: index('sessions_expires_idx').on(table.expiresAt),
  statusIdx: index('sessions_status_idx').on(table.status),
}));
