/**
 * Permission and authorization utilities
 */

import type { Permission, User } from './types.js';

export interface PermissionChecker {
  can(user: User, permission: Permission): boolean;
  canAll(user: User, permissions: Permission[]): boolean;
  canAny(user: User, permissions: Permission[]): boolean;
}

export class RoleBasedPermissionChecker implements PermissionChecker {
  private rolePermissions: Map<string, Permission[]>;

  constructor(rolePermissions: Map<string, Permission[]>) {
    this.rolePermissions = rolePermissions;
  }

  can(user: User, permission: Permission): boolean {
    // Check direct permissions
    if (this.hasDirectPermission(user, permission)) {
      return true;
    }

    // Check role-based permissions
    for (const role of user.roles) {
      const rolePerms = this.rolePermissions.get(role) || [];
      if (this.matchesAnyPermission(rolePerms, permission)) {
        return true;
      }
    }

    return false;
  }

  canAll(user: User, permissions: Permission[]): boolean {
    return permissions.every(p => this.can(user, p));
  }

  canAny(user: User, permissions: Permission[]): boolean {
    return permissions.some(p => this.can(user, p));
  }

  private hasDirectPermission(user: User, permission: Permission): boolean {
    const permString = `${permission.resource}:${permission.action}`;
    return user.permissions.includes(permString) || user.permissions.includes(`${permission.resource}:*`);
  }

  private matchesAnyPermission(rolePerms: Permission[], permission: Permission): boolean {
    return rolePerms.some(rp => 
      (rp.resource === permission.resource || rp.resource === '*') &&
      (rp.action === permission.action || rp.action === '*')
    );
  }
}
