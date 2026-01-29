/**
 * E-Signature Routes (ESIGN/UETA Compliance)
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { PrismaClient, SignatureType } from '@prisma/client';
import { z } from 'zod';
import { createESignatureService } from '../domain/legal-operations/services/e-signature.service.js';
import { authenticate, requirePermissions } from '../middleware/index.js';

const canManageSignatures = requirePermissions('contracts:signatures:manage');
const canViewSignatures = requirePermissions('contracts:signatures:view');

// Validation Schemas
const SignatureTypeEnum = z.enum([
  'TYPED', 'DRAWN', 'UPLOADED', 'CERTIFICATE_BASED',
  'BIOMETRIC', 'CLICK_TO_SIGN', 'SMS_VERIFICATION'
]);

const CreateSignatureEventSchema = z.object({
  contractPartyId: z.string().min(1),
  documentHash: z.string().min(1),
  documentVersion: z.number().int().positive(),
  signatureType: SignatureTypeEnum,
  signatureData: z.string().optional(),
  consentGiven: z.boolean(),
  consentMethod: z.string().min(1),
  consentText: z.string().min(1),
  ipAddress: z.string().min(1),
  userAgent: z.string().min(1),
  deviceId: z.string().optional(),
  geolocation: z.string().optional(),
  ceremonyStarted: z.coerce.date(),
  signedAt: z.coerce.date(),
  providerRef: z.string().optional(),
  providerName: z.string().optional(),
  providerData: z.record(z.unknown()).optional(),
});

const SignatureEventQuerySchema = z.object({
  contractPartyId: z.string().optional(),
  providerName: z.string().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export function createESignatureRouter(prisma: PrismaClient) {
  const router = new Hono();
  const service = createESignatureService(prisma);

  // List signature events
  router.get('/', authenticate, canViewSignatures, zValidator('query', SignatureEventQuerySchema), async (c) => {
    const query = c.req.valid('query');
    const result = await service.listSignatureEvents({
      contractPartyId: query.contractPartyId,
      providerName: query.providerName,
      fromDate: query.fromDate,
      toDate: query.toDate,
      page: query.page,
      limit: query.limit,
    });
    return c.json(result);
  });

  // Get signature event by ID
  router.get('/:id', authenticate, canViewSignatures, async (c) => {
    const id = c.req.param('id');
    const event = await service.getSignatureEvent(id);
    return c.json(event);
  });

  // Record new signature event
  router.post('/', authenticate, canManageSignatures, zValidator('json', CreateSignatureEventSchema), async (c) => {
    const input = c.req.valid('json');
    const event = await service.recordSignatureEvent({
      contractPartyId: input.contractPartyId,
      documentHash: input.documentHash,
      documentVersion: input.documentVersion,
      signatureType: input.signatureType as SignatureType,
      signatureData: input.signatureData,
      consentGiven: input.consentGiven,
      consentMethod: input.consentMethod,
      consentText: input.consentText,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      deviceId: input.deviceId,
      geolocation: input.geolocation,
      ceremonyStarted: input.ceremonyStarted,
      signedAt: input.signedAt,
      providerRef: input.providerRef,
      providerName: input.providerName,
      providerData: input.providerData,
    });
    return c.json(event, 201);
  });

  // Verify document integrity
  router.post('/:id/verify', authenticate, canViewSignatures, async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const result = await service.verifyDocumentIntegrity(id, body.currentHash);
    return c.json(result);
  });

  // Get signature events for a contract
  router.get('/contracts/:contractId', authenticate, canViewSignatures, async (c) => {
    const contractId = c.req.param('contractId');
    const events = await service.getContractSignatures(contractId);
    return c.json(events);
  });

  return router;
}
