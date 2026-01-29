/**
 * Authentication Middleware
 */

import { Context, MiddlewareHandler, Next } from 'hono';
import { AuthenticationError, AuthorizationError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
  organizationId?: string;
  metadata?: Record<string, unknown>;
}

declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser;
    requestId: string;
  }
}

function decodeJwt(token: string): AuthUser | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const part = parts[1];
    if (!part) return null;
    const payload = JSON.parse(Buffer.from(part, 'base64url').toString());
    return {
      id: payload.sub || payload.id,
      email: payload.email,
      name: payload.name,
      roles: payload.roles || [],
      permissions: payload.permissions || [],
      organizationId: payload.organizationId,
      metadata: payload.metadata,
    };
  } catch {
    return null;
  }
}

function verifyJwt(token: string): boolean {
  if (process.env.NODE_ENV !== 'production') {
    return token.split('.').length === 3;
  }
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    logger.warn('JWT_SECRET not configured');
    return false;
  }
  return token.split('.').length === 3;
}

function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

export const authenticate: MiddlewareHandler = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization');
  const token = extractToken(authHeader);
  if (!token) throw new AuthenticationError('Authentication required');
  if (!verifyJwt(token)) throw new AuthenticationError('Invalid or expired token');
  const user = decodeJwt(token);
  if (!user) throw new AuthenticationError('Invalid token payload');
  c.set('user', user);
  await next();
};

export const optionalAuth: MiddlewareHandler = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization');
  const token = extractToken(authHeader);
  if (token && verifyJwt(token)) {
    const user = decodeJwt(token);
    if (user) c.set('user', user);
  }
  await next();
};

export function requireRoles(...roles: string[]): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const user = c.get('user');
    if (!user) throw new AuthenticationError('Authentication required');
    const hasRole = roles.some((role) => user.roles.includes(role));
    if (!hasRole) {
      throw new AuthorizationError('Requires one of roles: ' + roles.join(', '), 'role', 'access');
    }
    await next();
  };
}

export function requirePermissions(...permissions: string[]): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const user = c.get('user');
    if (!user) throw new AuthenticationError('Authentication required');
    const hasPermission = permissions.every((perm) => user.permissions.includes(perm) || user.permissions.includes('*'));
    if (!hasPermission) {
      throw new AuthorizationError('Requires permissions: ' + permissions.join(', '), 'permission', 'access');
    }
    await next();
  };
}

export const contractPermissions = {
  canCreate: requirePermissions('contracts:create'),
  canRead: requirePermissions('contracts:read'),
  canUpdate: requirePermissions('contracts:update'),
  canDelete: requirePermissions('contracts:delete'),
  canApprove: requirePermissions('contracts:approve'),
  canSign: requirePermissions('contracts:sign'),
  canManageTemplates: requirePermissions('contracts:templates:manage'),
};

export const legalPermissions = {
  canManageMatters: requirePermissions('legal:matters:manage'),
  canViewMatters: requirePermissions('legal:matters:view'),
  canManageLitigation: requirePermissions('legal:litigation:manage'),
};

export default authenticate;
