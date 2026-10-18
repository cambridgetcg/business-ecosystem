/**
 * Role Domain Model
 *
 * Represents a security role for RBAC.
 * Roles contain permissions and can be hierarchical.
 */

import { z } from 'zod';
import { PermissionActionSchema, ResourceTypeSchema } from '../../value-objects/index.js';

// =============================================================================
// Permission Schema
// =============================================================================

export const PermissionSchema = z.object({
  id: z.string().uuid(),
  resource: ResourceTypeSchema,
  action: PermissionActionSchema,
  scope: z.enum(['own', 'tenant', 'global']).default('tenant'),
  conditions: z.record(z.unknown()).nullable(),
});

export type Permission = z.infer<typeof PermissionSchema>;

// =============================================================================
// Role Schema
// =============================================================================

export const RoleSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid().nullable(), // null for system roles
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable(),

  // Role type
  isSystem: z.boolean().default(false),
  isDefault: z.boolean().default(false),

  // Hierarchy
  parentRoleId: z.string().uuid().nullable(),
  level: z.number().int().default(0),

  // Permissions
  permissions: z.array(PermissionSchema),

  // Constraints
  maxUsers: z.number().int().nullable(),
  requiresMFA: z.boolean().default(false),
  sessionTimeout: z.number().int().nullable(), // minutes
  ipRestrictions: z.array(z.string()).nullable(),

  // Audit
  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
  version: z.number().int().positive(),
  deletedAt: z.date().nullable(),
});

export type Role = z.infer<typeof RoleSchema>;

// =============================================================================
// Role Assignment Schema
// =============================================================================

export const RoleAssignmentSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  identityId: z.string().uuid(),
  roleId: z.string().uuid(),

  // Scope
  entityId: z.string().uuid().nullable(), // Limit role to specific entity
  departmentId: z.string().uuid().nullable(),

  // Validity
  validFrom: z.date(),
  validUntil: z.date().nullable(),

  // Delegation
  delegatedBy: z.string().uuid().nullable(),
  delegatable: z.boolean().default(false),

  // Audit
  assignedAt: z.date(),
  assignedBy: z.string().uuid(),
  revokedAt: z.date().nullable(),
  revokedBy: z.string().uuid().nullable(),
  revokeReason: z.string().max(500).nullable(),

  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type RoleAssignment = z.infer<typeof RoleAssignmentSchema>;

// =============================================================================
// Create Input
// =============================================================================

export const CreateRoleInputSchema = z.object({
  tenantId: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  parentRoleId: z.string().uuid().optional(),
  permissions: z.array(z.object({
    resource: ResourceTypeSchema,
    action: PermissionActionSchema,
    scope: z.enum(['own', 'tenant', 'global']).optional(),
    conditions: z.record(z.unknown()).optional(),
  })),
  requiresMFA: z.boolean().optional(),
  sessionTimeout: z.number().int().optional(),
  ipRestrictions: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateRoleInput = z.infer<typeof CreateRoleInputSchema>;

// =============================================================================
// Domain Logic
// =============================================================================

/**
 * Check if role has specific permission
 */
export function hasPermission(
  role: Role,
  resource: string,
  action: string,
  scope: string = 'tenant'
): boolean {
  return role.permissions.some(p =>
    (p.resource === resource || p.resource === '*') &&
    (p.action === action || p.action === '*') &&
    (p.scope === scope || p.scope === 'global' || (scope === 'own' && p.scope === 'tenant'))
  );
}

/**
 * Check if role can be modified
 */
export function canModifyRole(role: Role): boolean {
  return !role.isSystem;
}

/**
 * Check if role assignment is active
 */
export function isAssignmentActive(assignment: RoleAssignment): boolean {
  const now = new Date();
  if (assignment.revokedAt) return false;
  if (assignment.validFrom > now) return false;
  if (assignment.validUntil && assignment.validUntil < now) return false;
  return true;
}

/**
 * Get effective permissions from role hierarchy
 */
export function getEffectivePermissions(
  role: Role,
  allRoles: Role[]
): Permission[] {
  const permissions = [...role.permissions];

  if (role.parentRoleId) {
    const parentRole = allRoles.find(r => r.id === role.parentRoleId);
    if (parentRole) {
      const parentPerms = getEffectivePermissions(parentRole, allRoles);
      // Merge parent permissions, child overrides parent
      for (const perm of parentPerms) {
        const exists = permissions.some(p =>
          p.resource === perm.resource && p.action === perm.action
        );
        if (!exists) {
          permissions.push(perm);
        }
      }
    }
  }

  return permissions;
}

/**
 * System roles that cannot be modified
 */
export const SYSTEM_ROLES = {
  SUPER_ADMIN: 'super_admin',
  TENANT_ADMIN: 'tenant_admin',
  SECURITY_ADMIN: 'security_admin',
  AUDITOR: 'auditor',
  USER: 'user',
  SERVICE_ACCOUNT: 'service_account',
} as const;

/**
 * Default permissions for system roles
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  [SYSTEM_ROLES.SUPER_ADMIN]: [
    { id: 'sa-1', resource: '*', action: '*', scope: 'global', conditions: null },
  ],
  [SYSTEM_ROLES.TENANT_ADMIN]: [
    { id: 'ta-1', resource: '*', action: '*', scope: 'tenant', conditions: null },
  ],
  [SYSTEM_ROLES.SECURITY_ADMIN]: [
    { id: 'sec-1', resource: 'user', action: '*', scope: 'tenant', conditions: null },
    { id: 'sec-2', resource: 'role', action: '*', scope: 'tenant', conditions: null },
    { id: 'sec-3', resource: 'policy', action: '*', scope: 'tenant', conditions: null },
    { id: 'sec-4', resource: 'audit_log', action: 'read', scope: 'tenant', conditions: null },
    { id: 'sec-5', resource: 'secret', action: '*', scope: 'tenant', conditions: null },
  ],
  [SYSTEM_ROLES.AUDITOR]: [
    { id: 'aud-1', resource: '*', action: 'read', scope: 'tenant', conditions: null },
    { id: 'aud-2', resource: 'audit_log', action: 'read', scope: 'tenant', conditions: null },
    { id: 'aud-3', resource: 'audit_log', action: 'export', scope: 'tenant', conditions: null },
  ],
  [SYSTEM_ROLES.USER]: [
    { id: 'usr-1', resource: '*', action: 'read', scope: 'own', conditions: null },
    { id: 'usr-2', resource: '*', action: 'update', scope: 'own', conditions: null },
  ],
};
