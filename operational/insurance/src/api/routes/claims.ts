/**
 * Claims API Routes
 *
 * REST endpoints for insurance claims management.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { ClaimsService } from '../../application/services/claims-service.js';
import { CreateClaimInputSchema, UpdateClaimInputSchema } from '../../domain/claims/models/claim.js';

const claimRoutes = new Hono();

// Shared schema for ID params
const idParamSchema = z.object({
  id: z.string().uuid(),
});

const tenantQuerySchema = z.object({
  tenantId: z.string().uuid(),
});

// ===========================================================================
// Claim CRUD
// ===========================================================================

// Create claim
claimRoutes.post(
  '/',
  zValidator('json', CreateClaimInputSchema),
  async (c) => {
    const prisma = c.get('prisma');
    const service = new ClaimsService(prisma);
    const input = c.req.valid('json');
    const userId = c.get('userId');

    try {
      const claim = await service.createClaim(input, userId);
      return c.json(claim, 201);
    } catch (error: any) {
      return c.json({ error: error.message }, 400);
    }
  }
);

// Get claim by ID
claimRoutes.get(
  '/:id',
  zValidator('param', idParamSchema),
  async (c) => {
    const prisma = c.get('prisma');
    const service = new ClaimsService(prisma);
    const { id } = c.req.valid('param');

    const claim = await service.getClaim(id);
    if (!claim) {
      return c.json({ error: 'Claim not found' }, 404);
    }

    return c.json(claim);
  }
);

// Update claim
claimRoutes.patch(
  '/:id',
  zValidator('param', idParamSchema),
  zValidator('json', UpdateClaimInputSchema),
  async (c) => {
    const prisma = c.get('prisma');
    const service = new ClaimsService(prisma);
    const { id } = c.req.valid('param');
    const input = c.req.valid('json');
    const userId = c.get('userId');

    try {
      const claim = await service.updateClaim(id, input, userId);
      return c.json(claim);
    } catch (error: any) {
      return c.json({ error: error.message }, 400);
    }
  }
);

// Delete claim (soft delete)
claimRoutes.delete(
  '/:id',
  zValidator('param', idParamSchema),
  async (c) => {
    const prisma = c.get('prisma');
    const service = new ClaimsService(prisma);
    const { id } = c.req.valid('param');
    const userId = c.get('userId');

    try {
      await service.deleteClaim(id, userId);
      return c.json({ success: true });
    } catch (error: any) {
      return c.json({ error: error.message }, 400);
    }
  }
);

// ===========================================================================
// Claim Status Transitions
// ===========================================================================

// Submit claim
claimRoutes.post(
  '/:id/submit',
  zValidator('param', idParamSchema),
  async (c) => {
    const prisma = c.get('prisma');
    const service = new ClaimsService(prisma);
    const { id } = c.req.valid('param');
    const userId = c.get('userId');

    try {
      const claim = await service.submitClaim(id, userId);
      return c.json(claim);
    } catch (error: any) {
      return c.json({ error: error.message }, 400);
    }
  }
);

// Start investigation
claimRoutes.post(
  '/:id/investigate',
  zValidator('param', idParamSchema),
  async (c) => {
    const prisma = c.get('prisma');
    const service = new ClaimsService(prisma);
    const { id } = c.req.valid('param');
    const userId = c.get('userId');

    try {
      const claim = await service.startInvestigation(id, userId);
      return c.json(claim);
    } catch (error: any) {
      return c.json({ error: error.message }, 400);
    }
  }
);

// Approve claim
claimRoutes.post(
  '/:id/approve',
  zValidator('param', idParamSchema),
  zValidator('json', z.object({
    notes: z.string().optional(),
  })),
  async (c) => {
    const prisma = c.get('prisma');
    const service = new ClaimsService(prisma);
    const { id } = c.req.valid('param');
    const { notes } = c.req.valid('json');
    const userId = c.get('userId');

    try {
      const claim = await service.approveClaim(id, notes, userId);
      return c.json(claim);
    } catch (error: any) {
      return c.json({ error: error.message }, 400);
    }
  }
);

// Deny claim
claimRoutes.post(
  '/:id/deny',
  zValidator('param', idParamSchema),
  zValidator('json', z.object({
    reason: z.string(),
  })),
  async (c) => {
    const prisma = c.get('prisma');
    const service = new ClaimsService(prisma);
    const { id } = c.req.valid('param');
    const { reason } = c.req.valid('json');
    const userId = c.get('userId');

    try {
      const claim = await service.denyClaim(id, reason, userId);
      return c.json(claim);
    } catch (error: any) {
      return c.json({ error: error.message }, 400);
    }
  }
);

// Settle claim
claimRoutes.post(
  '/:id/settle',
  zValidator('param', idParamSchema),
  zValidator('json', z.object({
    amount: z.number(),
    currency: z.string().optional(),
    notes: z.string().optional(),
  })),
  async (c) => {
    const prisma = c.get('prisma');
    const service = new ClaimsService(prisma);
    const { id } = c.req.valid('param');
    const settlement = c.req.valid('json');
    const userId = c.get('userId');

    try {
      const claim = await service.settleClaim(id, settlement, userId);
      return c.json(claim);
    } catch (error: any) {
      return c.json({ error: error.message }, 400);
    }
  }
);

// Close claim
claimRoutes.post(
  '/:id/close',
  zValidator('param', idParamSchema),
  zValidator('json', z.object({
    notes: z.string().optional(),
  })),
  async (c) => {
    const prisma = c.get('prisma');
    const service = new ClaimsService(prisma);
    const { id } = c.req.valid('param');
    const { notes } = c.req.valid('json');
    const userId = c.get('userId');

    try {
      const claim = await service.closeClaim(id, notes, userId);
      return c.json(claim);
    } catch (error: any) {
      return c.json({ error: error.message }, 400);
    }
  }
);

// Reopen claim
claimRoutes.post(
  '/:id/reopen',
  zValidator('param', idParamSchema),
  zValidator('json', z.object({
    reason: z.string(),
  })),
  async (c) => {
    const prisma = c.get('prisma');
    const service = new ClaimsService(prisma);
    const { id } = c.req.valid('param');
    const { reason } = c.req.valid('json');
    const userId = c.get('userId');

    try {
      const claim = await service.reopenClaim(id, reason, userId);
      return c.json(claim);
    } catch (error: any) {
      return c.json({ error: error.message }, 400);
    }
  }
);

// ===========================================================================
// Reserve Management
// ===========================================================================

// Update reserve
claimRoutes.post(
  '/:id/reserve',
  zValidator('param', idParamSchema),
  zValidator('json', z.object({
    indemnityReserve: z.number(),
    expenseReserve: z.number(),
    reason: z.string(),
  })),
  async (c) => {
    const prisma = c.get('prisma');
    const service = new ClaimsService(prisma);
    const { id } = c.req.valid('param');
    const reserve = c.req.valid('json');
    const userId = c.get('userId');

    try {
      const claim = await service.updateReserve(id, reserve, userId);
      return c.json(claim);
    } catch (error: any) {
      return c.json({ error: error.message }, 400);
    }
  }
);

// ===========================================================================
// Payments
// ===========================================================================

// Add payment
claimRoutes.post(
  '/:id/payments',
  zValidator('param', idParamSchema),
  zValidator('json', z.object({
    paymentType: z.string(),
    amount: z.number(),
    currency: z.string().optional(),
    payee: z.string(),
    payeeReference: z.string().optional(),
    description: z.string().optional(),
    paymentDate: z.string().transform((s) => new Date(s)),
    paymentMethod: z.string().optional(),
    reference: z.string().optional(),
  })),
  async (c) => {
    const prisma = c.get('prisma');
    const service = new ClaimsService(prisma);
    const { id } = c.req.valid('param');
    const payment = c.req.valid('json');
    const userId = c.get('userId');

    try {
      const pmt = await service.addPayment(id, payment, userId);
      return c.json(pmt, 201);
    } catch (error: any) {
      return c.json({ error: error.message }, 400);
    }
  }
);

// ===========================================================================
// Notes & Activity
// ===========================================================================

// Add note
claimRoutes.post(
  '/:id/notes',
  zValidator('param', idParamSchema),
  zValidator('json', z.object({
    note: z.string(),
    isInternal: z.boolean().optional(),
  })),
  async (c) => {
    const prisma = c.get('prisma');
    const service = new ClaimsService(prisma);
    const { id } = c.req.valid('param');
    const { note, isInternal } = c.req.valid('json');
    const userId = c.get('userId');

    try {
      const activity = await service.addNote(id, note, userId, isInternal ?? true);
      return c.json(activity, 201);
    } catch (error: any) {
      return c.json({ error: error.message }, 400);
    }
  }
);

// ===========================================================================
// Documents
// ===========================================================================

// Add document
claimRoutes.post(
  '/:id/documents',
  zValidator('param', idParamSchema),
  zValidator('json', z.object({
    name: z.string(),
    type: z.string(),
    storageKey: z.string(),
    fileSize: z.number().optional(),
    mimeType: z.string().optional(),
  })),
  async (c) => {
    const prisma = c.get('prisma');
    const service = new ClaimsService(prisma);
    const { id } = c.req.valid('param');
    const document = c.req.valid('json');
    const userId = c.get('userId');

    try {
      const doc = await service.addClaimDocument(id, document, userId);
      return c.json(doc, 201);
    } catch (error: any) {
      return c.json({ error: error.message }, 400);
    }
  }
);

// ===========================================================================
// Claimants
// ===========================================================================

// Add claimant
claimRoutes.post(
  '/:id/claimants',
  zValidator('param', idParamSchema),
  zValidator('json', z.object({
    claimantType: z.string(),
    name: z.string(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    companyName: z.string().optional(),
    solicitorName: z.string().optional(),
    solicitorReference: z.string().optional(),
  })),
  async (c) => {
    const prisma = c.get('prisma');
    const service = new ClaimsService(prisma);
    const { id } = c.req.valid('param');
    const claimant = c.req.valid('json');

    try {
      const result = await service.addClaimant(id, claimant);
      return c.json(result, 201);
    } catch (error: any) {
      return c.json({ error: error.message }, 400);
    }
  }
);

// ===========================================================================
// Claim Queries
// ===========================================================================

// Get claims by policy
claimRoutes.get(
  '/policy/:policyId',
  zValidator('param', z.object({ policyId: z.string().uuid() })),
  async (c) => {
    const prisma = c.get('prisma');
    const service = new ClaimsService(prisma);
    const { policyId } = c.req.valid('param');

    const claims = await service.getClaimsByPolicy(policyId);
    return c.json(claims);
  }
);

// Get claims by entity
claimRoutes.get(
  '/entity/:entityId',
  zValidator('param', z.object({ entityId: z.string().uuid() })),
  zValidator('query', tenantQuerySchema),
  async (c) => {
    const prisma = c.get('prisma');
    const service = new ClaimsService(prisma);
    const { entityId } = c.req.valid('param');
    const { tenantId } = c.req.valid('query');

    const claims = await service.getClaimsByEntity(tenantId, entityId);
    return c.json(claims);
  }
);

// Get open claims
claimRoutes.get(
  '/open',
  zValidator('query', tenantQuerySchema),
  async (c) => {
    const prisma = c.get('prisma');
    const service = new ClaimsService(prisma);
    const { tenantId } = c.req.valid('query');

    const claims = await service.getOpenClaims(tenantId);
    return c.json(claims);
  }
);

// Get claims needing review
claimRoutes.get(
  '/needs-review',
  zValidator('query', tenantQuerySchema.extend({
    daysThreshold: z.string().transform(Number).optional(),
  })),
  async (c) => {
    const prisma = c.get('prisma');
    const service = new ClaimsService(prisma);
    const { tenantId, daysThreshold } = c.req.valid('query');

    const claims = await service.getClaimsNeedingReview(tenantId, daysThreshold || 30);
    return c.json(claims);
  }
);

// Get claims by handler
claimRoutes.get(
  '/handler/:handlerId',
  zValidator('param', z.object({ handlerId: z.string().uuid() })),
  zValidator('query', tenantQuerySchema),
  async (c) => {
    const prisma = c.get('prisma');
    const service = new ClaimsService(prisma);
    const { handlerId } = c.req.valid('param');
    const { tenantId } = c.req.valid('query');

    const claims = await service.getClaimsByHandler(tenantId, handlerId);
    return c.json(claims);
  }
);

// ===========================================================================
// Dashboard
// ===========================================================================

// Get dashboard metrics
claimRoutes.get(
  '/dashboard/metrics',
  zValidator('query', tenantQuerySchema),
  async (c) => {
    const prisma = c.get('prisma');
    const service = new ClaimsService(prisma);
    const { tenantId } = c.req.valid('query');

    const metrics = await service.getDashboardMetrics(tenantId);
    return c.json(metrics);
  }
);

export { claimRoutes };
