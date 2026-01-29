/**
 * @ecosystem/service-auth
 * Service-to-service authentication
 */

import * as jose from 'jose';
import { z } from 'zod';

// Service identity schema
export const serviceIdentitySchema = z.object({
  serviceId: z.string(),
  serviceName: z.string(),
  permissions: z.array(z.string()),
  environment: z.string(),
  issuedAt: z.number(),
  expiresAt: z.number(),
});

export type ServiceIdentity = z.infer<typeof serviceIdentitySchema>;

// Service permissions
export const ServicePermissions = {
  // Entity governance
  'entity:read': 'Read entity data',
  'entity:write': 'Create/update entities',
  'entity:delete': 'Delete entities',
  
  // KYC
  'kyc:read': 'Read KYC data',
  'kyc:write': 'Create/update KYC records',
  'kyc:verify': 'Verify identities',
  
  // Accounting
  'accounting:read': 'Read accounting data',
  'accounting:write': 'Create/update accounting records',
  
  // Banking
  'banking:read': 'Read banking data',
  'banking:write': 'Create/update banking records',
  'banking:transfer': 'Initiate transfers',
  
  // Compliance
  'compliance:read': 'Read compliance data',
  'compliance:write': 'Create/update compliance records',
  
  // Events
  'events:publish': 'Publish domain events',
  'events:subscribe': 'Subscribe to domain events',
} as const;

export type ServicePermission = keyof typeof ServicePermissions;

// Service token configuration
export interface ServiceTokenConfig {
  secret: string;
  issuer: string;
  audience: string;
  expiresIn?: string; // Default: 1h
}

// Create a service token
export async function createServiceToken(
  config: ServiceTokenConfig,
  identity: Omit<ServiceIdentity, 'issuedAt' | 'expiresAt'>
): Promise<string> {
  const secret = new TextEncoder().encode(config.secret);
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = config.expiresIn || '1h';
  
  // Parse expiry
  const expirySeconds = parseExpiry(expiresIn);

  const token = await new jose.SignJWT({
    ...identity,
    issuedAt: now,
    expiresAt: now + expirySeconds,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + expirySeconds)
    .setIssuer(config.issuer)
    .setAudience(config.audience)
    .setSubject(identity.serviceId)
    .sign(secret);

  return token;
}

// Verify a service token
export async function verifyServiceToken(
  config: ServiceTokenConfig,
  token: string
): Promise<ServiceIdentity> {
  const secret = new TextEncoder().encode(config.secret);

  try {
    const { payload } = await jose.jwtVerify(token, secret, {
      issuer: config.issuer,
      audience: config.audience,
    });

    const identity = serviceIdentitySchema.parse({
      serviceId: payload.serviceId,
      serviceName: payload.serviceName,
      permissions: payload.permissions,
      environment: payload.environment,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
    });

    return identity;
  } catch (error) {
    if (error instanceof jose.errors.JWTExpired) {
      throw new ServiceAuthError('Token expired', 'TOKEN_EXPIRED');
    }
    if (error instanceof jose.errors.JWTInvalid) {
      throw new ServiceAuthError('Invalid token', 'INVALID_TOKEN');
    }
    throw new ServiceAuthError('Token verification failed', 'VERIFICATION_FAILED');
  }
}

// Check if service has permission
export function hasPermission(
  identity: ServiceIdentity,
  permission: ServicePermission
): boolean {
  return identity.permissions.includes(permission) || 
         identity.permissions.includes('*');
}

// Check multiple permissions (all required)
export function hasAllPermissions(
  identity: ServiceIdentity,
  permissions: ServicePermission[]
): boolean {
  return permissions.every(p => hasPermission(identity, p));
}

// Check multiple permissions (any required)
export function hasAnyPermission(
  identity: ServiceIdentity,
  permissions: ServicePermission[]
): boolean {
  return permissions.some(p => hasPermission(identity, p));
}

// Service auth error
export class ServiceAuthError extends Error {
  constructor(
    message: string,
    public code: 'TOKEN_EXPIRED' | 'INVALID_TOKEN' | 'VERIFICATION_FAILED' | 'PERMISSION_DENIED'
  ) {
    super(message);
    this.name = 'ServiceAuthError';
  }
}

// Service-to-service client
export class ServiceClient {
  private token: string | null = null;
  private tokenExpiry: number = 0;
  private config: ServiceTokenConfig;
  private identity: Omit<ServiceIdentity, 'issuedAt' | 'expiresAt'>;

  constructor(
    config: ServiceTokenConfig,
    identity: Omit<ServiceIdentity, 'issuedAt' | 'expiresAt'>
  ) {
    this.config = config;
    this.identity = identity;
  }

  async getToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    
    // Refresh token if expired or about to expire (5 min buffer)
    if (!this.token || this.tokenExpiry - now < 300) {
      this.token = await createServiceToken(this.config, this.identity);
      // Parse token to get expiry
      const decoded = jose.decodeJwt(this.token);
      this.tokenExpiry = decoded.exp as number;
    }

    return this.token;
  }

  async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.getToken();
    return {
      'Authorization': `Bearer ${token}`,
      'X-Service-Name': this.identity.serviceName,
      'X-Service-Id': this.identity.serviceId,
    };
  }
}

// Helper: parse expiry string to seconds
function parseExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match || !match[1] || !match[2]) return 3600; // Default 1 hour

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    case 'd': return value * 86400;
    default: return 3600;
  }
}

// Fastify plugin for service auth
export function serviceAuthPlugin(fastify: any, options: ServiceTokenConfig, done: () => void) {
  fastify.decorateRequest('serviceIdentity', null);

  fastify.addHook('onRequest', async (request: any, reply: any) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return; // No service auth, might be user auth
    }

    const serviceName = request.headers['x-service-name'];
    if (!serviceName) {
      return; // Not a service-to-service call
    }

    try {
      const token = authHeader.substring(7);
      const identity = await verifyServiceToken(options, token);
      request.serviceIdentity = identity;
    } catch (error) {
      // Log but don't fail - might be user auth
      request.log.debug({ error }, 'Service auth failed');
    }
  });

  done();
}
