/**
 * Routes Index - Aggregates all route modules
 */

import { Hono } from 'hono';
import { PrismaClient } from '@prisma/client';
import { createConsentRouter } from './consent.routes.js';
import { createDSARRouter } from './dsar.routes.js';
import { createBreachRouter } from './breach.routes.js';
import { dpiaRoutes } from './dpia.routes.js';
import { processorRoutes } from './processor.routes.js';
import { transferRoutes } from './transfer.routes.js';
import { activityRoutes } from './activity.routes.js';
import { metricsRoutes } from './metrics.routes.js';

// Import repositories
import { PrismaDPIARepository } from '../infrastructure/persistence/prisma-dpia.repository.js';
import { PrismaActivityRepository } from '../infrastructure/persistence/prisma-activity.repository.js';
import { PrismaProcessorRepository } from '../infrastructure/persistence/prisma-processor.repository.js';
import { PrismaTransferRepository } from '../infrastructure/persistence/prisma-transfer.repository.js';

// Import services
import { DPIAService } from '../domain/privacy-impact/services/dpia.service.js';
import { ActivityService } from '../domain/data-inventory/services/activity.service.js';
import { ProcessorService } from '../domain/vendor-privacy/services/processor.service.js';
import { TransferService } from '../domain/cross-border-transfer/services/transfer.service.js';
import { MetricsService, createPrismaProviders } from '../domain/privacy-program/services/metrics.service.js';

export function createRoutes(prisma: PrismaClient) {
  const api = new Hono();

  // Initialize repositories
  const dpiaRepository = new PrismaDPIARepository(prisma);
  const activityRepository = new PrismaActivityRepository(prisma);
  const processorRepository = new PrismaProcessorRepository(prisma);
  const transferRepository = new PrismaTransferRepository(prisma);

  // Initialize services
  const dpiaService = new DPIAService(dpiaRepository);
  const activityService = new ActivityService(activityRepository);
  const processorService = new ProcessorService(processorRepository);
  const transferService = new TransferService(transferRepository);
  const metricsService = new MetricsService(createPrismaProviders(prisma));

  // Inject services into context for new routes
  api.use('*', async (c, next) => {
    c.set('dpiaService', dpiaService);
    c.set('activityService', activityService);
    c.set('processorService', processorService);
    c.set('transferService', transferService);
    c.set('metricsService', metricsService);
    await next();
  });

  // Privacy domains
  api.route('/consent', createConsentRouter(prisma));
  api.route('/dsar', createDSARRouter(prisma));
  api.route('/breach', createBreachRouter(prisma));

  // Additional privacy domains
  api.route('/dpia', dpiaRoutes);
  api.route('/processors', processorRoutes);
  api.route('/transfers', transferRoutes);
  api.route('/activities', activityRoutes);
  api.route('/metrics', metricsRoutes);

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
