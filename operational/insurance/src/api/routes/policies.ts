/**
 * Policy API Routes
 *
 * REST endpoints for insurance policy management.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { PolicyService } from '../../application/services/policy-service.js';
import { CreatePolicyInputSchema, UpdatePolicyInputSchema } from '../../domain/policy/models/policy.js';

const policyRoutes = new Hono();

// Shared schema for ID params
const idParamSchema = z.object({
  id: z.string().uuid(),
});

const tenantQuerySchema = z.object({
  tenantId: z.string().uuid(),
});

// ===========================================================================
// Policy CRUD
// ===========================================================================

// Create policy
policyRoutes.post(
  '/',
  zValidator('json', CreatePolicyInputSchema),
  async (c) => {
    const prisma = c.get('prisma');
    const service = new PolicyService(prisma);
    const input = c.req.valid('json');
    const userId = c.get('userId');

    try {
      const policy = await service.createPolicy(input, userId);
      return c.json(policy, 201);
    } catch (error: any) {
      return c.json({ error: error.message }, 400);
    }
  }
);

// Get policy by ID
policyRoutes.get(
  '/:id',
  zValidator('param', idParamSchema),
  async (c) => {
    const prisma = c.get('prisma');
    const service = new PolicyService(prisma);
    const { id } = c.req.valid('param');

    const policy = await service.getPolicy(id);
    if (!policy) {
      return c.json({ error: 'Policy not found' }, 404);
    }

    return c.json(policy);
  }
);

// Update policy
policyRoutes.patch(
  '/:id',
  zValidator('param', idParamSchema),
  zValidator('json', UpdatePolicyInputSchema),
  async (c) => {
    const prisma = c.get('prisma');
    const service = new PolicyService(prisma);
    const { id } = c.req.valid('param');
    const input = c.req.valid('json');
    const userId = c.get('userId');

    try {
      const policy = await service.updatePolicy(id, input, userId);
      return c.json(policy);
    } catch (error: any) {
      return c.json({ error: error.message }, 400);
    }
  }
);

// Delete policy (soft delete)
policyRoutes.delete(
  '/:id',
  zValidator('param', idParamSchema),
  async (c) => {
    const prisma = c.get('prisma');
    const service = new PolicyService(prisma);
    const { id } = c.req.valid('param');
    const userId = c.get('userId');

    try {
      await service.deletePolicy(id, userId);
      return c.json({ success: true });
    } catch (error: any) {
      return c.json({ error: error.message }, 400);
    }
  }
);

// ===========================================================================
// Policy Status Transitions
// ===========================================================================

// Quote policy
policyRoutes.post(
  '/:id/quote',
  zValidator('param', idParamSchema),
  zValidator('json', z.object({
    grossPremium: z.object({ amount: z.number(), currency: z.string() }),
    ipt: z.object({ amount: z.number(), currency: z.string() }),
    brokerFee: z.object({ amount: z.number(), currency: z.string() }).optional(),
    netPremium: z.object({ amount: z.number(), currency: z.string() }),
    paymentFrequency: z.string(),
  })),
  async (c) => {
    const prisma = c.get('prisma');
    const service = new PolicyService(prisma);
    const { id } = c.req.valid('param');
    const premium = c.req.valid('json');
    const userId = c.get('userId');

    try {
      const policy = await service.quotePolicy(id, premium, userId);
      return c.json(policy);
    } catch (error: any) {
      return c.json({ error: error.message }, 400);
    }
  }
);

// Bind policy
policyRoutes.post(
  '/:id/bind',
  zValidator('param', idParamSchema),
  async (c) => {
    const prisma = c.get('prisma');
    const service = new PolicyService(prisma);
    const { id } = c.req.valid('param');
    const userId = c.get('userId');

    try {
      const policy = await service.bindPolicy(id, userId);
      return c.json(policy);
    } catch (error: any) {
      return c.json({ error: error.message }, 400);
    }
  }
);

// Activate policy
policyRoutes.post(
  '/:id/activate',
  zValidator('param', idParamSchema),
  async (c) => {
    const prisma = c.get('prisma');
    const service = new PolicyService(prisma);
    const { id } = c.req.valid('param');
    const userId = c.get('userId');

    try {
      const policy = await service.activatePolicy(id, userId);
      return c.json(policy);
    } catch (error: any) {
      return c.json({ error: error.message }, 400);
    }
  }
);

// Cancel policy
policyRoutes.post(
  '/:id/cancel',
  zValidator('param', idParamSchema),
  zValidator('json', z.object({
    reason: z.string().optional(),
  })),
  async (c) => {
    const prisma = c.get('prisma');
    const service = new PolicyService(prisma);
    const { id } = c.req.valid('param');
    const { reason } = c.req.valid('json');
    const userId = c.get('userId');

    try {
      const policy = await service.cancelPolicy(id, reason, userId);
      return c.json(policy);
    } catch (error: any) {
      return c.json({ error: error.message }, 400);
    }
  }
);

// Renew policy
policyRoutes.post(
  '/:id/renew',
  zValidator('param', idParamSchema),
  zValidator('json', z.object({
    newExpiryDate: z.string().transform((s) => new Date(s)),
  })),
  async (c) => {
    const prisma = c.get('prisma');
    const service = new PolicyService(prisma);
    const { id } = c.req.valid('param');
    const { newExpiryDate } = c.req.valid('json');
    const userId = c.get('userId');

    try {
      const policy = await service.renewPolicy(id, newExpiryDate, userId);
      return c.json(policy, 201);
    } catch (error: any) {
      return c.json({ error: error.message }, 400);
    }
  }
);

// ===========================================================================
// Policy Queries
// ===========================================================================

// Get policies by entity
policyRoutes.get(
  '/entity/:entityId',
  zValidator('param', z.object({ entityId: z.string().uuid() })),
  zValidator('query', tenantQuerySchema),
  async (c) => {
    const prisma = c.get('prisma');
    const service = new PolicyService(prisma);
    const { entityId } = c.req.valid('param');
    const { tenantId } = c.req.valid('query');

    const policies = await service.getPoliciesByEntity(tenantId, entityId);
    return c.json(policies);
  }
);

// Get active policies
policyRoutes.get(
  '/active',
  zValidator('query', tenantQuerySchema),
  async (c) => {
    const prisma = c.get('prisma');
    const service = new PolicyService(prisma);
    const { tenantId } = c.req.valid('query');

    const policies = await service.getActivePolicies(tenantId);
    return c.json(policies);
  }
);

// Get expiring policies
policyRoutes.get(
  '/expiring',
  zValidator('query', tenantQuerySchema.extend({
    daysAhead: z.string().transform(Number).optional(),
  })),
  async (c) => {
    const prisma = c.get('prisma');
    const service = new PolicyService(prisma);
    const { tenantId, daysAhead } = c.req.valid('query');

    const policies = await service.getExpiringPolicies(tenantId, daysAhead || 60);
    return c.json(policies);
  }
);

// Get policies by type
policyRoutes.get(
  '/type/:policyType',
  zValidator('param', z.object({ policyType: z.string() })),
  zValidator('query', tenantQuerySchema),
  async (c) => {
    const prisma = c.get('prisma');
    const service = new PolicyService(prisma);
    const { policyType } = c.req.valid('param');
    const { tenantId } = c.req.valid('query');

    const policies = await service.getPoliciesByType(tenantId, policyType);
    return c.json(policies);
  }
);

// ===========================================================================
// Premium Management
// ===========================================================================

// Record premium payment
policyRoutes.post(
  '/:id/premium/payment',
  zValidator('param', idParamSchema),
  zValidator('json', z.object({
    amount: z.number(),
    reference: z.string(),
  })),
  async (c) => {
    const prisma = c.get('prisma');
    const service = new PolicyService(prisma);
    const { id } = c.req.valid('param');
    const { amount, reference } = c.req.valid('json');
    const userId = c.get('userId');

    try {
      const policy = await service.recordPremiumPayment(id, amount, reference, userId);
      return c.json(policy);
    } catch (error: any) {
      return c.json({ error: error.message }, 400);
    }
  }
);

// ===========================================================================
// Documents & Endorsements
// ===========================================================================

// Add document
policyRoutes.post(
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
    const service = new PolicyService(prisma);
    const { id } = c.req.valid('param');
    const document = c.req.valid('json');
    const userId = c.get('userId');

    try {
      const doc = await service.addPolicyDocument(id, document, userId);
      return c.json(doc, 201);
    } catch (error: any) {
      return c.json({ error: error.message }, 400);
    }
  }
);

// Add endorsement
policyRoutes.post(
  '/:id/endorsements',
  zValidator('param', idParamSchema),
  zValidator('json', z.object({
    number: z.string(),
    effectiveDate: z.string().transform((s) => new Date(s)),
    description: z.string(),
    documentKey: z.string().optional(),
  })),
  async (c) => {
    const prisma = c.get('prisma');
    const service = new PolicyService(prisma);
    const { id } = c.req.valid('param');
    const endorsement = c.req.valid('json');
    const userId = c.get('userId');

    try {
      const end = await service.addEndorsement(id, endorsement, userId);
      return c.json(end, 201);
    } catch (error: any) {
      return c.json({ error: error.message }, 400);
    }
  }
);

// ===========================================================================
// Dashboard
// ===========================================================================

// Get dashboard metrics
policyRoutes.get(
  '/dashboard/metrics',
  zValidator('query', tenantQuerySchema),
  async (c) => {
    const prisma = c.get('prisma');
    const service = new PolicyService(prisma);
    const { tenantId } = c.req.valid('query');

    const metrics = await service.getDashboardMetrics(tenantId);
    return c.json(metrics);
  }
);

// ===========================================================================
// Certificate of Insurance (CoI)
// ===========================================================================

import { getCoiService } from '../../application/services/coi-service.js';
import { createRenewalSchedulerService } from '../../application/services/renewal-scheduler-service.js';

// Generate Certificate of Insurance
policyRoutes.post(
  '/:id/certificate',
  zValidator('param', idParamSchema),
  zValidator('json', z.object({
    insuredName: z.string().min(1).max(255),
    holder: z.object({
      name: z.string().min(1).max(255),
      address: z.string().max(500).optional(),
      relationship: z.string().max(100).optional(),
    }).optional(),
    additionalInsureds: z.array(z.object({
      name: z.string().min(1).max(255),
      relationship: z.string().min(1).max(100),
    })).optional(),
    remarks: z.string().max(1000).optional(),
  })),
  async (c) => {
    const prisma = c.get('prisma');
    const policyService = new PolicyService(prisma);
    const coiService = getCoiService();
    const { id } = c.req.valid('param');
    const input = c.req.valid('json');
    const userId = c.get('userId');

    try {
      const policy = await policyService.getPolicy(id);
      if (!policy) {
        return c.json({ error: 'Policy not found' }, 404);
      }

      if (policy.status !== 'active' && policy.status !== 'bound') {
        return c.json({
          error: 'Certificate can only be generated for active or bound policies',
        }, 400);
      }

      const { certificate, html } = await coiService.generateCertificatePdf(
        policy,
        input.insuredName,
        {
          holder: input.holder,
          additionalInsureds: input.additionalInsureds,
          remarks: input.remarks,
          issuedBy: userId,
        }
      );

      return c.json({
        certificate,
        html, // Can be used by frontend to render or convert to PDF
      }, 201);
    } catch (error: any) {
      return c.json({ error: error.message }, 400);
    }
  }
);

// Get certificate as HTML (for preview/PDF generation)
policyRoutes.get(
  '/:id/certificate/preview',
  zValidator('param', idParamSchema),
  zValidator('query', z.object({
    insuredName: z.string().min(1),
  })),
  async (c) => {
    const prisma = c.get('prisma');
    const policyService = new PolicyService(prisma);
    const coiService = getCoiService();
    const { id } = c.req.valid('param');
    const { insuredName } = c.req.valid('query');

    try {
      const policy = await policyService.getPolicy(id);
      if (!policy) {
        return c.json({ error: 'Policy not found' }, 404);
      }

      const { html } = await coiService.generateCertificatePdf(
        policy,
        insuredName,
        {}
      );

      return c.html(html);
    } catch (error: any) {
      return c.json({ error: error.message }, 400);
    }
  }
);

// ===========================================================================
// Renewal Scheduler
// ===========================================================================

// Run renewal check for a tenant (typically called by scheduler/cron)
policyRoutes.post(
  '/renewals/check',
  zValidator('json', z.object({
    tenantId: z.string().uuid(),
    config: z.object({
      firstReminderDays: z.number().int().positive().optional(),
      secondReminderDays: z.number().int().positive().optional(),
      thirdReminderDays: z.number().int().positive().optional(),
      urgentReminderDays: z.number().int().positive().optional(),
      autoRenewEnabled: z.boolean().optional(),
      autoRenewDays: z.number().int().positive().optional(),
    }).optional(),
  })),
  async (c) => {
    const prisma = c.get('prisma');
    const policyService = new PolicyService(prisma);
    const { tenantId, config } = c.req.valid('json');

    const renewalService = createRenewalSchedulerService(policyService, config);

    try {
      const result = await renewalService.runRenewalCheck(tenantId);
      return c.json(result);
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  }
);

// Get policies due for renewal
policyRoutes.get(
  '/renewals/due',
  zValidator('query', tenantQuerySchema.extend({
    daysAhead: z.string().transform(Number).optional(),
  })),
  async (c) => {
    const prisma = c.get('prisma');
    const policyService = new PolicyService(prisma);
    const { tenantId, daysAhead } = c.req.valid('query');

    const renewalService = createRenewalSchedulerService(policyService);
    const policies = await renewalService.getPoliciesDueForRenewal(tenantId, daysAhead || 60);

    return c.json(policies);
  }
);

// Send manual renewal reminder
policyRoutes.post(
  '/:id/renewals/remind',
  zValidator('param', idParamSchema),
  async (c) => {
    const prisma = c.get('prisma');
    const policyService = new PolicyService(prisma);
    const { id } = c.req.valid('param');

    const renewalService = createRenewalSchedulerService(policyService);

    try {
      const reminder = await renewalService.sendRenewalReminder(id);
      if (!reminder) {
        return c.json({ error: 'Policy not found' }, 404);
      }
      return c.json(reminder);
    } catch (error: any) {
      return c.json({ error: error.message }, 400);
    }
  }
);

// Trigger manual renewal
policyRoutes.post(
  '/:id/renewals/trigger',
  zValidator('param', idParamSchema),
  zValidator('json', z.object({
    newExpiryDate: z.string().transform((s) => new Date(s)).optional(),
  })),
  async (c) => {
    const prisma = c.get('prisma');
    const policyService = new PolicyService(prisma);
    const { id } = c.req.valid('param');
    const { newExpiryDate } = c.req.valid('json');
    const userId = c.get('userId');

    const renewalService = createRenewalSchedulerService(policyService);

    try {
      const result = await renewalService.triggerManualRenewal(id, newExpiryDate, userId);
      if (result.status === 'failed') {
        return c.json({ error: result.message }, 400);
      }
      return c.json(result, 201);
    } catch (error: any) {
      return c.json({ error: error.message }, 400);
    }
  }
);

export { policyRoutes };
