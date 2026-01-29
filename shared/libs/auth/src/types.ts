/**
 * Core authentication types
 */

export interface User {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
  tenantId?: string;
}

export interface TokenPayload {
  sub: string;
  email: string;
  roles: string[];
  tenantId?: string;
  iat: number;
  exp: number;
}

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshExpiresIn: string;
  issuer?: string;
  audience?: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface Permission {
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'manage' | '*';
  conditions?: Record<string, unknown>;
}
