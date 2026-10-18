/**
 * HMRC OAuth Routes
 *
 * Endpoints for HMRC MTD authorization flow.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomBytes } from 'crypto';
import type { HMRCOAuthClient, HMRCTokenStore } from '../../../infrastructure/hmrc/oauth-client.js';

interface RouteContext {
  oauthClient: HMRCOAuthClient;
  tokenStore: HMRCTokenStore;
}

// In-memory state store (should use Redis in production)
const pendingAuthStates = new Map<string, { entityId: string; scope: string; redirectUrl?: string; expiresAt: number }>();

// Clean up expired states periodically
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of pendingAuthStates.entries()) {
    if (data.expiresAt < now) {
      pendingAuthStates.delete(state);
    }
  }
}, 60000);

export async function hmrcOAuthRoutes(
  fastify: FastifyInstance,
  context: RouteContext
): Promise<void> {
  const { oauthClient, tokenStore } = context;

  /**
   * Start HMRC authorization flow
   * POST /hmrc/authorize
   */
  fastify.post(
    '/hmrc/authorize',
    {
      schema: {
        description: 'Start HMRC MTD authorization flow',
        tags: ['HMRC OAuth'],
        body: {
          type: 'object',
          required: ['entityId', 'scope'],
          properties: {
            entityId: { type: 'string', format: 'uuid' },
            scope: {
              type: 'string',
              enum: ['read:vat', 'write:vat', 'read:self-assessment', 'write:self-assessment'],
              default: 'write:vat',
            },
            redirectUrl: {
              type: 'string',
              format: 'uri',
              description: 'URL to redirect to after authorization completes',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              authorizationUrl: { type: 'string', format: 'uri' },
              state: { type: 'string' },
              expiresIn: { type: 'integer' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as { entityId: string; scope: string; redirectUrl?: string };

      // Generate state for CSRF protection
      const state = randomBytes(32).toString('hex');

      // Store pending authorization (expires in 10 minutes)
      const expiresAt = Date.now() + 10 * 60 * 1000;
      pendingAuthStates.set(state, {
        entityId: body.entityId,
        scope: body.scope,
        redirectUrl: body.redirectUrl,
        expiresAt,
      });

      // Generate authorization URL
      const authorizationUrl = oauthClient.getAuthorizationUrl(state);

      return reply.send({
        authorizationUrl,
        state,
        expiresIn: 600, // 10 minutes
      });
    }
  );

  /**
   * HMRC OAuth callback
   * GET /hmrc/callback
   */
  fastify.get(
    '/hmrc/callback',
    {
      schema: {
        description: 'HMRC OAuth callback endpoint',
        tags: ['HMRC OAuth'],
        querystring: {
          type: 'object',
          required: ['code', 'state'],
          properties: {
            code: { type: 'string' },
            state: { type: 'string' },
            error: { type: 'string' },
            error_description: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              entityId: { type: 'string' },
              scope: { type: 'string' },
              expiresAt: { type: 'string', format: 'date-time' },
            },
          },
          302: {
            description: 'Redirect to original URL if provided',
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as {
        code?: string;
        state: string;
        error?: string;
        error_description?: string;
      };

      // Check for OAuth error
      if (query.error) {
        return reply.status(400).send({
          error: query.error,
          message: query.error_description || 'HMRC authorization failed',
        });
      }

      // Validate state
      const pendingAuth = pendingAuthStates.get(query.state);
      if (!pendingAuth) {
        return reply.status(400).send({
          error: 'INVALID_STATE',
          message: 'Invalid or expired authorization state',
        });
      }

      // Remove used state
      pendingAuthStates.delete(query.state);

      // Check expiration
      if (pendingAuth.expiresAt < Date.now()) {
        return reply.status(400).send({
          error: 'EXPIRED_STATE',
          message: 'Authorization request has expired',
        });
      }

      try {
        // Exchange code for tokens
        const tokenSet = await oauthClient.exchangeCode(query.code!);

        // Store tokens
        await tokenStore.saveToken(pendingAuth.entityId, pendingAuth.scope, tokenSet);

        // If redirect URL was provided, redirect there
        if (pendingAuth.redirectUrl) {
          const redirectUrl = new URL(pendingAuth.redirectUrl);
          redirectUrl.searchParams.set('success', 'true');
          redirectUrl.searchParams.set('scope', pendingAuth.scope);
          return reply.redirect(302, redirectUrl.toString());
        }

        return reply.send({
          success: true,
          message: 'HMRC authorization successful',
          entityId: pendingAuth.entityId,
          scope: pendingAuth.scope,
          expiresAt: tokenSet.expiresAt.toISOString(),
        });
      } catch (error: any) {
        // If redirect URL was provided, redirect with error
        if (pendingAuth.redirectUrl) {
          const redirectUrl = new URL(pendingAuth.redirectUrl);
          redirectUrl.searchParams.set('success', 'false');
          redirectUrl.searchParams.set('error', error.code || 'auth_failed');
          return reply.redirect(302, redirectUrl.toString());
        }

        return reply.status(400).send({
          error: error.code || 'AUTH_FAILED',
          message: error.message || 'Failed to exchange authorization code',
        });
      }
    }
  );

  /**
   * Check authorization status
   * GET /hmrc/status/:entityId
   */
  fastify.get(
    '/hmrc/status/:entityId',
    {
      schema: {
        description: 'Check HMRC authorization status for an entity',
        tags: ['HMRC OAuth'],
        params: {
          type: 'object',
          properties: {
            entityId: { type: 'string', format: 'uuid' },
          },
          required: ['entityId'],
        },
        querystring: {
          type: 'object',
          properties: {
            scope: { type: 'string', default: 'write:vat' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              authorized: { type: 'boolean' },
              scope: { type: 'string' },
              expiresAt: { type: 'string', format: 'date-time', nullable: true },
              needsReauthorization: { type: 'boolean' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { entityId: string } }>, reply: FastifyReply) => {
      const { entityId } = request.params;
      const { scope = 'write:vat' } = request.query as { scope?: string };

      const tokenSet = await tokenStore.getToken(entityId, scope);

      if (!tokenSet) {
        return reply.send({
          authorized: false,
          scope,
          expiresAt: null,
          needsReauthorization: true,
        });
      }

      const isExpired = oauthClient.isTokenExpired(tokenSet);

      return reply.send({
        authorized: true,
        scope,
        expiresAt: tokenSet.expiresAt.toISOString(),
        needsReauthorization: isExpired,
      });
    }
  );

  /**
   * Revoke authorization
   * DELETE /hmrc/authorize/:entityId
   */
  fastify.delete(
    '/hmrc/authorize/:entityId',
    {
      schema: {
        description: 'Revoke HMRC authorization for an entity',
        tags: ['HMRC OAuth'],
        params: {
          type: 'object',
          properties: {
            entityId: { type: 'string', format: 'uuid' },
          },
          required: ['entityId'],
        },
        querystring: {
          type: 'object',
          properties: {
            scope: { type: 'string' },
          },
        },
        response: {
          204: { type: 'null' },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { entityId: string } }>, reply: FastifyReply) => {
      const { entityId } = request.params;
      const { scope } = request.query as { scope?: string };

      if (scope) {
        await tokenStore.deleteToken(entityId, scope);
      } else {
        // Delete all tokens for entity if no scope specified
        // This would require extending the token store interface
        await tokenStore.deleteToken(entityId, 'read:vat');
        await tokenStore.deleteToken(entityId, 'write:vat');
      }

      return reply.status(204).send();
    }
  );
}
