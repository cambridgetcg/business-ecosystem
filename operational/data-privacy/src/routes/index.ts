/**
 * Routes Index - Aggregates all route modules
 */

import { Hono } from 'hono';
import { PrismaClient } from '#prisma';
import { createConsentRouter } from './consent.routes.js';
import { createDSARRouter } from './dsar.routes.js';
import { createBreachRouter } from './breach.routes.js';

export function createRoutes(prisma: PrismaClient) {
  const api = new Hono();

  // Privacy domains
  api.route('/consent', createConsentRouter(prisma));
  api.route('/dsar', createDSARRouter(prisma));
  api.route('/breach', createBreachRouter(prisma));

  // Compliance status endpoint (for gateway aggregation)
  api.get('/compliance-status/:entityId', async (c) => {
    const entityId = c.req.param('entityId');

    // Check for any pending DSARs nearing deadline
    const pendingDsars = await prisma.dSARRequest.count({
      where: {
        entityId,
        status: { notIn: ['COMPLETED', 'REJECTED', 'CLOSED'] },
        deadline: { lt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }, // within 7 days
      },
    });

    // Check for any unresolved breaches
    const unresolvedBreaches = await prisma.dataBreach.count({
      where: {
        entityId,
        status: { notIn: ['RESOLVED', 'CLOSED'] },
      },
    });

    // Check for pending authority notifications
    const pendingNotifications = await prisma.dataBreach.count({
      where: {
        entityId,
        authorityNotificationRequired: true,
        authorityNotifiedAt: null,
      },
    });

    // Determine overall compliance status
    let status: 'compliant' | 'at_risk' | 'non_compliant' = 'compliant';
    const issues: string[] = [];

    if (pendingNotifications > 0) {
      status = 'non_compliant';
      issues.push(`${pendingNotifications} breach(es) pending authority notification`);
    }

    if (unresolvedBreaches > 0) {
      if (status === 'compliant') status = 'at_risk';
      issues.push(`${unresolvedBreaches} unresolved breach(es)`);
    }

    if (pendingDsars > 0) {
      if (status === 'compliant') status = 'at_risk';
      issues.push(`${pendingDsars} DSAR(s) due within 7 days`);
    }

    return c.json({
      entityId,
      domain: 'data-privacy',
      status,
      issues,
      metrics: {
        pendingDsars,
        unresolvedBreaches,
        pendingNotifications,
      },
      checkedAt: new Date().toISOString(),
    });
  });

  return api;
}
