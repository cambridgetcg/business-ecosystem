/**
 * Webhook Routes
 *
 * REST API endpoints for receiving webhooks from external IP watch services.
 * Supports patent watch, trademark watch, domain watch, and litigation alerts.
 *
 * @module api/rest/routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import pino from 'pino';
import { webhookValidator } from '../../../infrastructure/webhooks/webhook-validator.js';
import { webhookHandler } from '../../../application/handlers/webhook-handler.js';
import { detectProviderFromHeaders, getEnabledProviders } from '../../../infrastructure/webhooks/webhook-config.js';
import type { WebhookProvider, WebhookProcessingResult } from '../../../infrastructure/webhooks/webhook-types.js';

const logger = pino({ name: 'webhook-routes' });

// ============================================================================
// Schemas
// ============================================================================

/**
 * Provider query parameter schema.
 */
const providerQuerySchema = z.object({
  provider: z.enum([
    'anaqua', 'clarivate', 'trademarknow', 'markmonitor',
    'corsearch', 'brandshelter', 'compumark', 'darts_ip', 'custom',
  ]).optional(),
});

/**
 * Common webhook response schema for Swagger.
 */
const webhookResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    eventId: { type: 'string' },
    eventType: { type: 'string' },
    provider: { type: 'string' },
    message: { type: 'string' },
    error: { type: 'string' },
    recordsCreated: { type: 'number' },
    eventsPublished: { type: 'number' },
  },
};

/**
 * Error response schema for Swagger.
 */
const errorResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    error: { type: 'string' },
    details: { type: 'object' },
  },
};

// ============================================================================
// Route Handler
// ============================================================================

/**
 * Webhook routes plugin.
 */
