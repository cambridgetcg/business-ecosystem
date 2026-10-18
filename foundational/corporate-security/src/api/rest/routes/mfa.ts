/**
 * MFA API Routes
 *
 * REST endpoints for multi-factor authentication.
 *
 * @module api/rest/routes/mfa
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { MFAService, createMFAService } from '../../../domain/mfa/index.js';

// =============================================================================
// REQUEST SCHEMAS
// =============================================================================

const setupMFASchema = z.object({
  email: z.string().email(),
});

const verifySetupSchema = z.object({
  code: z.string().min(6).max(8),
});

const verifyChallengeSchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().min(6).max(10), // TOTP (6) or backup code (8-10)
});

// =============================================================================
// ROUTES
// =============================================================================

export async function mfaRoutes(fastify: FastifyInstance) {
  const mfaService = createMFAService({
    issuer: process.env.MFA_ISSUER ?? 'BusinessEcosystem',
    challengeExpiryMinutes: parseInt(process.env.MFA_CHALLENGE_EXPIRY ?? '5', 10),
    maxChallengeAttempts: parseInt(process.env.MFA_MAX_ATTEMPTS ?? '3', 10),
    backupCodeCount: parseInt(process.env.MFA_BACKUP_CODE_COUNT ?? '10', 10),
  });

  // ---------------------------------------------------------------------------
  // POST /mfa/setup - Initialize MFA setup
  // ---------------------------------------------------------------------------
  fastify.post<{
    Body: z.infer<typeof setupMFASchema>;
  }>('/mfa/setup', {
    schema: { body: setupMFASchema },
  }, async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    const identityId = request.headers['x-identity-id'] as string;

    if (!tenantId || !identityId) {
      return reply.status(400).send({ error: 'Missing required headers' });
    }

    try {
      const result = await mfaService.setupMFA(
        identityId,
        tenantId,
        request.body.email
      );

      return reply.status(201).send({
        secretId: result.secret.id,
        provisioningUri: result.provisioningUri,
        qrCodeDataUrl: result.qrCodeDataUrl,
        backupCodes: result.backupCodes,
        message: 'Scan the QR code with your authenticator app, then verify with a code',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Setup failed';
      return reply.status(400).send({ error: message });
    }
  });

  // ---------------------------------------------------------------------------
  // POST /mfa/verify-setup - Verify MFA setup with initial code
  // ---------------------------------------------------------------------------
  fastify.post<{
    Body: z.infer<typeof verifySetupSchema>;
  }>('/mfa/verify-setup', {
    schema: { body: verifySetupSchema },
  }, async (request, reply) => {
    const identityId = request.headers['x-identity-id'] as string;

    if (!identityId) {
      return reply.status(400).send({ error: 'Missing x-identity-id header' });
    }

    const result = await mfaService.verifySetup(identityId, request.body.code);

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send({
      success: true,
      message: 'MFA has been successfully enabled',
    });
  });

  // ---------------------------------------------------------------------------
  // POST /mfa/challenge - Create MFA challenge for login
  // ---------------------------------------------------------------------------
  fastify.post('/mfa/challenge', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    const identityId = request.headers['x-identity-id'] as string;
    const sessionId = request.headers['x-session-id'] as string;

    if (!tenantId || !identityId || !sessionId) {
      return reply.status(400).send({ error: 'Missing required headers' });
    }

    try {
      const result = await mfaService.createChallenge(
        identityId,
        tenantId,
        sessionId
      );

      return reply.status(201).send(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Challenge creation failed';
      return reply.status(400).send({ error: message });
    }
  });

  // ---------------------------------------------------------------------------
  // POST /mfa/verify - Verify MFA challenge
  // ---------------------------------------------------------------------------
  fastify.post<{
    Body: z.infer<typeof verifyChallengeSchema>;
  }>('/mfa/verify', {
    schema: { body: verifyChallengeSchema },
  }, async (request, reply) => {
    const result = await mfaService.verifyChallenge(
      request.body.challengeId,
      request.body.code
    );

    if (!result.success) {
      return reply.status(401).send({
        error: result.error,
        remainingAttempts: result.remainingAttempts,
      });
    }

    return reply.send({ success: true });
  });

  // ---------------------------------------------------------------------------
  // POST /mfa/disable - Disable MFA
  // ---------------------------------------------------------------------------
  fastify.post('/mfa/disable', async (request, reply) => {
    const identityId = request.headers['x-identity-id'] as string;

    if (!identityId) {
      return reply.status(400).send({ error: 'Missing x-identity-id header' });
    }

    await mfaService.disableMFA(identityId);

    return reply.send({
      success: true,
      message: 'MFA has been disabled',
    });
  });

  // ---------------------------------------------------------------------------
  // GET /mfa/status - Get MFA status
  // ---------------------------------------------------------------------------
  fastify.get('/mfa/status', async (request, reply) => {
    const identityId = request.headers['x-identity-id'] as string;

    if (!identityId) {
      return reply.status(400).send({ error: 'Missing x-identity-id header' });
    }

    const status = await mfaService.getMFAStatus(identityId);
    return reply.send(status);
  });

  // ---------------------------------------------------------------------------
  // POST /mfa/backup-codes/regenerate - Regenerate backup codes
  // ---------------------------------------------------------------------------
  fastify.post('/mfa/backup-codes/regenerate', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    const identityId = request.headers['x-identity-id'] as string;

    if (!tenantId || !identityId) {
      return reply.status(400).send({ error: 'Missing required headers' });
    }

    const codes = await mfaService.regenerateBackupCodes(identityId, tenantId);

    return reply.send({
      backupCodes: codes,
      message: 'New backup codes generated. Previous codes are now invalid.',
    });
  });
}
