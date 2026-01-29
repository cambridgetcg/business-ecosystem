/**
 * Authentication middleware
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { ServiceConfig } from '../config/services.js';

export interface JWTPayload {
  sub: string;
  email: string;
  roles: string[];
  tenantId?: string;
  iat: number;
  exp: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: JWTPayload;
  }
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
  serviceConfig: ServiceConfig
): Promise<void> {
  // Skip auth if not required
  if (!serviceConfig.auth?.required) {
    return;
  }

  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    reply.code(401).send({
      error: 'Unauthorized',
      message: 'Missing or invalid authorization header',
    });
    return;
  }

  try {
    const token = authHeader.substring(7);
    // @ts-ignore - jwt is added by fastify-jwt plugin
    const decoded = await request.jwtVerify<JWTPayload>();
    request.user = decoded;

    // Check role requirements
    if (serviceConfig.auth.roles && serviceConfig.auth.roles.length > 0) {
      const hasRole = serviceConfig.auth.roles.some(role => 
        decoded.roles.includes(role)
      );
      if (!hasRole) {
        reply.code(403).send({
          error: 'Forbidden',
          message: 'Insufficient permissions',
          requiredRoles: serviceConfig.auth.roles,
        });
        return;
      }
    }
  } catch (error) {
    reply.code(401).send({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
    });
  }
}

export function extractUserHeaders(request: FastifyRequest): Record<string, string> {
  const headers: Record<string, string> = {};
  
  if (request.user) {
    headers['x-user-id'] = request.user.sub;
    headers['x-user-email'] = request.user.email;
    headers['x-user-roles'] = request.user.roles.join(',');
    if (request.user.tenantId) {
      headers['x-tenant-id'] = request.user.tenantId;
    }
  }

  // Forward correlation ID
  if (request.correlationId) {
    headers['x-correlation-id'] = request.correlationId;
  }
  if (request.requestId) {
    headers['x-request-id'] = request.requestId;
  }

  return headers;
}
