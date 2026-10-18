/**
 * Contract Lifecycle Routes
 *
 * API endpoints for contract state transitions, renewals, and lifecycle management
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  TransitionRequestSchema,
  RenewalRequestSchema,
  ExpirationQuerySchema,
  BulkRenewalRequestSchema,
  createLifecycleRepository,
  createContractLifecycleService,
} from '../domain/contract-lifecycle/index.js';
import { prisma } from '../lib/prisma.js';

const lifecycle = new Hono();

// Initialize service
const repository = createLifecycleRepository(prisma);
const lifecycleService = createContractLifecycleService(repository);

// Get contract health status
lifecycle.get(
  '/contracts/:id/health',
  async (c) => {
    const contractId = c.req.param('id');
    const health = await lifecycleService.getContractHealth(contractId);
    return c.json({ data: health });
  }
);

// Get allowed actions for a contract
lifecycle.get(
  '/contracts/:id/actions',
  async (c) => {
    const contractId = c.req.param('id');
    const actions = await lifecycleService.getAllowedActions(contractId);
    return c.json({ data: { contractId, allowedActions: actions } });
  }
);

// Get contract activity history
lifecycle.get(
  '/contracts/:id/history',
  zValidator(
    'query',
    z.object({
      limit: z.coerce.number().int().positive().max(100).default(50),
    })
  ),
  async (c) => {
    const contractId = c.req.param('id');
    const { limit } = c.req.valid('query');
    const history = await lifecycleService.getActivityHistory(contractId, limit);
    return c.json({ data: history });
  }
);

// Perform lifecycle transition
lifecycle.post(
  '/contracts/:id/transition',
  zValidator(
    'json',
    TransitionRequestSchema.omit({ contractId: true })
  ),
  async (c) => {
    const contractId = c.req.param('id');
    const body = c.req.valid('json');
    const userId = c.get('user')?.id ?? 'system';

    const result = await lifecycleService.transition(
      { ...body, contractId },
      userId
    );

    return c.json({
      data: {
        contract: result.contract,
        transition: {
          from: result.previousStatus,
          to: result.newStatus,
          action: result.event.action,
        },
      },
    }, 200);
  }
);

// Renew a contract
lifecycle.post(
  '/contracts/:id/renew',
  zValidator(
    'json',
    RenewalRequestSchema.omit({ contractId: true })
  ),
  async (c) => {
    const contractId = c.req.param('id');
    const body = c.req.valid('json');
    const userId = c.get('user')?.id ?? 'system';

    const contract = await lifecycleService.renew(
      { ...body, contractId },
      userId
    );

    return c.json({ data: contract });
  }
);

// Bulk renew contracts
lifecycle.post(
  '/contracts/bulk-renew',
  zValidator('json', BulkRenewalRequestSchema),
  async (c) => {
    const body = c.req.valid('json');
    const userId = c.get('user')?.id ?? 'system';

    const result = await lifecycleService.bulkRenew(body, userId);

    return c.json({ data: result });
  }
);

// Get expiring contracts
lifecycle.get(
  '/contracts/expiring',
  zValidator('query', ExpirationQuerySchema),
  async (c) => {
    const query = c.req.valid('query');
    const contracts = await lifecycleService.getExpiringContracts(query);

    return c.json({
      data: contracts,
      meta: {
        count: contracts.length,
        daysAhead: query.daysAhead,
      },
    });
  }
);

// Get contracts due for renewal
lifecycle.get(
  '/contracts/renewal-due',
  zValidator(
    'query',
    z.object({
      daysAhead: z.coerce.number().int().positive().max(90).default(30),
    })
  ),
  async (c) => {
    const { daysAhead } = c.req.valid('query');
    const contracts = await lifecycleService.getContractsForRenewal(daysAhead);

    return c.json({
      data: contracts,
      meta: {
        count: contracts.length,
        daysAhead,
      },
    });
  }
);

// Get status summary (counts by status)
lifecycle.get('/summary', async (c) => {
  const summary = await lifecycleService.getStatusSummary();
  return c.json({ data: summary });
});

// Process expired contracts (mark as EXPIRED)
lifecycle.post('/process-expired', async (c) => {
  const userId = c.get('user')?.id ?? 'system';
  const count = await lifecycleService.processExpiredContracts(userId);

  return c.json({
    data: {
      processedCount: count,
      message: `Marked ${count} contract(s) as expired`,
    },
  });
});

// Auto-renew eligible contracts
lifecycle.post('/auto-renew', async (c) => {
  const userId = c.get('user')?.id ?? 'system';
  const result = await lifecycleService.autoRenewEligible(userId);

  return c.json({
    data: result,
  });
});

export { lifecycle as lifecycleRoutes };