export async function webhookRoutes(fastify: FastifyInstance): Promise<void> {
  // ============================================================================
  // Patent Watch Webhook
  // ============================================================================

  /**
   * POST /api/v1/webhooks/patent-watch
   *
   * Receive patent watch alerts from external providers.
   * Handles new filings, citations, competitor activity, and status changes.
   */
  fastify.post<{
    Querystring: z.infer<typeof providerQuerySchema>;
    Body: Record<string, unknown>;
  }>(
    '/patent-watch',
    {
      schema: {
        tags: ['webhooks'],
        summary: 'Receive patent watch alerts',
        description: `
          Receives patent watch alerts from external providers (Anaqua, Clarivate, etc.).

          **Alert Types:**
          - \`new_filing\` - New patent application filed
          - \`new_publication\` - Patent application published
          - \`new_grant\` - Patent granted
          - \`citation_forward\` - Patent cited by another
          - \`citation_backward\` - Patent cites another
          - \`competitor_filing\` - Competitor filed a patent
          - \`family_member\` - Family member detected
          - \`status_change\` - Patent status changed
          - \`maintenance_due\` - Maintenance fee due
          - \`expiration\` - Patent expiring
          - \`opposition\` - Opposition filed
          - \`reexamination\` - Reexamination requested
          - \`assignment\` - Patent assigned
          - \`license_recorded\` - License recorded

          **Authentication:**
          The provider must sign the request with HMAC-SHA256 using the configured secret.
          Include the signature in the provider-specific header (e.g., X-Anaqua-Signature).
        `,
        querystring: providerQuerySchema,
        body: {
          type: 'object',
          additionalProperties: true,
        },
        response: {
          200: webhookResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
      config: {
        rawBody: true, // Store raw body for signature verification
      },
    },
    async (request, reply) => {
      return handleWebhook(request, reply, 'patent');
    }
  );

  // ============================================================================
  // Trademark Watch Webhook
  // ============================================================================

  /**
   * POST /api/v1/webhooks/trademark-watch
   *
   * Receive trademark watch alerts from external providers.
   * Handles similar marks, oppositions, renewals, and status changes.
   */
  fastify.post<{
    Querystring: z.infer<typeof providerQuerySchema>;
    Body: Record<string, unknown>;
  }>(
    '/trademark-watch',
    {
      schema: {
        tags: ['webhooks'],
        summary: 'Receive trademark watch alerts',
        description: `
          Receives trademark watch alerts from external providers (TrademarkNow, Corsearch, etc.).

          **Alert Types:**
          - \`similar_mark_filed\` - Similar mark filed
          - \`similar_mark_published\` - Similar mark published
          - \`similar_mark_registered\` - Similar mark registered
          - \`opposition_filed\` - Opposition filed against similar mark
          - \`opposition_received\` - Opposition received against our mark
          - \`cancellation_filed\` - Cancellation filed
          - \`cancellation_received\` - Cancellation received
          - \`renewal_due\` - Renewal deadline approaching
          - \`status_change\` - Mark status changed
          - \`assignment\` - Mark assigned
          - \`use_declaration_due\` - Use declaration due (US)
          - \`intent_to_use\` - Intent to use filed
          - \`domain_registration\` - Similar domain registered

          **Authentication:**
          The provider must sign the request with HMAC-SHA256 using the configured secret.
        `,
        querystring: providerQuerySchema,
        body: {
          type: 'object',
          additionalProperties: true,
        },
        response: {
          200: webhookResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
      config: {
        rawBody: true,
      },
    },
    async (request, reply) => {
      return handleWebhook(request, reply, 'trademark');
    }
  );

  // ============================================================================
  // Domain Watch Webhook
  // ============================================================================

  /**
   * POST /api/v1/webhooks/domain-watch
   *
   * Receive domain watch alerts from external providers.
   * Handles typosquatting, similar registrations, and brand abuse.
   */
  fastify.post<{
    Querystring: z.infer<typeof providerQuerySchema>;
    Body: Record<string, unknown>;
  }>(
    '/domain-watch',
    {
      schema: {
        tags: ['webhooks'],
        summary: 'Receive domain watch alerts',
        description: `
          Receives domain watch alerts from external providers (MarkMonitor, BrandShelter, etc.).

          **Alert Types:**
          - \`typosquatting\` - Typosquatting domain detected
          - \`similar_registration\` - Similar domain registered
          - \`zone_file_addition\` - Domain added to zone file
          - \`expiration_notice\` - Domain expiration notice
          - \`transfer_notice\` - Domain transfer detected
          - \`whois_change\` - WHOIS information changed
          - \`dns_change\` - DNS records changed
          - \`content_change\` - Website content changed
          - \`brand_abuse\` - Brand abuse detected

          **Authentication:**
          The provider must sign the request with HMAC-SHA256 using the configured secret.
        `,
        querystring: providerQuerySchema,
        body: {
          type: 'object',
          additionalProperties: true,
        },
        response: {
          200: webhookResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
      config: {
        rawBody: true,
      },
    },
    async (request, reply) => {
      return handleWebhook(request, reply, 'domain');
    }
  );

  // ============================================================================
  // Litigation Watch Webhook
  // ============================================================================

  /**
   * POST /api/v1/webhooks/litigation-watch
   *
   * Receive IP litigation alerts from external providers.
   * Routes to enforcement handlers for case tracking.
   */
  fastify.post<{
    Querystring: z.infer<typeof providerQuerySchema>;
    Body: Record<string, unknown>;
  }>(
    '/litigation-watch',
    {
      schema: {
        tags: ['webhooks'],
        summary: 'Receive IP litigation alerts',
        description: `
          Receives IP litigation alerts from external providers (Darts-IP, etc.).

          **Alert Types:**
          - \`case_filed\` - New case filed
          - \`case_updated\` - Case updated
          - \`motion_filed\` - Motion filed
          - \`order_issued\` - Order issued
          - \`judgment\` - Judgment entered
          - \`appeal_filed\` - Appeal filed
          - \`settlement\` - Settlement announced
          - \`trial_date_set\` - Trial date scheduled
          - \`claim_construction\` - Claim construction ruling
          - \`invalidity_contention\` - Invalidity contention filed
          - \`ptab_proceeding\` - PTAB proceeding activity
          - \`itc_investigation\` - ITC investigation activity

          **Authentication:**
          The provider must sign the request with HMAC-SHA256 using the configured secret.

          **Integration:**
          High-importance litigation alerts are automatically routed to the enforcement
          module for case creation and tracking.
        `,
        querystring: providerQuerySchema,
        body: {
          type: 'object',
          additionalProperties: true,
        },
        response: {
          200: webhookResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
      config: {
        rawBody: true,
      },
    },
    async (request, reply) => {
      return handleWebhook(request, reply, 'litigation');
    }
  );

  // ============================================================================
  // Webhook Status Endpoint
  // ============================================================================

  /**
   * GET /api/v1/webhooks/status
   *
   * Get webhook configuration status and enabled providers.
   */
  fastify.get(
    '/status',
    {
      schema: {
        tags: ['webhooks'],
        summary: 'Get webhook status',
        description: 'Returns the status of webhook configuration and enabled providers.',
        response: {
          200: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              providers: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    provider: { type: 'string' },
                    name: { type: 'string' },
                    enabled: { type: 'boolean' },
                    signatureHeader: { type: 'string' },
                  },
                },
              },
              endpoints: {
                type: 'object',
                properties: {
                  patentWatch: { type: 'string' },
                  trademarkWatch: { type: 'string' },
                  domainWatch: { type: 'string' },
                  litigationWatch: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const enabledProviders = getEnabledProviders();

      const baseUrl = `${request.protocol}://${request.hostname}`;

      return reply.send({
        enabled: true,
        providers: enabledProviders.map(p => ({
          provider: p.provider,
          name: p.name,
          enabled: p.enabled,
          signatureHeader: p.signatureHeader,
        })),
        endpoints: {
          patentWatch: `${baseUrl}/api/v1/webhooks/patent-watch`,
          trademarkWatch: `${baseUrl}/api/v1/webhooks/trademark-watch`,
          domainWatch: `${baseUrl}/api/v1/webhooks/domain-watch`,
          litigationWatch: `${baseUrl}/api/v1/webhooks/litigation-watch`,
        },
      });
    }
  );

  // ============================================================================
  // Test Webhook Endpoint (Development Only)
  // ============================================================================

  if (process.env.NODE_ENV !== 'production') {
    /**
     * POST /api/v1/webhooks/test
     *
     * Test webhook endpoint for development. Accepts any payload without signature verification.
     */
    fastify.post<{
      Body: Record<string, unknown>;
      Querystring: { type?: 'patent' | 'trademark' | 'domain' | 'litigation' };
    }>(
      '/test',
      {
        schema: {
          tags: ['webhooks'],
          summary: 'Test webhook (development only)',
          description: 'Test endpoint for webhook development. Does not verify signatures.',
          querystring: z.object({
            type: z.enum(['patent', 'trademark', 'domain', 'litigation']).optional(),
          }),
          body: {
            type: 'object',
            additionalProperties: true,
          },
          response: {
            200: webhookResponseSchema,
          },
        },
      },
      async (request, reply) => {
        const { type = 'patent' } = request.query;
        const provider: WebhookProvider = 'custom';

        let result: WebhookProcessingResult;

        switch (type) {
          case 'patent':
            result = await webhookHandler.handlePatentWatch(request.body, provider);
            break;
          case 'trademark':
            result = await webhookHandler.handleTrademarkWatch(request.body, provider);
            break;
          case 'domain':
            result = await webhookHandler.handleDomainWatch(request.body, provider);
            break;
          case 'litigation':
            result = await webhookHandler.handleLitigationWatch(request.body, provider);
            break;
          default:
            result = await webhookHandler.handlePatentWatch(request.body, provider);
        }

        return reply.status(result.success ? 200 : 400).send(result);
      }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Handle webhook request with signature verification.
 */
async function handleWebhook(
  request: FastifyRequest<{
    Querystring: z.infer<typeof providerQuerySchema>;
    Body: Record<string, unknown>;
  }>,
  reply: FastifyReply,
  webhookType: 'patent' | 'trademark' | 'domain' | 'litigation'
): Promise<WebhookProcessingResult> {
  // Get raw body for signature verification
  const rawBody = (request as unknown as { rawBody?: string | Buffer }).rawBody;
  if (!rawBody && process.env.NODE_ENV === 'production') {
    return reply.status(400).send({
      success: false,
      error: 'Raw body not available for signature verification',
    });
  }

  // Determine provider
  const headers = normalizeHeaders(request.headers);
  const explicitProvider = request.query.provider as WebhookProvider | undefined;
  const provider = explicitProvider ?? detectProviderFromHeaders(headers);

  if (!provider) {
    // In development, allow without provider detection
    if (process.env.NODE_ENV !== 'production') {
      logger.warn('No provider detected, using custom for development');
      const result = await routeToHandler(webhookType, request.body, 'custom');
      return reply.status(result.success ? 200 : 400).send(result);
    }

    return reply.status(400).send({
      success: false,
      error: 'Unable to determine webhook provider. Include provider query parameter or signature header.',
    });
  }

  // Verify signature
  const validation = webhookValidator.validateRequest(
    rawBody ?? JSON.stringify(request.body),
    headers,
    provider
  );

  if (!validation.valid) {
    logger.warn({ provider, error: validation.error }, 'Webhook signature validation failed');

    // In production, reject invalid signatures
    if (process.env.NODE_ENV === 'production') {
      return reply.status(401).send({
        success: false,
        error: validation.error ?? 'Signature verification failed',
      });
    }

    // In development, log and continue
    logger.warn('Allowing invalid signature in development mode');
  }

  // Route to appropriate handler
  const result = await routeToHandler(webhookType, request.body, provider);

  return reply.status(result.success ? 200 : 400).send(result);
}

/**
 * Route webhook to appropriate handler.
 */
async function routeToHandler(
  webhookType: 'patent' | 'trademark' | 'domain' | 'litigation',
  payload: Record<string, unknown>,
  provider: WebhookProvider
): Promise<WebhookProcessingResult> {
  switch (webhookType) {
    case 'patent':
      return webhookHandler.handlePatentWatch(payload, provider);
    case 'trademark':
      return webhookHandler.handleTrademarkWatch(payload, provider);
    case 'domain':
      return webhookHandler.handleDomainWatch(payload, provider);
    case 'litigation':
      return webhookHandler.handleLitigationWatch(payload, provider);
    default:
      return {
        success: false,
        eventId: 'unknown',
        eventType: 'unknown',
        provider,
        error: `Unknown webhook type: ${webhookType}`,
      };
  }
}

/**
 * Normalize headers to lowercase keys.
 */
function normalizeHeaders(headers: Record<string, string | string[] | undefined>): Record<string, string | undefined> {
  const normalized: Record<string, string | undefined> = {};

  for (const [key, value] of Object.entries(headers)) {
    normalized[key.toLowerCase()] = Array.isArray(value) ? value[0] : value;
  }

  return normalized;
}

export default webhookRoutes;
