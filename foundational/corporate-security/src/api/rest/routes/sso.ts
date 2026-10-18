/**
 * SSO API Routes
 *
 * REST endpoints for single sign-on authentication.
 *
 * @module api/rest/routes/sso
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  SSOService,
  createSSOService,
  CreateSSOProviderInputSchema,
} from '../../../domain/sso/index.js';

// =============================================================================
// REQUEST SCHEMAS
// =============================================================================

const createProviderSchema = CreateSSOProviderInputSchema;

const initiateSAMLSchema = z.object({
  providerId: z.string().uuid(),
  relayState: z.string().optional(),
});

const initiateOIDCSchema = z.object({
  providerId: z.string().uuid(),
});

const callbackOIDCSchema = z.object({
  code: z.string(),
  state: z.string(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

// =============================================================================
// ROUTES
// =============================================================================

export async function ssoRoutes(fastify: FastifyInstance) {
  const ssoService = createSSOService();

  // ---------------------------------------------------------------------------
  // Provider Management
  // ---------------------------------------------------------------------------

  // POST /sso/providers - Create SSO provider
  fastify.post<{
    Body: z.infer<typeof createProviderSchema>;
  }>('/sso/providers', {
    schema: { body: createProviderSchema },
  }, async (request, reply) => {
    try {
      const provider = await ssoService.createProvider(request.body);
      return reply.status(201).send(provider);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Provider creation failed';
      return reply.status(400).send({ error: message });
    }
  });

  // GET /sso/providers - List providers for tenant
  fastify.get('/sso/providers', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const providers = await ssoService.getProvidersByTenant(tenantId);
    return reply.send({ data: providers });
  });

  // GET /sso/providers/:id - Get provider by ID
  fastify.get<{
    Params: { id: string };
  }>('/sso/providers/:id', async (request, reply) => {
    const provider = await ssoService.getProvider(request.params.id);
    if (!provider) {
      return reply.status(404).send({ error: 'Provider not found' });
    }
    return reply.send(provider);
  });

  // POST /sso/providers/:id/activate - Activate provider
  fastify.post<{
    Params: { id: string };
  }>('/sso/providers/:id/activate', async (request, reply) => {
    try {
      const provider = await ssoService.activateProvider(request.params.id);
      return reply.send(provider);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Activation failed';
      return reply.status(400).send({ error: message });
    }
  });

  // POST /sso/providers/:id/deactivate - Deactivate provider
  fastify.post<{
    Params: { id: string };
  }>('/sso/providers/:id/deactivate', async (request, reply) => {
    try {
      const provider = await ssoService.deactivateProvider(request.params.id);
      return reply.send(provider);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Deactivation failed';
      return reply.status(400).send({ error: message });
    }
  });

  // GET /sso/discover - Find provider by email domain
  fastify.get<{
    Querystring: { email: string };
  }>('/sso/discover', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const email = request.query.email;
    if (!email) {
      return reply.status(400).send({ error: 'Email is required' });
    }

    const provider = await ssoService.findProviderByEmailDomain(tenantId, email);

    if (!provider) {
      return reply.send({ ssoAvailable: false });
    }

    return reply.send({
      ssoAvailable: true,
      providerId: provider.id,
      providerName: provider.name,
      providerType: provider.type,
    });
  });

  // ---------------------------------------------------------------------------
  // SAML Authentication
  // ---------------------------------------------------------------------------

  // POST /sso/saml/initiate - Start SAML authentication
  fastify.post<{
    Body: z.infer<typeof initiateSAMLSchema>;
  }>('/sso/saml/initiate', {
    schema: { body: initiateSAMLSchema },
  }, async (request, reply) => {
    try {
      const result = await ssoService.generateSAMLAuthRequest(
        request.body.providerId,
        request.body.relayState
      );

      return reply.send({
        requestId: result.requestId,
        redirectUrl: result.redirectUrl,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'SAML initiation failed';
      return reply.status(400).send({ error: message });
    }
  });

  // POST /sso/saml/callback - Process SAML response
  fastify.post<{
    Body: { SAMLResponse: string; RelayState?: string };
  }>('/sso/saml/callback', async (request, reply) => {
    try {
      const result = await ssoService.processSAMLResponse(
        request.body.SAMLResponse,
        request.body.RelayState
      );

      if (!result.success) {
        return reply.status(401).send({ error: result.error });
      }

      return reply.send({
        success: true,
        email: result.email,
        attributes: result.attributes,
        newUser: result.newUser,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'SAML callback failed';
      return reply.status(400).send({ error: message });
    }
  });

  // ---------------------------------------------------------------------------
  // OIDC Authentication
  // ---------------------------------------------------------------------------

  // POST /sso/oidc/initiate - Start OIDC authentication
  fastify.post<{
    Body: z.infer<typeof initiateOIDCSchema>;
  }>('/sso/oidc/initiate', {
    schema: { body: initiateOIDCSchema },
  }, async (request, reply) => {
    try {
      const result = await ssoService.generateOIDCAuthRequest(
        request.body.providerId
      );

      return reply.send({
        state: result.state,
        redirectUrl: result.redirectUrl,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'OIDC initiation failed';
      return reply.status(400).send({ error: message });
    }
  });

  // GET /sso/oidc/callback - Process OIDC callback
  fastify.get<{
    Querystring: z.infer<typeof callbackOIDCSchema>;
  }>('/sso/oidc/callback', async (request, reply) => {
    const { code, state, error, error_description } = request.query;

    if (error) {
      return reply.status(401).send({
        error,
        error_description,
      });
    }

    if (!code || !state) {
      return reply.status(400).send({ error: 'Missing code or state' });
    }

    try {
      const result = await ssoService.exchangeOIDCCode(code, state);

      if (!result.success) {
        return reply.status(401).send({ error: result.error });
      }

      return reply.send({
        success: true,
        email: result.email,
        attributes: result.attributes,
        sessionId: result.session?.id,
        newUser: result.newUser,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'OIDC callback failed';
      return reply.status(400).send({ error: message });
    }
  });

  // ---------------------------------------------------------------------------
  // Session Management
  // ---------------------------------------------------------------------------

  // GET /sso/sessions/:id - Get SSO session
  fastify.get<{
    Params: { id: string };
  }>('/sso/sessions/:id', async (request, reply) => {
    const session = await ssoService.getSession(request.params.id);
    if (!session) {
      return reply.status(404).send({ error: 'Session not found' });
    }
    return reply.send(session);
  });

  // POST /sso/sessions/:id/revoke - Revoke SSO session
  fastify.post<{
    Params: { id: string };
  }>('/sso/sessions/:id/revoke', async (request, reply) => {
    await ssoService.revokeSession(request.params.id);
    return reply.send({ success: true });
  });
}
