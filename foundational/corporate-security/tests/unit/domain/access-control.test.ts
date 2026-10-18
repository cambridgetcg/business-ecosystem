/**
 * Access Control Domain Tests
 */

import { describe, it, expect } from 'vitest';
import {
  hasPermission,
  canModifyRole,
  isAssignmentActive,
  getEffectivePermissions,
  SYSTEM_ROLES,
  type Role,
  type RoleAssignment,
  type Permission,
} from '../../../src/domain/access-control/models/role.js';
import {
  evaluateCondition,
  evaluateConditions,
  evaluateRule,
  evaluatePolicy,
  isPolicyActive,
  type AccessPolicy,
  type PolicyRule,
  type AccessRequest,
} from '../../../src/domain/access-control/models/policy.js';

describe('Access Control - Roles', () => {
  const baseRole: Role = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    tenantId: '123e4567-e89b-12d3-a456-426614174001',
    name: 'TestRole',
    description: 'Test role',
    isSystem: false,
    isDefault: false,
    parentRoleId: null,
    level: 0,
    permissions: [
      { id: '1', resource: 'entity', action: 'read', scope: 'tenant', conditions: null },
      { id: '2', resource: 'entity', action: 'create', scope: 'tenant', conditions: null },
    ],
    maxUsers: null,
    requiresMFA: false,
    sessionTimeout: null,
    ipRestrictions: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    version: 1,
    deletedAt: null,
  };

  describe('hasPermission', () => {
    it('should return true for matching permission', () => {
      expect(hasPermission(baseRole, 'entity', 'read')).toBe(true);
    });

    it('should return false for non-matching permission', () => {
      expect(hasPermission(baseRole, 'entity', 'delete')).toBe(false);
    });

    it('should return true for wildcard resource', () => {
      const wildcardRole: Role = {
        ...baseRole,
        permissions: [{ id: '1', resource: '*', action: 'read', scope: 'tenant', conditions: null }],
      };
      expect(hasPermission(wildcardRole, 'entity', 'read')).toBe(true);
      expect(hasPermission(wildcardRole, 'contract', 'read')).toBe(true);
    });

    it('should return true for wildcard action', () => {
      const wildcardRole: Role = {
        ...baseRole,
        permissions: [{ id: '1', resource: 'entity', action: '*', scope: 'tenant', conditions: null }],
      };
      expect(hasPermission(wildcardRole, 'entity', 'read')).toBe(true);
      expect(hasPermission(wildcardRole, 'entity', 'delete')).toBe(true);
    });
  });

  describe('canModifyRole', () => {
    it('should return true for non-system role', () => {
      expect(canModifyRole(baseRole)).toBe(true);
    });

    it('should return false for system role', () => {
      const systemRole = { ...baseRole, isSystem: true };
      expect(canModifyRole(systemRole)).toBe(false);
    });
  });

  describe('isAssignmentActive', () => {
    const baseAssignment: RoleAssignment = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      tenantId: '123e4567-e89b-12d3-a456-426614174001',
      identityId: '123e4567-e89b-12d3-a456-426614174002',
      roleId: '123e4567-e89b-12d3-a456-426614174003',
      entityId: null,
      departmentId: null,
      validFrom: new Date(Date.now() - 86400000), // Yesterday
      validUntil: null,
      delegatedBy: null,
      delegatable: false,
      assignedAt: new Date(),
      assignedBy: '123e4567-e89b-12d3-a456-426614174004',
      revokedAt: null,
      revokedBy: null,
      revokeReason: null,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should return true for active assignment', () => {
      expect(isAssignmentActive(baseAssignment)).toBe(true);
    });

    it('should return false for revoked assignment', () => {
      const revoked = { ...baseAssignment, revokedAt: new Date() };
      expect(isAssignmentActive(revoked)).toBe(false);
    });

    it('should return false for future assignment', () => {
      const future = { ...baseAssignment, validFrom: new Date(Date.now() + 86400000) };
      expect(isAssignmentActive(future)).toBe(false);
    });

    it('should return false for expired assignment', () => {
      const expired = { ...baseAssignment, validUntil: new Date(Date.now() - 86400000) };
      expect(isAssignmentActive(expired)).toBe(false);
    });
  });

  describe('getEffectivePermissions', () => {
    it('should return role permissions', () => {
      const perms = getEffectivePermissions(baseRole, []);
      expect(perms.length).toBe(2);
    });

    it('should include parent permissions', () => {
      const parentRole: Role = {
        ...baseRole,
        id: 'parent-id',
        permissions: [{ id: '3', resource: 'contract', action: 'read', scope: 'tenant', conditions: null }],
      };
      const childRole: Role = {
        ...baseRole,
        parentRoleId: 'parent-id',
      };
      const perms = getEffectivePermissions(childRole, [parentRole]);
      expect(perms.length).toBe(3);
    });
  });
});

