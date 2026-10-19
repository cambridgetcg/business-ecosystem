/**
 * Consent Management Routes
 * GDPR Art. 6 - Lawful basis for processing
 *
 * Routes delegate to ConsentService - no business logic here
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { PrismaClient } from '#prisma';
import { createDomainLogger } from '../lib/logger.js';
import { eventPublisher, EventTypes } from '../lib/events.js';
import { ConsentService } from '../domain/consent-management/index.js';
import { PrismaConsentRepository } from '../infrastructure/persistence/prisma-consent.repository.js';

const logger = createDomainLogger('consent-management');

// ============================================================================
// VALIDATORS
// ============================================================================

const CreateConsentSchema = z.object({
  entityId: z.string().min(1),
  subjectId: z.string().min(1),
  subjectEmail: z.string().email().optional(),
  subjectType: z.enum(['CUSTOMER', 'EMPLOYEE', 'CONTRACTOR', 'PROSPECT', 'PARTNER', 'OTHER']).default('CUSTOMER'),
  purpose: z.string().min(1),
  purposeGroup: z.string().optional(),
  lawfulBasis: z.enum(['CONSENT', 'CONTRACT', 'LEGAL_OBLIGATION', 'VITAL_INTEREST', 'PUBLIC_TASK', 'LEGITIMATE_INTEREST']),
  grantedAt: z.string().datetime().transform((s) => new Date(s)),
  expiresAt: z.string().datetime().transform((s) => new Date(s)).optional(),
  proofRef: z.string().optional(),
  captureMethod: z.enum(['FORM', 'API', 'VERBAL', 'WRITTEN', 'CHECKBOX', 'DOUBLE_OPT_IN', 'IMPLICIT']).default('FORM'),
  sourceSystem: z.string().optional(),
  version: z.string().optional(),
});

const WithdrawConsentSchema = z.object({
  reason: z.string().optional(),
  method: z.enum(['FORM', 'API', 'VERBAL', 'WRITTEN', 'CHECKBOX', 'DOUBLE_OPT_IN', 'IMPLICIT']).optional(),
});

const ConsentQuerySchema = z.object({
  entityId: z.string().optional(),
  subjectId: z.string().optional(),
  purpose: z.string().optional(),
  status: z.enum(['ACTIVE', 'WITHDRAWN', 'EXPIRED', 'SUPERSEDED']).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

const CheckConsentSchema = z.object({
  subjectId: z.string().min(1),
  purpose: z.string().min(1),
});

// ============================================================================
// ROUTER FACTORY
// ============================================================================

export function createConsentRouter(prisma: PrismaClient) {
  const router = new Hono();

  // Dependency injection
  const repository = new PrismaConsentRepository(prisma);
  const service = new ConsentService(repository);

  // ─────────────────────────────────────────────────────────────────────────
  // LIST / QUERY
  // ─────────────────────────────────────────────────────────────────────────

  router.get('/', zValidator('query', ConsentQuerySchema), async (c) => {
    const filter = c.req.valid('query');
    const result = await service.listConsents(filter);

    return c.json({
      data: result.data,
      pagination: {
        total: result.total,
        limit: filter.limit,
        offset: filter.offset,
      },
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CHECK CONSENT (before /subject/:id and /:id routes)
  // ─────────────────────────────────────────────────────────────────────────

  router.get('/check', zValidator('query', CheckConsentSchema), async (c) => {
    const { subjectId, purpose } = c.req.valid('query');
    const result = await service.checkConsent(subjectId, purpose);
    return c.json(result);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET BY SUBJECT
  // ─────────────────────────────────────────────────────────────────────────

  router.get('/subject/:subjectId', async (c) => {
    const subjectId = c.req.param('subjectId');
    const consents = await service.getSubjectConsents(subjectId);
    return c.json({ data: consents });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET BY ENTITY
  // ─────────────────────────────────────────────────────────────────────────

  router.get('/entity/:entityId', async (c) => {
    const entityId = c.req.param('entityId');
    const consents = await service.getEntityConsents(entityId);
    return c.json({ data: consents });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET BY ID
  // ─────────────────────────────────────────────────────────────────────────

  router.get('/:id', async (c) => {
    const id = c.req.param('id');
    const result = await service.getConsent(id);

    if (!result.success) {
      return c.json({ error: result.error.message }, 404);
    }

    return c.json(result.data);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GRANT CONSENT
  // ─────────────────────────────────────────────────────────────────────────

  router.post('/', zValidator('json', CreateConsentSchema), async (c) => {
    const input = c.req.valid('json');
    const result = await service.grantConsent(input);

    if (!result.success) {
      return c.json({ error: result.error.message }, 400);
    }

    const consent = result.data;

    logger.info({
      consentId: consent.id,
      subjectId: consent.subjectId,
      purpose: consent.purpose,
    }, 'Consent granted');

    // Publish domain event
    await eventPublisher.publish(
      EventTypes.CONSENT_GIVEN,
      'ConsentRecord',
      consent.id,
      {
        entityId: consent.entityId,
        subjectId: consent.subjectId,
        purpose: consent.purpose,
        lawfulBasis: consent.lawfulBasis,
        expiresAt: consent.expiresAt,
      }
    );

    return c.json(consent, 201);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // WITHDRAW CONSENT (GDPR Art. 7(3))
  // ─────────────────────────────────────────────────────────────────────────

  router.post('/:id/withdraw', zValidator('json', WithdrawConsentSchema), async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const result = await service.withdrawConsent(id, input);

    if (!result.success) {
      const status = result.error.code === 'NOT_FOUND' ? 404 : 400;
      return c.json({ error: result.error.message }, status);
    }

    const consent = result.data;

    logger.info({
      consentId: id,
      subjectId: consent.subjectId,
    }, 'Consent withdrawn');

    // Publish domain event
    await eventPublisher.publish(
      EventTypes.CONSENT_WITHDRAWN,
      'ConsentRecord',
      consent.id,
      {
        entityId: consent.entityId,
        subjectId: consent.subjectId,
        purpose: consent.purpose,
        reason: input.reason,
      }
    );

    return c.json(consent);
  });

  return router;
}