describe('Access Control - Policies', () => {
  describe('evaluateCondition', () => {
    it('should evaluate equals correctly', () => {
      expect(evaluateCondition(
        { attribute: 'role', operator: 'equals', value: 'admin' },
        { role: 'admin' }
      )).toBe(true);

      expect(evaluateCondition(
        { attribute: 'role', operator: 'equals', value: 'admin' },
        { role: 'user' }
      )).toBe(false);
    });

    it('should evaluate not_equals correctly', () => {
      expect(evaluateCondition(
        { attribute: 'role', operator: 'not_equals', value: 'admin' },
        { role: 'user' }
      )).toBe(true);
    });

    it('should evaluate contains correctly', () => {
      expect(evaluateCondition(
        { attribute: 'email', operator: 'contains', value: '@company.com' },
        { email: 'user@company.com' }
      )).toBe(true);
    });

    it('should evaluate greater_than correctly', () => {
      expect(evaluateCondition(
        { attribute: 'level', operator: 'greater_than', value: 5 },
        { level: 10 }
      )).toBe(true);

      expect(evaluateCondition(
        { attribute: 'level', operator: 'greater_than', value: 5 },
        { level: 3 }
      )).toBe(false);
    });

    it('should evaluate in correctly', () => {
      expect(evaluateCondition(
        { attribute: 'country', operator: 'in', value: ['UK', 'US', 'CA'] },
        { country: 'UK' }
      )).toBe(true);

      expect(evaluateCondition(
        { attribute: 'country', operator: 'in', value: ['UK', 'US', 'CA'] },
        { country: 'DE' }
      )).toBe(false);
    });

    it('should evaluate exists correctly', () => {
      expect(evaluateCondition(
        { attribute: 'mfa', operator: 'exists', value: true },
        { mfa: 'configured' }
      )).toBe(true);

      expect(evaluateCondition(
        { attribute: 'mfa', operator: 'exists', value: true },
        { }
      )).toBe(false);
    });
  });

  describe('evaluateConditions', () => {
    it('should return true for empty conditions', () => {
      expect(evaluateConditions(null, {})).toBe(true);
      expect(evaluateConditions([], {})).toBe(true);
    });

    it('should require all conditions to match (AND logic)', () => {
      const conditions = [
        { attribute: 'role', operator: 'equals' as const, value: 'admin' },
        { attribute: 'verified', operator: 'equals' as const, value: true },
      ];

      expect(evaluateConditions(conditions, { role: 'admin', verified: true })).toBe(true);
      expect(evaluateConditions(conditions, { role: 'admin', verified: false })).toBe(false);
    });
  });

  describe('isPolicyActive', () => {
    const basePolicy: AccessPolicy = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      tenantId: '123e4567-e89b-12d3-a456-426614174001',
      name: 'TestPolicy',
      description: null,
      policyType: 'abac',
      isSystem: false,
      enabled: true,
      targetType: 'all',
      targetIds: null,
      rules: [],
      defaultEffect: 'deny',
      combiningAlgorithm: 'deny_overrides',
      validFrom: null,
      validUntil: null,
      metadata: null,
      tags: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: null,
      updatedBy: null,
      version: 1,
      deletedAt: null,
    };

    it('should return true for enabled policy', () => {
      expect(isPolicyActive(basePolicy)).toBe(true);
    });

    it('should return false for disabled policy', () => {
      const disabled = { ...basePolicy, enabled: false };
      expect(isPolicyActive(disabled)).toBe(false);
    });

    it('should return false for deleted policy', () => {
      const deleted = { ...basePolicy, deletedAt: new Date() };
      expect(isPolicyActive(deleted)).toBe(false);
    });

    it('should return false for future policy', () => {
      const future = { ...basePolicy, validFrom: new Date(Date.now() + 86400000) };
      expect(isPolicyActive(future)).toBe(false);
    });

    it('should return false for expired policy', () => {
      const expired = { ...basePolicy, validUntil: new Date(Date.now() - 86400000) };
      expect(isPolicyActive(expired)).toBe(false);
    });
  });
});
